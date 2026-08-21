import prisma from '../config/db.js'

// Parsea "YYYY-MM-DD" como medianoche local (Argentina UTC-3), no UTC
function parseLocalDate(str) {
  if (!str) return new Date()
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

const INCLUDE_MOVEMENT = {
  account:   { select: { id: true, name: true, type: true, currency: true } },
  toAccount: { select: { id: true, name: true } },
  category:  { select: { id: true, name: true, type: true } },
  client:    { select: { id: true, name: true } },
  project:   { select: { id: true, title: true } },
  supplier:  { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
}

// ── Crear movimiento (income | expense | adjustment) ──────────────────────────
export async function createMovement(orgId, userId, data) {
  const {
    accountId, type, concept, categoryId, amount,
    paymentMethod = 'cash', date, description, reference,
    clientId, projectId, supplierId, quoteId,
    status: requestedStatus,
  } = data

  const isPending = requestedStatus === 'pending'

  const account = await prisma.cashAccount.findFirst({ where: { id: accountId, orgId, status: 'active' } })
  if (!account) throw new Error('Cuenta no encontrada o inactiva')

  const qty    = Number(amount)
  const delta  = (type === 'income' || type === 'adjustment') ? qty : -qty
  const before = isPending ? 0 : Number(account.currentBalance)
  const after  = isPending ? 0 : before + delta

  const movement = await prisma.$transaction(async (tx) => {
    const m = await tx.cashMovement.create({
      data: {
        orgId, accountId, type,
        concept: concept ?? 'other',
        categoryId: categoryId || null,
        amount: qty,
        balanceBefore: before,
        balanceAfter:  after,
        paymentMethod,
        status: isPending ? 'pending' : 'confirmed',
        date: parseLocalDate(date),
        description: description?.trim() || null,
        reference:   reference?.trim()   || null,
        clientId:   clientId   || null,
        projectId:  projectId  || null,
        supplierId: supplierId || null,
        quoteId:    quoteId    || null,
        createdById: userId,
      },
      include: INCLUDE_MOVEMENT,
    })
    if (!isPending) {
      await tx.cashAccount.update({
        where: { id: accountId },
        data:  { currentBalance: after },
      })
    }
    return m
  })
  return movement
}

// ── Transferencia entre cuentas ───────────────────────────────────────────────
export async function createTransfer(orgId, userId, data) {
  const { fromAccountId, toAccountId, amount, date, description, reference } = data

  if (fromAccountId === toAccountId) throw new Error('Las cuentas de origen y destino deben ser distintas')

  const [from, to] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { id: fromAccountId, orgId, status: 'active' } }),
    prisma.cashAccount.findFirst({ where: { id: toAccountId,   orgId, status: 'active' } }),
  ])
  if (!from) throw new Error('Cuenta de origen no encontrada')
  if (!to)   throw new Error('Cuenta de destino no encontrada')

  const qty        = Number(amount)
  const pairId     = crypto.randomUUID()
  const dateObj    = parseLocalDate(date)
  const fromBefore = Number(from.currentBalance)
  const fromAfter  = fromBefore - qty
  const toBefore   = Number(to.currentBalance)
  const toAfter    = toBefore + qty

  const [outMovement] = await prisma.$transaction(async (tx) => {
    const out = await tx.cashMovement.create({
      data: {
        orgId, accountId: fromAccountId, type: 'transfer_out',
        concept: 'transfer', amount: qty,
        balanceBefore: fromBefore, balanceAfter: fromAfter,
        toAccountId, transferPairId: pairId,
        paymentMethod: 'bank_transfer', status: 'confirmed',
        date: dateObj, description: description?.trim() || null,
        reference: reference?.trim() || null,
        createdById: userId,
      },
      include: INCLUDE_MOVEMENT,
    })
    await tx.cashMovement.create({
      data: {
        orgId, accountId: toAccountId, type: 'transfer_in',
        concept: 'transfer', amount: qty,
        balanceBefore: toBefore, balanceAfter: toAfter,
        toAccountId: null, transferPairId: pairId,
        paymentMethod: 'bank_transfer', status: 'confirmed',
        date: dateObj, description: description?.trim() || null,
        reference: reference?.trim() || null,
        createdById: userId,
      },
    })
    await tx.cashAccount.update({ where: { id: fromAccountId }, data: { currentBalance: fromAfter } })
    await tx.cashAccount.update({ where: { id: toAccountId },   data: { currentBalance: toAfter  } })
    return [out]
  })
  return outMovement
}

