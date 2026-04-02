import prisma from '../config/db.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'

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
