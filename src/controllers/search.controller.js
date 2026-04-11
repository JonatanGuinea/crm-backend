import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export const globalSearch = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { q } = req.query

    if (!q || q.trim().length < 2) {
      return fail(res, 400, 'El término de búsqueda debe tener al menos 2 caracteres')
    }

    const term = q.trim()
    const contains = { contains: term, mode: 'insensitive' }

    const [clients, projects, quotes, invoices] = await Promise.all([
      prisma.client.findMany({
        where: {
          organizationId: orgId,
          OR: [{ name: contains }, { email: contains }, { company: contains }]
        },
        select: { id: true, name: true, email: true, company: true },
        take: 5
      }),
      prisma.project.findMany({
        where: {
          organizationId: orgId,
          OR: [{ title: contains }, { description: contains }]
        },
        select: {
          id: true, title: true, status: true,
          client: { select: { id: true, name: true } }
        },
        take: 5
      }),
      prisma.quote.findMany({
        where: {
          organizationId: orgId,
          OR: [{ title: contains }, { notes: contains }]
        },
        select: {
          id: true, number: true, title: true, status: true, total: true,
          client: { select: { id: true, name: true } }
        },
        take: 5
      }),
      prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          OR: [{ title: contains }, { notes: contains }]
        },
        select: {
          id: true, number: true, title: true, status: true, total: true,
          client: { select: { id: true, name: true } }
        },
        take: 5
      })
    ])

    const total = clients.length + projects.length + quotes.length + invoices.length

    return success(res, 200, { total, clients, projects, quotes, invoices })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
