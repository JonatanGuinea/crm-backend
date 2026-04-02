import prisma from '../config/db.js'
import { fail } from '../utils/response.js'

export const requireMembership = async (req, res, next) => {
  try {
    if (req.user.isSystemAdmin) {
      return next()
    }

    const { id, organizationId } = req.user

    if (!organizationId) {
      return fail(res, 403, 'No hay organización activa')
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: id,
        organizationId,
        status: 'active'
      }
    })

    if (!membership) {
      return fail(res, 403, 'No perteneces a esta organización')
    }

    req.membership = membership

    next()

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
