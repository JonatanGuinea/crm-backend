import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { notify } from '../services/notifications.service.js'

const allowedTransitions = {
  draft: ['sent', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  paid: [],
  overdue: ['paid', 'cancelled'],
  cancelled: []
}

function computeItems(items, taxRate) {
  const computed = items.map(item => ({
    description: item.description,
    quantity: parseFloat(item.quantity),
    unitPrice: parseFloat(item.unitPrice),
    amount: parseFloat(item.quantity) * parseFloat(item.unitPrice)
  }))
  const subtotal = computed.reduce((acc, i) => acc + i.amount, 0)
  const total = subtotal + subtotal * (parseFloat(taxRate) / 100)
  return { computed, subtotal, total }
}

export const createInvoice = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id
    const { title, clientId, projectId, quoteId, notes, dueDate, taxRate = 0, currency = 'USD', items } = req.body

    if (!title || !clientId) {
      return fail(res, 400, 'El título y el cliente son requeridos')
    }
    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, 400, 'Debe incluir al menos un item')
    }

    const clientExists = await prisma.client.findFirst({
      where: { id: clientId, organizationId: orgId },
      select: { id: true }
    })
    if (!clientExists) return fail(res, 404, 'Cliente no encontrado en esta organización')

    if (projectId) {
      const projectExists = await prisma.project.findFirst({
        where: { id: projectId, organizationId: orgId },
        select: { id: true }
      })
      if (!projectExists) return fail(res, 404, 'Proyecto no encontrado en esta organización')
    }

    if (quoteId) {
      const quoteExists = await prisma.quote.findFirst({
        where: { id: quoteId, organizationId: orgId },
        select: { id: true }
      })
      if (!quoteExists) return fail(res, 404, 'Presupuesto no encontrado en esta organización')
    }

    const last = await prisma.invoice.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: 'desc' },
      select: { number: true }
    })
    const number = (last?.number ?? 0) + 1

    const { computed, subtotal, total } = computeItems(items, taxRate)

    const invoice = await prisma.invoice.create({
      data: {
        number,
        title,
        notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        taxRate: parseFloat(taxRate),
        subtotal,
        total,
        currency,
        clientId,
        projectId: projectId || null,
        quoteId: quoteId || null,
        organizationId: orgId,
        createdById: userId,
        items: { create: computed }
      },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
        quote: { select: { id: true, number: true, title: true } }
      }
    })

    return success(res, 201, invoice)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getInvoices = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { status, clientId } = req.query

    const where = { organizationId: orgId }
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        quote: { select: { id: true, number: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return success(res, 200, invoices)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getInvoiceById = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true, phone: true, company: true } },
        project: { select: { id: true, title: true } },
        quote: { select: { id: true, number: true, title: true } }
      }
    })

    if (!invoice) return fail(res, 404, 'Factura no encontrada')

    return success(res, 200, invoice)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateInvoice = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const invoice = await prisma.invoice.findFirst({ where: { id, organizationId: orgId } })
    if (!invoice) return fail(res, 404, 'Factura no encontrada')

    const updates = {}
    const { status, title, notes, dueDate, taxRate, currency, items } = req.body

    if (status && status !== invoice.status) {
      const allowed = allowedTransitions[invoice.status] || []
      if (!allowed.includes(status)) {
        return fail(
          res, 400,
          `Transición no permitida. Estado actual: ${invoice.status}. Permitidos: ${allowed.join(', ') || 'ninguno'}`
        )
      }
      updates.status = status

      if (status === 'paid') {
        await notify({
          type: 'invoice_paid',
          title: 'Factura pagada',
          message: `La factura #${invoice.number} "${invoice.title}" fue marcada como pagada`,
          userId: invoice.createdById,
          orgId,
          refId: invoice.id
        })
      }
    }

    for (const key of ['title', 'notes', 'currency']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return fail(res, 400, 'Debe incluir al menos un item')
      }
      const rate = taxRate !== undefined ? taxRate : invoice.taxRate
      const { computed, subtotal, total } = computeItems(items, rate)
      updates.taxRate = parseFloat(rate)
      updates.subtotal = subtotal
      updates.total = total
      updates.items = {
        deleteMany: {},
        create: computed
      }
    } else if (taxRate !== undefined) {
      const { subtotal: sub, total: tot } = computeItems(
        await prisma.invoiceItem.findMany({ where: { invoiceId: id } }),
        taxRate
      )
      updates.taxRate = parseFloat(taxRate)
      updates.subtotal = sub
      updates.total = tot
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: updates,
      include: {
        items: true,
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        quote: { select: { id: true, number: true } }
      }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteInvoice = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const invoice = await prisma.invoice.findFirst({ where: { id, organizationId: orgId } })
    if (!invoice) return fail(res, 404, 'Factura no encontrada')
    if (invoice.status !== 'draft') return fail(res, 400, 'Solo se pueden eliminar facturas en borrador')

    await prisma.invoice.delete({ where: { id } })

    return success(res, 200, { message: 'Factura eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getInvoicesDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    const byStatus = await prisma.invoice.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { status: true },
      _sum: { total: true }
    })

    const totals = await prisma.invoice.aggregate({
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { total: true }
    })

    const paid = byStatus.find(s => s.status === 'paid')
    const overdue = byStatus.find(s => s.status === 'overdue')
    const pending = byStatus.filter(s => ['draft', 'sent'].includes(s.status))
    const pendingTotal = pending.reduce((acc, s) => acc + (s._sum.total || 0), 0)

    return success(res, 200, {
      summary: {
        totalInvoices: totals._count._all,
        totalValue: totals._sum.total || 0,
        paid: paid?._sum.total || 0,
        overdue: overdue?._sum.total || 0,
        pending: pendingTotal
      },
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.status,
        total: s._sum.total || 0
      }))
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
