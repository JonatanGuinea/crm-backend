import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { createProject, getProjects, getProjectById, getDashboardMetrics, updateProject, deleteProject} from "../controllers/projects.controller.js";
import { requireAuth } from "../middlewares/requireAuth.middleware.js";
import { requireRole } from "../middlewares/RBAC.middleware.js";


const router = Router()

router.post('/',  requireAuth, requireRole('owner', 'admin'), createProject)
router.get('/', auth, getProjects)

router.get('/dashboard', auth, getDashboardMetrics)

router.get('/:id', auth, getProjectById)
router.put('/:id', auth, updateProject)
router.delete('/:id', auth, deleteProject)

export default router
