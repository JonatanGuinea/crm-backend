import mongoose from 'mongoose'
import User from '../models/user.model.js'
import Organization from '../models/organization.model.js'
import OrganizationMembership from '../models/organizationMembership.model.js'
import { hashPassword } from '../utils/passwordHash.js'
import { generateTempToken } from '../utils/jwt.js'
import { success, fail } from '../utils/response.js'



export const register = async (req, res) => {
  try {
    const { name, email, password, organizationName } = req.body

    if (!name || !email || !password || !organizationName) {
      return fail(res, 400, 'Todos los campos son obligatorios')
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return fail(res, 400, 'El usuario ya existe')
    }

    const hashedPassword = await hashPassword(password)

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    })

    const organization = await Organization.create({
      name: organizationName,
      owner: user._id
    })

    await OrganizationMembership.create({
      user: user._id,
      organization: organization._id,
      role: 'owner'
    })

    const token = generateToken(
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
//REGISTER PARA PRODUCCION (ATLAS)
// export const register = async (req, res) => {
//   const session = await mongoose.startSession()
//   session.startTransaction()

//   try {
//     const { name, email, password, organizationName } = req.body

//     if (!name || !email || !password || !organizationName) {
//       await session.abortTransaction()
//       session.endSession()
//       return fail(res, 400, 'Todos los campos son obligatorios')
//   }

//     // 1️⃣ Verificar usuario existente
//     const existingUser = await User.findOne({ email })

//     if (existingUser) {
//       await session.abortTransaction()
//       session.endSession()
//       return fail(res, 400, 'El usuario ya existe')
//     }

//     // 2️⃣ Hash password
//     const hashedPassword = await hashPassword(password)

//     // 3️⃣ Crear usuario
//     const [user] = await User.create(
//       [{
//         name,
//         email,
//         password: hashedPassword
//       }],
//       { session }
//     )

//     // 4️⃣ Crear organización
//     const [organization] = await Organization.create(
//       [{
//         name: organizationName,
//         owner: user._id
//       }],
//       { session }
//     )

//     // 5️⃣ Crear membership owner
//     await OrganizationMembership.create(
//       [{
//         user: user._id,
//         organization: organization._id,
//         role: 'owner'
//       }],
//       { session }
//     )

//     await session.commitTransaction()
//     session.endSession()

//     // 6️⃣ Generar token automáticamente con organización activa
//     const token = generateToken(
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
//     session.endSession()
//     return fail(res, 500, error.message)
//   }
// }