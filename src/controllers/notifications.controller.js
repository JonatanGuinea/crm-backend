import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { checkTimeAlerts } from '../services/notifications.service.js'

export const getNotifications = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id

    await checkTimeAlerts(orgId)

    const notifications = await prisma.notification.findMany({
      where: { userId, organizationId: orgId },
      orderBy: { createdAt: 'desc' }
    })

    const unreadCount = notifications.filter(n => !n.read).length

    return success(res, 200, { unreadCount, notifications })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const orgId = req.user.organizationId

    const notif = await prisma.notification.findFirst({
      where: { id, userId, organizationId: orgId }
    })
    if (!notif) return fail(res, 404, 'Notificación no encontrada')

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id
    const orgId = req.user.organizationId

    const { count } = await prisma.notification.updateMany({
      where: { userId, organizationId: orgId, read: false },
      data: { read: true }
    })

    return success(res, 200, { message: `${count} notificaciones marcadas como leídas` })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const orgId = req.user.organizationId

    const notif = await prisma.notification.findFirst({
      where: { id, userId, organizationId: orgId }
    })
    if (!notif) return fail(res, 404, 'Notificación no encontrada')

    await prisma.notification.delete({ where: { id } })

    return success(res, 200, { message: 'Notificación eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
