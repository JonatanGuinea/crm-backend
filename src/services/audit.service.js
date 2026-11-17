import prisma from '../config/db.js'

/* Auditoría centralizada de la plataforma (tabla AuditLog).
   - logAudit(): registro explícito con valores antes/después (operaciones administrativas, auth).
   - auditMutations: middleware que registra toda escritura (POST/PUT/PATCH/DELETE) de la API
     con usuario, organización, entidad, id, IP, user-agent y resultado. Nunca guarda el body
     (puede traer contraseñas o datos personales).
   El registro nunca debe romper la operación principal: los errores se loguean y se ignoran. */

const MAX_UA = 300

export function requestContext(req) {
  return {
    ip: req?.ip || null,
    userAgent: req?.get?.('user-agent')?.slice(0, MAX_UA) || null,
  }
}

// Quita campos sensibles antes de guardar valores antes/después
const SENSITIVE = /password|token|hash|secret|signature/i
export function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj ?? null
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.test(k)) continue
    out[k] = v instanceof Date ? v.toISOString() : (typeof v === 'bigint' ? Number(v) : v)
  }
  return out
}

export async function logAudit({
  req, actorId, actorEmail, organizationId, action, entity, entityId,
  success = true, statusCode, before, after, meta,
}) {
  try {
    const ctx = requestContext(req)
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? req?.user?.id ?? null,
        actorEmail: actorEmail ?? null,
        organizationId: organizationId ?? req?.user?.organizationId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        success,
        statusCode: statusCode ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        before: before ? sanitize(before) : undefined,
        after: after ? sanitize(after) : undefined,
        meta: meta ?? undefined,
      },
    })
  } catch (err) {
    console.error('[audit] No se pudo registrar', action, err.message)
  }
}

// Rutas que se auditan explícitamente (auth) o que no son mutaciones de datos del CRM
const SKIP_PREFIXES = ['/api/auth', '/api/public', '/api/admin']
const METHOD_ACTION = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }

export function auditMutations(req, res, next) {
  const action = METHOD_ACTION[req.method]
  if (!action || SKIP_PREFIXES.some(p => req.originalUrl.startsWith(p))) return next()

  res.on('finish', () => {
    if (!req.user?.id) return // sin usuario autenticado no hay nada útil que registrar
    const path = req.originalUrl.split('?')[0]
    const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean)
    const entity = parts[0] || null
    // Primer segmento con forma de id (cuid) después de la entidad
    const entityId = parts.slice(1).find(p => /^c[a-z0-9]{20,}$/.test(p)) || null
    // Sub-acciones como /quotes/:id/send → "quotes.send"
    const sub = parts.slice(1).filter(p => p !== entityId && !/^c[a-z0-9]{20,}$/.test(p)).join('.')
    logAudit({
      req,
      action: `${entity}.${sub || action}`,
      entity,
      entityId,
      success: res.statusCode < 400,
      statusCode: res.statusCode,
      meta: { method: req.method, path },
    })
  })
  next()
}
