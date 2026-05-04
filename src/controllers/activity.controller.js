import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export const getRecentActivity = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    const [invoices, quotes, projects] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: orgId },
        select: {
          id: true, number: true, title: true, status: true, total: true, createdAt: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.quote.findMany({
        where: { organizationId: orgId },
        select: {
          id: true, number: true, title: true, status: true, total: true, createdAt: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.project.findMany({
        where: { organizationId: orgId },
        select: {
          id: true, title: true, status: true, createdAt: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    const feed = [
      ...invoices.map(i => ({ type: 'invoice', createdAt: i.createdAt, data: i })),
      ...quotes.map(q => ({ type: 'quote', createdAt: q.createdAt, data: q })),
      ...projects.map(p => ({ type: 'project', createdAt: p.createdAt, data: p }))
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)

    return success(res, 200, feed)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
