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



export default app
