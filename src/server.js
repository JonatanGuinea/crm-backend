import dotenv from 'dotenv'
import app from './app.js'
import { connectDB } from './config/db.js'

dotenv.config()

const PORT = process.env.PORT || 3000

connectDB()

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})
