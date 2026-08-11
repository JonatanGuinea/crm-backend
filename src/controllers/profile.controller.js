import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../config/db.js'
import { comparePassword, hashPassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { sendPasswordChangeEmail } from '../services/email.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', '..', 'uploads')

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatar: true, phone: true }
    })

    if (!user) return fail(res, 404, 'Usuario no encontrado')

    return success(res, 200, user)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body

    if (!name || !name.trim()) {
      return fail(res, 400, 'El nombre es requerido')
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim(), phone: phone?.trim() || null },
      select: { id: true, name: true, email: true, avatar: true, phone: true }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const requestPasswordChange = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return fail(res, 400, 'La contraseña actual y la nueva son requeridas')
    }
    if (newPassword.length < 6) {
      return fail(res, 400, 'La nueva contraseña debe tener al menos 6 caracteres')
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true, email: true, name: true }
    })

    const isMatch = await comparePassword(currentPassword, user.password)
    if (!isMatch) return fail(res, 401, 'La contraseña actual es incorrecta')

    const token  = crypto.randomBytes(32).toString('hex')
    const hashed = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordChangeToken: token,
        passwordChangeHash:  hashed,
      }
    })

    await sendPasswordChangeEmail({ to: user.email, name: user.name, token })

    return success(res, 200, { message: 'Te enviamos un email para confirmar el cambio.' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const confirmPasswordChange = async (req, res) => {
  try {
    const { token } = req.body
    if (!token) return fail(res, 400, 'Token requerido')

    const user = await prisma.user.findUnique({
      where: { passwordChangeToken: token },
      select: { id: true, passwordChangeHash: true }
    })

    if (!user) return fail(res, 400, 'El enlace no es válido o ya fue usado')

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password:           user.passwordChangeHash,
        passwordChangeToken: null,
        passwordChangeHash:  null,
      }
    })

    return success(res, 200, { message: 'Contraseña actualizada correctamente.' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'No se recibió ninguna imagen')
    }

    // Borrar avatar anterior si existe
    const current = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatar: true }
    })
    if (current?.avatar) {
      const oldPath = path.join(uploadsDir, current.avatar)
      fs.unlink(oldPath, () => {}) // silencioso si no existe
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: req.file.filename },
      select: { id: true, name: true, email: true, avatar: true }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
