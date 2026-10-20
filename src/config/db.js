import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.SUPABASE_DATABASE_URL,
})

export default prisma
