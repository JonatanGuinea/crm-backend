import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import { auth } from '../middlewares/auth.middleware.js'
import { getProfile, updateProfile, changePassword, uploadAvatar } from '../controllers/profile.controller.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `avatar-${randomUUID()}${ext}`)
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'))
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
})

const router = Router()

router.get('/', auth, getProfile)
router.put('/', auth, updateProfile)
router.put('/password', auth, changePassword)
router.post('/avatar', auth, avatarUpload.single('avatar'), uploadAvatar)

export default router
