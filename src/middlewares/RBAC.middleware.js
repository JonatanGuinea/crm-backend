import { fail } from "../utils/response.js";

export const requireRole = (...roles) => {
  return (req, res, next) => {

    if (!req.user) {
      return fail(res, 401, 'No autorizado')
    }

    if (req.user.isSystemAdmin) {
      return next()
    }

    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'No tienes permisos suficientes')
    }

    next()
  }
}