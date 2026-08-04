import prisma from '../config/db.js'
import { notify } from './notifications.service.js'

export const IN_TYPES  = ['initial', 'purchase', 'adjustment_in', 'return_in', 'production_in', 'transfer_in', 'correction']
export const OUT_TYPES = ['sale', 'adjustment_out', 'return_out', 'production_out', 'transfer_out']

export function directionFor(type) {
  if (IN_TYPES.includes(type))  return 'IN'
  if (OUT_TYPES.includes(type)) return 'OUT'
  return null
}

export async function createMovement(tx, { orgId, productId, type, quantity, unitCost, reason, reference, quoteId, projectId, clientId, createdById }) {
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
      product: { select: { id: true, sku: true, name: true, unit: true, minStock: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await tx.product.update({
    where: { id: productId },
    data:  { stock: currentStock },
  })

  return movement
}

export async function maybeNotifyStockAlert(orgId, movement) {
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
