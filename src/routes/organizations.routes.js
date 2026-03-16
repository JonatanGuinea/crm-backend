import express from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { authorize } from '../middlewares/authorize.middleware.js'

import {
  createOrganization,
  getOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization
} from '../controllers/organizations.controller.js'

const router = express.Router()

router.post('/', auth, createOrganization)

router.get('/', auth, getOrganizations)
router.get('/:slug', auth, getOrganizationBySlug)

router.patch('/:id',
  auth,
  authorize('owner'),
  updateOrganization
)

router.delete('/:id',
  auth,
  authorize('owner'),
  deleteOrganization
)

export default router