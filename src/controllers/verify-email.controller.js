import prisma from '../config/db.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body

    if (!token) return fail(res, 400, 'Token requerido')

    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token }
    })

    if (!user) return fail(res, 400, 'El enlace no es válido o ya fue usado')

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null }
    })

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id, status: 'active' }
    })

    const token_ = generateAccessToken(user, membership)

    return success(res, 200, {
      message: 'Email confirmado',
      token: token_,
      user: { id: user.id, name: user.name, email: user.email, isSystemAdmin: user.isSystemAdmin }
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
