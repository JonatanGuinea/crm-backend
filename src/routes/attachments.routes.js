import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'
import { upload } from '../middlewares/upload.middleware.js'

import {
  uploadAttachment,
  getAttachments,
  deleteAttachment
} from '../controllers/attachments.controller.js'

const router = Router()

router.post(
  '/:entityType/:entityId',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  upload.single('file'),
  uploadAttachment
)

router.get(
  '/:entityType/:entityId',
  auth,
  requireMembership,
  getAttachments
)

router.delete(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  deleteAttachment
)

export default router
