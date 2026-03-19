import mongoose from 'mongoose'
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

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return fail(res, 400, 'organizationId inválido')
    }

    // 🔍 validar membership
    const membership = await OrganizationMembership.findOne({
      user: userId,
      organization: organizationId
    })

    if (!membership) {
      return fail(res, 403, 'No perteneces a esta organización')
    }

    // 🔥 traer usuario REAL desde DB
    const user = await User.findById(userId)

    if (!user) {
      return fail(res, 404, 'Usuario no encontrado')
    }

    // 🔐 generar token correctamente
    const token = generateAccessToken(user, membership)

    return success(res, 200, { token })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}