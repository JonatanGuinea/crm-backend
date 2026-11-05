import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { syncMembershipCharges } from '../services/memberships.service.js'

const INCLUDE_MEMBERSHIP = {
  client:   { select: { id: true, name: true, email: true } },
  account:  { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
}

// "YYYY-MM-DD" → medianoche UTC (mismo criterio que las fechas de cobro)
function parseDay(str) {
  if (!str) return null
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

function todayArgUTC() {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(arg.getUTCFullYear(), arg.getUTCMonth(), arg.getUTCDate(), 0, 0, 0, 0))
}

async function validatePayload(orgId, body, current = {}) {
  const data = {
    clientId:   body.clientId   ?? current.clientId,
    name:       (body.name ?? current.name)?.trim(),
    amount:     body.amount     !== undefined ? Number(body.amount)     : Number(current.amount),
    billingDay: body.billingDay !== undefined ? Number(body.billingDay) : current.billingDay,
    startDate:  body.startDate  !== undefined ? parseDay(body.startDate) : current.startDate,
    endDate:    body.endDate    !== undefined ? parseDay(body.endDate)   : current.endDate ?? null,
    accountId:  body.accountId  ?? current.accountId,
    categoryId: body.categoryId !== undefined ? (body.categoryId || null) : current.categoryId ?? null,
    notes:      body.notes      !== undefined ? (body.notes?.trim() || null) : current.notes ?? null,
  }

  if (!data.name)                                          throw new Error('El nombre es obligatorio')
  if (!(data.amount > 0))                                  throw new Error('El monto debe ser mayor a 0')
  if (!Number.isInteger(data.billingDay) || data.billingDay < 1 || data.billingDay > 31)
                                                           throw new Error('El día de cobro debe estar entre 1 y 31')
  if (!data.startDate)                                     throw new Error('La fecha de inicio es obligatoria')
  if (data.endDate && data.endDate < data.startDate)       throw new Error('La fecha de fin no puede ser anterior al inicio')

  const [client, account] = await Promise.all([
    prisma.client.findFirst({ where: { id: data.clientId, organizationId: orgId }, select: { id: true } }),
    prisma.cashAccount.findFirst({ where: { id: data.accountId, orgId, status: 'active' }, select: { id: true } }),
  ])
  if (!client)  throw new Error('Cliente no encontrado')
  if (!account) throw new Error('Cuenta no encontrada o inactiva')

  if (data.categoryId) {
    const category = await prisma.financialCategory.findFirst({ where: { id: data.categoryId, orgId }, select: { id: true } })
    if (!category) throw new Error('Categoría no encontrada')
  }

  return data
}

// ── Listado con próximo cobro y atrasados ─────────────────────────────────────
export async function getMemberships(req, res) {
  const orgId = req.user.organizationId
  const { clientId, status } = req.query
  const today = todayArgUTC()

  const where = { orgId }
  if (clientId) where.clientId = clientId
  if (status)   where.status   = status

  const memberships = await prisma.clientMembership.findMany({
    where,
    include: INCLUDE_MEMBERSHIP,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  const ids = memberships.map(m => m.id)
  const pending = ids.length === 0 ? [] : await prisma.cashMovement.findMany({
    where:   { membershipId: { in: ids }, status: 'pending' },
    select:  { membershipId: true, date: true, amount: true },
    orderBy: { date: 'asc' },
  })

  const items = memberships.map(m => {
    const own      = pending.filter(p => p.membershipId === m.id)
    const overdue  = own.filter(p => p.date < today)
    const next     = own.find(p => p.date >= today)
    return {
      ...m,
      nextChargeDate: next?.date ?? null,
      overdueCount:   overdue.length,
      overdueAmount:  overdue.reduce((s, p) => s + Number(p.amount), 0),
    }
  })

  const active = items.filter(m => m.status === 'active')
  const summary = {
    activeCount:    active.length,
    monthlyRevenue: active.reduce((s, m) => s + Number(m.amount), 0),
    overdueCount:   items.reduce((s, m) => s + m.overdueCount, 0),
    overdueAmount:  items.reduce((s, m) => s + m.overdueAmount, 0),
  }

  success(res, 200, { items, summary })
}

export async function createMembership(req, res) {
  const orgId = req.user.organizationId
  try {
    const data = await validatePayload(orgId, req.body)
    const membership = await prisma.clientMembership.create({
      data: { ...data, orgId, status: 'active', createdById: req.user.id },
      include: INCLUDE_MEMBERSHIP,
    })
    await syncMembershipCharges(membership.id)
    success(res, 201, membership)
  } catch (err) {
    fail(res, 400, err.message)
  }
}

// Cualquier cambio regenera los cobros pendientes futuros (los atrasados y confirmados no se tocan)
export async function updateMembership(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const current = await prisma.clientMembership.findFirst({ where: { id, orgId } })
  if (!current) return fail(res, 404, 'Membresía no encontrada')

  const { status } = req.body
  if (status !== undefined && !['active', 'paused', 'cancelled'].includes(status)) {
    return fail(res, 400, 'Estado inválido')
  }

  try {
    const data = await validatePayload(orgId, req.body, current)
    const membership = await prisma.clientMembership.update({
      where: { id },
      data:  { ...data, ...(status ? { status } : {}) },
      include: INCLUDE_MEMBERSHIP,
    })
    await syncMembershipCharges(id, { resetFuture: true })
    success(res, 200, membership)
  } catch (err) {
    fail(res, 400, err.message)
  }
}

// Borra la membresía y todos sus cobros pendientes; los confirmados quedan en Finanzas sin vínculo
export async function deleteMembership(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const membership = await prisma.clientMembership.findFirst({ where: { id, orgId } })
  if (!membership) return fail(res, 404, 'Membresía no encontrada')

  await prisma.$transaction([
    prisma.cashMovement.deleteMany({ where: { membershipId: id, status: 'pending' } }),
    prisma.clientMembership.delete({ where: { id } }),
  ])
  success(res, 200, { message: 'Membresía eliminada' })
}
