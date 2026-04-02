import mongoose from "mongoose";
import Project from "../models/project.model.js";
import Client from "../models/client.model.js";
import { success, fail } from "../utils/response.js";

// Estados permitidos y transiciones
const allowedTransitions = {
  pending: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["finished"],
  finished: [],
  cancelled: []
};

// Crear proyecto
export const createProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id

    const { title, description, budget, startDate, endDate, client } = req.body

    if (!title || !client) {
      return fail(res, 400, "Titulo del proyecto y cliente son requeridos")
    }

    if (!mongoose.Types.ObjectId.isValid(client)) {
      return fail(res, 400, "ID de cliente no es válido")
    }

    const clientExists = await Client.exists({
      _id: client,
      organization: orgId
    })

    if (!clientExists) {
      return fail(res, 404, "Cliente no encontrado en esta organización")
    }

    const project = await Project.create({
      title,
      description,
      budget,
      startDate,
      endDate,
      client,
      organization: orgId,
      createdBy: userId
    })

    return success(res, 201, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Obtener todos
export const getProjects = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    const projects = await Project.find({ organization: orgId })
      .populate("client", "name email")
      .sort({ createdAt: -1 })
      .lean()

    return success(res, 200, projects)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Obtener por ID
export const getProjectById = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOne({
      _id: id,
      organization: orgId
    })
      .populate("client", "name email")
      .select("-__v")
      .lean()

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Actualizar proyecto
export const updateProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOne({
      _id: id,
      organization: orgId
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    const { status } = req.body

    // Validación de estado
    if (status && status !== project.status) {
      const allowed = allowedTransitions[project.status] || []

      if (!allowed.includes(status)) {
        return fail(
          res,
          400,
          `Transición no permitida. Estado actual: ${project.status}. Permitidos: ${allowed.join(", ")}`
        )
      }

      project.status = status
    }

    // Campos permitidos
    const allowedFields = ["title", "description", "budget", "startDate", "endDate"]

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        project[key] = req.body[key]
      }
    }

    await project.save()

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Dashboard
export const getDashboardMetrics = async (req, res) => {
  try {
    const orgIdString = req.user.organizationId

    if (!orgIdString || !mongoose.Types.ObjectId.isValid(orgIdString)) {
      return fail(res, 400, "Organización inválida")
    }

    const orgId = new mongoose.Types.ObjectId(orgIdString)

    const metrics = await Project.aggregate([
      { $match: { organization: orgId } },
      {
        $group: {
          _id: "$status",
          totalProjects: { $sum: 1 },
          totalBudget: { $sum: { $ifNull: ["$budget", 0] } }
        }
      }
    ])

    const totalStats = await Project.aggregate([
      { $match: { organization: orgId } },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalBudget: { $sum: { $ifNull: ["$budget", 0] } }
        }
      }
    ])

    return success(res, 200, {
      summary: totalStats[0] || { totalProjects: 0, totalBudget: 0 },
      byStatus: metrics
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Eliminar
export const deleteProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOneAndDelete({
      _id: id,
      organization: orgId
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    return success(res, 200, {
      message: "Proyecto eliminado correctamente"
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}