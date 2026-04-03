import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

import {
  createOrganization,
  getOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization
} from '../controllers/organizations.controller.js'

import {
  inviteUser,
  getMembers,
  updateMemberRole,
  removeMember
} from '../controllers/members.controller.js'

const router = Router()

router.get('/', auth, requireMembership, getOrganizations)
router.get('/:slug', auth, getOrganizationBySlug)

router.post('/', auth, createOrganization)

router.patch('/:id', auth, requireMembership, requireRole('owner', 'admin'), updateOrganization)

router.delete('/:id', auth, deleteOrganization)

// Members
router.post('/:id/members', auth, requireMembership, requireRole('owner', 'admin'), inviteUser)
router.get('/:id/members', auth, requireMembership, getMembers)
router.patch('/:id/members/:userId', auth, requireMembership, requireRole('owner'), updateMemberRole)
router.delete('/:id/members/:userId', auth, requireMembership, requireRole('owner'), removeMember)

export default router