// ── Anular movimiento ─────────────────────────────────────────────────────────
export async function annulMovement(orgId, userId, movementId, reason) {
  const movement = await prisma.cashMovement.findFirst({
    where: { id: movementId, orgId },
  })
  if (!movement)                       throw new Error('Movimiento no encontrado')
  if (movement.status === 'annulled')  throw new Error('El movimiento ya fue anulado')
  if (movement.status === 'pending')   throw new Error('Los movimientos pendientes se pueden eliminar directamente')

  // Si es parte de una transferencia, anular el par
  if (movement.transferPairId) {
    return annulTransfer(orgId, userId, movement.transferPairId, reason)
  }

  const account = await prisma.cashAccount.findFirst({ where: { id: movement.accountId, orgId } })
  const delta   = (movement.type === 'income' || movement.type === 'adjustment') ? -Number(movement.amount) : Number(movement.amount)
  const after   = Number(account.currentBalance) + delta

  await prisma.$transaction(async (tx) => {
    await tx.cashMovement.update({ where: { id: movementId }, data: { status: 'annulled', annulmentReason: reason || null } })
    await tx.cashAccount.update({ where: { id: movement.accountId }, data: { currentBalance: after } })
  })
}

async function annulTransfer(orgId, userId, pairId, reason) {
  const pair = await prisma.cashMovement.findMany({ where: { transferPairId: pairId, orgId } })
  const out = pair.find(m => m.type === 'transfer_out')
  const inn = pair.find(m => m.type === 'transfer_in')
  if (!out || !inn) throw new Error('Par de transferencia incompleto')

  const qty = Number(out.amount)

  await prisma.$transaction(async (tx) => {
    await tx.cashMovement.updateMany({ where: { transferPairId: pairId }, data: { status: 'annulled', annulmentReason: reason || null } })
    await tx.cashAccount.update({ where: { id: out.accountId }, data: { currentBalance: { increment: qty } } })
    await tx.cashAccount.update({ where: { id: inn.accountId }, data: { currentBalance: { decrement: qty } } })
  })
}

// ── Sincronizar movimientos pendientes de un presupuesto ─────────────────────
// Llama esto cada vez que cambia el estado de un presupuesto a approved/signed
// o cuando se crea/modifica/elimina su plan de cuotas.
export async function syncQuoteMovements(quoteId, orgId, installments, userId) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: orgId },
    select: { id: true, status: true, number: true, total: true, deliveryDate: true, clientId: true, projectId: true },
  })
  if (!['approved', 'signed'].includes(quote?.status)) return

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { defaultCashAccountId: true } })
  let accountId = org?.defaultCashAccountId

  // Fallback: si no hay cuenta predeterminada, usar la primera activa
  if (!accountId) {
    const first = await prisma.cashAccount.findFirst({ where: { orgId, status: 'active' }, orderBy: { createdAt: 'asc' } })
    accountId = first?.id
  }
  if (!accountId) return

  await prisma.cashMovement.deleteMany({ where: { quoteId, status: 'pending' } })

  if (installments.length > 0) {
    await prisma.cashMovement.createMany({
      data: installments.map(inst => ({
        orgId,
        accountId,
        type: 'income',
        concept: 'quote_installment',
        amount: Number(inst.amount),
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'pending',
        date: inst.dueDate,
        description: `Cuota ${inst.number} — Presupuesto #${quote.number}`,
        clientId: quote.clientId ?? null,
        projectId: quote.projectId ?? null,
        quoteId,
        createdById: userId,
      })),
    })
  } else {
    await prisma.cashMovement.create({
      data: {
        orgId,
        accountId,
        type: 'income',
        concept: 'quote_payment',
        amount: Number(quote.total ?? 0),
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'pending',
        date: quote.deliveryDate ?? new Date(),
        description: `Cobro — Presupuesto #${quote.number}`,
        clientId: quote.clientId ?? null,
        projectId: quote.projectId ?? null,
        quoteId,
        createdById: userId,
      },
    })
  }
}

export { INCLUDE_MOVEMENT }
