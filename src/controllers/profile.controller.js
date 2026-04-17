import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../config/db.js'
import { comparePassword, hashPassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', '..', 'uploads')

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatar: true }
    })

    if (!user) return fail(res, 404, 'Usuario no encontrado')

    return success(res, 200, user)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body

    if (!name || !name.trim()) {
      return fail(res, 400, 'El nombre es requerido')
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, avatar: true }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const changePassword = async (req, res) => {
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
      select: { password: true }
    })

    const isMatch = await comparePassword(currentPassword, user.password)
    if (!isMatch) {
      return fail(res, 401, 'La contraseña actual es incorrecta')
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed }
    })

    return success(res, 200, { message: 'Contraseña actualizada correctamente' })
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
