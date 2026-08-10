import dotenv from 'dotenv';

import app from './app.js'
import prisma from './config/db.js'
import { checkTimeAlerts } from './services/notifications.service.js'
import { getMonthlyReportData } from './services/report.service.js'
import { buildMonthlyReportPdf } from './utils/buildReportPdf.js'
import { sendMonthlyReportEmail } from './services/email.service.js'

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

prisma.$connect()
  .then(() => {
    console.log('PostgreSQL conectado')
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`)
      runTimeAlerts()
      setInterval(runTimeAlerts,     6 * 60 * 60 * 1000) // cada 6 horas
      setInterval(runMonthlyReports,      60 * 60 * 1000) // cada hora
    })
  })
  .catch((error) => {
    console.error('Error de conexión:', error.message)
    process.exit(1)
  })
