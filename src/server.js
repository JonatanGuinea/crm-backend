import dotenv from 'dotenv';

import app from './app.js'
import prisma from './config/db.js'
import { checkTimeAlerts } from './services/notifications.service.js'

dotenv.config({ override: true })

const PORT = process.env.PORT || 3000

async function runTimeAlerts() {
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    await Promise.all(orgs.map(o => checkTimeAlerts(o.id)))
  } catch (err) {
    console.error('[cron] Error en alertas:', err.message)
  }
}

prisma.$connect()
  .then(() => {
    console.log('PostgreSQL conectado')
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`)
      runTimeAlerts()
      setInterval(runTimeAlerts, 6 * 60 * 60 * 1000) // cada 6 horas
    })
  })
  .catch((error) => {
    console.error('Error de conexión:', error.message)
    process.exit(1)
  })
