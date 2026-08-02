import { Router } from 'express'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { buildPdf } from '../utils/buildPdf.js'
import { notify } from '../services/notifications.service.js'

const router = Router()

const quotePublicInclude = {
  items: true,
  installments: { orderBy: { number: 'asc' } },
  client: { select: { id: true, name: true, email: true, phone: true, company: true, address: true, city: true, province: true, postalCode: true, cuit: true, website: true } },
  project: { select: { id: true, title: true } },
  organization: { select: { id: true, name: true, cuit: true, email: true, website: true, phone: true, address: true, city: true, province: true, postalCode: true, logo: true, signature: true, signatureOwnerName: true } }
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
        potentialClientName: true, potentialClientEmail: true, potentialClientPhone: true, potentialClientCompany: true,
        organizationId: true, createdById: true,
      }
    })

    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (quote.status === 'signed')   return fail(res, 400, 'El presupuesto ya fue firmado')
    if (quote.status === 'approved') return fail(res, 400, 'El presupuesto ya fue confirmado')
    if (quote.status === 'rejected') return fail(res, 400, 'El presupuesto fue rechazado')
    if (quote.status === 'expired')  return fail(res, 400, 'El presupuesto ha expirado')

    const updateData = { status: 'signed' }

    if (!quote.clientId && quote.potentialClientName) {
      const { name, company, email, phone, website, cuit, address, province, city, postalCode, notes, signature } = req.body
      const newClient = await prisma.client.create({
        data: {
          name:           name    || quote.potentialClientName,
          email:          email   || quote.potentialClientEmail   || null,
          phone:          phone   || quote.potentialClientPhone   || null,
          company:        company || quote.potentialClientCompany || null,
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

    const { signature } = req.body
    if (signature) {
      updateData.clientSignature = signature
      updateData.clientSignedAt  = new Date()
    }

    await prisma.quote.update({ where: { id }, data: updateData })
    return success(res, 200, { message: 'Presupuesto confirmado exitosamente' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
})

router.post('/quotes/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true, status: true, number: true, title: true,
        organizationId: true, createdById: true,
        client: { select: { name: true, phone: true, company: true } },
        potentialClientName: true, potentialClientPhone: true, potentialClientCompany: true
      }
    })

    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')
    if (quote.status === 'rejected') return fail(res, 400, 'El presupuesto ya fue rechazado')
    if (quote.status === 'signed')   return fail(res, 400, 'El presupuesto ya fue firmado')
    if (quote.status === 'expired')  return fail(res, 400, 'El presupuesto ha expirado')
    if (!['draft', 'sent'].includes(quote.status)) return fail(res, 400, 'Este presupuesto no puede ser rechazado')

    const trimmedReason = reason?.trim() || null

    await prisma.quote.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: trimmedReason }
    })

    // Notificar a todos los miembros activos de la organización
    const clientName    = quote.client?.name    || quote.potentialClientName || 'Cliente'
    const clientCompany = quote.client?.company || quote.potentialClientCompany || null
    const clientPhone   = (quote.client?.phone  || quote.potentialClientPhone || '').replace(/\D/g, '')
    const numStr        = String(quote.number).padStart(3, '0')
    const displayName   = clientCompany ? `${clientCompany} (${clientName})` : clientName

    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: quote.organizationId, status: 'active', role: { in: ['owner', 'admin'] } },
      select: { userId: true }
    })

    await Promise.all(members.map(m =>
      notify({
        type:    'quote_rejected',
        title:   'Presupuesto rechazado',
        message: `${displayName} rechazó el presupuesto #${numStr} — ${quote.title}`,
        metadata: JSON.stringify({
          phone:       clientPhone || null,
          clientName,
          clientCompany,
          quoteNumber: numStr,
          quoteTitle:  quote.title,
          reason:      trimmedReason
        }),
        userId: m.userId,
        orgId:  quote.organizationId,
        refId:  quote.id
      })
    ))

    return success(res, 200, { message: 'Presupuesto rechazado' })
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
