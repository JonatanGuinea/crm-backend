import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { notify } from '../services/notifications.service.js'

// Tipos que suman stock (IN) y los que restan (OUT)
const IN_TYPES  = ['initial', 'purchase', 'adjustment_in', 'return_in', 'production_in', 'transfer_in', 'correction']
const OUT_TYPES = ['sale', 'adjustment_out', 'return_out', 'production_out', 'transfer_out']

function directionFor(type) {
  if (IN_TYPES.includes(type))  return 'IN'
  if (OUT_TYPES.includes(type)) return 'OUT'
  return null
}

// ── Helper para crear un movimiento dentro de una transacción ────────────────
async function createMovement(tx, { orgId, productId, type, quantity, unitCost, reason, reference, quoteId, projectId, clientId, createdById }) {
  const direction = directionFor(type)
  if (!direction) throw new Error(`Tipo de movimiento inválido: ${type}`)

  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product) throw new Error('Producto no encontrado')
  if (product.orgId !== orgId) throw new Error('Producto no pertenece a esta organización')

  const qty  = Number(quantity)
  const prev = Number(product.stock)

  if (direction === 'OUT' && prev < qty) {
    throw new Error(`Stock insuficiente. Disponible: ${prev} ${product.unit}, solicitado: ${qty} ${product.unit}`)
  }

  const currentStock = direction === 'IN' ? prev + qty : prev - qty
  const totalCost    = unitCost ? qty * Number(unitCost) : null

  const movement = await tx.stockMovement.create({
    data: {
      orgId, productId, type, direction,
      quantity: qty,
      previousStock: prev,
      currentStock,
      unitCost: unitCost ? Number(unitCost) : null,
      totalCost,
      reason,
      reference,
      quoteId:   quoteId   || null,
      projectId: projectId || null,
      clientId:  clientId  || null,
      createdById,
    },
    include: {
      product:   { select: { id: true, sku: true, name: true, unit: true, minStock: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await tx.product.update({
    where: { id: productId },
    data:  { stock: currentStock },
  })

  return movement
}

// ── Notificaciones de stock bajo / sin stock ──────────────────────────────────
async function maybeNotifyStockAlert(orgId, movement) {
  try {
    const stock = Number(movement.currentStock)
    const min   = Number(movement.product.minStock)

    let type, title, message
    if (stock <= 0) {
      type    = 'stock_out'
      title   = 'Producto sin stock'
      message = `"${movement.product.name}" (${movement.product.sku}) quedó sin stock`
    } else if (min > 0 && stock <= min) {
      type    = 'stock_low'
      title   = 'Stock bajo'
      message = `"${movement.product.name}" tiene stock bajo: ${stock} ${movement.product.unit} (mínimo: ${min})`
    } else {
      return
    }

    const admins = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId, status: 'active', role: { in: ['owner', 'admin'] } },
      select: { userId: true },
    })

    await Promise.all(admins.map(m =>
      notify({ type, title, message, userId: m.userId, orgId, refId: movement.productId, reactivate: true })
    ))
  } catch {
    // non-critical
  }
}

// ── POST /stock/in ────────────────────────────────────────────────────────────
export async function stockIn(req, res) {
  const orgId = req.user.organizationId
  const { productId, type, quantity, unitCost, reason, reference, quoteId, projectId, clientId } = req.body

  if (!productId)            return fail(res, 400, 'productId es requerido')
  if (!type)                 return fail(res, 400, 'type es requerido')
  if (!IN_TYPES.includes(type)) return fail(res, 400, `Tipo inválido para ingreso. Opciones: ${IN_TYPES.join(', ')}`)
  if (!quantity || Number(quantity) <= 0) return fail(res, 400, 'quantity debe ser mayor a 0')

  const movement = await prisma.$transaction(tx =>
    createMovement(tx, {
      orgId, productId, type, quantity, unitCost,
      reason, reference, quoteId, projectId, clientId,
      createdById: req.user.id,
    })
  )
  await maybeNotifyStockAlert(orgId, movement)
  success(res, 201, movement)
}

// ── POST /stock/out ───────────────────────────────────────────────────────────
export async function stockOut(req, res) {
  const orgId = req.user.organizationId
  const { productId, type, quantity, unitCost, reason, reference, quoteId, projectId, clientId } = req.body

  if (!productId)             return fail(res, 400, 'productId es requerido')
  if (!type)                  return fail(res, 400, 'type es requerido')
  if (!OUT_TYPES.includes(type)) return fail(res, 400, `Tipo inválido para egreso. Opciones: ${OUT_TYPES.join(', ')}`)
  if (!quantity || Number(quantity) <= 0) return fail(res, 400, 'quantity debe ser mayor a 0')

  try {
    const movement = await prisma.$transaction(tx =>
      createMovement(tx, {
        orgId, productId, type, quantity, unitCost,
        reason, reference, quoteId, projectId, clientId,
        createdById: req.user.id,
      })
    )
    await maybeNotifyStockAlert(orgId, movement)
    success(res, 201, movement)
  } catch (err) {
    if (err.message.startsWith('Stock insuficiente')) return fail(res, 422, err.message)
    throw err
  }
}

// ── POST /stock/adjustment ────────────────────────────────────────────────────
// Recibe un valor absoluto de stock deseado y calcula la diferencia
export async function stockAdjustment(req, res) {
  const orgId = req.user.organizationId
  const { productId, targetStock, reason, reference } = req.body

  if (!productId)                     return fail(res, 400, 'productId es requerido')
  if (targetStock === undefined || targetStock === null) return fail(res, 400, 'targetStock es requerido')
  if (Number(targetStock) < 0)        return fail(res, 400, 'targetStock no puede ser negativo')

  const product = await prisma.product.findFirst({ where: { id: productId, orgId } })
  if (!product) return fail(res, 404, 'Producto no encontrado')

  const current = Number(product.stock)
  const target  = Number(targetStock)
  const diff    = target - current

  if (diff === 0) return success(res, 200, { message: 'El stock ya está en el valor indicado', stock: current })

  const type = diff > 0 ? 'adjustment_in' : 'adjustment_out'

  const movement = await prisma.$transaction(tx =>
    createMovement(tx, {
      orgId, productId,
      type,
      quantity: Math.abs(diff),
      reason: reason || `Ajuste de inventario: ${current} → ${target}`,
      reference,
      createdById: req.user.id,
    })
  )
  await maybeNotifyStockAlert(orgId, movement)
  success(res, 201, movement)
}

// ── GET /stock/movements ──────────────────────────────────────────────────────
export async function getMovements(req, res) {
  const orgId = req.user.organizationId
  const { productId, type, direction, from, to, page = 1, limit = 25 } = req.query

  const where = { orgId }
  if (productId) where.productId = productId
  if (type)      where.type      = type
  if (direction) where.direction = direction
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
        product:   { select: { id: true, sku: true, name: true, unit: true } },
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

  success(res, 200, { movements, total, page: Number(page), limit: Number(limit) })
}

// ── GET /stock/dashboard ──────────────────────────────────────────────────────
export async function getStockDashboard(req, res) {
  const orgId = req.user.organizationId
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalProducts,
    activeProducts,
    outOfStockProducts,
    discontinuedProducts,
    recentMovements,
    inventoryValue,
    movementsByType,
    topProducts,
  ] = await Promise.all([
    prisma.product.count({ where: { orgId } }),

    prisma.product.count({ where: { orgId, status: 'active' } }),

    // stock <= 0 y activos
    prisma.product.count({ where: { orgId, status: 'active', stock: { lte: 0 } } }),

    prisma.product.count({ where: { orgId, status: 'discontinued' } }),

    // Últimos 10 movimientos
    prisma.stockMovement.findMany({
      where: { orgId },
      include: {
        product:   { select: { id: true, sku: true, name: true, unit: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Valor total del inventario: SUM(stock * costPrice) para activos con costo definido
    prisma.product.findMany({
      where: { orgId, status: { not: 'discontinued' }, costPrice: { not: null } },
      select: { stock: true, costPrice: true },
    }),

    // Conteo de movimientos por tipo (últimos 30 días)
    prisma.stockMovement.groupBy({
      by: ['type'],
      where: { orgId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),

    // Top 5 productos con más movimientos en últimos 30 días
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { orgId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ])

  // Calcular stock bajo en JS (requiere comparar dos campos)
  const allActive = await prisma.product.findMany({
    where: { orgId, status: 'active' },
    select: { stock: true, minStock: true },
  })
  const lowStock = allActive.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.minStock)).length

  // Valor total del inventario
  const totalInventoryValue = inventoryValue.reduce((acc, p) => {
    return acc + Number(p.stock) * Number(p.costPrice)
  }, 0)

  // Mapear top productos con nombre
  const topProductIds = topProducts.map(t => t.productId)
  const topProductDetails = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, sku: true, name: true, stock: true, unit: true },
  })
  const topProductsWithCount = topProducts.map(t => ({
    ...topProductDetails.find(p => p.id === t.productId),
    movementCount: t._count.id,
  }))

  success(res, 200, {
    totalProducts,
    activeProducts,
    outOfStock: outOfStockProducts,
    lowStock,
    discontinued: discontinuedProducts,
    totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
    recentMovements,
    movementsByType: Object.fromEntries(movementsByType.map(m => [m.type, m._count.id])),
    topProducts: topProductsWithCount,
  })
}
