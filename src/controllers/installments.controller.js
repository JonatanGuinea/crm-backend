import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export const createInstallments = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { invoiceId, count, firstDueDate } = req.body

    if (!invoiceId) return fail(res, 400, 'invoiceId es requerido')
    if (!count || count < 2) return fail(res, 400, 'El número de cuotas debe ser al menos 2')
    if (!firstDueDate) return fail(res, 400, 'La fecha del primer vencimiento es requerida')

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId }
    })
    if (!invoice) return fail(res, 404, 'Factura no encontrada')
    if (['paid', 'cancelled'].includes(invoice.status)) {
      return fail(res, 400, 'No se pueden crear cuotas en una factura pagada o cancelada')
    }

    // Eliminar cuotas existentes antes de crear el nuevo plan
    await prisma.installment.deleteMany({ where: { invoiceId, organizationId: orgId } })

    const amountPerInstallment = parseFloat((invoice.total / count).toFixed(2))
    const remainder = parseFloat((invoice.total - amountPerInstallment * count).toFixed(2))

    const startDate = new Date(firstDueDate)
    startDate.setUTCHours(0, 0, 0, 0)

    const installmentsData = Array.from({ length: count }, (_, i) => {
      const dueDate = new Date(startDate)
      dueDate.setMonth(dueDate.getMonth() + i)
      const amount = i === count - 1
        ? parseFloat((amountPerInstallment + remainder).toFixed(2))
        : amountPerInstallment
      return { number: i + 1, amount, dueDate, invoiceId, organizationId: orgId }
    })

    await prisma.installment.createMany({ data: installmentsData })
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'partial' } })

    const created = await prisma.installment.findMany({
      where: { invoiceId },
      orderBy: { number: 'asc' }
    })

    return success(res, 201, created)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getInstallments = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { invoiceId } = req.query

    if (!invoiceId) return fail(res, 400, 'invoiceId es requerido')

    const installments = await prisma.installment.findMany({
      where: { invoiceId, organizationId: orgId },
      orderBy: { number: 'asc' }
    })

    return success(res, 200, installments)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const payInstallment = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const installment = await prisma.installment.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!installment) return fail(res, 404, 'Cuota no encontrada')
    if (installment.status === 'paid') return fail(res, 400, 'Esta cuota ya está pagada')

    await prisma.installment.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() }
    })

    const pending = await prisma.installment.count({
      where: { invoiceId: installment.invoiceId, status: 'pending' }
    })

    if (pending === 0) {
      await prisma.invoice.update({
        where: { id: installment.invoiceId },
        data: { status: 'paid' }
      })
    }

    const updated = await prisma.installment.findMany({
      where: { invoiceId: installment.invoiceId },
      orderBy: { number: 'asc' }
    })

    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteInstallments = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { invoiceId } = req.query

    if (!invoiceId) return fail(res, 400, 'invoiceId es requerido')

    await prisma.installment.deleteMany({ where: { invoiceId, organizationId: orgId } })

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: orgId } })
    if (invoice?.status === 'partial') {
      await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'sent' } })
    }

    return success(res, 200, { message: 'Plan de cuotas eliminado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
