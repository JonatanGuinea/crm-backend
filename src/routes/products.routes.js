import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductMovements,
} from '../controllers/products.controller.js'

const router = Router()

router.get('/',              auth, requireMembership, getProducts)
router.get('/:id',           auth, requireMembership, getProduct)
router.get('/:id/movements', auth, requireMembership, getProductMovements)
router.post('/',             auth, requireMembership, requireRole('owner', 'admin'), createProduct)
router.patch('/:id',         auth, requireMembership, requireRole('owner', 'admin'), updateProduct)
router.delete('/:id',        auth, requireMembership, requireRole('owner', 'admin'), deleteProduct)

export default router
