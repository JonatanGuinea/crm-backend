import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { createProject, getProjects, getProjectById } from "../controllers/projects.controller.js";

const router = Router()

router.post('/', auth, createProject)
router.get('/', auth, getProjects)
router.get('/:id', auth, getProjectById)

export default router
