
import { Router } from "express";


import { switchOrganization } from "../controllers/auth.controller.js";
import {login} from '../controllers/login.controller.js'
import {register} from '../controllers/register.controller.js'
import { selectOrganization } from "../controllers/selectOrganization.controller.js";
import { requireAuth } from "../middlewares/requireAuth.middleware.js";




const router = Router()

router.post('/register', register)
router.post('/login',login)
router.post('/switch-organization', switchOrganization)
router.post('/select-organization', requireAuth, selectOrganization)


export default router