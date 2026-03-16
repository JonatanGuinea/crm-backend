import express from 'express'

import authRoutes from './routes/auth.routes.js'
import clientsRoutes from './routes/clients.routes.js'
import projectsRoutes from './routes/projects.routes.js'
import organizationsRoutes from './routes/organizations.routes.js'
// import { auth } from './middlewares/auth.middleware.js'

const app = express()

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/organizations', organizationsRoutes)




//PRUEBA DE FUNCIONAMIENTO DE AUTH
// app.get('/health', (req, res) => {
//   res.json({ status: 'ok' })
// })

// app.get('/api/protected', auth, (req, res) => {
//   res.json({
//     message: 'Ruta protegida',
//     user: req.user
//   })
// })


export default app
