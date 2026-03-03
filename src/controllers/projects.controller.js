import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import Client from '../models/client.model.js'; 
import { success, fail } from '../utils/response.js';

//funcion para crear un nuevo proyecto
export const createProject = async (req, res) => {
  try {
    const { title, description, budget, startDate, endDate, client } = req.body

    if (!title || !client) {
      return fail(res, 400, "Titulo del proyecto y cliente son requeridos")
    }

    if (!mongoose.Types.ObjectId.isValid(client)) {
      return fail(res, 400, "ID de cliente no es válido")
    }

    // 🔐 Cliente debe pertenecer a la organización activa
    const clientExists = await Client.findOne({
      _id: client,
      organization: req.user.activeOrganization
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
      organization: req.user.activeOrganization,
      createdBy: req.user._id
    })

    return success(res, 201, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

//Funcion para obtener todos los proyectos del usuario autenticado

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      organization: req.user.activeOrganization
    })
      .populate("client", "name email")
      .sort({ createdAt: -1 })

    return success(res, 200, projects)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}


//Funcion para obtener un proyecto por su ID, asegurando que pertenezca al usuario autenticado
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOne({
      _id: id,
      organization: req.user.activeOrganization
    })
      .populate("client", "name email")
      .select("-__v")

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

//Funcion para actualizar un proyecto por su ID, asegurando que pertenezca al usuario autenticado

const allowedtransitions = {
    pending: ["approved", "cancelled"],
    approved: ["in_progress", "cancelled"],
    in_progress: ["finished"],
    finished: [],
    cancelled: []
}

//Función para actualizar un proyecto por su ID, asegurando que pertenezca al usuario autenticado
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, status, budget, startDate, endDate } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOne({
      _id: id,
      organization: req.user.activeOrganization
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    if (status && status !== project.status) {
      const allowed = allowedtransitions[project.status]

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


export const getDashboardMetrics = async (req, res) => {
  try {
    const orgId = req.user.activeOrganization

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

//Función para eliminar un proyecto por su ID, asegurando que pertenezca al usuario autenticado
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "ID de proyecto no es válido")
    }

    const project = await Project.findOneAndDelete({
      _id: id,
      organization: req.user.activeOrganization
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}