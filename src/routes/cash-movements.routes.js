import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getMovements, getMovement, getMovementsHistory,
  createMovementHandler, transferHandler,
  updateMovement, confirmMovement,
  annulMovementHandler, deleteMovement,
} from '../controllers/cash-movements.controller.js'

const router = Router()

router.get('/history',            auth, requireMembership, requireRole('owner', 'admin'), getMovementsHistory)
router.get('/',                   auth, requireMembership, requireRole('owner', 'admin'), getMovements)
router.get('/:id',                auth, requireMembership, requireRole('owner', 'admin'), getMovement)
router.post('/',                  auth, requireMembership, requireRole('owner', 'admin'), createMovementHandler)
router.post('/transfer',          auth, requireMembership, requireRole('owner', 'admin'), transferHandler)
router.patch('/:id',              auth, requireMembership, requireRole('owner', 'admin'), updateMovement)
router.post('/:id/confirm',       auth, requireMembership, requireRole('owner', 'admin'), confirmMovement)
router.post('/:id/annul',         auth, requireMembership, requireRole('owner', 'admin'), annulMovementHandler)
router.delete('/:id',             auth, requireMembership, requireRole('owner', 'admin'), deleteMovement)

export default router
