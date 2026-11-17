import jwt from 'jsonwebtoken'
import { fail } from '../utils/response.js'
import { getUserStatus } from '../services/account-status.service.js'

export const auth = async (req, res, next) => {
  let decoded
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'No autorizado')
    }

    const token = authHeader.split(' ')[1]
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return fail(res, 401, 'Token inválido o expirado')
  }

  // 🚫 bloquear temp tokens
  if (decoded.type === 'temp') {
    return fail(res, 401, 'Token temporal no válido para esta acción')
  }

  try {
    // Estado real de la cuenta (caché 30 s): una cuenta deshabilitada o borrada pierde el acceso
    // aunque su token siga vigente, y isSystemAdmin sale de la DB, no del claim del JWT.
    const status = await getUserStatus(decoded.uid)
    if (!status.exists) return fail(res, 401, 'Token inválido o expirado')
    if (status.disabled) return fail(res, 403, 'Tu cuenta está deshabilitada. Contactá al soporte de DanteUP.')

    req.user = {
      id: decoded.uid,
      organizationId: decoded.org || null,
      role: decoded.role,
      isSystemAdmin: status.isSystemAdmin,
    }

    next()
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
