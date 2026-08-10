import prisma from '../config/db.js'

export async function getMonthlyReportData(orgId, year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const end   = new Date(year, month, 0, 23, 59, 59, 999)

  const [
    org,
    finIncome, finExpense, finPending,
    finCategories, finMonthly,
    quoteSummary, quoteByStatus,
    projectByStatus,
    stockSummary, outOfStock, lowStock,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, defaultCurrency: true,
        owner: { select: { id: true, name: true, email: true } }
      }
    }),

    // Finanzas — ingresos del mes
    prisma.cashMovement.aggregate({
      where: { orgId, status: 'confirmed', type: 'income', date: { gte: start, lte: end } },
      _sum: { amount: true }, _count: { _all: true }
    }),

    // Finanzas — egresos del mes
    prisma.cashMovement.aggregate({
      where: { orgId, status: 'confirmed', type: 'expense', date: { gte: start, lte: end } },
      _sum: { amount: true }, _count: { _all: true }
    }),

    // Finanzas — pendientes
    prisma.cashMovement.groupBy({
      by: ['type'],
      where: { orgId, status: 'pending', type: { in: ['income', 'expense'] } },
      _sum: { amount: true }
    }),

    // Finanzas — top categorías de egreso del mes
    prisma.cashMovement.groupBy({
      by: ['categoryId'],
      where: { orgId, status: 'confirmed', type: 'expense', date: { gte: start, lte: end }, categoryId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    }),

    // Finanzas — evolución últimos 6 meses
    (async () => {
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d   = new Date(year, month - 1 - i, 1)
        const s   = new Date(d.getFullYear(), d.getMonth(), 1)
        const e   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const [inc, exp] = await Promise.all([
          prisma.cashMovement.aggregate({ where: { orgId, status: 'confirmed', type: 'income',  date: { gte: s, lte: e } }, _sum: { amount: true } }),
          prisma.cashMovement.aggregate({ where: { orgId, status: 'confirmed', type: 'expense', date: { gte: s, lte: e } }, _sum: { amount: true } }),
        ])
        months.push({ key, income: Number(inc._sum.amount ?? 0), expense: Number(exp._sum.amount ?? 0) })
      }
      return months
    })(),

    // Presupuestos — resumen histórico
    prisma.quote.aggregate({
      where: { organizationId: orgId },
      _count: { _all: true }, _sum: { total: true }
    }),

    // Presupuestos — por estado
    prisma.quote.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { status: true }, _sum: { total: true }
    }),

    // Proyectos — por estado
    prisma.project.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { status: true }
    }),

    // Stock — resumen
    prisma.product.aggregate({
      where: { orgId },
      _count: { _all: true }
    }),

    // Stock — sin stock
    prisma.product.findMany({
      where: { orgId, stock: { lte: 0 } },
      select: { sku: true, name: true, stock: true, unit: true },
      take: 20
    }),

    // Stock — stock bajo
    prisma.product.findMany({
      where: { orgId, minStock: { gt: 0 }, stock: { gt: 0 } },
      select: { sku: true, name: true, stock: true, minStock: true, unit: true },
      orderBy: { stock: 'asc' },
      take: 20
    }),
  ])

  // Resolver categorías de finanzas
  const catIds = finCategories.map(c => c.categoryId).filter(Boolean)
  const catNames = catIds.length > 0
    ? await prisma.financialCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
    : []
  const catMap = Object.fromEntries(catNames.map(c => [c.id, c.name]))

  // Saldo total de cuentas
  const accounts = await prisma.cashAccount.findMany({ where: { orgId, status: 'active' }, select: { balance: true } })
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0)

  const incomeMonth  = Number(finIncome._sum.amount  ?? 0)
  const expenseMonth = Number(finExpense._sum.amount ?? 0)
  const pendingIncome  = Number(finPending.find(p => p.type === 'income')  ?._sum?.amount ?? 0)
  const pendingExpense = Number(finPending.find(p => p.type === 'expense') ?._sum?.amount ?? 0)

  const lowStockFiltered = lowStock.filter(p => Number(p.stock) <= Number(p.minStock))

  return {
    org,
    currency: org?.defaultCurrency ?? 'ARS',
    finances: {
      incomeMonth,
      expenseMonth,
      netMonth:    incomeMonth - expenseMonth,
      totalBalance,
      incomeCount:  finIncome._count._all,
      expenseCount: finExpense._count._all,
      pendingIncome,
      pendingExpense,
      monthlyEvolution: finMonthly,
      categoryBreakdown: finCategories.map(c => ({
        name:  catMap[c.categoryId] ?? 'Sin categoría',
        total: Number(c._sum.amount ?? 0)
      }))
    },
    quotes: {
      total:    quoteSummary._count._all,
      totalVal: Number(quoteSummary._sum.total ?? 0),
      byStatus: quoteByStatus.map(s => ({
        status: s.status,
        count:  s._count.status,
        total:  Number(s._sum.total ?? 0)
      }))
    },
    projects: {
      byStatus: projectByStatus.map(s => ({
        status: s.status,
        count:  s._count.status
      }))
    },
    stock: {
      totalProducts: stockSummary._count._all,
      outOfStock:    outOfStock.length,
      lowStock:      lowStockFiltered.length,
      outOfStockList: outOfStock,
      lowStockList:   lowStockFiltered,
    }
  }
}
