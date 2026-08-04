import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import { getFinancesDashboard } from '../controllers/finances-dashboard.controller.js'

const router = Router()

router.get('/dashboard', auth, requireMembership, requireRole('owner', 'admin'), getFinancesDashboard)

export default router
