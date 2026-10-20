import { Router } from 'express'
import { auth } from '../middlewares/auth.middleware.js'
import { upload } from '../middlewares/upload.middleware.js'
import { getProfile, updateProfile, requestPasswordChange, confirmPasswordChange, uploadAvatar } from '../controllers/profile.controller.js'

const router = Router()

router.get('/', auth, getProfile)
router.put('/', auth, updateProfile)
router.put('/password', auth, requestPasswordChange)
router.post('/password/confirm', confirmPasswordChange)
router.post('/avatar', auth, upload.single('avatar'), uploadAvatar)

export default router
