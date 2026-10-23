import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

export default prisma
