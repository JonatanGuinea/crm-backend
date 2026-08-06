import prisma from '../config/db.js'
import { success, fail, paginated } from '../utils/response.js'
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js'
import { notify } from '../services/notifications.service.js'
import { sendQuoteEmail } from '../services/email.service.js'
import { syncQuoteMovements } from '../services/finances.service.js'

const allowedTransitions = {
  draft:     ['sent', 'expired'],
  sent:      ['approved', 'rejected', 'expired'],
  approved:  ['cancelled'],
  signed:    ['cancelled'],
  rejected:  [],
  expired:   [],
  cancelled: [],
}

function computeItems(items, taxRate, discountType = null, discountValue = 0) {
  const computed = items.map(item => ({
    description: item.description,
    quantity: parseFloat(item.quantity),
    unitPrice: parseFloat(item.unitPrice),
    amount: parseFloat(item.quantity) * parseFloat(item.unitPrice)
  }))
  const subtotal = computed.reduce((acc, i) => acc + i.amount, 0)
  const rate = parseFloat(taxRate) || 0
  const discAmt = discountType === 'percent'
    ? subtotal * ((parseFloat(discountValue) || 0) / 100)
    : parseFloat(discountValue) || 0
  const discountedSubtotal = subtotal - discAmt
  const total = discountedSubtotal + discountedSubtotal * (rate / 100)
  return { computed, subtotal, total }
}

