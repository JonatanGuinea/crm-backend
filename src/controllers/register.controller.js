import prisma from '../config/db.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'

export const register = async (req, res) => {
  try {
    const name     = req.body.name?.trim()
    const email    = req.body.email?.trim().toLowerCase()
    const password = req.body.password
    const phone    = req.body.userPhone?.trim() || null

    if (!name || !email || !password || !phone) {
      return fail(res, 400, 'Nombre, email, contraseña y teléfono son obligatorios')
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, phone }
    })

    const token = generateAccessToken(user)

    return success(res, 201, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
