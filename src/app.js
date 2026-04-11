import express from 'express'



import authRoutes from './routes/auth.routes.js'
import clientsRoutes from './routes/clients.routes.js'
import projectsRoutes from './routes/projects.routes.js'
import organizationsRoutes from './routes/organizations.routes.js'
import quotesRoutes from './routes/quotes.routes.js'
import invoicesRoutes from './routes/invoices.routes.js'

const app = express()

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/organizations', organizationsRoutes)
app.use('/api/quotes', quotesRoutes)
app.use('/api/invoices', invoicesRoutes)



export default app
