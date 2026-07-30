import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido en las variables de entorno')
}
export const generatePreInviteToken = ({ email, orgId, role, orgName }) => {
  return jwt.sign(
    { email, orgId, role, orgName, type: 'pre-invite' },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export const generateTempToken = (user) => {
  return jwt.sign(
    {
      uid: user.id,
      membershipId: user.membershipId || null,
      type: 'temp'
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  )
}

export const generateAccessToken = (user, membership = null) => {
  return jwt.sign(
    {
      uid: user.id,
      org: membership?.organizationId ?? null,
      role: membership?.role ?? null,
      isSystemAdmin: user.isSystemAdmin || false
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}
