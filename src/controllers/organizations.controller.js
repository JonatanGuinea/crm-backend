import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '..', '..', 'uploads')

export const createOrganization = async (req, res) => {
  try {
    const { name, cuit, email, website, phone, address } = req.body
    const userId = req.user.id

    if (!name) {
      return fail(res, 400, 'El nombre es requerido')
    }

    const organizationsCount = await prisma.organizationMembership.count({
      where: { userId, role: 'owner' }
    })

    if (organizationsCount >= 5) {
      return fail(res, 403, 'Tu plan solo permite cinco organizaciones')
    }

    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')

    let slug = baseSlug
    let counter = 1

    while (await prisma.organization.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }

    const organization = await prisma.organization.create({
      data: {
        name, ownerId: userId, slug,
        cuit:    cuit?.trim()    || null,
        email:   email?.trim()   || null,
        website: website?.trim() || null,
        phone:   phone?.trim()   || null,
        address: address?.trim() || null,
      }
    })

    await prisma.organizationMembership.create({
      data: {
        userId,
        organizationId: organization.id,
        role: 'owner',
        status: 'active'
      }
    })

    return success(res, 201, organization)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getOrganizations = async (req, res) => {
  try {
    const userId = req.user.id

    const memberships = await prisma.organizationMembership.findMany({
      where: { userId, status: 'active' },
      include: { organization: { select: { id: true, name: true, plan: true, cuit: true, email: true, website: true, phone: true, address: true, logo: true, defaultCurrency: true } } }
    })

    if (memberships.length === 0) {
      return success(res, 200, [])
    }

    const organizations = memberships.map(m => ({
      id:      m.organization.id,
      name:    m.organization.name,
      plan:    m.organization.plan,
      cuit:    m.organization.cuit,
      email:   m.organization.email,
      website: m.organization.website,
      phone:   m.organization.phone,
      address: m.organization.address,
      logo:            m.organization.logo,
      defaultCurrency: m.organization.defaultCurrency,
      role:            m.role
    }))

    return success(res, 200, organizations)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getOrganizationBySlug = async (req, res) => {
  try {
    const { slug } = req.params

    const organization = await prisma.organization.findUnique({ where: { slug } })

    if (!organization) {
      return fail(res, 404, 'Organización no encontrada')
    }

    return success(res, 200, organization)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params
    const { name, cuit, email, website, phone, address, defaultCurrency } = req.body

    if (!name?.trim()) {
      return fail(res, 400, 'El nombre es requerido')
    }

    const updates = {
      name:            name.trim(),
      cuit:            cuit?.trim()    || null,
      email:           email?.trim()   || null,
      website:         website?.trim() || null,
      phone:           phone?.trim()   || null,
      address:         address?.trim() || null,
      defaultCurrency: ['USD', 'ARS'].includes(defaultCurrency) ? defaultCurrency : undefined,
    }

    const newSlug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')

    const slugConflict = await prisma.organization.findFirst({
      where: { slug: newSlug, NOT: { id } }
    })

    updates.slug = slugConflict ? `${newSlug}-${Date.now()}` : newSlug

    const organization = await prisma.organization.update({
      where: { id },
      data: updates,
      select: { id: true, name: true, slug: true, plan: true, cuit: true, email: true, website: true, phone: true, address: true, logo: true, defaultCurrency: true, updatedAt: true }
    })

    return success(res, 200, organization)

  } catch (error) {
    if (error.code === 'P2025') {
      return fail(res, 404, 'Organización no encontrada')
    }
    return fail(res, 500, error.message)
  }
}

export const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params

    if (!req.user.isSystemAdmin) {
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: req.user.id,
          organizationId: id,
          status: 'active',
          role: 'owner'
        }
      })

      if (!membership) {
        return fail(res, 403, 'Solo el dueño puede eliminar la organización')
      }
    }

    await prisma.organization.delete({ where: { id } })

    return success(res, 200, { message: 'Organización eliminada correctamente' })

  } catch (error) {
    if (error.code === 'P2025') {
      return fail(res, 404, 'Organización no encontrada')
    }
    return fail(res, 500, error.message)
  }
}

export const uploadOrgLogo = async (req, res) => {
  try {
    const { id } = req.params
    if (!req.file) return fail(res, 400, 'No se recibió ninguna imagen')

    const current = await prisma.organization.findFirst({ where: { id }, select: { logo: true } })
    if (current?.logo) {
      fs.unlink(path.join(uploadsDir, current.logo), () => {})
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { logo: req.file.filename },
      select: { id: true, logo: true }
    })

    return success(res, 200, org)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
