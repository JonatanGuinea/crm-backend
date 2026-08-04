import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export async function getCategories(req, res) {
  const orgId = req.user.organizationId
  const categories = await prisma.productCategory.findMany({
    where: { orgId },
    include: {
      children: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  })
  success(res, 200, categories)
}

export async function createCategory(req, res) {
  const orgId = req.user.organizationId
  const { name, description, color, parentId } = req.body

  if (!name?.trim()) return fail(res, 400, 'El nombre es requerido')

  if (parentId) {
    const parent = await prisma.productCategory.findFirst({ where: { id: parentId, orgId } })
    if (!parent) return fail(res, 404, 'Categoría padre no encontrada')
    if (parent.parentId) return fail(res, 400, 'No se permiten más de 2 niveles de categorías')
  }

  const exists = await prisma.productCategory.findUnique({ where: { orgId_name: { orgId, name: name.trim() } } })
  if (exists) return fail(res, 409, 'Ya existe una categoría con ese nombre')

  const category = await prisma.productCategory.create({
    data: { orgId, name: name.trim(), description, color, parentId: parentId || null },
  })
  success(res, 201, category)
}

export async function updateCategory(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const { name, description, color, parentId } = req.body

  const category = await prisma.productCategory.findFirst({ where: { id, orgId } })
  if (!category) return fail(res, 404, 'Categoría no encontrada')

  if (name && name.trim() !== category.name) {
    const exists = await prisma.productCategory.findUnique({ where: { orgId_name: { orgId, name: name.trim() } } })
    if (exists) return fail(res, 409, 'Ya existe una categoría con ese nombre')
  }

  const updated = await prisma.productCategory.update({
    where: { id },
    data: {
      name:        name?.trim() ?? category.name,
      description: description ?? category.description,
      color:       color ?? category.color,
      parentId:    parentId !== undefined ? (parentId || null) : category.parentId,
    },
  })
  success(res, 200, updated)
}

export async function deleteCategory(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const category = await prisma.productCategory.findFirst({
    where: { id, orgId },
    include: { _count: { select: { products: true } } },
  })
  if (!category) return fail(res, 404, 'Categoría no encontrada')
  if (category._count.products > 0) return fail(res, 409, `No se puede eliminar: tiene ${category._count.products} producto(s) asignado(s)`)

  await prisma.productCategory.delete({ where: { id } })
  success(res, 200, { message: 'Categoría eliminada' })
}
