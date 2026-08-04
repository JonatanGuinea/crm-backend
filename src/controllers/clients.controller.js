import prisma from '../config/db.js'
import { Prisma } from '@prisma/client'
import { success, fail, paginated } from '../utils/response.js'
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js'

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, city, province, postalCode, cuit, website, notes } = req.body

    if (!name)
      return fail(res, 400, "El nombre es obligatorio")

    if (!req.user.organizationId)
      return fail(res, 400, "Organización activa requerida")

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        company,
        address,
        city,
        province,
        postalCode,
        cuit,
        website,
        notes,
        organizationId: req.user.organizationId,
        createdById: req.user.id
      }
    })

    await prisma.clientHistory.create({
      data: {
        clientId:      client.id,
        userId:        req.user.id,
        action:        'created',
        organizationId: req.user.organizationId,
      }
    })

    return success(res, 201, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getClients = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { name, company } = req.query
    const { page, limit, skip } = parsePagination(req.query)

    const conditions = [Prisma.sql`"organizationId" = ${orgId}`]
    if (name)    conditions.push(Prisma.sql`name ILIKE ${'%' + name + '%'}`)
    if (company) conditions.push(Prisma.sql`company ILIKE ${'%' + company + '%'}`)
    const where = Prisma.join(conditions, ' AND ')

    const [clients, countResult] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM "Client" WHERE ${where} ORDER BY LOWER(name) ASC LIMIT ${limit} OFFSET ${skip}`,
      prisma.$queryRaw`SELECT COUNT(*) AS count FROM "Client" WHERE ${where}`,
    ])
    const total = Number(countResult[0].count)

    return paginated(res, clients, buildPaginationMeta(total, page, limit))

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params

    const client = await prisma.client.findFirst({
      where: { id, organizationId: req.user.organizationId }
    })

    if (!client)
      return fail(res, 404, "Cliente no encontrado")

    return success(res, 200, client)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: req.user.organizationId }
    })

    if (!existing)
      return fail(res, 404, "Cliente no encontrado")

    const allowedFields = ["name", "email", "phone", "company", "address", "city", "province", "postalCode", "cuit", "website", "notes"]
    const updates = {}

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    const FIELD_LABELS = {
      name: 'nombre', email: 'email', phone: 'teléfono', company: 'empresa',
      address: 'dirección', city: 'ciudad', province: 'provincia',
      postalCode: 'código postal', cuit: 'CUIT', website: 'sitio web', notes: 'notas'
    }

    const changedFields = Object.keys(updates).filter(k => updates[k] !== existing[k])

    const updatedClient = await prisma.client.update({
      where: { id },
      data: updates
    })

    if (changedFields.length > 0) {
      await prisma.clientHistory.create({
        data: {
          clientId:      id,
          userId:        req.user.id,
          action:        'updated',
          detail:        changedFields.map(k => FIELD_LABELS[k] || k).join(', '),
          organizationId: req.user.organizationId,
        }
      })
    }

    return success(res, 200, updatedClient)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getClientsDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, newThisMonth] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId } }),
      prisma.client.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } })
    ])

    return success(res, 200, { total, newThisMonth })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getTopClients = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    const quotesByClient = await prisma.quote.groupBy({
      by: ['clientId'],
      where: { organizationId: orgId, status: { in: ['approved', 'signed'] }, clientId: { not: null } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5
    })

    const clientIds = quotesByClient.map(r => r.clientId)
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, company: true }
    })

    const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))

    const result = quotesByClient.map(r => ({
      client: clientMap[r.clientId] ?? { id: r.clientId, name: 'Desconocido' },
      total: r._sum.total || 0
    }))

    return success(res, 200, result)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getAllClientsHistory = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const history = await prisma.clientHistory.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user:   { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      }
    })
    return success(res, 200, history)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getClientHistory = async (req, res) => {
  try {
    const { id } = req.params
    const orgId  = req.user.organizationId

    const client = await prisma.client.findFirst({ where: { id, organizationId: orgId } })
    if (!client) return fail(res, 404, 'Cliente no encontrado')

    const history = await prisma.clientHistory.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true } } }
    })

    return success(res, 200, history)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params

    const existing = await prisma.client.findFirst({
      where: { id, organizationId: req.user.organizationId }
    })

    if (!existing)
      return fail(res, 404, "Cliente no encontrado")

    const [projectCount, quoteCount, invoiceCount] = await Promise.all([
      prisma.project.count({ where: { clientId: id } }),
      prisma.quote.count({ where: { clientId: id } }),
      prisma.invoice.count({ where: { clientId: id } })
    ])

    if (projectCount > 0 || quoteCount > 0 || invoiceCount > 0) {
      const parts = []
      if (projectCount > 0) parts.push(`${projectCount} proyecto${projectCount > 1 ? 's' : ''}`)
      if (quoteCount > 0) parts.push(`${quoteCount} presupuesto${quoteCount > 1 ? 's' : ''}`)
      if (invoiceCount > 0) parts.push(`${invoiceCount} factura${invoiceCount > 1 ? 's' : ''}`)
      return fail(res, 400, `No se puede eliminar el cliente porque tiene ${parts.join(', ')} asociado${parts.length > 1 ? 's' : ''}`)
    }

    await prisma.client.delete({ where: { id } })

    return success(res, 200, { message: "Cliente eliminado correctamente" })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
