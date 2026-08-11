import crypto from 'crypto'
import prisma from '../config/db.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'
import { sendPasswordResetEmail } from '../services/email.service.js'

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body
    if (!email) return fail(res, 400, 'El email es requerido.')

    // Always return success — don't reveal if email exists
    const successMsg = 'Si ese email está registrado, te enviamos un enlace para restablecer tu contraseña.'

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) return success(res, 200, { message: successMsg })

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 30 * 60 * 1000) // 30 min

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry }
    })

    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, token })
    } catch (emailErr) {
      console.error('[forgotPassword] email error:', emailErr.message)
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: null, passwordResetExpiry: null }
      })
      return fail(res, 500, 'No se pudo enviar el email. Intentá de nuevo más tarde.')
    }

    return success(res, 200, { message: successMsg })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body
    if (!token || !password) return fail(res, 400, 'Datos incompletos.')
    if (password.length < 6) return fail(res, 400, 'La contraseña debe tener al menos 6 caracteres.')

    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } })
    if (!user) return fail(res, 400, 'El enlace no es válido o ya fue usado.')

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return fail(res, 400, 'El enlace expiró. Solicitá uno nuevo.')
    }

    const hash = await hashPassword(password)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, passwordResetToken: null, passwordResetExpiry: null }
    })

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id, status: 'active' }
    })
    const jwtToken = generateAccessToken(user, membership)

    return success(res, 200, { message: 'Contraseña restablecida correctamente.', token: jwtToken })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
