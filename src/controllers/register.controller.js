// import mongoose from 'mongoose'
// import User from '../models/user.model.js'
// import Organization from '../models/organization.model.js'
// import OrganizationMembership from '../models/organizationMembership.model.js'
// import { hashPassword } from '../utils/passwordHash.js'
// import { generateTempToken } from '../utils/jwt.js'
// import { success, fail } from '../utils/response.js'


// export const register = async (req, res) => {

//   const session = await mongoose.startSession()
//   session.startTransaction()

//   try {

//     const name = req.body.name?.trim()
//     const email = req.body.email?.trim().toLowerCase()
//     const password = req.body.password
//     const organizationName = req.body.organizationName?.trim()

//     if (!name || !email || !password || !organizationName) {
//       throw new Error('Todos los campos son obligatorios')
//     }

//     const existingUser = await User.findOne({ email }).session(session)

//     if (existingUser) {
//       throw new Error('El usuario ya existe')
//     }

//     const hashedPassword = await hashPassword(password)

//     const [user] = await User.create([{
//       name,
//       email,
//       password: hashedPassword
//     }], { session })

//     const [organization] = await Organization.create([{
//       name: organizationName,
//       owner: user._id
//     }], { session })

//     await OrganizationMembership.create([{
//       user: user._id,
//       organization: organization._id,
//       role: 'owner'
//     }], { session })

//     await session.commitTransaction()

//     const token = generateTempToken(
//       user,
//       organization._id,
//       'owner'
//     )

//     return success(res, 201, {
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         isSystemAdmin: user.isSystemAdmin
//       },
//       organization: {
//         id: organization._id,
//         name: organization.name,
//         role: 'owner'
//       },
//       token
//     })

//   } catch (error) {

//     await session.abortTransaction()

//     return fail(res, 500, error.message)

//   } finally {

//     session.endSession()

//   }
// }


import User from '../models/user.model.js'
import Organization from '../models/organization.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateTempToken } from '../utils/jwt.js'
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

    // verificar usuario existente
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    const slug = organizationName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')


    // hash password
    const hashedPassword = await hashPassword(password)

    // crear usuario
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    })

    // crear organización
    const organization = await Organization.create({
      name: organizationName,
      owner: user._id,
      slug
    })

    // crear membership owner
    await OrganizationMembership.create({
      user: user._id,
      organization: organization._id,
      role: 'owner'
    })

    // generar token con organización activa
    const token = generateTempToken(
      user,
      organization._id,
      'owner'
    )

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
        role: 'owner'
      },
      token
    })

  } catch (error) {

    return fail(res, 500, error.message)

  }
}