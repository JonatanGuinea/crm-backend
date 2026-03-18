import express from 'express'
import { auth } from '../middlewares/auth.middleware.js'

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
  updateOrganization
)

router.delete('/:id',
  auth,
  deleteOrganization
)

export default router