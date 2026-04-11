import { Router } from 'express'

import { auth } from '../middlewares/auth.middleware.js'
import { requireMembership } from '../middlewares/requireMembership.middleware.js'
import { globalSearch } from '../controllers/search.controller.js'

const router = Router()

router.get('/', auth, requireMembership, globalSearch)

export default router
