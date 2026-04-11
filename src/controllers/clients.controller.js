import prisma from '../config/db.js'
import { success, fail, paginated } from '../utils/response.js'
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js'

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, company, notes } = req.body

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
        notes,
        organizationId: req.user.organizationId,
        createdById: req.user.id
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

    const where = { organizationId: orgId }
    if (name) where.name = { contains: name, mode: 'insensitive' }
    if (company) where.company = { contains: company, mode: 'insensitive' }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.client.count({ where })
    ])

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

    const allowedFields = ["name", "email", "phone", "company", "notes"]
    const updates = {}

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: updates
    })

    return success(res, 200, updatedClient)

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

    await prisma.client.delete({ where: { id } })

    return success(res, 200, { message: "Cliente eliminado correctamente" })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
