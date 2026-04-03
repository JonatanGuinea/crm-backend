import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'

export const authInvite = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'Token de invitación requerido')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.type !== 'temp') {
      return fail(res, 401, 'Token inválido para esta acción')
    }

    req.user = {
      id: decoded.uid,
      membershipId: decoded.membershipId
    }

    next()

  } catch (error) {
    return fail(res, 401, 'Token de invitación inválido o expirado')
  }
}
