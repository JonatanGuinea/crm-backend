import prisma from '../config/db.js'
import { BadRequest, parsePage, parseRange, oneOf, parseId, parseSearch, paginated } from '../utils/admin-params.js'
import { getActivityFeed, lastActivityBy } from './admin-activity.service.js'

/* Empresas y usuarios para el panel Sistema: listados con paginación en servidor,
   detalle completo y los filtros que usan también las exportaciones. */

export const PLANS = ['free', 'pro', 'enterprise']
export const ORG_STATUS = ['active', 'suspended']

// ── Empresas ────────────────────────────────────────────────────────────────

const ORG_SORT = {
  createdAt: dir => ({ createdAt: dir }),
  name:      dir => ({ name: dir }),
  plan:      dir => ({ plan: dir }),
  status:    dir => ({ status: dir }),
  members:   dir => ({ memberships: { _count: dir } }),
  clients:   dir => ({ clients: { _count: dir } }),
  projects:  dir => ({ projects: { _count: dir } }),
  quotes:    dir => ({ quotes: { _count: dir } }),
}

export function orgWhere(query) {
  const q = parseSearch(query.q)
  const { from, to } = parseRange(query)
  const where = {}
  const status = oneOf(query.status, ORG_STATUS, 'status')
  const plan = oneOf(query.plan, PLANS, 'plan')
  if (status) where.status = status
  if (plan) where.plan = plan
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) }
  if (q) where.OR = [
    { name: { contains: q, mode: 'insensitive' } },
    { slug: { contains: q, mode: 'insensitive' } },
    { id: q },
    { owner: { name: { contains: q, mode: 'insensitive' } } },
    { owner: { email: { contains: q, mode: 'insensitive' } } },
  ]
  return where
}

export function orgOrderBy(query) {
  const sort = oneOf(query.sort, Object.keys(ORG_SORT), 'sort', 'createdAt')
  const dir = oneOf(query.order, ['asc', 'desc'], 'order', 'desc')
  return [ORG_SORT[sort](dir), { id: 'asc' }]
}

const ORG_SELECT = {
  id: true, name: true, slug: true, plan: true, status: true, suspendedAt: true, suspendedReason: true,
  defaultCurrency: true, createdAt: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { clients: true, projects: true, quotes: true, products: true } },
}

async function decorateOrgs(orgs) {
  const ids = orgs.map(o => o.id)
  const [team, last] = await Promise.all([
    ids.length ? prisma.organizationMembership.groupBy({ by: ['organizationId', 'status'], where: { organizationId: { in: ids } }, _count: { _all: true } }) : [],
    lastActivityBy('org', ids),
  ])
  const t = {}
  for (const g of team) (t[g.organizationId] ||= { active: 0, invited: 0, disabled: 0 })[g.status] = g._count._all
  return orgs.map(({ _count, ...o }) => ({
    ...o,
    team: t[o.id] || { active: 0, invited: 0, disabled: 0 },
    clients: _count.clients, projects: _count.projects, quotes: _count.quotes, products: _count.products,
    lastActivityAt: last[o.id] || null,
  }))
}

export async function listOrganizations(query) {
  const p = parsePage(query)
  const where = orgWhere(query)
  const [total, rows] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({ where, orderBy: orgOrderBy(query), skip: p.skip, take: p.take, select: ORG_SELECT }),
  ])
  return paginated(await decorateOrgs(rows), total, p)
}

// Para exportar: mismos filtros, sin paginar (con tope)
export async function allOrganizations(query, cap) {
  const rows = await prisma.organization.findMany({ where: orgWhere(query), orderBy: orgOrderBy(query), take: cap, select: ORG_SELECT })
  return decorateOrgs(rows)
}

export async function getOrganizationDetail(id) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      ...ORG_SELECT,
      cuit: true, email: true, phone: true, website: true, address: true, city: true, province: true, updatedAt: true,
      _count: { select: { clients: true, projects: true, quotes: true, products: true, tasks: true, cashMovements: true, stockMovements: true, clientMemberships: true, suppliers: true } },
      memberships: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true, disabledAt: true, lastLoginAt: true, isSystemAdmin: true } } },
      },
    },
  })
  if (!org) return null
  const [clients, projects, quotes, activity, audit, [decorated]] = await Promise.all([
    prisma.client.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, email: true, company: true, createdAt: true } }),
    prisma.project.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, title: true, status: true, createdAt: true, client: { select: { name: true } } } }),
    prisma.quote.findMany({ where: { organizationId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, number: true, title: true, status: true, total: true, currency: true, createdAt: true } }),
    getActivityFeed({ organizationId: id, limit: 30 }),
    prisma.auditLog.findMany({ where: { entity: 'organization', entityId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    decorateOrgs([{ ...org, _count: org._count }]),
  ])
  const { memberships, _count, ...rest } = org
  return {
    ...rest,
    team: decorated.team,
    lastActivityAt: decorated.lastActivityAt,
    counts: _count,
    members: memberships,
    recent: { clients, projects, quotes },
    activity,
    adminHistory: audit,
  }
}

