import prisma from '../config/db.js'
import { fail } from '../utils/response.js'

// Solo administradores del sistema. No alcanza con el claim del JWT (dura 24 h):
// se vuelve a leer el flag en la DB para que quitar el permiso tenga efecto inmediato.
export const requireSystemAdmin = async (req, res, next) => {
  try {
    if (!req.user?.isSystemAdmin) {
      return fail(res, 403, 'Acceso restringido')
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isSystemAdmin: true }
    })

    if (!user?.isSystemAdmin) {
      return fail(res, 403, 'Acceso restringido')
    }

    next()
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
