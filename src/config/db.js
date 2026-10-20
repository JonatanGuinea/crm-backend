import { PrismaClient } from '@prisma/client'

// TEMP: hardcode para confirmar conectividad con Supabase
const SUPABASE_URL = 'postgresql://postgres:HNXumLxouQT0JZbx@db.tmzynnehkhkybuapxpiy.supabase.co:5432/postgres'
console.log('[DB] usando URL directa Supabase')

const prisma = new PrismaClient({
  datasourceUrl: SUPABASE_URL,
})

export default prisma
