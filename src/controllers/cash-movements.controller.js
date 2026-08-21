import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { createMovement, createTransfer, annulMovement, INCLUDE_MOVEMENT } from '../services/finances.service.js'

export async function getMovements(req, res) {
  const orgId = req.user.organizationId
  const {
    accountId, type, categoryId, status,
    clientId, projectId, reference,
    from, to,
    page = 1, limit = 30,
  } = req.query

  const where = { orgId }
  if (accountId)  where.accountId  = accountId
  if (type)       where.type       = type
  if (categoryId) where.categoryId = categoryId
  if (status)     where.status     = status
  if (clientId)   where.clientId   = clientId
  if (projectId)  where.projectId  = projectId
  if (reference)  where.reference  = { contains: reference, mode: 'insensitive' }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to)   where.date.lte = new Date(to + 'T23:59:59Z')
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [total, items] = await Promise.all([
    prisma.cashMovement.count({ where }),
    prisma.cashMovement.findMany({
      where,
      include: INCLUDE_MOVEMENT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
  ])

  success(res, 200, { items, total, page: Number(page), limit: Number(limit) })
}

export async function getMovement(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const movement = await prisma.cashMovement.findFirst({ where: { id, orgId }, include: INCLUDE_MOVEMENT })
  if (!movement) return fail(res, 404, 'Movimiento no encontrado')
  success(res, 200, movement)
}

export async function createMovementHandler(req, res) {
  const orgId  = req.user.organizationId
  const userId = req.user.id
  try {
    const movement = await createMovement(orgId, userId, req.body)
    success(res, 201, movement)
  } catch (err) {
    fail(res, 400, err.message)
  }
}

export async function transferHandler(req, res) {
  const orgId  = req.user.organizationId
  const userId = req.user.id
  try {
    const movement = await createTransfer(orgId, userId, req.body)
    success(res, 201, movement)
  } catch (err) {
    fail(res, 400, err.message)
  }
}

export async function updateMovement(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const movement = await prisma.cashMovement.findFirst({ where: { id, orgId } })
  if (!movement)                       return fail(res, 404, 'Movimiento no encontrado')
  if (movement.status === 'annulled')  return fail(res, 409, 'No se puede editar un movimiento anulado')
  if (movement.status === 'confirmed') return fail(res, 409, 'No se puede editar un movimiento confirmado. Anulalo y creá uno nuevo.')

  const { categoryId, description, reference, concept } = req.body
  const updated = await prisma.cashMovement.update({
    where: { id },
    data: {
      categoryId: categoryId !== undefined ? (categoryId || null) : movement.categoryId,
      description: description !== undefined ? (description?.trim() || null) : movement.description,
      reference:   reference   !== undefined ? (reference?.trim()   || null) : movement.reference,
      concept:     concept ?? movement.concept,
    },
    include: INCLUDE_MOVEMENT,
  })
  success(res, 200, updated)
}

export async function confirmMovement(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  try {
    const movement = await prisma.cashMovement.findFirst({ where: { id, orgId } })
    if (!movement)                     return fail(res, 404, 'Movimiento no encontrado')
    if (movement.status !== 'pending') return fail(res, 409, 'Solo se pueden confirmar movimientos pendientes')

    const account = await prisma.cashAccount.findFirst({ where: { id: movement.accountId, orgId } })
    if (!account) return fail(res, 404, 'Cuenta del movimiento no encontrada')

    const qty   = Number(movement.amount)
    const delta = (movement.type === 'income' || movement.type === 'adjustment') ? qty : -qty
    const before = Number(account.currentBalance)
    const after  = before + delta

    const _n = new Date()
    const today = new Date(_n.getFullYear(), _n.getMonth(), _n.getDate(), 0, 0, 0, 0)

    await prisma.$transaction(async (tx) => {
      await tx.cashMovement.update({
        where: { id },
        data: { status: 'confirmed', balanceBefore: before, balanceAfter: after, date: today },
      })
      await tx.cashAccount.update({ where: { id: movement.accountId }, data: { currentBalance: after } })
    })

    success(res, 200, { message: 'Movimiento confirmado' })
  } catch (err) {
    fail(res, 500, err.message)
  }
}

export async function annulMovementHandler(req, res) {
  const orgId  = req.user.organizationId
  const userId = req.user.id
  const { id } = req.params
  const { reason } = req.body
  try {
    await annulMovement(orgId, userId, id, reason)
    success(res, 200, { message: 'Movimiento anulado' })
  } catch (err) {
    fail(res, 400, err.message)
  }
}

export async function getMovementsHistory(req, res) {
  const orgId = req.user.organizationId
  const history = await prisma.cashMovement.findMany({
    where: { orgId },
    include: INCLUDE_MOVEMENT,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  success(res, 200, history)
}

export async function deleteMovement(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const movement = await prisma.cashMovement.findFirst({ where: { id, orgId } })
  if (!movement)                       return fail(res, 404, 'Movimiento no encontrado')
  if (movement.status === 'confirmed') return fail(res, 409, 'No se puede eliminar un movimiento confirmado. Usá anular.')
  if (movement.status === 'annulled')  return fail(res, 409, 'No se puede eliminar un movimiento anulado.')

  await prisma.cashMovement.delete({ where: { id } })
  success(res, 200, { message: 'Movimiento eliminado' })
}
