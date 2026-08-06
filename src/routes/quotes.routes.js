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
  sendQuote,
  getAllQuotesHistory,
} from '../controllers/quotes.controller.js'
import { downloadQuotePdf } from '../controllers/pdf.controller.js'

const router = Router()

router.post(   '/',          auth, requireMembership, requireRole('owner', 'admin'), createQuote)
router.get(    '/',          auth, requireMembership, requireRole('owner', 'admin'), getQuotes)
router.get(    '/dashboard', auth, requireMembership, requireRole('owner', 'admin'), getQuotesDashboard)
router.get(    '/history',   auth, requireMembership, requireRole('owner', 'admin'), getAllQuotesHistory)
router.get(    '/:id',       auth, requireMembership, requireRole('owner', 'admin'), getQuoteById)
router.put(    '/:id',       auth, requireMembership, requireRole('owner', 'admin'), updateQuote)
router.delete( '/:id',       auth, requireMembership, requireRole('owner'),          deleteQuote)
router.post(   '/:id/send',  auth, requireMembership, requireRole('owner', 'admin'), sendQuote)
router.get(    '/:id/pdf',   auth, requireMembership, requireRole('owner', 'admin'), downloadQuotePdf)

export default router
