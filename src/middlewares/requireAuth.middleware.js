import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'


export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'No autorizado')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = decoded
    next()

  } catch (error) {
    return fail(res, 401, 'Token inválido o expirado')
  }
}