import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import {
  createQuoteNote,
  updateQuoteNote,
  deleteQuoteNote,
} from '../controllers/quote-notes.controller.js'

const router = Router()

router.post(
  '/:quoteId',
  auth, requireMembership, requireRole('owner', 'admin'),
  createQuoteNote
)

router.patch(
  '/:noteId',
  auth, requireMembership, requireRole('owner', 'admin'),
  updateQuoteNote
)

router.delete(
  '/:noteId',
  auth, requireMembership, requireRole('owner', 'admin'),
  deleteQuoteNote
)

export default router
