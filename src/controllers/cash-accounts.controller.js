import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export async function ensureDefaultAccount(orgId) {
  const existing = await prisma.cashAccount.count({ where: { orgId } })
  if (existing > 0) return
  await prisma.cashAccount.create({
    data: { orgId, name: 'Caja principal', type: 'cash', currency: 'ARS' },
  })
}

export async function getAccounts(req, res) {
  const orgId = req.user.organizationId
  const accounts = await prisma.cashAccount.findMany({
    where: { orgId },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  })
  success(res, 200, accounts)
}

export async function createAccount(req, res) {
  const orgId = req.user.organizationId
  const { name, type = 'cash', currency = 'ARS', initialBalance = 0, description } = req.body

  if (!name?.trim()) return fail(res, 400, 'El nombre es requerido')
  if (!['cash','bank','virtual'].includes(type)) return fail(res, 400, 'Tipo inválido')

  const balance = Number(initialBalance)
  const account = await prisma.cashAccount.create({
    data: {
      orgId,
      name: name.trim(),
      type,
      currency,
      description: description?.trim() || null,
      initialBalance: balance,
      currentBalance: balance,
    },
  })
  success(res, 201, account)
}

export async function updateAccount(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const { name, description, status } = req.body

  const account = await prisma.cashAccount.findFirst({ where: { id, orgId } })
  if (!account) return fail(res, 404, 'Cuenta no encontrada')

  const updated = await prisma.cashAccount.update({
    where: { id },
    data: {
      name:        name?.trim()        ?? account.name,
      description: description !== undefined ? (description?.trim() || null) : account.description,
      status:      status              ?? account.status,
    },
  })
  success(res, 200, updated)
}

export async function deleteAccount(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const account = await prisma.cashAccount.findFirst({
    where: { id, orgId },
    include: { _count: { select: { movements: true } } },
  })
  if (!account) return fail(res, 404, 'Cuenta no encontrada')
  if (account._count.movements > 0)
    return fail(res, 409, 'No se puede eliminar una cuenta con movimientos registrados. Desactivala en su lugar.')

  await prisma.cashAccount.delete({ where: { id } })
  success(res, 200, { message: 'Cuenta eliminada' })
}
