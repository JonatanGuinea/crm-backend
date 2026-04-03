import { Router } from "express";

import { switchOrganization } from "../controllers/auth.controller.js";
import { login } from '../controllers/login.controller.js'
import { register } from '../controllers/register.controller.js'
import { acceptInvite } from '../controllers/members.controller.js'
import { auth } from "../middlewares/auth.middleware.js"
import { authInvite } from "../middlewares/authInvite.middleware.js"

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/switch-organization', auth, switchOrganization)
router.post('/accept-invite', authInvite, acceptInvite)

export default router