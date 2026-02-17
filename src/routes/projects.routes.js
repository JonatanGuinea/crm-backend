import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { createProject, getProjects } from "../controllers/projects.controller.js";

const router = Router()

router.post('/', auth, createProject)
router.get('/', auth, getProjects)


export default router
