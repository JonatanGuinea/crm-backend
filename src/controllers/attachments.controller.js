import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads')

const VALID_ENTITY_TYPES = ['client', 'project', 'quote', 'invoice']

async function findEntity(entityType, entityId, orgId) {
  const queries = {
    client: () => prisma.client.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
    project: () => prisma.project.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
    quote: () => prisma.quote.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
    invoice: () => prisma.invoice.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } })
  }
  return queries[entityType]()
}

export const uploadAttachment = async (req, res) => {
  try {
    const { entityType, entityId } = req.params
    const orgId = req.user.organizationId

    if (!req.file) return fail(res, 400, 'No se envió ningún archivo')

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename))
      return fail(res, 400, `Tipo de entidad no válido. Permitidos: ${VALID_ENTITY_TYPES.join(', ')}`)
    }

    const entity = await findEntity(entityType, entityId, orgId)
    if (!entity) {
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename))
      return fail(res, 404, 'Entidad no encontrada en esta organización')
    }

    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        storedName: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
        entityType,
        entityId,
        organizationId: orgId,
        uploadedById: req.user.id
      }
    })

    return success(res, 201, attachment)
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)) } catch {}
    }
    return fail(res, 500, error.message)
  }
}

export const getAttachments = async (req, res) => {
  try {
    const { entityType, entityId } = req.params
    const orgId = req.user.organizationId

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return fail(res, 400, `Tipo de entidad no válido. Permitidos: ${VALID_ENTITY_TYPES.join(', ')}`)
    }

    const entity = await findEntity(entityType, entityId, orgId)
    if (!entity) return fail(res, 404, 'Entidad no encontrada en esta organización')

    const attachments = await prisma.attachment.findMany({
      where: { entityType, entityId, organizationId: orgId },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return success(res, 200, attachments)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params
    const orgId = req.user.organizationId

    const attachment = await prisma.attachment.findFirst({
      where: { id, organizationId: orgId }
    })
    if (!attachment) return fail(res, 404, 'Archivo no encontrado')

    await prisma.attachment.delete({ where: { id } })

    try {
      fs.unlinkSync(path.join(UPLOADS_DIR, attachment.storedName))
    } catch {}

    return success(res, 200, { message: 'Archivo eliminado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
