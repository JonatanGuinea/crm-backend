import prisma from '../config/db.js'
import { success } from '../utils/response.js'

export async function getFinancesDashboard(req, res) {
  const orgId     = req.user.organizationId
  const accountId = req.query.accountId || null

  const now   = new Date()
  // Usar fecha local (Argentina UTC-3), no UTC
  const year  = parseInt(req.query.year)  || now.getFullYear()
  const month = parseInt(req.query.month) || (now.getMonth() + 1)
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end   = new Date(year, month, 0, 23, 59, 59, 999)

  const movementBase = { orgId, ...(accountId ? { accountId } : {}) }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { defaultCashAccountId: true } })

  const [accounts, monthMovements, recentMovements, categoryTotals, pendingTotals] = await Promise.all([
    // Saldo por cuenta
    prisma.cashAccount.findMany({
      where: { orgId, status: 'active', ...(accountId ? { id: accountId } : {}) },
      orderBy: { name: 'asc' },
    }),

    // Ingresos y egresos del mes (solo confirmados)
    prisma.cashMovement.groupBy({
      by: ['type'],
      where: {
        ...movementBase, status: 'confirmed',
        date: { gte: start, lte: end },
        type: { in: ['income', 'expense'] },
      },
      _sum: { amount: true },
    }),

    // Movimientos del día actual (fecha local Argentina)
    prisma.cashMovement.findMany({
      where: {
        ...movementBase,
        status: { not: 'annulled' },
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
          lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
        },
      },
      include: {
        account:  { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        client:   { select: { id: true, name: true } },
        project:  { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Gastos por categoría del mes
    prisma.cashMovement.groupBy({
      by: ['categoryId'],
      where: {
        ...movementBase, status: 'confirmed', type: 'expense',
        date: { gte: start, lte: end },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    }),

    // Pendientes del mes seleccionado (income y expense por separado)
    prisma.cashMovement.groupBy({
      by: ['type'],
      where: {
        ...movementBase,
        status: 'pending',
        type: { in: ['income', 'expense'] },
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ])

  // Saldo total (de las cuentas filtradas)
  const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0)

  // Ingresos / egresos del mes
  const incomeMonth  = Number(monthMovements.find(m => m.type === 'income')?._sum?.amount  ?? 0)
  const expenseMonth = Number(monthMovements.find(m => m.type === 'expense')?._sum?.amount ?? 0)

  // Pendientes
  const pendingIncome  = Number(pendingTotals.find(m => m.type === 'income')?._sum?.amount  ?? 0)
  const pendingExpense = Number(pendingTotals.find(m => m.type === 'expense')?._sum?.amount ?? 0)

  // Enriquecer categorías con nombre
  const categoryIds = categoryTotals.map(c => c.categoryId).filter(Boolean)
  const categories  = await prisma.financialCategory.findMany({ where: { id: { in: categoryIds } } })
  const catMap      = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const categoryBreakdown = categoryTotals.map(c => ({
    categoryId: c.categoryId,
    name:       catMap[c.categoryId] ?? 'Sin categoría',
    total:      Number(c._sum.amount),
  }))

  // Evolución mensual (últimos 6 meses)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthlyRaw   = await prisma.cashMovement.findMany({
    where: {
      ...movementBase, status: 'confirmed',
      type: { in: ['income', 'expense'] },
      date: { gte: sixMonthsAgo },
    },
    select: { type: true, amount: true, date: true },
  })
  const monthlyMap = {}
  for (const m of monthlyRaw) {
    const key = `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 }
    monthlyMap[key][m.type] += Number(m.amount)
  }
  const monthlyEvolution = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({ month, ...vals }))

  // Todas las cuentas activas (siempre, para el selector del frontend)
  const allAccounts = accountId
    ? await prisma.cashAccount.findMany({ where: { orgId, status: 'active' }, orderBy: { name: 'asc' } })
    : accounts

  success(res, 200, {
    totalBalance,
    accounts,
    allAccounts,
    incomeMonth,
    expenseMonth,
    netMonth: incomeMonth - expenseMonth,
    pendingIncome,
    pendingExpense,
    recentMovements,
    categoryBreakdown,
    monthlyEvolution,
    filteredByAccount:    accountId || null,
    defaultCashAccountId: org?.defaultCashAccountId || null,
  })
}
