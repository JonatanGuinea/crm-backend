import { Router } from "express";

import { auth } from "../middlewares/auth.middleware.js";
import { requireMembership } from "../middlewares/requireMembership.middleware.js";
import { requireRole } from "../middlewares/RBAC.middleware.js";

import {
  createProject,
  getProjects,
  getProjectById,
  getDashboardMetrics,
  updateProject,
  deleteProject
} from "../controllers/projects.controller.js";

const router = Router()

router.post(
  '/',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  createProject
)

router.get(
  '/',
  auth,
  requireMembership,
  getProjects
)

router.get(
  '/dashboard',
  auth,
  requireMembership,
  getDashboardMetrics
)

router.get(
  '/:id',
  auth,
  requireMembership,
  getProjectById
)

router.put(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner', 'admin'),
  updateProject
)

router.delete(
  '/:id',
  auth,
  requireMembership,
  requireRole('owner'),
  deleteProject
)

export default router