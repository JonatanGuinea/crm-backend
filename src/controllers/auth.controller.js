import mongoose from "mongoose"
import { generateAccessToken } from "../utils/jwt.js"
import { success, fail } from "../utils/response.js"
import OrganizationMembership from "../models/organizationMembership.model.js"
import User from "../models/user.model.js"

export const switchOrganization = async (req, res) => {
  try {

    const { organizationId } = req.body
    const userId = req.user.id

    if (!organizationId) {
      return fail(res, 400, "organizationId es requerido")
    }

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return fail(res, 400, "ID de organización inválido")
    }

    // 🔍 validar membership
    const membership = await OrganizationMembership.findOne({
      user: userId,
      organization: organizationId
    })

    if (!membership) {
      return fail(res, 403, "No perteneces a esta organización")
    }

    // 🔥 traer usuario REAL
    const user = await User.findById(userId)

    if (!user) {
      return fail(res, 404, "Usuario no encontrado")
    }

    // 🔐 generar token correcto
    const token = generateAccessToken(user, membership)

    return success(res, 200, {
      token,
      role: membership.role
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}