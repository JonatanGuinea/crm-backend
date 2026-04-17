import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { getProfile, updateProfile, changePassword } from '../controllers/profile.controller.js'

const router = Router()

router.get('/', auth, getProfile)
router.put('/', auth, updateProfile)
router.put('/password', auth, changePassword)

export default router
