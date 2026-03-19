import { fail } from "../utils/response.js";

export const requireRole = (...roles) => {
  return (req, res, next) => {

    //  system admin bypass
    if (req.user.isSystemAdmin) {
      return next()
    }

    //  requiere membership previa
    if (!req.membership) {
      return fail(res, 403, 'Membership requerida')
    }

    //  si no se especifican roles, dejar pasar
    if (!roles.length) {
      return next()
    }

    //  validar rol
    if (!roles.includes(req.membership.role)) {
      return fail(
        res,
        403,
        `No tienes permisos suficientes`
      )
    }

    next()
  }
}