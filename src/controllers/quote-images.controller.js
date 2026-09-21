import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')

export const uploadQuoteImage = async (req, res) => {
  try {
    const orgId   = req.user.organizationId
    const { quoteId } = req.params

    if (!req.file) return fail(res, 400, 'No se envió ningún archivo')

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: orgId },
      select: { id: true }
    })
    if (!quote) {
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename))
      return fail(res, 404, 'Presupuesto no encontrado')
    }

    const { title, description } = req.body

    const lastImage = await prisma.quoteImage.findFirst({
      where: { quoteId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })
    const order = (lastImage?.order ?? -1) + 1

    const image = await prisma.quoteImage.create({
      data: {
        quoteId,
        organizationId: orgId,
        storedName: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        title: title?.trim() || null,
        description: description?.trim() || null,
        order,
      }
    })

    return success(res, 201, image)
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)) } catch {}
    }
    return fail(res, 500, error.message)
  }
}

export const updateQuoteImage = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { imageId } = req.params

    const image = await prisma.quoteImage.findFirst({
      where: { id: imageId, organizationId: orgId }
    })
    if (!image) return fail(res, 404, 'Imagen no encontrada')

    const { title, description } = req.body
    const updates = {}
    if (title       !== undefined) updates.title       = title?.trim()       || null
    if (description !== undefined) updates.description = description?.trim() || null

    const updated = await prisma.quoteImage.update({ where: { id: imageId }, data: updates })
    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteQuoteImage = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { imageId } = req.params

    const image = await prisma.quoteImage.findFirst({
      where: { id: imageId, organizationId: orgId }
    })
    if (!image) return fail(res, 404, 'Imagen no encontrada')

    await prisma.quoteImage.delete({ where: { id: imageId } })

    try { fs.unlinkSync(path.join(UPLOADS_DIR, image.storedName)) } catch {}

    return success(res, 200, { message: 'Imagen eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
