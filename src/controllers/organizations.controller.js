import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'

export const createOrganization = async (req, res) => {
  try {
    const { name } = req.body
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
      data: { name, ownerId: userId, slug }
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
      include: { organization: { select: { id: true, name: true, plan: true } } }
    })

    if (memberships.length === 0) {
      return success(res, 200, [])
    }

    const organizations = memberships.map(m => ({
      id: m.organization.id,
      name: m.organization.name,
      plan: m.organization.plan,
      role: m.role
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
    const { name } = req.body

    if (!name?.trim()) {
      return fail(res, 400, 'El nombre es requerido')
    }

    const updates = { name: name.trim() }

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
      select: { id: true, name: true, slug: true, plan: true, updatedAt: true }
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
