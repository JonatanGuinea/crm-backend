import { Router } from 'express'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { buildPdf } from '../utils/buildPdf.js'

const router = Router()

const quotePublicInclude = {
  items: true,
  installments: { orderBy: { number: 'asc' } },
  client: { select: { id: true, name: true, email: true, phone: true, company: true, address: true, city: true, province: true, postalCode: true, cuit: true, website: true } },
  project: { select: { id: true, title: true } },
  organization: { select: { id: true, name: true, cuit: true, email: true, website: true, phone: true, address: true, city: true, province: true, postalCode: true, logo: true } }
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

router.post('/quotes/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params
    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true, status: true, clientId: true,
        potentialClientName: true, potentialClientEmail: true, potentialClientCompany: true,
        organizationId: true, createdById: true,
      }
    })

    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (quote.status === 'approved') return fail(res, 400, 'El presupuesto ya fue confirmado')
    if (quote.status === 'rejected') return fail(res, 400, 'El presupuesto fue rechazado')
    if (quote.status === 'expired')  return fail(res, 400, 'El presupuesto ha expirado')

    const updateData = { status: 'approved' }

    if (!quote.clientId && quote.potentialClientName) {
      const { name, company, email, phone, website, cuit, address, province, city, postalCode, notes } = req.body
      const newClient = await prisma.client.create({
        data: {
          name:           name    || quote.potentialClientName,
          email:          email   || quote.potentialClientEmail   || null,
          company:        company || quote.potentialClientCompany || null,
          phone:          phone      || null,
          website:        website    || null,
          cuit:           cuit       || null,
          address:        address    || null,
          province:       province   || null,
          city:           city       || null,
          postalCode:     postalCode || null,
          notes:          notes      || null,
          organizationId: quote.organizationId,
          createdById:    quote.createdById,
        }
      })
      updateData.clientId = newClient.id
    }

    await prisma.quote.update({ where: { id }, data: updateData })
    return success(res, 200, { message: 'Presupuesto confirmado exitosamente' })
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
