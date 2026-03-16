import Organization from '../models/organization.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { success, fail } from '../utils/response.js'

export const createOrganization = async (req, res) => {
  try {

    const { name } = req.body
    const userId = req.user.id

    if (!name) {
      return fail(res, 400, 'El nombre es requerido')
    }

     const organizationsCount = await OrganizationMembership.countDocuments({
      user: userId,
      role: 'owner'
    })

    if (organizationsCount >= 5) {
      return fail(res, 403, 'Tu plan solo permite cinco organizaciones')
    }
    const slug = organizationName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    // crear organización
    const organization = await Organization.create({
      name,
      owner: userId,
      slug
    })

    // crear membership owner
    await OrganizationMembership.create({
      user: userId,
      organization: organization._id,
      role: 'owner',
      status: 'active'
    })

    return success(res, 201, organization)

  } catch (error) {
    return fail(res, 500, error.message)
  }

}


export const getOrganizations = async (req, res) => {
  try {

    const userId = req.user.id

    const memberships = await OrganizationMembership
      .find({ user: userId, status: 'active' })
      .populate('organization', 'name plan')
      .lean()

    const organizations = memberships.map(m => ({
      id: m.organization._id,
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

  const { slug } = req.params

  const organization = await Organization.findOne({ slug })

  if (!organization) {
    return fail(res, 404, 'Organización no encontrada')
  }

  return success(res, 200, organization)

}

export const updateOrganization = async (req, res) => {
  try {

    const { id } = req.params
    const { name, plan } = req.body

    const organization = await Organization.findByIdAndUpdate(
      id,
      { name, plan },
      { new: true }
    )

    if (!organization) {
      return fail(res, 404, 'Organización no encontrada')
    }

    return success(res, 200, organization)

  } catch (error) {
    return fail(res, 500, error.message)
  }
}



export const deleteOrganization = async (req, res) => {

  try {

    const { id } = req.params

    await Organization.deleteOne({ _id: id })

    await OrganizationMembership.deleteMany({
      organization: id
    })

    return success(res, 200, 'Organization deleted')

  } catch (error) {
    return fail(res, 500, error.message)
  }

}