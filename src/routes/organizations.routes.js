import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

import {
  createOrganization,
  getOrganizations,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization,
  uploadOrgLogo
} from '../controllers/organizations.controller.js'
import { upload } from '../middlewares/upload.middleware.js'

import {
  inviteUser,
  getMembers,
  updateMemberRole,
  removeMember
} from '../controllers/members.controller.js'

import {
  getDefaultTasks,
  createDefaultTask,
  updateDefaultTask,
  deleteDefaultTask,
  reorderDefaultTasks
} from '../controllers/default-tasks.controller.js'

const router = Router()

router.get('/', auth, getOrganizations)
router.get('/:slug', auth, getOrganizationBySlug)

router.post('/', auth, createOrganization)

router.patch('/:id', auth, requireMembership, requireRole('owner', 'admin'), updateOrganization)

router.delete('/:id', auth, deleteOrganization)

router.post('/:id/logo', auth, requireMembership, requireRole('owner', 'admin'), upload.single('logo'), uploadOrgLogo)

// Members
router.post('/:id/members', auth, requireMembership, requireRole('owner', 'admin'), inviteUser)
router.get('/:id/members', auth, requireMembership, getMembers)
router.patch('/:id/members/:userId', auth, requireMembership, requireRole('owner'), updateMemberRole)
router.delete('/:id/members/:userId', auth, requireMembership, requireRole('owner'), removeMember)

// Default Tasks
router.get('/:id/default-tasks', auth, requireMembership, getDefaultTasks)
router.post('/:id/default-tasks', auth, requireMembership, requireRole('owner', 'admin'), createDefaultTask)
router.patch('/:id/default-tasks/:taskId', auth, requireMembership, requireRole('owner', 'admin'), updateDefaultTask)
router.delete('/:id/default-tasks/:taskId', auth, requireMembership, requireRole('owner', 'admin'), deleteDefaultTask)
router.put('/:id/default-tasks/order', auth, requireMembership, requireRole('owner', 'admin'), reorderDefaultTasks)

export default router