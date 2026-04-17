import prisma from '../config/db.js'
import { comparePassword, hashPassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true }
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
      select: { id: true, name: true, email: true }
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
