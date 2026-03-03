import OrganizationMembership from '../models/organizationMembership.model.js'
import User from '../models/user.model.js'
import { success, fail } from '../utils/response.js'
import { generateAccessToken } from '../utils/jwt.js'

export const selectOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body
    const userId = req.user.id

    if (!organizationId) {
      return fail(res, 400, 'organizationId es requerido')
    }
    const user = await User.findById(userId)
    if (!user) return fail(res, 404, 'Usuario no encontrado')

    const membership = await OrganizationMembership.findOne({
      user: userId,
      organization: organizationId
    })
      
      
    if (!membership) {
      return fail(res, 403, 'No perteneces a esta organización')
    }

    const token = generateAccessToken(
      user,
      organizationId,
      membership.role
    )

    return success(res, 200, { token })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}