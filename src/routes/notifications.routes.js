import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'

import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../controllers/notifications.controller.js'

const router = Router()

router.get('/', auth, requireMembership, getNotifications)

router.patch('/:id/read', auth, requireMembership, markAsRead)

router.patch('/read-all', auth, requireMembership, markAllAsRead)

router.delete('/:id', auth, requireMembership, deleteNotification)

export default router
