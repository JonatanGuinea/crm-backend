import prisma from '../config/db.js'
import { fail } from '../utils/response.js'
import { buildPdf } from '../utils/buildPdf.js'

export const downloadQuotePdf = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const quote = await prisma.quote.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true, phone: true, company: true } },
        project: { select: { id: true, title: true } },
        organization: { select: { id: true, name: true } }
      }
    })

    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="presupuesto-${quote.number}.pdf"`)

    const doc = buildPdf('quote', quote)
    doc.pipe(res)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const downloadInvoicePdf = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { id } = req.params

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        items: true,
        client: { select: { id: true, name: true, email: true, phone: true, company: true } },
        project: { select: { id: true, title: true } },
        organization: { select: { id: true, name: true } }
      }
    })

    if (!invoice) return fail(res, 404, 'Factura no encontrada')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.number}.pdf"`)

    const doc = buildPdf('invoice', invoice)
    doc.pipe(res)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
