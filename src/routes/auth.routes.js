
import { Router } from "express";


import { switchOrganization } from "../controllers/auth.controller.js";
import {login} from '../controllers/login.controller.js'
import {register} from '../controllers/register.controller.js'
import {auth} from "../middlewares/auth.middleware.js"

const router = Router()

router.post('/register', register)
router.post('/login', login)

router.post('/switch-organization', auth, switchOrganization)

export default router