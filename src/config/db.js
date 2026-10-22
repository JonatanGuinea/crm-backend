import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const prisma = new PrismaClient({
  datasourceUrl: process.env.SUPABASE_DIRECT_URL,
})

export default prisma
