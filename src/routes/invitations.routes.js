import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import {
  getPendingInvitations,
  acceptInvitationById,
  declineInvitation
} from '../controllers/members.controller.js'

const router = Router()

router.get('/', auth, getPendingInvitations)
router.post('/:membershipId/accept', auth, acceptInvitationById)
router.delete('/:membershipId', auth, declineInvitation)

export default router
