import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.SUPABASE_DATABASE_URL
console.log('[DB] SUPABASE_DATABASE_URL:', dbUrl ? dbUrl.substring(0, 50) + '...' : 'NO DEFINIDA')

const prisma = new PrismaClient({
  datasourceUrl: dbUrl,
})

export default prisma
