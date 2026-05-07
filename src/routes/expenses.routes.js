import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  getCategories, createCategory, deleteCategory,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getExpensesDashboard
} from '../controllers/expenses.controller.js'

const router = Router()

router.get('/categories', auth, requireMembership, getCategories)
router.post('/categories', auth, requireMembership, requireRole('owner', 'admin'), createCategory)
router.delete('/categories/:id', auth, requireMembership, requireRole('owner', 'admin'), deleteCategory)

router.get('/dashboard', auth, requireMembership, getExpensesDashboard)
router.get('/', auth, requireMembership, getExpenses)
router.post('/', auth, requireMembership, requireRole('owner', 'admin'), createExpense)
router.put('/:id', auth, requireMembership, requireRole('owner', 'admin'), updateExpense)
router.delete('/:id', auth, requireMembership, requireRole('owner', 'admin'), deleteExpense)

export default router
