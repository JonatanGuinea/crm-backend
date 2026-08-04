import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { notify } from '../services/notifications.service.js'
import { createMovement, maybeNotifyStockAlert } from '../services/stock.service.js'

const taskInclude = {
  assignedTo: { select: { id: true, name: true, avatar: true } },
  project:    { select: { id: true, title: true } },
  createdBy:  { select: { id: true, name: true } },
  stockItems: {
    include: { product: { select: { id: true, name: true, sku: true, unit: true, stock: true } } },
    orderBy: { createdAt: 'asc' },
  },
}

export const getTasks = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { status, priority, assignedToId, projectId } = req.query

    const where = { organizationId: orgId }
    if (status)       where.status       = status
    if (priority)     where.priority     = priority
    if (assignedToId) where.assignedToId = assignedToId
    if (projectId)    where.projectId    = projectId

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: taskInclude,
    })

    return success(res, 200, tasks)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createTask = async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedToId, projectId, stockItems } = req.body
    const orgId = req.user.organizationId

    if (!title) return fail(res, 400, 'El título es obligatorio')

    const task = await prisma.task.create({
      data: {
        title,
        description:   description   || null,
        status:        status        || 'todo',
        priority:      priority      || 'medium',
        dueDate:       dueDate       ? new Date(dueDate) : null,
        assignedToId:  assignedToId  || null,
        projectId:     projectId     || null,
        organizationId: orgId,
        createdById:   req.user.id,
      },
      include: taskInclude,
    })

    await prisma.taskHistory.create({
      data: {
        taskId:         task.id,
        userId:         req.user.id,
        fromStatus:     null,
        toStatus:       task.status,
        organizationId: orgId,
      }
    })

    if (stockItems?.length > 0) {
      await prisma.taskStockItem.createMany({
        data: stockItems.map(item => ({
          taskId:        task.id,
          productId:     item.productId,
          quantity:      Number(item.quantity),
          organizationId: orgId,
        }))
      })
    }

    if (assignedToId && assignedToId !== req.user.id) {
      notify({
        type:    'task_assigned',
        title:   'Nueva tarea asignada',
        message: `Te asignaron la tarea "${task.title}"`,
        userId:  assignedToId,
        orgId:   orgId,
        refId:   task.id,
      })
    }

    const taskWithItems = await prisma.task.findUnique({ where: { id: task.id }, include: taskInclude })
    return success(res, 201, taskWithItems)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params
    const orgId  = req.user.organizationId

    const existing = await prisma.task.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return fail(res, 404, 'Tarea no encontrada')

    const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedToId', 'projectId']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'dueDate')       updates[key] = req.body[key] ? new Date(req.body[key]) : null
        else if (key === 'assignedToId' || key === 'projectId') updates[key] = req.body[key] || null
        else updates[key] = req.body[key]
      }
    }

    if (updates.status === 'in_progress' && existing.status !== 'in_progress') {
      updates.startedAt = new Date()
    } else if (updates.status === 'todo') {
      updates.startedAt = null
    }

    if (updates.status === 'done' && existing.status !== 'done') {
      updates.completedAt = new Date()
    } else if (updates.status && updates.status !== 'done' && existing.status === 'done') {
      updates.completedAt = null
    }

    // Sincronizar ítems de stock si vienen en el body
    if (req.body.stockItems !== undefined) {
      await prisma.taskStockItem.deleteMany({ where: { taskId: id } })
      if (req.body.stockItems.length > 0) {
        await prisma.taskStockItem.createMany({
          data: req.body.stockItems.map(item => ({
            taskId:        id,
            productId:     item.productId,
            quantity:      Number(item.quantity),
            organizationId: orgId,
          }))
        })
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updates,
      include: taskInclude,
    })

    if (updates.status && updates.status !== existing.status) {
      await prisma.taskHistory.create({
        data: {
          taskId:         id,
          userId:         req.user.id,
          fromStatus:     existing.status,
          toStatus:       updates.status,
          organizationId: orgId,
        }
      })
    }

    // Descontar stock al completar la tarea
    if (updates.status === 'done' && existing.status !== 'done') {
      const items = await prisma.taskStockItem.findMany({
        where: { taskId: id },
        select: { productId: true, quantity: true },
      })
      for (const item of items) {
        try {
          const movement = await prisma.$transaction(tx =>
            createMovement(tx, {
              orgId,
              productId:   item.productId,
              type:        'production_out',
              quantity:    Number(item.quantity),
              reason:      `Tarea completada: "${existing.title}"`,
              createdById: req.user.id,
            })
          )
          await maybeNotifyStockAlert(orgId, movement)
        } catch {
          // stock insuficiente u otro error — se omite el ítem
        }
      }
    }

    if (
      updates.assignedToId &&
      updates.assignedToId !== req.user.id &&
      updates.assignedToId !== existing.assignedToId
    ) {
      notify({
        type:    'task_assigned',
        title:   'Nueva tarea asignada',
        message: `Te asignaron la tarea "${task.title}"`,
        userId:  updates.assignedToId,
        orgId:   orgId,
        refId:   `${task.id}_${updates.assignedToId}`,
      })
    }

    return success(res, 200, task)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getTaskHistory = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const history = await prisma.taskHistory.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        task: { select: { id: true, title: true } },
      }
    })
    return success(res, 200, history)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const clearDoneTasks = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { count } = await prisma.task.deleteMany({
      where: { organizationId: orgId, status: 'done' }
    })
    return success(res, 200, { count })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params
    const orgId  = req.user.organizationId

    const existing = await prisma.task.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return fail(res, 404, 'Tarea no encontrada')

    await prisma.task.delete({ where: { id } })
    return success(res, 200, { message: 'Tarea eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
