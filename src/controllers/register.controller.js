import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import prisma from '../config/db.js'
import { hashPassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { notify } from '../services/notifications.service.js'
import { sendVerificationEmail } from '../services/email.service.js'

export const register = async (req, res) => {
  try {
    const name        = req.body.name?.trim()
    const email       = req.body.email?.trim().toLowerCase()
    const password    = req.body.password
    const phone       = req.body.userPhone?.trim() || null
    const inviteToken = req.body.inviteToken || null

    if (!name || !email || !password || !phone) {
      return fail(res, 400, 'Nombre, email, contraseña y teléfono son obligatorios')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    const hashedPassword     = await hashPassword(password)
    const emailVerifyToken   = crypto.randomBytes(32).toString('hex')

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone, emailVerifyToken }
    })

    // Si viene con token de invitación, unir a la org directamente
    if (inviteToken) {
      try {
        const payload = jwt.verify(inviteToken, process.env.JWT_SECRET)
        if (payload.type === 'pre-invite' && payload.email === email) {
          const membership = await prisma.organizationMembership.create({
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

    try {
      await sendVerificationEmail({ to: email, name, token: emailVerifyToken })
    } catch (emailErr) {
      await prisma.user.delete({ where: { id: user.id } })
      return fail(res, 500, 'No se pudo enviar el email de verificación. Intentá de nuevo.')
    }

    return success(res, 201, { message: 'Cuenta creada. Revisá tu email para activarla.' })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
