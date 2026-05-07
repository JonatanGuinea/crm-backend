import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  createInstallments,
  getInstallments,
  payInstallment,
  deleteInstallments
} from '../controllers/installments.controller.js'

const router = Router()

router.post('/', auth, requireMembership, requireRole('owner', 'admin'), createInstallments)
router.get('/', auth, requireMembership, getInstallments)
router.patch('/:id/pay', auth, requireMembership, requireRole('owner', 'admin'), payInstallment)
router.delete('/', auth, requireMembership, requireRole('owner', 'admin'), deleteInstallments)

export default router
