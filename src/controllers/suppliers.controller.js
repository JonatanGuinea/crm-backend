import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export async function getSuppliers(req, res) {
  const orgId = req.user.organizationId
  const { search, status } = req.query

  const where = {
    orgId,
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { name:    { contains: search, mode: 'insensitive' } },
        { email:   { contains: search, mode: 'insensitive' } },
        { phone:   { contains: search, mode: 'insensitive' } },
      ]
    } : {})
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  })
  success(res, 200, suppliers)
}

export async function createSupplier(req, res) {
  const orgId = req.user.organizationId
  const { name, email, phone, address, website, notes } = req.body

  if (!name?.trim()) return fail(res, 400, 'El nombre es requerido')

  const supplier = await prisma.supplier.create({
    data: {
      orgId,
      name:    name.trim(),
      email:   email?.trim()   || null,
      phone:   phone?.trim()   || null,
      address: address?.trim() || null,
      website: website?.trim() || null,
      notes:   notes?.trim()   || null,
    },
  })
  success(res, 201, supplier)
}

export async function updateSupplier(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params
  const { name, email, phone, address, website, notes, status } = req.body

  const supplier = await prisma.supplier.findFirst({ where: { id, orgId } })
  if (!supplier) return fail(res, 404, 'Proveedor no encontrado')

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      name:    name?.trim()    ?? supplier.name,
      email:   email !== undefined   ? (email?.trim() || null)   : supplier.email,
      phone:   phone !== undefined   ? (phone?.trim() || null)   : supplier.phone,
      address: address !== undefined ? (address?.trim() || null) : supplier.address,
      website: website !== undefined ? (website?.trim() || null) : supplier.website,
      notes:   notes !== undefined   ? (notes?.trim() || null)   : supplier.notes,
      status:  status ?? supplier.status,
    },
  })
  success(res, 200, updated)
}

export async function deleteSupplier(req, res) {
  const orgId = req.user.organizationId
  const { id } = req.params

  const supplier = await prisma.supplier.findFirst({
    where: { id, orgId },
    include: { _count: { select: { products: true } } },
  })
  if (!supplier) return fail(res, 404, 'Proveedor no encontrado')

  if (supplier._count.products > 0) {
    // Desvincula productos en lugar de bloquear
    await prisma.product.updateMany({
      where: { supplierId: id, orgId },
      data:  { supplierId: null },
    })
  }

  await prisma.supplier.delete({ where: { id } })
  success(res, 200, { message: 'Proveedor eliminado' })
}
