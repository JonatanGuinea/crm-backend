import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

import {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuotesDashboard,
  updateQuote,
  deleteQuote,
  createInvoiceFromQuote
} from '../controllers/quotes.controller.js'
import { downloadQuotePdf } from '../controllers/pdf.controller.js'

const router = Router()

router.post(
  '/',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  createQuote
)

router.get(
  '/',
  auth,
  requireMembership,
  getQuotes
)

router.get(
  '/dashboard',
  auth,
  requireMembership,
  getQuotesDashboard
)

router.get(
  '/:id',
  auth,
  requireMembership,
  getQuoteById
)

router.put(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  updateQuote
)

router.delete(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner'),
  deleteQuote
)

router.post(
  '/:id/invoice',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  createInvoiceFromQuote
)

router.get(
  '/:id/pdf',
  auth,
  requireMembership,
  downloadQuotePdf
)

export default router
