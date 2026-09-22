import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const taskInclude = {
  assignedTo: { select: { id: true, name: true, avatar: true } }
}

export const getDefaultTasks = async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const tasks = await prisma.defaultTask.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
      include: taskInclude
    })
    return success(res, 200, tasks)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createDefaultTask = async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const { title, description, priority, assignedToId } = req.body

    if (!title?.trim()) return fail(res, 400, 'El título es requerido')

    const agg = await prisma.defaultTask.aggregate({
      where: { organizationId },
      _max: { order: true }
    })

    const task = await prisma.defaultTask.create({
      data: {
        organizationId,
        title:        title.trim(),
        description:  description?.trim() || null,
        priority:     priority || 'medium',
        assignedToId: assignedToId || null,
        order:        (agg._max.order ?? -1) + 1,
      },
      include: taskInclude
    })

    return success(res, 201, task)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateDefaultTask = async (req, res) => {
  try {
    const { id: organizationId, taskId } = req.params
    const { title, description, priority, assignedToId } = req.body

    const existing = await prisma.defaultTask.findFirst({
      where: { id: taskId, organizationId }
    })
    if (!existing) return fail(res, 404, 'Tarea predeterminada no encontrada')

    const data = {}
    if (title !== undefined)       data.title = title.trim()
    if (description !== undefined) data.description = description?.trim() || null
    if (priority !== undefined)    data.priority = priority
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null

    const task = await prisma.defaultTask.update({
      where: { id: taskId },
      data,
      include: taskInclude
    })

    return success(res, 200, task)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteDefaultTask = async (req, res) => {
  try {
    const { id: organizationId, taskId } = req.params

    const existing = await prisma.defaultTask.findFirst({
      where: { id: taskId, organizationId }
    })
    if (!existing) return fail(res, 404, 'Tarea predeterminada no encontrada')

    await prisma.defaultTask.delete({ where: { id: taskId } })

    return success(res, 200, { message: 'Tarea eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const reorderDefaultTasks = async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const { ids } = req.body

    if (!Array.isArray(ids)) return fail(res, 400, 'ids debe ser un array')

    await Promise.all(
      ids.map((id, index) =>
        prisma.defaultTask.updateMany({
          where: { id, organizationId },
          data: { order: index }
        })
      )
    )

    return success(res, 200, { message: 'Orden actualizado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
