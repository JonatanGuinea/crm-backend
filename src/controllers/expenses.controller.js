import prisma from '../config/db.js'
import { success, fail, paginated } from '../utils/response.js'
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js'

const DEFAULT_CATEGORIES = [
  'Proveedores', 'Materia prima', 'Alquiler', 'Sueldos',
  'Servicios', 'Marketing', 'Impuestos', 'Otros'
]

async function ensureDefaultCategories(orgId) {
  const existing = await prisma.expenseCategory.count({ where: { organizationId: orgId } })
  if (existing === 0) {
    await prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map(name => ({ name, isDefault: true, organizationId: orgId }))
    })
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const getCategories = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    await ensureDefaultCategories(orgId)
    const categories = await prisma.expenseCategory.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    })
    return success(res, 200, categories)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createCategory = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { name } = req.body
    if (!name?.trim()) return fail(res, 400, 'El nombre es requerido')
    const category = await prisma.expenseCategory.create({
      data: { name: name.trim(), organizationId: orgId }
    })
    return success(res, 201, category)
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 400, 'Ya existe una categoría con ese nombre')
    return fail(res, 500, error.message)
  }
}

export const deleteCategory = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params
    const category = await prisma.expenseCategory.findFirst({ where: { id, organizationId: orgId } })
    if (!category) return fail(res, 404, 'Categoría no encontrada')
    if (category.isDefault) return fail(res, 400, 'No se pueden eliminar las categorías por defecto')
    const inUse = await prisma.expense.count({ where: { categoryId: id } })
    if (inUse > 0) return fail(res, 400, 'La categoría tiene egresos asociados')
    await prisma.expenseCategory.delete({ where: { id } })
    return success(res, 200, { message: 'Categoría eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const getExpenses = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { categoryId, from, to } = req.query
    const { page, limit, skip } = parsePagination(req.query)

    const where = { organizationId: orgId }
    if (categoryId) where.categoryId = categoryId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) where.date.lte = new Date(to)
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: limit
      }),
      prisma.expense.count({ where })
    ])

    return paginated(res, expenses, buildPaginationMeta(total, page, limit))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createExpense = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id
    const { title, amount, date, categoryId, notes } = req.body

    if (!title || !amount || !date || !categoryId) {
      return fail(res, 400, 'Título, monto, fecha y categoría son requeridos')
    }

    const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, organizationId: orgId } })
    if (!category) return fail(res, 404, 'Categoría no encontrada')

    const expense = await prisma.expense.create({
      data: {
        title,
        amount: parseFloat(amount),
        date: new Date(date),
        notes: notes || null,
        categoryId,
        organizationId: orgId,
        createdById: userId
      },
      include: { category: { select: { id: true, name: true } } }
    })

    return success(res, 201, expense)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateExpense = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params
    const { title, amount, date, categoryId, notes } = req.body

    const expense = await prisma.expense.findFirst({ where: { id, organizationId: orgId } })
    if (!expense) return fail(res, 404, 'Egreso no encontrado')

    const updates = {}
    if (title !== undefined) updates.title = title
    if (amount !== undefined) updates.amount = parseFloat(amount)
    if (date !== undefined) updates.date = new Date(date)
    if (notes !== undefined) updates.notes = notes || null
    if (categoryId !== undefined) {
      const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, organizationId: orgId } })
      if (!category) return fail(res, 404, 'Categoría no encontrada')
      updates.categoryId = categoryId
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: updates,
      include: { category: { select: { id: true, name: true } } }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteExpense = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params
    const expense = await prisma.expense.findFirst({ where: { id, organizationId: orgId } })
    if (!expense) return fail(res, 404, 'Egreso no encontrado')
    await prisma.expense.delete({ where: { id } })
    return success(res, 200, { message: 'Egreso eliminado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getExpensesDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const [totalMonth, byCategory, monthly] = await Promise.all([
      prisma.expense.aggregate({
        where: { organizationId: orgId, date: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: { organizationId: orgId, date: { gte: startOfMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } }
      }),
      prisma.expense.findMany({
        where: { organizationId: orgId, date: { gte: since } },
        select: { amount: true, date: true }
      })
    ])

    // Enriquecer byCategory con nombre
    const categoryIds = byCategory.map(b => b.categoryId)
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    })
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]))

    return success(res, 200, {
      totalMonth: totalMonth._sum.amount || 0,
      byCategory: byCategory.map(b => ({
        categoryId: b.categoryId,
        name: catMap[b.categoryId] || 'Sin categoría',
        total: b._sum.amount || 0
      })),
      monthly
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
