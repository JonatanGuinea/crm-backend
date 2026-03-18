import { fail } from "../utils/response.js";

export const requireRole = (...roles) => {
  return (req, res, next) => {

    if (req.user.isSystemAdmin) {
      return next()
    }

    if (!req.membership) {
      return fail(res, 500, 'Membership no cargado')
    }

    if (!roles.includes(req.membership.role)) {
      return fail(res, 403, 'No tienes permisos suficientes')
    }

    next()
  }
}