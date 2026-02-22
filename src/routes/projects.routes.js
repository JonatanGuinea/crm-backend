import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { createProject, getProjects, getProjectById, getDashboardMetrics } from "../controllers/projects.controller.js";

const router = Router()

router.post('/', auth, createProject)
router.get('/', auth, getProjects)
router.get('/dashboard', auth, getDashboardMetrics)
router.get('/:id', auth, getProjectById)

export default router
