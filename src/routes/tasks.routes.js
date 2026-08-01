import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller.js'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'

const router = Router()

router.get('/',    auth, requireMembership, getTasks)
router.post('/',   auth, requireMembership, createTask)
router.put('/:id', auth, requireMembership, updateTask)
router.delete('/:id', auth, requireMembership, deleteTask)

export default router
