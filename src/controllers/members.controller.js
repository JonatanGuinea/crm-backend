
import prisma from '../config/db.js'
import { generateTempToken, generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'

export const inviteUser = async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const { email, role } = req.body

    if (!email || !role) {
      return fail(res, 400, 'Email y rol son requeridos')
    }

    const validRoles = ['admin', 'member']
    if (!validRoles.includes(role)) {
      return fail(res, 400, 'Rol inválido. Permitidos: admin, member')
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) {
      return fail(res, 404, 'Organización no encontrada')
    }

    const inviterMembership = await prisma.organizationMembership.findFirst({
      where: { userId: req.user.id, organizationId, status: 'active' }
    })

    if (!inviterMembership || !['owner', 'admin'].includes(inviterMembership.role)) {
      return fail(res, 403, 'No tienes permisos para invitar usuarios')
    }

    // admin no puede invitar a owner ni a otros admin
    if (inviterMembership.role === 'admin' && role !== 'member') {
      return fail(res, 403, 'Los admins solo pueden invitar con rol member')
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true }
    })

    if (!invitedUser) {
      return fail(res, 404, 'No existe un usuario con ese email')
    }

    const existing = await prisma.organizationMembership.findFirst({
      where: { userId: invitedUser.id, organizationId }
    })

    if (existing) {
      if (existing.status === 'active') {
        return fail(res, 409, 'El usuario ya es miembro de esta organización')
      }
      if (existing.status === 'invited') {
        return fail(res, 409, 'El usuario ya tiene una invitación pendiente')
      }
    }

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: invitedUser.id,
        organizationId,
        role,
        status: 'invited'
      }
    })

    const inviteToken = generateTempToken({ ...invitedUser, membershipId: membership.id })

    return success(res, 201, {
      message: `Invitación enviada a ${invitedUser.email}`,
      invitedUser: { id: invitedUser.id, name: invitedUser.name, email: invitedUser.email },
      role,
      inviteToken
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const acceptInvite = async (req, res) => {
  try {
    const { membershipId } = req.user

    if (!membershipId) {
      return fail(res, 400, 'Token de invitación inválido')
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: { id: membershipId }
    })

    if (!membership) {
      return fail(res, 404, 'Invitación no encontrada')
    }

    if (membership.status !== 'invited') {
      return fail(res, 400, 'Esta invitación ya fue procesada')
    }

    if (membership.userId !== req.user.id) {
      return fail(res, 403, 'Esta invitación no te pertenece')
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: membershipId },
      data: { status: 'active' }
    })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const token = generateAccessToken(user, updated)

    return success(res, 200, {
      message: 'Invitación aceptada',
      token,
      role: updated.role
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getMembers = async (req, res) => {
  try {
    const { id: organizationId } = req.params

    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId, status: { in: ['active', 'invited'] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    })

    const members = memberships.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt
    }))

    return success(res, 200, members)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateMemberRole = async (req, res) => {
  try {
    const { id: organizationId, userId: targetUserId } = req.params
    const { role } = req.body

    const validRoles = ['admin', 'member']
    if (!role || !validRoles.includes(role)) {
      return fail(res, 400, 'Rol inválido. Permitidos: admin, member')
    }

    if (targetUserId === req.user.id) {
      return fail(res, 400, 'No puedes cambiar tu propio rol')
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) {
      return fail(res, 404, 'Organización no encontrada')
    }

    if (org.ownerId === targetUserId) {
      return fail(res, 403, 'No se puede cambiar el rol del owner')
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: targetUserId, organizationId, status: 'active' }
    })

    if (!membership) {
      return fail(res, 404, 'Miembro no encontrado')
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { role }
    })

    return success(res, 200, { userId: targetUserId, role: updated.role })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const removeMember = async (req, res) => {
  try {
    const { id: organizationId, userId: targetUserId } = req.params

    if (targetUserId === req.user.id) {
      return fail(res, 400, 'No puedes removerte a ti mismo')
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) {
      return fail(res, 404, 'Organización no encontrada')
    }

    if (org.ownerId === targetUserId) {
      return fail(res, 403, 'No se puede remover al owner de la organización')
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: targetUserId, organizationId }
    })

    if (!membership) {
      return fail(res, 404, 'Miembro no encontrado')
    }

    await prisma.organizationMembership.delete({ where: { id: membership.id } })

    return success(res, 200, { message: 'Miembro removido correctamente' })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
