import User from '../models/user.model.js'
import Organization from '../models/organization.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateAccessToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'

export const register = async (req, res) => {
  try {

    const name = req.body.name?.trim()
    const email = req.body.email?.trim().toLowerCase()
    const password = req.body.password
    const organizationName = req.body.organizationName?.trim()

    if (!name || !email || !password || !organizationName) {
      return fail(res, 400, 'Todos los campos son obligatorios')
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    // 🔥 slug único
    let baseSlug = organizationName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')

    let slug = baseSlug
    let counter = 1

    while (await Organization.findOne({ slug })) {
      slug = `${baseSlug}-${counter++}`
    }

    const hashedPassword = await hashPassword(password)

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    })

    const organization = await Organization.create({
      name: organizationName,
      owner: user._id,
      slug
    })

    // 👇 usa este objeto directamente
    const membership = await OrganizationMembership.create({
      user: user._id,
      organization: organization._id,
      role: 'owner'
    })

    const token = generateAccessToken(user, membership)

    return success(res, 201, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      organization: {
        id: organization._id,
        name: organization.name,
        role: membership.role
      },
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}