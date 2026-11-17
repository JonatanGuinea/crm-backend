import prisma from '../config/db.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'
import { logAudit } from '../services/audit.service.js'

export const switchOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body
    const userId = req.user.id

    if (!organizationId) {
      return fail(res, 400, "organizationId es requerido")
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId, organizationId }
    })

    if (!membership) {
      return fail(res, 403, "No perteneces a esta organización")
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { status: true } })
    if (org?.status === 'suspended' && !req.user.isSystemAdmin) {
      return fail(res, 403, "Esta organización está suspendida. Contactá al soporte de DanteUP.")
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return fail(res, 404, "Usuario no encontrado")
    }

    const token = generateAccessToken(user, membership)

    return success(res, 200, {
      token,
      role: membership.role
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// Cierre de sesión: el JWT es stateless, el endpoint solo deja el evento en la auditoría
export const logout = async (req, res) => {
  await logAudit({ req, action: 'auth.logout', entity: 'auth' })
  return success(res, 200, { ok: true })
}
