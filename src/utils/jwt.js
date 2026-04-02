import jwt from 'jsonwebtoken'

export const generateTempToken = (user) => {
  return jwt.sign(
    {
      uid: user.id,
      type: 'temp'
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  )
}

export const generateAccessToken = (user, membership) => {
  return jwt.sign(
    {
      uid: user.id,
      org: membership.organizationId,
      role: membership.role,
      isSystemAdmin: user.isSystemAdmin || false
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
}
