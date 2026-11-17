import prisma from '../config/db.js'
import { comparePassword } from '../utils/passwordHash.js'
import { success, fail } from '../utils/response.js'
import { generateAccessToken } from '../utils/jwt.js'
import { logAudit } from '../services/audit.service.js'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return fail(res, 400, "Email y contraseña son requeridos")
    }

    const normalizedEmail = email.toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        isSystemAdmin: true,
        emailVerified: true,
        disabledAt: true,
      }
    })

    if (!user) {
      await logAudit({ req, action: 'auth.login_failed', entity: 'auth', success: false, statusCode: 401, actorEmail: normalizedEmail, meta: { reason: 'unknown_email' } })
      return fail(res, 401, "Credenciales inválidas")
    }

    const isMatch = await comparePassword(password, user.password)

    if (!isMatch) {
      await logAudit({ req, actorId: user.id, actorEmail: user.email, action: 'auth.login_failed', entity: 'auth', success: false, statusCode: 401, meta: { reason: 'bad_password' } })
      return fail(res, 401, "Credenciales inválidas")
    }

    if (user.disabledAt) {
      await logAudit({ req, actorId: user.id, actorEmail: user.email, action: 'auth.login_failed', entity: 'auth', success: false, statusCode: 403, meta: { reason: 'disabled' } })
      return fail(res, 403, "Tu cuenta está deshabilitada. Contactá al soporte de DanteUP.")
    }

    if (!user.emailVerified) {
      return fail(res, 403, "Debés confirmar tu email antes de ingresar. Revisá tu casilla.")
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: user.id, status: 'active' },
      include: { organization: { select: { id: true, name: true, status: true } } }
    })

    const organizations = memberships
      .filter(m => m.organization)
      .map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role
      }))

    // Empresa inicial: la primera no suspendida (si todas lo están, igual entra y verá el aviso)
    const membership = memberships.find(m => m.organization?.status !== 'suspended') ?? memberships[0] ?? null
    const token = generateAccessToken(user, membership)

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await logAudit({ req, actorId: user.id, actorEmail: user.email, organizationId: membership?.organizationId ?? null, action: 'auth.login', entity: 'auth' })

    return success(res, 200, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      organizations,
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
