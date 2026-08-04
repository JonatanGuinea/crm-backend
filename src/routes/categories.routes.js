import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categories.controller.js'

const router = Router()

router.get('/',      auth, requireMembership, getCategories)
router.post('/',     auth, requireMembership, requireRole('owner', 'admin'), createCategory)
router.patch('/:id', auth, requireMembership, requireRole('owner', 'admin'), updateCategory)
router.delete('/:id',auth, requireMembership, requireRole('owner', 'admin'), deleteCategory)

export default router
