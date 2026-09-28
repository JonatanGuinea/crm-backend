import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export const createQuoteNote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { quoteId } = req.params
    const { title, description } = req.body

    if (!description?.trim()) return fail(res, 400, 'La descripción es obligatoria')

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, organizationId: orgId },
      select: { id: true }
    })
    if (!quote) return fail(res, 404, 'Presupuesto no encontrado')

    const last = await prisma.quoteNote.findFirst({
      where: { quoteId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })
    const order = (last?.order ?? -1) + 1

    const note = await prisma.quoteNote.create({
      data: {
        quoteId,
        organizationId: orgId,
        title: title?.trim() || null,
        description: description.trim(),
        order,
      }
    })

    return success(res, 201, note)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateQuoteNote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { noteId } = req.params
    const { title, description } = req.body

    const note = await prisma.quoteNote.findFirst({
      where: { id: noteId, organizationId: orgId }
    })
    if (!note) return fail(res, 404, 'Nota no encontrada')

    const updates = {}
    if (title       !== undefined) updates.title       = title?.trim()       || null
    if (description !== undefined) updates.description = description?.trim() || note.description

    const updated = await prisma.quoteNote.update({ where: { id: noteId }, data: updates })
    return success(res, 200, updated)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteQuoteNote = async (req, res) => {
  try {
    const orgId = req.user.organizationId
    const { noteId } = req.params

    const note = await prisma.quoteNote.findFirst({
      where: { id: noteId, organizationId: orgId }
    })
    if (!note) return fail(res, 404, 'Nota no encontrada')

    await prisma.quoteNote.delete({ where: { id: noteId } })
    return success(res, 200, { message: 'Nota eliminada' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
