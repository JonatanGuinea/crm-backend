import jwt from 'jsonwebtoken'
import OrganizationMembership from '../models/organizationMembership.model'

export const generateTempToken = (user) => {
  return jwt.sign(
    {
      uid: user._id,
      type: 'temp'
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  )
}





export const generateAccessToken = (user, membership) => {
  return jwt.sign(
    {
      uid: user._id,
      org: membership.organization,
      role: membership.role,
      isSystemAdmin: user.isSystemAdmin || false
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
}



