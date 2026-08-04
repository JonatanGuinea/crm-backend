import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const DEFAULT_CATEGORIES = [
  { name: 'Ventas',              type: 'income'  },
  { name: 'Servicios',           type: 'income'  },
  { name: 'Cobro de cliente',    type: 'income'  },
  { name: 'Intereses / renta',   type: 'income'  },
  { name: 'Otros ingresos',      type: 'income'  },
  { name: 'Compras / mercadería',type: 'expense' },
  { name: 'Sueldos y honorarios',type: 'expense' },
  { name: 'Impuestos y tasas',   type: 'expense' },
  { name: 'Alquiler',            type: 'expense' },
  { name: 'Servicios (luz, agua, internet)', type: 'expense' },
  { name: 'Marketing y publicidad',          type: 'expense' },
  { name: 'Transporte y combustible',        type: 'expense' },
  { name: 'Mantenimiento',       type: 'expense' },
  { name: 'Gastos bancarios',    type: 'expense' },
  { name: 'Gastos generales',    type: 'expense' },
]

export async function seedDefaultCategories(orgId) {
  const existing = await prisma.financialCategory.count({ where: { orgId } })
  if (existing > 0) return
  await prisma.financialCategory.createMany({
    data: DEFAULT_CATEGORIES.map(c => ({ orgId, ...c, isDefault: true })),
    skipDuplicates: true,
  })
}

export async function getCategories(req, res) {
  const orgId = req.user.organizationId
  const { type } = req.query

  const categories = await prisma.financialCategory.findMany({
    where: { orgId, ...(type ? { type } : {}) },
    include: {
      children: { orderBy: { name: 'asc' } },
      _count: { select: { movements: true } },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })
  success(res, 200, categories)
}

export async function createCategory(req, res) {
  const orgId = req.user.organizationId
  const { name, type, parentId, color } = req.body

  if (!name?.trim())               return fail(res, 400, 'El nombre es requerido')
  if (!['income','expense'].includes(type)) return fail(res, 400, 'Tipo inválido')

  const exists = await prisma.financialCategory.findUnique({
    where: { orgId_name_type: { orgId, name: name.trim(), type } }
  })
  if (exists) return fail(res, 409, 'Ya existe una categoría con ese nombre y tipo')

  const category = await prisma.financialCategory.create({
    data: { orgId, name: name.trim(), type, parentId: parentId || null, color: color || null },
  })
  success(res, 201, category)
}

export async function updateCategory(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const { name, color, parentId } = req.body

  const cat = await prisma.financialCategory.findFirst({ where: { id, orgId } })
  if (!cat) return fail(res, 404, 'Categoría no encontrada')

  const updated = await prisma.financialCategory.update({
    where: { id },
    data: {
      name:     name?.trim()                    ?? cat.name,
      color:    color !== undefined ? color : cat.color,
      parentId: parentId !== undefined ? (parentId || null) : cat.parentId,
    },
  })
  success(res, 200, updated)
}

export async function deleteCategory(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const cat = await prisma.financialCategory.findFirst({
    where: { id, orgId },
    include: { _count: { select: { movements: true } } },
  })
  if (!cat) return fail(res, 404, 'Categoría no encontrada')
  if (cat._count.movements > 0) return fail(res, 409, `No se puede eliminar: tiene ${cat._count.movements} movimiento(s) asociado(s)`)

  await prisma.financialCategory.delete({ where: { id } })
  success(res, 200, { message: 'Categoría eliminada' })
}

export async function seedCategories(req, res) {
  const orgId = req.user.organizationId
  await seedDefaultCategories(orgId)
  success(res, 200, { message: 'Categorías inicializadas' })
}
