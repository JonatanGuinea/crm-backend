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

    const orgId = req.user.activeOrganization
    const userId = req.user.id

    const { title, description, budget, startDate, endDate, client } = req.body

    if (!title || !client) {
      return fail(res, 400, "Titulo del proyecto y cliente son requeridos")
    }

    if (!mongoose.Types.ObjectId.isValid(client)) {
      return fail(res, 400, "ID de cliente no es válido")
    }

    // Verificar que el cliente pertenece a la organización
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


// Obtener todos los proyectos
export const getProjects = async (req, res) => {
  try {

    const orgId = req.user.activeOrganization

    const projects = await Project.find({
      organization: orgId
    })
      .populate("client", "name email")
      .sort({ createdAt: -1 })
      .lean()

    return success(res, 200, projects)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}


// Obtener proyecto por ID
export const getProjectById = async (req, res) => {
  try {

    const orgId = req.user.activeOrganization
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

    const orgId = req.user.activeOrganization
    const { id } = req.params

    const {
      title,
      description,
      status,
      budget,
      startDate,
      endDate
    } = req.body

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

    // Validación de cambio de estado
    if (status && status !== project.status) {

      if (!allowedTransitions[project.status]) {
        return fail(res, 400, "Estado actual inválido")
      }

      const allowed = allowedTransitions[project.status]

      if (!allowed.includes(status)) {
        return fail(
          res,
          400,
          `Transición no permitida. Estado actual: ${project.status}. Permitidos: ${allowed.join(", ")}`
        )
      }

      project.status = status
    }

    if (title !== undefined) project.title = title
    if (description !== undefined) project.description = description
    if (budget !== undefined) project.budget = budget
    if (startDate !== undefined) project.startDate = startDate
    if (endDate !== undefined) project.endDate = endDate

    await project.save()

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}


// Métricas del dashboard
export const getDashboardMetrics = async (req, res) => {
  try {

    const orgId = new mongoose.Types.ObjectId(req.user.activeOrganization)

    const metrics = await Project.aggregate([
      { $match: { organization: orgId } },
      {
        $group: {
          _id: "$status",
          totalProjects: { $sum: 1 },
          totalBudget: { $sum: "$budget" }
        }
      }
    ])

    const totalStats = await Project.aggregate([
      { $match: { organization: orgId } },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalBudget: { $sum: "$budget" }
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


// Eliminar proyecto
export const deleteProject = async (req, res) => {
  try {

    const orgId = req.user.activeOrganization
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