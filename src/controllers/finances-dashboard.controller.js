import prisma from '../config/db.js'
import { success } from '../utils/response.js'

export async function getFinancesDashboard(req, res) {
  const orgId = req.user.organizationId

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [accounts, monthMovements, recentMovements, categoryTotals] = await Promise.all([
    // Saldo por cuenta
    prisma.cashAccount.findMany({
      where: { orgId, status: 'active' },
      orderBy: { name: 'asc' },
    }),

    // Ingresos y egresos del mes (solo confirmados)
    prisma.cashMovement.groupBy({
      by: ['type'],
      where: {
        orgId, status: 'confirmed',
        date: { gte: start, lte: end },
        type: { in: ['income', 'expense'] },
      },
      _sum: { amount: true },
    }),

    // Últimos 10 movimientos
    prisma.cashMovement.findMany({
      where: { orgId, status: { not: 'annulled' } },
      include: {
        account:  { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        client:   { select: { id: true, name: true } },
        project:  { select: { id: true, title: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),

    // Gastos por categoría del mes
    prisma.cashMovement.groupBy({
      by: ['categoryId'],
      where: {
        orgId, status: 'confirmed', type: 'expense',
        date: { gte: start, lte: end },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    }),
  ])

  // Saldo total
  const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0)

  // Ingresos / egresos del mes
  const incomeMonth  = Number(monthMovements.find(m => m.type === 'income')?._sum?.amount  ?? 0)
  const expenseMonth = Number(monthMovements.find(m => m.type === 'expense')?._sum?.amount ?? 0)

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
      orgId, status: 'confirmed',
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

  success(res, 200, {
    totalBalance,
    accounts,
    incomeMonth,
    expenseMonth,
    netMonth: incomeMonth - expenseMonth,
    recentMovements,
    categoryBreakdown,
    monthlyEvolution,
  })
}
