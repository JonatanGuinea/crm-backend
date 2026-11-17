import prisma from '../config/db.js'
import { parsePage, parseRange, oneOf, parseId, parseSearch, paginated } from '../utils/admin-params.js'

/* Consulta de la auditoría (solo lectura: no existe ningún endpoint que la modifique o borre). */

export function auditWhere(query) {
  const and = []
  const q = parseSearch(query.q)
  const actorId = parseId(query.actorId, 'actorId')
  const orgId = parseId(query.orgId, 'orgId')
  const entityId = parseId(query.entityId, 'entityId')
  const result = oneOf(query.result, ['ok', 'error'], 'result')
  const { from, to } = parseRange(query)
  const action = parseSearch(query.action)
  const entity = parseSearch(query.entity)

  if (actorId) and.push({ actorId })
  if (orgId) and.push({ organizationId: orgId })
  if (entityId) and.push({ entityId })
  if (entity) and.push({ entity })
  // "auth." filtra por prefijo; una acción completa filtra exacto
  if (action) and.push(action.endsWith('.') ? { action: { startsWith: action } } : { action })
  if (result) and.push({ success: result === 'ok' })
  if (from || to) and.push({ createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } })
  if (q) and.push({ OR: [
    { action: { contains: q, mode: 'insensitive' } },
    { entity: { contains: q, mode: 'insensitive' } },
    { entityId: q },
    { actorEmail: { contains: q, mode: 'insensitive' } },
    { ip: { contains: q } },
  ] })
  return and.length ? { AND: and } : {}
}

async function withNames(rows) {
  const userIds = [...new Set(rows.map(r => r.actorId).filter(Boolean))]
  const orgIds = [...new Set(rows.map(r => r.organizationId).filter(Boolean))]
  const [users, orgs] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
    orgIds.length ? prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [],
  ])
  const u = Object.fromEntries(users.map(x => [x.id, x]))
  const o = Object.fromEntries(orgs.map(x => [x.id, x.name]))
  return rows.map(r => ({
    ...r,
    actorName: u[r.actorId]?.name ?? null,
    actorEmail: r.actorEmail ?? u[r.actorId]?.email ?? null,
    organizationName: o[r.organizationId] ?? null,
  }))
}

const LIST_SELECT = {
  id: true, createdAt: true, actorId: true, actorEmail: true, organizationId: true, action: true,
  entity: true, entityId: true, success: true, statusCode: true, ip: true,
}

export async function listAudit(query) {
  const p = parsePage(query, { defaultSize: 50, maxSize: 200 })
  const where = auditWhere(query)
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: p.skip, take: p.take, select: LIST_SELECT }),
  ])
  return paginated(await withNames(rows), total, p)
}

export async function allAudit(query, cap) {
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: cap,
    select: { ...LIST_SELECT, userAgent: true },
  })
  return withNames(rows)
}

export async function getAuditEvent(id) {
  const row = await prisma.auditLog.findUnique({ where: { id } })
  if (!row) return null
  const [named] = await withNames([row])
  return named
}

// Valores distintos para poblar los filtros del front
export async function auditFacets() {
  const [actions, entities] = await Promise.all([
    prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } }, take: 200 }),
    prisma.auditLog.groupBy({ by: ['entity'], _count: { _all: true }, orderBy: { _count: { entity: 'desc' } }, take: 100 }),
  ])
  return {
    actions: actions.map(a => ({ value: a.action, count: a._count._all })),
    entities: entities.filter(e => e.entity).map(e => ({ value: e.entity, count: e._count._all })),
  }
}
