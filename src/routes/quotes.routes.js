import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

import {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuotesDashboard,
  getNextQuoteNumber,
  updateQuote,
  deleteQuote,
  sendQuote,
  getAllQuotesHistory,
  reactivateQuote,
  duplicateQuote,
} from '../controllers/quotes.controller.js'
import { downloadQuotePdf } from '../controllers/pdf.controller.js'

const router = Router()

router.post(   '/',             auth, requireMembership, requireRole('owner', 'admin'), createQuote)
router.get(    '/',             auth, requireMembership, requireRole('owner', 'admin'), getQuotes)
router.get(    '/dashboard',    auth, requireMembership, requireRole('owner', 'admin'), getQuotesDashboard)
router.get(    '/history',      auth, requireMembership, requireRole('owner', 'admin'), getAllQuotesHistory)
router.get(    '/next-number',  auth, requireMembership, requireRole('owner', 'admin'), getNextQuoteNumber)
router.get(    '/:id',       auth, requireMembership, requireRole('owner', 'admin'), getQuoteById)
router.put(    '/:id',       auth, requireMembership, requireRole('owner', 'admin'), updateQuote)
router.delete( '/:id',       auth, requireMembership, requireRole('owner'),          deleteQuote)
router.post(   '/:id/send',  auth, requireMembership, requireRole('owner', 'admin'), sendQuote)
router.post(   '/:id/reactivate', auth, requireMembership, requireRole('owner', 'admin'), reactivateQuote)
router.post(   '/:id/duplicate',  auth, requireMembership, requireRole('owner', 'admin'), duplicateQuote)
router.get(    '/:id/pdf',   auth, requireMembership, requireRole('owner', 'admin'), downloadQuotePdf)

export default router
