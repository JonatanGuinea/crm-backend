import { Router } from 'express'
import { getRecentActivity } from '../controllers/activity.controller.js'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'

const router = Router()

router.get('/', auth, requireMembership, getRecentActivity)

export default router
