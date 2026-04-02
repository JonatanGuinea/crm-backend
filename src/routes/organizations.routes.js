import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'

import {
  createOrganization,
  getOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization
} from '../controllers/organizations.controller.js'

import { requireMembership } from '../middlewares/requireMembership.middleware.js'

const router = Router()


router.get('/', auth,requireMembership, getOrganizations)
router.get('/:slug', auth, getOrganizationBySlug)

router.post('/', auth, createOrganization)

router.patch('/:id',
  auth,
  updateOrganization
)

router.delete('/:id', auth, deleteOrganization
)

export default router