import prisma from '../config/db.js'
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

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    let baseSlug = organizationName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')

    let slug = baseSlug
    let counter = 1

    while (await prisma.organization.findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword }
    })

    const organization = await prisma.organization.create({
      data: { name: organizationName, ownerId: user.id, slug }
    })

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'owner'
      }
    })

    const token = generateAccessToken(user, membership)

    return success(res, 201, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSystemAdmin: user.isSystemAdmin
      },
      organization: {
        id: organization.id,
        name: organization.name,
        role: membership.role
      },
      token
    })

  } catch (error) {
    return fail(res, 500, error.message)
  }
}
