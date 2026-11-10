import { Router } from "express";
import { rateLimit } from 'express-rate-limit'

import { switchOrganization } from "../controllers/auth.controller.js";
import { login } from '../controllers/login.controller.js'
import { register } from '../controllers/register.controller.js'
import { verifyEmail } from '../controllers/verify-email.controller.js'
import { acceptInvite } from '../controllers/members.controller.js'
import { forgotPassword, resetPassword } from '../controllers/forgot-password.controller.js'
import { auth } from "../middlewares/auth.middleware.js"
import { authInvite } from "../middlewares/authInvite.middleware.js"
import { verifyTurnstile } from "../middlewares/turnstile.middleware.js"

const router = Router()

// Límite por IP solo para las rutas sin sesión (adivinar contraseñas, spam de registros/emails).
// Cambiar de empresa y aceptar invitación ya exigen un token válido: no cuentan.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
})

router.post('/register', authLimiter, verifyTurnstile, register)
router.post('/login', authLimiter, verifyTurnstile, login)
router.post('/verify-email', authLimiter, verifyEmail)
router.post('/forgot-password', authLimiter, verifyTurnstile, forgotPassword)
router.post('/reset-password', authLimiter, resetPassword)
router.post('/switch-organization', auth, switchOrganization)
router.post('/accept-invite', authInvite, acceptInvite)

export default router