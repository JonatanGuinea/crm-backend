import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.routes.js'
import clientsRoutes from './routes/clients.routes.js'
import projectsRoutes from './routes/projects.routes.js'
import organizationsRoutes from './routes/organizations.routes.js'
import quotesRoutes from './routes/quotes.routes.js'
import invoicesRoutes from './routes/invoices.routes.js'
import notificationsRoutes from './routes/notifications.routes.js'
import attachmentsRoutes from './routes/attachments.routes.js'
import searchRoutes from './routes/search.routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/clients', clientsRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/organizations', organizationsRoutes)
app.use('/api/quotes', quotesRoutes)
app.use('/api/invoices', invoicesRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/attachments', attachmentsRoutes)
app.use('/api/search', searchRoutes)



export default app
