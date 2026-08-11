import { Router } from "express";

import { switchOrganization } from "../controllers/auth.controller.js";
import { login } from '../controllers/login.controller.js'
import { register } from '../controllers/register.controller.js'
import { verifyEmail } from '../controllers/verify-email.controller.js'
import { acceptInvite } from '../controllers/members.controller.js'
import { forgotPassword, resetPassword } from '../controllers/forgot-password.controller.js'
import { auth } from "../middlewares/auth.middleware.js"
import { authInvite } from "../middlewares/authInvite.middleware.js"

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/verify-email', verifyEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/switch-organization', auth, switchOrganization)
router.post('/accept-invite', authInvite, acceptInvite)

export default router