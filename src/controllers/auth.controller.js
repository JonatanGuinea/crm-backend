import mongoose from "mongoose"
import { generateAccessToken } from "../utils/jwt.js"
import { success, fail } from "../utils/response.js"
import OrganizationMembership from "../models/organizationMembership.model.js"

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

    const membership = await OrganizationMembership.findOne({
      user: userId,
      organization: organizationId
    }).lean()

    if (!membership) {
      return fail(res, 403, "No perteneces a esta organización")
    }

    const token = generateAccessToken(
      req.user,
      organizationId,
      membership.role
    )

    return success(res, 200, {
        token,
        role: membership.role
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}