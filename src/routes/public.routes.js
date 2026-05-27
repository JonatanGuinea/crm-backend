import { Router } from 'express'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { buildPdf } from '../utils/buildPdf.js'

const router = Router()

const quotePublicInclude = {
  items: true,
  installments: { orderBy: { number: 'asc' } },
  client: { select: { id: true, name: true, email: true, phone: true, company: true, address: true, cuit: true, website: true } },
  project: { select: { id: true, title: true } },
  organization: { select: { id: true, name: true, cuit: true, email: true, website: true, phone: true, address: true, logo: true } }
}

router.get('/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params
    const quote = await prisma.quote.findUnique({ where: { id }, include: quotePublicInclude })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    return success(res, 200, quote)
  } catch (error) {
    return fail(res, 500, error.message)
  }
})

router.get('/quotes/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params
    const quote = await prisma.quote.findUnique({ where: { id }, include: quotePublicInclude })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="presupuesto-${quote.number}.pdf"`)

    const doc = buildPdf('quote', quote)
    doc.pipe(res)
  } catch (error) {
    return fail(res, 500, error.message)
  }
})

export default router
