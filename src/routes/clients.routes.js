import { Router } from 'express'
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient
} from '../controllers/clients.controller.js'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { requireRole } from '../middlewares/RBAC.middleware.js'

const router = Router()

router.post('/', auth, requireMembership, requireRole('owner', 'admin'),createClient)

router.get( '/', auth, requireMembership, getClients)

router.get( '/:id', auth, requireMembership, getClientById)

router.put('/:id', auth, requireMembership, requireRole('owner', 'admin'), updateClient)

router.delete('/:id', auth, requireMembership, requireRole('owner'), deleteClient)

export default router