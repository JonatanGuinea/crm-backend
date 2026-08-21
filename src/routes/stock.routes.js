import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  stockIn,
  stockOut,
  stockAdjustment,
  getMovements,
  getStockHistory,
  getStockDashboard,
} from '../controllers/stock.controller.js'

const router = Router()

router.get('/dashboard',   auth, requireMembership, getStockDashboard)
router.get('/history',     auth, requireMembership, getStockHistory)
router.get('/movements',   auth, requireMembership, getMovements)
router.post('/in',         auth, requireMembership, stockIn)
router.post('/out',        auth, requireMembership, stockOut)
router.post('/adjustment', auth, requireMembership, requireRole('owner', 'admin'), stockAdjustment)

export default router
