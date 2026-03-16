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

    // crear organización
    const organization = await Organization.create({
      name,
      owner: userId
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



import express from 'express'
import { auth } from '../middlewares/auth.js'
import { authorize } from '../middlewares/authorize.js'

import {
  createOrganization,
  getOrganizations,
  updateOrganization,
  deleteOrganization
} from '../controllers/organization.controller.js'

const router = express.Router()

router.post('/', auth, createOrganization)

router.get('/', auth, getOrganizations)

router.patch('/:id',
  auth,
  authorize('owner'),
  updateOrganization
)

router.delete('/:id',
  auth,
  authorize('owner'),
  deleteOrganization
)

export default router