import dotenv from 'dotenv';

import app from './app.js'
import prisma from './config/db.js'

dotenv.config({ override: true })


const PORT = process.env.PORT || 3000

prisma.$connect()
  .then(() => {
    console.log('PostgreSQL conectado')
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Error de conexión:', error.message)
    process.exit(1)
  })
