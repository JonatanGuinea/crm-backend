import User from '../models/user.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { comparePassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { generateTempToken } from '../utils/jwt.js'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // 1️⃣ Buscar usuario
    const user = await User.findOne({ email })

    if (!user) {
      return fail(res, 401, 'Credenciales inválidas')
    }

    // 2️⃣ Validar contraseña usando tu helper
    const isMatch = await comparePassword(password, user.password)

    if (!isMatch) {
      return fail(res, 401, 'Credenciales inválidas')
    }

    // 3️⃣ Obtener memberships del usuario
    const memberships = await OrganizationMembership
      .find({ user: user._id })
      .populate('organization', 'name')

    // 4️⃣ Formatear organizaciones
    const organizations = memberships.map(m => ({
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