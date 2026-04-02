import prisma from '../config/db.js'
import { comparePassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { generateAccessToken } from '../utils/jwt.js'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return fail(res, 400, "Email y contraseña son requeridos")
    }

    const normalizedEmail = email.toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        isSystemAdmin: true
      }
    })

    if (!user) {
      return fail(res, 401, "Credenciales inválidas")
    }

    const isMatch = await comparePassword(password, user.password)

    if (!isMatch) {
      return fail(res, 401, "Credenciales inválidas")
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: user.id },
      include: { organization: { select: { id: true, name: true } } }
    })

    if (!memberships.length) {
      return fail(res, 403, "El usuario no pertenece a ninguna organización")
    }

    const organizations = memberships
      .filter(m => m.organization)
      .map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role
      }))

    const membership = memberships[0]
    const token = generateAccessToken(user, membership)

    return success(res, 200, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      organizations,
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
