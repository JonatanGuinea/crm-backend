import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

export const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'No autorizado')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      id: decoded.uid, // ⚠️ unificar nombre
      organizationId: decoded.org || null,
      role: decoded.role,
      isSystemAdmin: decoded.isSystemAdmin || false
    }

    next()

  } catch (error) {
    return fail(res, 401, 'Token inválido o expirado')
  }
}