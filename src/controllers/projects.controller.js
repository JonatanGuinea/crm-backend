import prisma from '../config/db.js'
import { success, fail, paginated } from '../utils/response.js'
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js'

const allowedTransitions = {
  pending: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["finished"],
  finished: [],
  cancelled: []
}

export const createProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id

    const { title, description, budget, startDate, endDate, client } = req.body

    if (!title || !client) {
      return fail(res, 400, "Titulo del proyecto y cliente son requeridos")
    }

    const clientExists = await prisma.client.findFirst({
      where: { id: client, organizationId: orgId },
      select: { id: true }
    })

    if (!clientExists) {
      return fail(res, 404, "Cliente no encontrado en esta organización")
    }

    const project = await prisma.project.create({
      data: {
        title,
        description,
        budget: budget != null ? parseFloat(budget) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        clientId: client,
        organizationId: orgId,
        createdById: userId
      }
    })

    return success(res, 201, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getProjects = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { status, clientId } = req.query
    const { page, limit, skip } = parsePagination(req.query)

    const where = { organizationId: orgId }
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { client: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.project.count({ where })
    ])

    return paginated(res, projects, buildPaginationMeta(total, page, limit))

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getProjectById = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId },
      include: { client: { select: { id: true, name: true, email: true } } }
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    return success(res, 200, project)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId }
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    const { status } = req.body
    const updates = {}

    if (status && status !== project.status) {
      const allowed = allowedTransitions[project.status] || []

      if (!allowed.includes(status)) {
        return fail(
          res,
          400,
          `Transición no permitida. Estado actual: ${project.status}. Permitidos: ${allowed.join(", ")}`
        )
      }

      updates.status = status
    }

    const allowedFields = ["title", "description", "budget", "startDate", "endDate"]

for (const key of allowedFields) {
  if (req.body[key] !== undefined) {

    if (key === "startDate" || key === "endDate") {
      updates[key] = req.body[key] ? new Date(req.body[key]) : null
    } else if (key === "budget") {
      updates[key] = req.body[key] != null ? parseFloat(req.body[key]) : null
    } else {
      updates[key] = req.body[key]
    }

  }
}

    const updated = await prisma.project.update({
      where: { id },
      data: updates
    })

    return success(res, 200, updated)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getDashboardMetrics = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    if (!orgId) {
      return fail(res, 400, "Organización inválida")
    }

    const byStatus = await prisma.project.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { status: true },
      _sum: { budget: true }
    })

    const totals = await prisma.project.aggregate({
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { budget: true }
    })

    return success(res, 200, {
      summary: {
        totalProjects: totals._count._all,
        totalBudget: totals._sum.budget || 0
      },
      byStatus: byStatus.map(s => ({
        _id: s.status,
        totalProjects: s._count.status,
        totalBudget: s._sum.budget || 0
      }))
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteProject = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: { id, organizationId: orgId }
    })

    if (!project) {
      return fail(res, 404, "Proyecto no encontrado")
    }

    await prisma.project.delete({ where: { id } })

    return success(res, 200, { message: "Proyecto eliminado correctamente" })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
