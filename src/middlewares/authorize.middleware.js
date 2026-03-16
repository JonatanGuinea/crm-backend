import { fail } from '../utils/response.js'

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return fail(res, 401, 'No autorizado')
    }

    // organización activa requerida
    if (!req.user.activeOrganization) {
      return fail(res, 403, 'No hay organización activa')
    }

    // system admin bypass
    if (req.user.isSystemAdmin) {
      return next()
    }

    // validar rol
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 403, 'No tienes permisos suficientes')
    }

    next()
  }
}