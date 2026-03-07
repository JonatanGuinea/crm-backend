import User from '../models/user.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { comparePassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { generateTempToken } from '../utils/jwt.js'


export const login = async (req, res) => {
  try {

    const { email, password } = req.body

    if (!email || !password) {
      return fail(res, 400, "Email y contraseña son requeridos")
    }

    const normalizedEmail = email.toLowerCase()

    const user = await User
      .findOne({ email: normalizedEmail })
      .select('+password')
      .lean()

    if (!user) {
      return fail(res, 401, "Credenciales inválidas")
    }

    const isMatch = await comparePassword(password, user.password)

    if (!isMatch) {
      return fail(res, 401, "Credenciales inválidas")
    }

    delete user.password

    const memberships = await OrganizationMembership
      .find({ user: user._id })
      .populate("organization", "name")
      .lean()

    if (!memberships.length) {
      return fail(res, 403, "El usuario no pertenece a ninguna organización")
    }

    const organizations = memberships
      .filter(m => m.organization)
      .map(m => ({
        id: m.organization._id,
        name: m.organization.name,
        role: m.role
      }))

    const tempToken = generateTempToken(user)

    return success(res, 200, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      organizations,
      tempToken
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}