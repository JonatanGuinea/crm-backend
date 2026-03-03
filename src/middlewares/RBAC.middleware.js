export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return fail(res, 403, 'No tienes permisos suficientes')
    }
    next()
  }
}