import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../controllers/cash-accounts.controller.js'

const router = Router()

router.get('/',       auth, requireMembership, getAccounts)
router.post('/',      auth, requireMembership, requireRole('owner', 'admin'), createAccount)
router.patch('/:id',  auth, requireMembership, requireRole('owner', 'admin'), updateAccount)
router.delete('/:id', auth, requireMembership, requireRole('owner', 'admin'), deleteAccount)

export default router
