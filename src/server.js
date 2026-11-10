import dotenv from 'dotenv';

import app from './app.js'
import prisma from './config/db.js'
import { checkTimeAlerts } from './services/notifications.service.js'
import { getMonthlyReportData } from './services/report.service.js'
import { buildMonthlyReportPdf } from './utils/buildReportPdf.js'
import { sendMonthlyReportEmail, sendQuoteReminderEmail, sendPaymentReminderEmail, sendQuoteExpiredEmail } from './services/email.service.js'
import { runDatabaseBackup } from './services/backup.service.js'
import { syncAllMemberships, sendMembershipReminders } from './services/memberships.service.js'

dotenv.config({ override: true })

const PORT = process.env.PORT || 3000

// Guarda el último mes/día en que corrieron los jobs para evitar duplicados
let lastReportMonth = null
let lastBackupDate  = null

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

async function scheduleDatabaseBackup() {
  const now     = new Date()
  const hour    = now.getHours()
  const dateKey = now.toISOString().slice(0, 10)

  if (hour !== 3 || lastBackupDate === dateKey) return

  lastBackupDate = dateKey
  await runDatabaseBackup()
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
        const { count } = await prisma.quote.updateMany({
          where: { id: q.id, reminderSentAt: null },
          data:  { reminderSentAt: new Date() },
        })
        if (count === 0) continue
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

    // Presupuestos sin cuotas con paymentDueDate hoy
    const singlePaymentQuotes = await prisma.quote.findMany({
      where: {
        status:           { in: ['signed', 'approved'] },
        paymentDueDate:   { gte: todayStart, lte: todayEnd },
        paymentReminderSentAt: null,
        installments:     { none: {} },
      },
      select: {
        id: true, number: true, title: true, total: true, currency: true,
        potentialClientEmail: true, potentialClientName: true,
        client: { select: { email: true, name: true } },
        organization: { select: { name: true, logo: true } },
      }
    })

    for (const q of singlePaymentQuotes) {
      const to   = q.client?.email || q.potentialClientEmail
      const name = q.client?.name  || q.potentialClientName || 'Cliente'
      if (!to) continue

      try {
        const { count } = await prisma.quote.updateMany({
          where: { id: q.id, paymentReminderSentAt: null },
          data:  { paymentReminderSentAt: new Date() },
        })
        if (count === 0) continue
        await sendPaymentReminderEmail({
          to, clientName: name,
          orgName:           q.organization.name,
          orgLogo:           q.organization.logo,
          quoteId:           q.id,
          quoteNumber:       q.number,
          quoteTitle:        q.title,
          installmentNumber: 1,
          installmentTotal:  1,
          amount:            q.total,
          currency:          q.currency,
        })
        console.log(`[cron] Recordatorio de pago único → ${to} | Presupuesto #${q.number}`)
      } catch (err) {
        console.error(`[cron] Error recordatorio pago único ${q.id}:`, err.message)
      }
    }

    // Presupuestos con cuotas
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
        const { count } = await prisma.installment.updateMany({
          where: { id: inst.id, reminderSentAt: null },
          data:  { reminderSentAt: new Date() },
        })
        if (count === 0) continue
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
        console.log(`[cron] Recordatorio de pago → ${to} | Cuota ${inst.number} | Presupuesto #${q.number}`)
      } catch (err) {
        console.error(`[cron] Error recordatorio pago cuota ${inst.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron] Error en recordatorios de pago:', err.message)
  }
}

// Pasa a "Vencido" los presupuestos enviados cuya fecha de validez ya pasó (hora Argentina)
// y avisa al cliente por email para que pueda pedir uno actualizado.
// Vencen el día siguiente a validUntil; los borradores no se tocan.
async function runQuoteExpiration() {
  try {
    const arg      = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const todayArg = new Date(Date.UTC(arg.getUTCFullYear(), arg.getUTCMonth(), arg.getUTCDate(), 0, 0, 0, 0))
    // Solo se avisa por email lo que venció en la última semana (no deudas viejas tras una caída)
    const emailFrom = new Date(todayArg.getTime() - 7 * 24 * 60 * 60 * 1000)

    const quotes = await prisma.quote.findMany({
      where:  { status: 'sent', validUntil: { lt: todayArg } },
      select: {
        id: true, number: true, title: true, validUntil: true, organizationId: true, createdById: true,
        potentialClientEmail: true, potentialClientName: true,
        client:       { select: { email: true, name: true } },
        organization: { select: { name: true, logo: true } },
      },
    })

    for (const q of quotes) {
      try {
        // Condición sobre el estado: si alguien lo aprobó/rechazó mientras tanto, no se pisa
        const { count } = await prisma.quote.updateMany({
          where: { id: q.id, status: 'sent' },
          data:  { status: 'expired' },
        })
        if (count === 0) continue
        await prisma.quoteHistory.create({
          data: {
            quoteId:        q.id,
            userId:         q.createdById,
            action:         'auto_expired',
            detail:         'Enviado → Vencido',
            organizationId: q.organizationId,
          }
        })
        console.log(`[cron] Presupuesto #${q.number} vencido automáticamente (${q.id})`)

        const to = q.client?.email || q.potentialClientEmail
        if (to && q.validUntil >= emailFrom) {
          await sendQuoteExpiredEmail({
            to,
            clientName:  q.client?.name || q.potentialClientName || 'Cliente',
            orgName:     q.organization.name,
            orgLogo:     q.organization.logo,
            quoteId:     q.id,
            quoteNumber: q.number,
            quoteTitle:  q.title,
            validUntil:  q.validUntil,
          })
        }
      } catch (err) {
        console.error(`[cron] Error venciendo presupuesto ${q.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron] Error en vencimiento de presupuestos:', err.message)
  }
}

// Extiende el horizonte de cobros de membresías y avisa a los clientes con cobros atrasados
async function runMemberships() {
  try {
    await syncAllMemberships()
    await sendMembershipReminders()
  } catch (err) {
    console.error('[cron] Error en membresías:', err.message)
  }
}

prisma.$connect()
  .then(() => {
    console.log('PostgreSQL conectado')
    app.listen(PORT, (err) => {
      // Express 5 llama este callback también cuando falla el listen (ej. puerto ocupado)
      if (err) {
        console.error(`No se pudo iniciar el servidor en el puerto ${PORT}:`, err.message)
        process.exit(1)
      }
      console.log(`Servidor corriendo en puerto ${PORT}`)

      // En local conectado a la DB de producción: no enviar emails, informes ni backups duplicados
      if (process.env.DISABLE_CRONS === 'true') {
        console.log('[cron] Jobs desactivados (DISABLE_CRONS=true)')
        return
      }

      runTimeAlerts()
      runQuoteReminders()
      runPaymentReminders()
      runMemberships()
      runQuoteExpiration()
      setInterval(runTimeAlerts,          6  * 60 * 60 * 1000) // cada 6 horas
      setInterval(runQuoteExpiration,         60 * 60 * 1000) // cada hora
      setInterval(runMemberships,         6  * 60 * 60 * 1000) // cada 6 horas
      setInterval(runMonthlyReports,          60 * 60 * 1000) // cada hora
      setInterval(runQuoteReminders,      12  * 60 * 60 * 1000) // cada 12 horas
      setInterval(runPaymentReminders,        60 * 60 * 1000) // cada hora
      setInterval(scheduleDatabaseBackup,     60 * 60 * 1000) // cada hora, ejecuta a las 3 AM
    })
  })
  .catch((error) => {
    console.error('Error de conexión:', error.message)
    process.exit(1)
  })
