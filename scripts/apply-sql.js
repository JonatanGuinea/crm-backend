// Aplica un archivo .sql de prisma/manual-migrations sentencia por sentencia, en una transacción.
// Uso: node scripts/apply-sql.js prisma/manual-migrations/<archivo>.sql
// (prisma db execute se cuelga contra el pooler de Supabase; este script usa el cliente de Prisma)
import 'dotenv/config'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

const file = process.argv[2]
if (!file) { console.error('Falta el archivo .sql'); process.exit(1) }
const statements = fs.readFileSync(file, 'utf8')
  .split(/;\s*(?:\r?\n|$)/)
  .map(s => s.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n').trim())
  .filter(Boolean)

const prisma = new PrismaClient()
try {
  await prisma.$transaction(async tx => {
    for (const sql of statements) {
      await tx.$executeRawUnsafe(sql)
      console.log('OK', sql.split('\n')[0].slice(0, 90))
    }
  }, { timeout: 120_000 })
  console.log(`Listo: ${statements.length} sentencias aplicadas`)
} catch (err) {
  console.error('ERROR (se revirtió todo):', err.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