export const createQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const userId = req.user.id
    const {
      title, clientId, projectId, notes, validUntil, deliveryDate, taxRate = 0, currency = 'USD', items,
      potentialClientName, potentialClientEmail, potentialClientPhone, potentialClientCompany, potentialProjectTitle,
      discountType = null, discountValue = 0
    } = req.body

    const isPotential = !clientId && potentialClientName

    if (!title) return fail(res, 400, 'El título es requerido')
    if (!isPotential && !clientId) return fail(res, 400, 'El cliente es requerido')
    if (!Array.isArray(items) || items.length === 0) return fail(res, 400, 'Debe incluir al menos un item')

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: { id: clientId, organizationId: orgId },
        select: { id: true }
      })
      if (!clientExists) return fail(res, 404, 'Cliente no encontrado en esta organización')

      if (projectId) {
        const projectExists = await prisma.project.findFirst({
          where: { id: projectId, organizationId: orgId },
          select: { id: true, clientId: true }
        })
        if (!projectExists) return fail(res, 404, 'Proyecto no encontrado en esta organización')
        if (projectExists.clientId !== clientId) return fail(res, 400, 'El proyecto no pertenece al cliente seleccionado')
      }
    }

    const last = await prisma.quote.findFirst({
      where: { organizationId: orgId },
      orderBy: { number: 'desc' },
      select: { number: true }
    })
    const number = (last?.number ?? 0) + 1

    const { computed, subtotal, total } = computeItems(items, taxRate, discountType, discountValue)

    const quote = await prisma.quote.create({
      data: {
        number,
        title,
        notes,
        validUntil:   validUntil   ? new Date(validUntil)   : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        taxRate: parseFloat(taxRate),
        discountType: discountType || null,
        discountValue: discountType ? (parseFloat(discountValue) || 0) : null,
        subtotal,
        total,
        currency,
        clientId: clientId || null,
        projectId: projectId || null,
        potentialClientName: isPotential ? potentialClientName : null,
        potentialClientEmail: isPotential ? (potentialClientEmail || null) : null,
        potentialClientPhone: isPotential ? (potentialClientPhone || null) : null,
        potentialClientCompany: isPotential ? (potentialClientCompany || null) : null,
        potentialProjectTitle: isPotential ? (potentialProjectTitle || null) : null,
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

    await prisma.quoteHistory.create({
      data: {
        quoteId:        quote.id,
        userId:         req.user.id,
        action:         'created',
        organizationId: orgId,
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
    const { status, clientId, projectId } = req.query
    const { page, limit, skip } = parsePagination(req.query)

    const where = { organizationId: orgId }
    if (status)    where.status    = status
    if (clientId)  where.clientId  = clientId
    if (projectId) where.projectId = projectId

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          project: { select: { id: true, title: true } },
          _count: { select: { installments: true } },
          installments: { where: { status: { in: ['pending', 'overdue'] } }, select: { id: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.quote.count({ where })
    ])

    return paginated(res, quotes, buildPaginationMeta(total, page, limit))
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
    const { status, title, notes, validUntil, deliveryDate, taxRate, currency, items, discountType, discountValue } = req.body

    if (quote.status === 'approved' || quote.status === 'signed') {
      const hasContentChange = [title, notes, validUntil, deliveryDate, taxRate, currency, items, discountType, discountValue].some(v => v !== undefined)
      if (hasContentChange) {
        const invoiceCount = await prisma.invoice.count({ where: { quoteId: id } })
        if (invoiceCount > 0) {
          return fail(res, 400, 'No se puede modificar un presupuesto aprobado que ya tiene facturas asociadas')
        }
      }
    }

    if (status && status !== quote.status) {
      const allowed = allowedTransitions[quote.status] || []
      if (!allowed.includes(status)) {
        return fail(
          res, 400,
          `Transición no permitida. Estado actual: ${quote.status}. Permitidos: ${allowed.join(', ') || 'ninguno'}`
        )
      }
      updates.status = status

      // Al aprobar un presupuesto de cliente potencial: crear cliente + proyecto
      if (status === 'approved' && quote.potentialClientName && !quote.clientId) {
        const newClient = await prisma.client.create({
          data: {
            name: quote.potentialClientName,
            email: quote.potentialClientEmail || undefined,
            phone: quote.potentialClientPhone || undefined,
            company: quote.potentialClientCompany || undefined,
            organizationId: orgId,
            createdById: quote.createdById
          }
        })
        updates.clientId = newClient.id
        updates.potentialClientName = null
        updates.potentialClientEmail = null
        updates.potentialClientPhone = null
        updates.potentialClientCompany = null

        await prisma.clientHistory.create({
          data: {
            clientId:       newClient.id,
            userId:         req.user.id,
            action:         'created',
            detail:         'Creado al aprobar presupuesto',
            organizationId: orgId,
          }
        })

        if (quote.potentialProjectTitle) {
          const newProject = await prisma.project.create({
            data: {
              title: quote.potentialProjectTitle,
              clientId: newClient.id,
              organizationId: orgId,
              createdById: quote.createdById
            }
          })
          updates.projectId = newProject.id
          updates.potentialProjectTitle = null

          await prisma.projectHistory.create({
            data: {
              projectId:      newProject.id,
              userId:         req.user.id,
              action:         'created',
              detail:         'Creado al aprobar presupuesto',
              organizationId: orgId,
            }
          })
        }
      }

      // Auto-crear proyecto para cliente existente sin proyecto vinculado
      if (['approved', 'signed'].includes(status) && quote.clientId && !quote.projectId && !updates.projectId) {
        const newProject = await prisma.project.create({
          data: {
            title:          quote.title,
            status:         'approved',
            clientId:       quote.clientId,
            organizationId: orgId,
            createdById:    req.user.id,
          }
        })
        updates.projectId = newProject.id

        await prisma.projectHistory.create({
          data: {
            projectId:      newProject.id,
            userId:         req.user.id,
            action:         'created',
            detail:         'Creado al aprobar presupuesto',
            organizationId: orgId,
          }
        })
      }

      if (['approved', 'rejected'].includes(status)) {
        await notify({
          type: status === 'approved' ? 'quote_approved' : 'quote_rejected',
          title: status === 'approved' ? 'Presupuesto aprobado' : 'Presupuesto rechazado',
          message: `El presupuesto #${quote.number} "${quote.title}" fue ${status === 'approved' ? 'aprobado' : 'rechazado'}`,
          userId: quote.createdById,
          orgId,
          refId: quote.id
        })
      }

      if (status === 'cancelled') {
        await prisma.cashMovement.updateMany({
          where: { quoteId: id, status: 'pending' },
          data:  { status: 'annulled', annulmentReason: 'Presupuesto cancelado' },
        })
      }
    }

    const needsMovementSync = status && ['approved', 'signed'].includes(status) && status !== quote.status

    if (req.body.sentByWhatsapp === true && !quote.sentByWhatsapp) {
      updates.sentByWhatsapp = true
      if (!['sent', 'approved', 'signed'].includes(quote.status)) updates.status = 'sent'
    }

    for (const key of ['title', 'notes', 'currency']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    for (const key of ['potentialClientName', 'potentialClientEmail', 'potentialClientPhone', 'potentialClientCompany', 'potentialProjectTitle']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key] || null
    }
    if (validUntil   !== undefined) updates.validUntil   = validUntil   ? new Date(validUntil)   : null
    if (deliveryDate !== undefined) updates.deliveryDate = deliveryDate ? new Date(deliveryDate) : null

    // Persistir descuento si viene en el body
    if (discountType !== undefined) {
      updates.discountType  = discountType || null
      updates.discountValue = discountType ? (parseFloat(discountValue) || 0) : null
    }

    const effectiveDiscountType  = discountType  !== undefined ? (discountType || null)  : quote.discountType
    const effectiveDiscountValue = discountValue !== undefined ? (parseFloat(discountValue) || 0) : (quote.discountValue || 0)

    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return fail(res, 400, 'Debe incluir al menos un item')
      }
      const rate = taxRate !== undefined ? taxRate : quote.taxRate
      const { computed, subtotal, total } = computeItems(items, rate, effectiveDiscountType, effectiveDiscountValue)
      updates.taxRate = parseFloat(rate)
      updates.subtotal = subtotal
      updates.total = total
      updates.items = {
        deleteMany: {},
        create: computed
      }
    } else if (taxRate !== undefined || discountType !== undefined || discountValue !== undefined) {
      const existingItems = await prisma.quoteItem.findMany({ where: { quoteId: id } })
      const rate = taxRate !== undefined ? taxRate : quote.taxRate
      const { subtotal: sub, total: tot } = computeItems(existingItems, rate, effectiveDiscountType, effectiveDiscountValue)
      updates.taxRate  = parseFloat(rate)
      updates.subtotal = sub
      updates.total    = tot
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

    // Sincronizar movimientos financieros DESPUÉS del update para que el servicio
    // lea status, clientId y projectId ya persistidos (incluye clientes potenciales convertidos)
    if (needsMovementSync) {
      const quoteWithInstallments = await prisma.quote.findUnique({
        where: { id },
        include: { installments: { orderBy: { number: 'asc' } } },
      })
      await syncQuoteMovements(id, orgId, quoteWithInstallments.installments ?? [], req.user.id)
    }

    const STATUS_LABELS_ES = {
      draft: 'Borrador', sent: 'Enviado', approved: 'Aprobado',
      signed: 'Firmado', rejected: 'Rechazado', expired: 'Vencido'
    }
    const FIELD_LABELS = {
      title: 'título', notes: 'notas', currency: 'moneda',
      validUntil: 'validez', deliveryDate: 'entrega',
      taxRate: 'IVA', discountType: 'descuento',
    }

    if (updates.status && updates.status !== quote.status) {
      await prisma.quoteHistory.create({
        data: {
          quoteId:        id,
          userId:         req.user.id,
          action:         'status_changed',
          detail:         `${STATUS_LABELS_ES[quote.status]} → ${STATUS_LABELS_ES[updates.status]}`,
          organizationId: orgId,
        }
      })
    }

    if (updates.items) {
      await prisma.quoteHistory.create({
        data: {
          quoteId:        id,
          userId:         req.user.id,
          action:         'updated',
          detail:         'ítems y precios',
          organizationId: orgId,
        }
      })
    } else {
      const textFields = ['title', 'notes', 'currency', 'validUntil', 'deliveryDate', 'taxRate', 'discountType']
      const changed = textFields.filter(k => updates[k] !== undefined && String(updates[k]) !== String(quote[k]))
      if (changed.length > 0) {
        await prisma.quoteHistory.create({
          data: {
            quoteId:        id,
            userId:         req.user.id,
            action:         'updated',
            detail:         changed.map(k => FIELD_LABELS[k] || k).join(', '),
            organizationId: orgId,
          }
        })
      }
    }

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

export const sendQuote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: orgId },
      include: {
        client:       { select: { id: true, name: true, email: true } },
        organization: { select: { name: true, logo: true, signature: true } },
      }
    })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (!['draft', 'sent'].includes(quote.status)) return fail(res, 400, 'Solo se pueden enviar presupuestos en borrador o enviados')

    if (!quote.organization?.signature) {
      return fail(res, 400, 'La organización no tiene firma configurada. Configurá la firma en Ajustes antes de enviar presupuestos.')
    }

    const recipientEmail = quote.client?.email || quote.potentialClientEmail
    const recipientName  = quote.client?.name  || quote.potentialClientName
    if (!recipientEmail) {
      const label = recipientName || 'El cliente'
      return fail(res, 400, `"${label}" no tiene email asignado. Agregá un email antes de enviar.`)
    }

    await sendQuoteEmail({
      to:          recipientEmail,
      clientName:  recipientName,
      orgName:     quote.organization?.name || '',
      orgLogo:     quote.organization?.logo || null,
      quoteId:     id,
      quoteNumber: quote.number,
      quoteTitle:  quote.title,
      total:       quote.total,
      currency:    quote.currency,
    })

    const updated = await prisma.quote.update({
      where: { id },
      data: { status: 'sent', sentByEmail: true }
    })

    await prisma.quoteHistory.create({
      data: {
        quoteId:        id,
        userId:         req.user.id,
        action:         'sent_email',
        detail:         recipientEmail,
        organizationId: quote.organizationId,
      }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getAllQuotesHistory = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const history = await prisma.quoteHistory.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user:  { select: { id: true, name: true } },
        quote: { select: { id: true, number: true, title: true } },
      }
    })
    return success(res, 200, history)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getQuotesDashboard = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    in7Days.setUTCHours(23, 59, 59, 999)
    const { currency } = req.query
    const currencyFilter = currency ? { currency } : {}

    // Últimos 12 meses para el gráfico
    const twelveMonthsAgo = new Date(now)
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setUTCHours(0, 0, 0, 0)

    const [byStatus, totals, expiringSoon, recent, installments, monthlyRaw, monthlyExpenses] = await Promise.all([
      prisma.quote.groupBy({
        by: ['status'],
        where: { organizationId: orgId, ...currencyFilter },
        _count: { status: true },
        _sum: { total: true }
      }),
      prisma.quote.aggregate({
        where: { organizationId: orgId, ...currencyFilter },
        _count: { _all: true },
        _sum: { total: true }
      }),
      prisma.quote.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['draft', 'sent'] },
          validUntil: { gte: now, lte: in7Days },
          ...currencyFilter
        },
        select: {
          id: true, number: true, title: true, validUntil: true, total: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { validUntil: 'asc' }
      }),
      prisma.quote.findMany({
        where: { organizationId: orgId, ...currencyFilter },
        select: {
          id: true, number: true, title: true, status: true, total: true, currency: true, createdAt: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.installment.findMany({
        where: {
          organizationId: orgId,
          quoteId: { not: null },
          status: 'pending',
          dueDate: { gte: now }
        },
        select: {
          id: true, number: true, amount: true, dueDate: true, status: true,
          quote: {
            select: {
              id: true, number: true, currency: true,
              client: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { dueDate: 'asc' },
        take: 5
      }),
      prisma.quote.findMany({
        where: {
          organizationId: orgId,
          ...currencyFilter,
          createdAt: { gte: twelveMonthsAgo }
        },
        select: { createdAt: true, total: true, status: true }
      }),
      prisma.expense.findMany({
        where: {
          organizationId: orgId,
          date: { gte: twelveMonthsAgo }
        },
        select: { date: true, amount: true }
      })
    ])

    // Agrupar monthly
    const monthlyMap = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-AR', { month: 'short' })
      monthlyMap[key] = { key, label, issued: 0, approved: 0, expenses: 0 }
    }
    monthlyRaw.forEach(q => {
      const d = new Date(q.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyMap[key]) {
        monthlyMap[key].issued += Number(q.total) || 0
        if (q.status === 'approved' || q.status === 'signed') monthlyMap[key].approved += Number(q.total) || 0
      }
    })
    monthlyExpenses.forEach(e => {
      const d = new Date(e.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (monthlyMap[key]) {
        monthlyMap[key].expenses += Number(e.amount) || 0
      }
    })

    const statusMap = {}
    byStatus.forEach(s => { statusMap[s.status] = { count: s._count.status, total: s._sum.total || 0 } })

    return success(res, 200, {
      summary: {
        totalQuotes:  totals._count._all,
        totalValue:   totals._sum.total  || 0,
        draft:        statusMap.draft?.total      || 0,
        sent:         statusMap.sent?.total       || 0,
        approved:     (statusMap.approved?.total || 0) + (statusMap.signed?.total || 0),
        rejected:     (statusMap.rejected?.total  || 0) + (statusMap.cancelled?.total || 0),
      },
      byStatus: byStatus.map(s => ({
        status: s.status,
        count:  s._count.status,
        total:  s._sum.total || 0
      })),
      expiringSoon,
      recent,
      upcomingInstallments: installments,
      monthly: Object.values(monthlyMap)
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
