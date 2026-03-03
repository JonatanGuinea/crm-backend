import { fail } from '../utils/response.js'

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {

    // 1️⃣ Debe existir organización activa
    if (!req.user.activeOrganization) {
      return fail(res, 403, 'No hay organización activa')
    }

    // 2️⃣ System admin bypass
    if (req.user.isSystemAdmin) {
      return next()
    }

    // 3️⃣ Verificar rol permitido
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 403, 'No tienes permisos suficientes')
    }

    next()
  }
}
