import { Router } from 'express'
import { getTasks, createTask, updateTask, deleteTask, clearDoneTasks, getTaskHistory } from '../controllers/tasks.controller.js'
import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'

const router = Router()

router.get('/',         auth, requireMembership, getTasks)
router.get('/history',  auth, requireMembership, getTaskHistory)
router.post('/',   auth, requireMembership, createTask)
router.put('/:id', auth, requireMembership, updateTask)
router.delete('/done/all', auth, requireMembership, clearDoneTasks)
router.delete('/:id', auth, requireMembership, deleteTask)

export default router
