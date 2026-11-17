import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireSystemAdmin } from '../middlewares/requireSystemAdmin.middleware.js'
import { getOverview, updateOrganizationPlan } from '../controllers/admin.controller.js'

// Panel de sistema: solo administradores del sistema (User.isSystemAdmin)
const router = Router()

router.use(auth, requireSystemAdmin)

router.get('/overview', getOverview)
router.patch('/organizations/:id/plan', updateOrganizationPlan)

export default router
