import express from 'express'
import { auth } from '../middlewares/auth.js'
import { authorize } from '../middlewares/authorize.js'

import {
  createOrganization,
  getOrganizations,
  updateOrganization,
  deleteOrganization
} from '../controllers/organization.controller.js'

const router = express.Router()

router.post('/', auth, createOrganization)

router.get('/', auth, getOrganizations)

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