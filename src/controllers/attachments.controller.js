import path from 'path'
import { randomUUID } from 'crypto'
import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { uploadFile, deleteFile } from '../config/supabase.js'

const VALID_ENTITY_TYPES = ['client', 'project', 'quote', 'invoice']

async function findEntity(entityType, entityId, orgId) {
  const queries = {
    client:  () => prisma.client.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
    project: () => prisma.project.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
    quote:   () => prisma.quote.findFirst({ where: { id: entityId, organizationId: orgId }, select: { id: true } }),
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
      return fail(res, 400, `Tipo de entidad no válido. Permitidos: ${VALID_ENTITY_TYPES.join(', ')}`)
    }

    const entity = await findEntity(entityType, entityId, orgId)
    if (!entity) return fail(res, 404, 'Entidad no encontrada en esta organización')

    const ext        = path.extname(req.file.originalname) || ''
    const storedName = `${randomUUID()}${ext}`
    const url        = await uploadFile(req.file.buffer, storedName, req.file.mimetype)

    const attachment = await prisma.attachment.create({
      data: {
        filename:     req.file.originalname,
        storedName,
        url,
        mimetype:     req.file.mimetype,
        size:         req.file.size,
        entityType,
        entityId,
        organizationId: orgId,
        uploadedById:   req.user.id
      }
    })

    return success(res, 201, attachment)
  } catch (error) {
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

    let where = { organizationId: orgId, entityType, entityId }

    if (entityType === 'client') {
      const projects = await prisma.project.findMany({
        where: { clientId: entityId, organizationId: orgId },
        select: { id: true, title: true }
      })
      const projectIds = projects.map(p => p.id)
      const projectTitleMap = Object.fromEntries(projects.map(p => [p.id, p.title]))

      where = {
        organizationId: orgId,
        OR: [
          { entityType: 'client', entityId },
          ...(projectIds.length > 0 ? [{ entityType: 'project', entityId: { in: projectIds } }] : [])
        ]
      }

      const attachments = await prisma.attachment.findMany({
        where,
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      })

      return success(res, 200, attachments.map(a => ({
        ...a,
        sourceLabel: a.entityType === 'project' ? (projectTitleMap[a.entityId] ?? 'Proyecto') : null
      })))
    }

    const attachments = await prisma.attachment.findMany({
      where,
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    })

    return success(res, 200, attachments)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const serveFile = async (req, res) => {
  try {
    const { filename } = req.params
    const orgId = req.user.organizationId

    const attachment = await prisma.attachment.findFirst({
      where: { storedName: filename, organizationId: orgId }
    })
    if (!attachment) return fail(res, 404, 'Archivo no encontrado')

    // Archivos nuevos: URL pública de Supabase
    if (attachment.url.startsWith('http')) {
      return res.redirect(attachment.url)
    }

    // Archivos legacy: redirigir a ruta estática del backend
    return res.redirect(`/uploads/${attachment.storedName}`)
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
    await deleteFile(attachment.storedName)

    return success(res, 200, { message: 'Archivo eliminado' })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
