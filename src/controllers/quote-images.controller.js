import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { toWebp } from '../utils/toWebp.js'
import { uploadFile, deleteFile } from '../config/supabase.js'

export const uploadQuoteImage = async (req, res) => {
  try {
    const orgId   = req.user.organizationId
    const { quoteId } = req.params

    if (!req.file) return fail(res, 400, 'No se envió ningún archivo')

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: orgId },
      select: { id: true }
    })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    const { title, description } = req.body
    const { buffer, name, mimetype } = await toWebp(req.file)
    const url = await uploadFile(buffer, name, mimetype)

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
        storedName: name,
        url,
        title: title?.trim() || null,
        description: description?.trim() || null,
        order,
      }
    })

    return success(res, 201, image)
  } catch (error) {
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

    if (req.file) {
      await deleteFile(image.storedName)
      const { buffer, name, mimetype } = await toWebp(req.file)
      const url = await uploadFile(buffer, name, mimetype)
      updates.storedName = name
      updates.url        = url
    }

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
    await deleteFile(image.storedName)

    return success(res, 200, { message: 'Imagen eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
