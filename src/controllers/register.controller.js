import jwt from 'jsonwebtoken'
import prisma from '../config/db.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'
import { notify } from '../services/notifications.service.js'

export const register = async (req, res) => {
  try {
    const name       = req.body.name?.trim()
    const email      = req.body.email?.trim().toLowerCase()
    const password   = req.body.password
    const phone      = req.body.userPhone?.trim() || null
    const inviteToken = req.body.inviteToken || null

    if (!name || !email || !password || !phone) {
      return fail(res, 400, 'Nombre, email, contraseña y teléfono son obligatorios')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone }
    })

    // Si viene con token de invitación, unir a la org directamente
    let membership = null
    if (inviteToken) {
      try {
        const payload = jwt.verify(inviteToken, process.env.JWT_SECRET)
        if (payload.type === 'pre-invite' && payload.email === email) {
          membership = await prisma.organizationMembership.create({
            data: {
              userId: user.id,
              organizationId: payload.orgId,
              role: payload.role,
              status: 'active'
            }
          })
          const org = await prisma.organization.findUnique({
            where: { id: payload.orgId },
            select: { ownerId: true }
          })
          if (org && org.ownerId !== user.id) {
            await notify({
              type: 'member_joined',
              title: 'Nuevo miembro',
              message: `${user.name} se registró y se unió a la organización`,
              userId: org.ownerId,
              orgId: payload.orgId,
              refId: user.id
            })
          }
        }
      } catch {
        // Token inválido o expirado — registrar igual, sin unirse a la org
      }
    }

    const token = generateAccessToken(user, membership)

    return success(res, 201, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