// ── Usuarios ────────────────────────────────────────────────────────────────

const USER_SORT = {
  createdAt:   dir => ({ createdAt: dir }),
  name:        dir => ({ name: dir }),
  email:       dir => ({ email: dir }),
  lastLoginAt: dir => ({ lastLoginAt: { sort: dir, nulls: 'last' } }),
}

export function userWhere(query) {
  const q = parseSearch(query.q)
  const { from, to } = parseRange(query)
  const where = { AND: [] }
  const status = oneOf(query.status, ['enabled', 'disabled'], 'status')
  const verified = oneOf(query.verified, ['yes', 'no'], 'verified')
  const kind = oneOf(query.kind, ['owner', 'team', 'none'], 'kind')
  const orgId = parseId(query.orgId, 'orgId')
  if (status) where.AND.push({ disabledAt: status === 'disabled' ? { not: null } : null })
  if (verified) where.AND.push({ emailVerified: verified === 'yes' })
  if (orgId) where.AND.push({ memberships: { some: { organizationId: orgId } } })
  if (kind === 'owner') where.AND.push({ memberships: { some: { status: 'active', role: 'owner' } } })
  if (kind === 'team') where.AND.push({ memberships: { some: { status: 'active' }, none: { status: 'active', role: 'owner' } } })
  if (kind === 'none') where.AND.push({ memberships: { none: { status: 'active' } } })
  if (from || to) where.AND.push({ createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } })
  if (q) where.AND.push({ OR: [
    { name: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
    { id: q },
    { memberships: { some: { organization: { name: { contains: q, mode: 'insensitive' } } } } },
  ] })
  return where
}

export function userOrderBy(query) {
  const sort = oneOf(query.sort, Object.keys(USER_SORT), 'sort', 'createdAt')
  const dir = oneOf(query.order, ['asc', 'desc'], 'order', 'desc')
  return [USER_SORT[sort](dir), { id: 'asc' }]
}

// Nunca se seleccionan password, tokens ni hashes
const USER_SELECT = {
  id: true, name: true, email: true, phone: true, emailVerified: true, isSystemAdmin: true,
  disabledAt: true, disabledReason: true, lastLoginAt: true, createdAt: true,
  memberships: { select: { role: true, status: true, organization: { select: { id: true, name: true, status: true } } } },
}

function userKind(u) {
  const active = u.memberships.filter(m => m.status === 'active')
  if (active.some(m => m.role === 'owner')) return 'owner'
  return active.length ? 'team' : 'none'
}

async function decorateUsers(users) {
  const last = await lastActivityBy('user', users.map(u => u.id))
  return users.map(({ memberships, ...u }) => ({
    ...u,
    kind: userKind({ memberships }),
    lastActivityAt: last[u.id] || null,
    organizations: memberships.filter(m => m.organization).map(m => ({ id: m.organization.id, name: m.organization.name, orgStatus: m.organization.status, role: m.role, status: m.status })),
  }))
}

export async function listUsers(query) {
  const p = parsePage(query)
  const where = userWhere(query)
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: userOrderBy(query), skip: p.skip, take: p.take, select: USER_SELECT }),
  ])
  return paginated(await decorateUsers(rows), total, p)
}

export async function allUsers(query, cap) {
  const rows = await prisma.user.findMany({ where: userWhere(query), orderBy: userOrderBy(query), take: cap, select: USER_SELECT })
  return decorateUsers(rows)
}

export async function getUserDetail(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT, avatar: true, updatedAt: true,
      memberships: { select: { id: true, role: true, status: true, createdAt: true, organization: { select: { id: true, name: true, status: true, plan: true } } } },
      _count: { select: { clients: true, projects: true, quotes: true, createdTasks: true, assignedTasks: true, cashMovements: true, notifications: true } },
    },
  })
  if (!user) return null
  const [[decorated], activity, accesses, adminHistory] = await Promise.all([
    decorateUsers([user]),
    getActivityFeed({ userId: id, limit: 30 }),
    prisma.auditLog.findMany({
      where: { OR: [{ actorId: id }, { actorEmail: user.email }], action: { in: ['auth.login', 'auth.logout', 'auth.login_failed'] } },
      orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, createdAt: true, action: true, success: true, ip: true, userAgent: true, meta: true },
    }),
    prisma.auditLog.findMany({ where: { entity: 'user', entityId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ])
  return { ...decorated, memberships: user.memberships, counts: user._count, activity, accesses, adminHistory }
}

export function assertReason(reason, required) {
  const r = reason == null ? '' : String(reason).trim()
  if (required && r.length < 3) throw new BadRequest('Indicá un motivo (mínimo 3 caracteres)')
  if (r.length > 500) throw new BadRequest('El motivo no puede superar 500 caracteres')
  return r || null
}
