import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import { upload } from '../middlewares/upload.middleware.js'
import {
  uploadQuoteImage,
  updateQuoteImage,
  deleteQuoteImage,
} from '../controllers/quote-images.controller.js'

const router = Router()

router.post(
  '/:quoteId',
  auth, requireMembership, requireRole('owner', 'admin'),
  upload.single('file'),
  uploadQuoteImage
)

router.patch(
  '/:imageId',
  auth, requireMembership, requireRole('owner', 'admin'),
  upload.single('file'),
  updateQuoteImage
)

router.delete(
  '/:imageId',
  auth, requireMembership, requireRole('owner', 'admin'),
  deleteQuoteImage
)

export default router
