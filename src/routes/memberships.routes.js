import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getMemberships, createMembership, updateMembership, deleteMembership,
} from '../controllers/memberships.controller.js'

const router = Router()

router.get('/',       auth, requireMembership, requireRole('owner', 'admin'), getMemberships)
router.post('/',      auth, requireMembership, requireRole('owner', 'admin'), createMembership)
router.patch('/:id',  auth, requireMembership, requireRole('owner', 'admin'), updateMembership)
router.delete('/:id', auth, requireMembership, requireRole('owner', 'admin'), deleteMembership)

export default router
