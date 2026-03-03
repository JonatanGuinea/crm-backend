import jwt from 'jsonwebtoken'

export const generateTempToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  )
}

export const generateAccessToken = (user, organizationId, role) => {
  return jwt.sign(
    {
      id: user._id,
      activeOrganization: organizationId,
      role,
      isSystemAdmin: user.isSystemAdmin
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
}



