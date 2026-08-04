import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/suppliers.controller.js'

const router = Router()

router.get('/',       auth, requireMembership, getSuppliers)
router.post('/',      auth, requireMembership, requireRole('owner', 'admin'), createSupplier)
router.patch('/:id',  auth, requireMembership, requireRole('owner', 'admin'), updateSupplier)
router.delete('/:id', auth, requireMembership, requireRole('owner', 'admin'), deleteSupplier)

export default router
