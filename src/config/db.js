import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { attachPrismaMetrics } from '../services/db-metrics.service.js'

dotenv.config()

// Los eventos de query/error alimentan el monitoreo del panel Sistema (db-metrics.service.js).
// 'warn' sigue saliendo por stdout; los errores se re-loguean en el handler.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
})

attachPrismaMetrics(prisma)
prisma.$on('error', e => console.error('[prisma]', e.message))

export default prisma
