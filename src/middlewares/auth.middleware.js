import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { fail } from '../utils/response.js'

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'No autorizado - token faltante o formato token inválido')
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      _id: new mongoose.Types.ObjectId(decoded.id),
      activeOrganization: decoded.activeOrganization
        ? new mongoose.Types.ObjectId(decoded.activeOrganization)
        : null,
      role: decoded.role,
      isSystemAdmin: decoded.isSystemAdmin
    }

    next()
  } catch (error) {
    return fail(res, 401, 'Token inválido')
  }
}

