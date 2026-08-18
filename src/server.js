import dotenv from 'dotenv';

import app from './app.js'
import prisma from './config/db.js'
import { checkTimeAlerts } from './services/notifications.service.js'
import { getMonthlyReportData } from './services/report.service.js'
import { buildMonthlyReportPdf } from './utils/buildReportPdf.js'
import { sendMonthlyReportEmail, sendQuoteReminderEmail, sendPaymentReminderEmail } from './services/email.service.js'

dotenv.config({ override: true })

const PORT = process.env.PORT || 3000

// Guarda el último mes en que se enviaron los reportes para evitar duplicados
let lastReportMonth = null

async function runTimeAlerts() {
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    await Promise.all(orgs.map(o => checkTimeAlerts(o.id)))
  } catch (err) {
    console.error('[cron] Error en alertas:', err.message)
  }
}

async function runMonthlyReports() {
  const now      = new Date()
  const hour     = now.getHours()
  const day      = now.getDate()
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`

  // Solo el último día del mes, entre las 8 y las 9 AM, y si aún no se envió este mes
  if (day !== lastDay || hour !== 8 || lastReportMonth === monthKey) return

  lastReportMonth = monthKey
  console.log(`[cron] Enviando informes mensuales (${monthKey})`)

  // El reporte cubre el mes actual (ya que se envía el último día)
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    for (const org of orgs) {
      try {
        const data      = await getMonthlyReportData(org.id, year, month)
        if (!data.org?.owner?.email) continue
        const pdfBuffer = await buildMonthlyReportPdf(data, year, month)
        await sendMonthlyReportEmail({
          to:        data.org.owner.email,
          ownerName: data.org.owner.name,
          orgName:   data.org.name,
          year, month, pdfBuffer
        })
        console.log(`[cron] Informe enviado → ${data.org.owner.email} (${data.org.name})`)
      } catch (err) {
        console.error(`[cron] Error en org ${org.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron] Error general en informes:', err.message)
  }
}

async function runQuoteReminders() {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

    const quotes = await prisma.quote.findMany({
      where: {
        status:          'sent',
        sentByEmail:     true,
        reminderSentAt:  null,
        sentAt:          { lte: twoDaysAgo },
        validUntil:      { gte: new Date() },
      },
      select: {
        id: true, number: true, title: true, total: true, currency: true,
        potentialClientEmail: true, potentialClientName: true,
        client: { select: { email: true, name: true } },
        organization: { select: { name: true, logo: true } },
      }
    })

    for (const q of quotes) {
      const to   = q.client?.email || q.potentialClientEmail
      const name = q.client?.name  || q.potentialClientName || 'Cliente'
      if (!to) continue

      try {
        await sendQuoteReminderEmail({
          to, clientName: name,
          orgName:    q.organization.name,
          orgLogo:    q.organization.logo,
          quoteId:    q.id,
          quoteNumber: q.number,
          quoteTitle:  q.title,
          total:       q.total,
          currency:    q.currency,
        })
        await prisma.quote.update({
          where: { id: q.id },
          data:  { reminderSentAt: new Date() },
        })
        console.log(`[cron] Recordatorio enviado → ${to} (presupuesto #${q.number})`)
      } catch (err) {
        console.error(`[cron] Error recordatorio presupuesto ${q.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron] Error en recordatorios de presupuestos:', err.message)
  }
}

async function runPaymentReminders() {
  try {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setUTCHours(23, 59, 59, 999)

    const installments = await prisma.installment.findMany({
      where: {
        status:         'pending',
        reminderSentAt: null,
        dueDate:        { gte: todayStart, lte: todayEnd },
        quoteId:        { not: null },
        quote: {
          status: { in: ['signed', 'approved'] },
        },
      },
      include: {
        quote: {
          select: {
            id: true, number: true, title: true, currency: true,
            potentialClientEmail: true, potentialClientName: true,
            client: { select: { email: true, name: true } },
            organization: { select: { name: true, logo: true } },
            installments: { select: { id: true } },
          }
        }
      }
    })

    for (const inst of installments) {
      const q    = inst.quote
      const to   = q.client?.email || q.potentialClientEmail
      const name = q.client?.name  || q.potentialClientName || 'Cliente'
      if (!to) continue

      try {
        await sendPaymentReminderEmail({
          to, clientName: name,
          orgName:            q.organization.name,
          orgLogo:            q.organization.logo,
          quoteId:            q.id,
          quoteNumber:        q.number,
          quoteTitle:         q.title,
          installmentNumber:  inst.number,
          installmentTotal:   q.installments.length,
          amount:             inst.amount,
          currency:           q.currency,
        })
        await prisma.installment.update({
          where: { id: inst.id },
          data:  { reminderSentAt: new Date() },
        })
        console.log(`[cron] Recordatorio de pago → ${to} | Cuota ${inst.number} | Presupuesto #${q.number}`)
      } catch (err) {
        console.error(`[cron] Error recordatorio pago cuota ${inst.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron] Error en recordatorios de pago:', err.message)
  }
}

prisma.$connect()
  .then(() => {
    console.log('PostgreSQL conectado')
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`)
      runTimeAlerts()
      runQuoteReminders()
      runPaymentReminders()
      setInterval(runTimeAlerts,      6  * 60 * 60 * 1000) // cada 6 horas
      setInterval(runMonthlyReports,       60 * 60 * 1000) // cada hora
      setInterval(runQuoteReminders,  12  * 60 * 60 * 1000) // cada 12 horas
      setInterval(runPaymentReminders,     60 * 60 * 1000) // cada hora
    })
  })
  .catch((error) => {
    console.error('Error de conexión:', error.message)
    process.exit(1)
  })
