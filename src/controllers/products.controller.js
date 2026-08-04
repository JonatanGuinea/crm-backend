import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const VALID_UNITS    = ['unidad', 'kg', 'g', 'litro', 'ml', 'm', 'cm', 'm²', 'm³', 'caja', 'par', 'rollo', 'bolsa']
const VALID_STATUSES = ['active', 'inactive', 'discontinued']

export async function getProducts(req, res) {
  const orgId = req.user.organizationId
  if (!orgId) return fail(res, 403, 'Organización activa requerida')
  const {
    search, status, categoryId,
    lowStock, outOfStock,
    page = 1, limit = 50,
  } = req.query

  const where = { orgId }
  if (status)     where.status = status
  if (categoryId) where.categoryId = categoryId
  if (search)     where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { sku:  { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
  ]
  if (outOfStock === 'true') where.stock = { lte: 0 }

  // "Stock bajo" requiere comparar dos campos del mismo registro — lo manejamos post-query
  const skip = (Number(page) - 1) * Number(limit)
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true } },
        supplier: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: Number(limit),
    }),
  ])

  // Filtramos stock bajo en JS (stock > 0 && stock <= minStock)
  const finalItems = lowStock === 'true' && outOfStock !== 'true'
    ? items.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock))
    : items

  // Stock comprometido: suma de ítems en tareas no completadas
  const productIds = finalItems.map(p => p.id)
  const committed = await prisma.taskStockItem.groupBy({
    by: ['productId'],
    where: {
      organizationId: orgId,
      productId: { in: productIds },
      task: { status: { not: 'done' } },
    },
    _sum: { quantity: true },
  })
  const committedMap = Object.fromEntries(
    committed.map(c => [c.productId, Number(c._sum.quantity ?? 0)])
  )
  const itemsWithCommitted = finalItems.map(p => ({
    ...p,
    committedStock: committedMap[p.id] ?? 0,
  }))

  success(res, 200, { items: itemsWithCommitted, total, page: Number(page), limit: Number(limit) })
}

export async function getProduct(req, res) {
  const orgId = req.user.organizationId
  if (!orgId) return fail(res, 403, 'Organización activa requerida')
  const { id } = req.params

  const product = await prisma.product.findFirst({
    where: { id, orgId },
    include: {
      category: { select: { id: true, name: true, color: true } },
      supplier: { select: { id: true, name: true, email: true, phone: true } },
      _count: { select: { movements: true } },
    },
  })
  if (!product) return fail(res, 404, 'Producto no encontrado')

  success(res, 200, product)
}

export async function createProduct(req, res) {
  const orgId     = req.user.organizationId
  const createdBy = req.user.id
  if (!orgId) return fail(res, 403, 'Organización activa requerida')
  const {
    sku, name, description, unit = 'unidad',
    categoryId, supplierId, costPrice, salePrice,
    minStock = 0, maxStock,
    initialStock = 0, initialReason,
  } = req.body

  if (!sku?.trim())  return fail(res, 400, 'El SKU es requerido')
  if (!name?.trim()) return fail(res, 400, 'El nombre es requerido')
  if (!VALID_UNITS.includes(unit)) return fail(res, 400, `Unidad inválida. Opciones: ${VALID_UNITS.join(', ')}`)
  if (Number(initialStock) < 0) return fail(res, 400, 'El stock inicial no puede ser negativo')

  const exists = await prisma.product.findUnique({ where: { orgId_sku: { orgId, sku: sku.trim() } } })
  if (exists) return fail(res, 409, `Ya existe un producto con el SKU "${sku.trim()}"`)

  if (categoryId) {
    const cat = await prisma.productCategory.findFirst({ where: { id: categoryId, orgId } })
    if (!cat) return fail(res, 404, 'Categoría no encontrada')
  }

  const qty = Number(initialStock)

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        orgId, sku: sku.trim(), name: name.trim(), description,
        unit, categoryId: categoryId || null, supplierId: supplierId || null,
        costPrice: costPrice ? Number(costPrice) : null,
        salePrice: salePrice ? Number(salePrice) : null,
        minStock: Number(minStock),
        maxStock: maxStock ? Number(maxStock) : null,
        stock: qty,
      },
    })

    if (qty > 0) {
      await tx.stockMovement.create({
        data: {
          orgId, productId: p.id,
          type: 'initial', direction: 'IN',
          quantity: qty, previousStock: 0, currentStock: qty,
          unitCost: costPrice ? Number(costPrice) : null,
          totalCost: costPrice ? qty * Number(costPrice) : null,
          reason: initialReason || 'Carga inicial de stock',
          createdById: createdBy,
        },
      })
    }

    return p
  })

  success(res, 201, product)
}

export async function updateProduct(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const {
    name, description, unit, categoryId, supplierId,
    costPrice, salePrice, minStock, maxStock, status,
  } = req.body

  const product = await prisma.product.findFirst({ where: { id, orgId } })
  if (!product) return fail(res, 404, 'Producto no encontrado')

  if (unit && !VALID_UNITS.includes(unit)) return fail(res, 400, `Unidad inválida. Opciones: ${VALID_UNITS.join(', ')}`)
  if (status && !VALID_STATUSES.includes(status)) return fail(res, 400, 'Estado inválido')
  if (categoryId) {
    const cat = await prisma.productCategory.findFirst({ where: { id: categoryId, orgId } })
    if (!cat) return fail(res, 404, 'Categoría no encontrada')
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      name:        name?.trim()              ?? product.name,
      description: description               ?? product.description,
      unit:        unit                      ?? product.unit,
      categoryId:  categoryId !== undefined  ? (categoryId || null)  : product.categoryId,
      supplierId:  supplierId !== undefined  ? (supplierId || null)  : product.supplierId,
      costPrice:   costPrice !== undefined  ? (costPrice ? Number(costPrice) : null) : product.costPrice,
      salePrice:   salePrice !== undefined  ? (salePrice ? Number(salePrice) : null) : product.salePrice,
      minStock:    minStock !== undefined   ? Number(minStock)  : product.minStock,
      maxStock:    maxStock !== undefined   ? (maxStock ? Number(maxStock) : null) : product.maxStock,
      status:      status                    ?? product.status,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      supplier: { select: { id: true, name: true, phone: true } },
    },
  })
  success(res, 200, updated)
}

export async function deleteProduct(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const product = await prisma.product.findFirst({
    where: { id, orgId },
    include: { _count: { select: { movements: true } } },
  })
  if (!product) return fail(res, 404, 'Producto no encontrado')

  // Si tiene movimientos, marcar como descontinuado en lugar de eliminar (integridad del Kardex)
  if (product._count.movements > 0) {
    const updated = await prisma.product.update({
      where: { id },
      data: { status: 'discontinued' },
    })
    return success(res, 200, { ...updated, _softDeleted: true, message: 'El producto tiene movimientos registrados y fue marcado como descontinuado.' })
  }

  await prisma.product.delete({ where: { id } })
  success(res, 200, { message: 'Producto eliminado' })
}

export async function getProductMovements(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const { type, from, to, page = 1, limit = 25 } = req.query

  const product = await prisma.product.findFirst({ where: { id, orgId } })
  if (!product) return fail(res, 404, 'Producto no encontrado')

  const where = { orgId, productId: id }
  if (type) where.type = type
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to)   where.createdAt.lte = new Date(to + 'T23:59:59Z')
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        quote:     { select: { id: true, number: true, title: true } },
        project:   { select: { id: true, title: true } },
        client:    { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
  ])

  success(res, 200, { product, movements, total, page: Number(page), limit: Number(limit) })
}
