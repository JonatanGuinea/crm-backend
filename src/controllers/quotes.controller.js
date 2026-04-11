import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const allowedTransitions = {
  draft: ['sent', 'expired'],
  sent: ['approved', 'rejected', 'expired'],
  approved: [],
  rejected: [],
  expired: []
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

export const createQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id
    const { title, clientId, projectId, notes, validUntil, taxRate = 0, currency = 'USD', items } = req.body

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

    const last = await prisma.quote.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: 'desc' },
      select: { number: true }
    })
    const number = (last?.number ?? 0) + 1

    const { computed, subtotal, total } = computeItems(items, taxRate)

    const quote = await prisma.quote.create({
      data: {
        number,
        title,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        taxRate: parseFloat(taxRate),
        subtotal,
        total,
        currency,
        clientId,
        projectId: projectId || null,
        organizationId: orgId,
        createdById: userId,
        items: { create: computed }
      },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } }
      }
    })

    return success(res, 201, quote)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getQuotes = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { status, clientId } = req.query

    const where = { organizationId: orgId }
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    const quotes = await prisma.quote.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return success(res, 200, quotes)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getQuoteById = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true, phone: true, company: true } },
        project: { select: { id: true, title: true } }
      }
    })

    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    return success(res, 200, quote)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const quote = await prisma.quote.findFirst({ where: { id, organizationId: orgId } })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    const updates = {}
    const { status, title, notes, validUntil, taxRate, currency, items } = req.body

    if (status && status !== quote.status) {
      const allowed = allowedTransitions[quote.status] || []
      if (!allowed.includes(status)) {
        return fail(
          res, 400,
          `Transición no permitida. Estado actual: ${quote.status}. Permitidos: ${allowed.join(', ') || 'ninguno'}`
        )
      }
      updates.status = status
    }

    for (const key of ['title', 'notes', 'currency']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (validUntil !== undefined) updates.validUntil = validUntil ? new Date(validUntil) : null

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return fail(res, 400, 'Debe incluir al menos un item')
      }
      const rate = taxRate !== undefined ? taxRate : quote.taxRate
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
        await prisma.quoteItem.findMany({ where: { quoteId: id } }),
        taxRate
      )
      updates.taxRate = parseFloat(taxRate)
      updates.subtotal = sub
      updates.total = tot
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: updates,
      include: {
        items: true,
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } }
      }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const quote = await prisma.quote.findFirst({ where: { id, organizationId: orgId } })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (quote.status !== 'draft') return fail(res, 400, 'Solo se pueden eliminar presupuestos en borrador')

    await prisma.quote.delete({ where: { id } })

    return success(res, 200, { message: 'Presupuesto eliminado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createInvoiceFromQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id
    const { id } = req.params
    const { dueDate } = req.body

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: orgId },
      include: { items: true }
    })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (quote.status !== 'approved') return fail(res, 400, 'Solo se puede facturar un presupuesto aprobado')

    const last = await prisma.invoice.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: 'desc' },
      select: { number: true }
    })
    const number = (last?.number ?? 0) + 1

    const invoice = await prisma.invoice.create({
      data: {
        number,
        title: quote.title,
        notes: quote.notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        total: quote.total,
        currency: quote.currency,
        clientId: quote.clientId,
        projectId: quote.projectId,
        quoteId: quote.id,
        organizationId: orgId,
        createdById: userId,
        items: {
          create: quote.items.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.amount
          }))
        }
      },
      include: {
        items: true,
        client: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } }
      }
    })

    return success(res, 201, invoice)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getQuotesDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId

    const byStatus = await prisma.quote.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { status: true },
      _sum: { total: true }
    })

    const totals = await prisma.quote.aggregate({
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { total: true }
    })

    return success(res, 200, {
      summary: {
        totalQuotes: totals._count._all,
        totalValue: totals._sum.total || 0
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
