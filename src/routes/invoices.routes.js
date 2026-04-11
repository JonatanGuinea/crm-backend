import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

import {
  createInvoice,
  getInvoices,
  getInvoiceById,
  getInvoicesDashboard,
  updateInvoice,
  deleteInvoice
} from '../controllers/invoices.controller.js'

const router = Router()

router.post(
  '/',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  createInvoice
)

router.get(
  '/',
  auth,
  requireMembership,
  getInvoices
)

router.get(
  '/dashboard',
  auth,
  requireMembership,
  getInvoicesDashboard
)

router.get(
  '/:id',
  auth,
  requireMembership,
  getInvoiceById
)

router.put(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  updateInvoice
)

router.delete(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner'),
  deleteInvoice
)

export default router
