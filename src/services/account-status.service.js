import prisma from '../config/db.js'

/* Estado de cuenta en tiempo real, con caché corta en memoria.
   El JWT dura 24 h: sin esta verificación, deshabilitar un usuario, quitarle el rol de
   systemadmin o suspender su empresa tardaría hasta un día en tener efecto. */

const TTL_MS = 30_000
const users = new Map()
const orgs = new Map()

function cached(map, key) {
  const hit = map.get(key)
  return hit && hit.exp > Date.now() ? hit.value : undefined
}

export async function getUserStatus(userId) {
  const hit = cached(users, userId)
  if (hit !== undefined) return hit
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSystemAdmin: true, disabledAt: true },
  })
  const value = u ? { exists: true, isSystemAdmin: u.isSystemAdmin, disabled: !!u.disabledAt } : { exists: false }
  users.set(userId, { value, exp: Date.now() + TTL_MS })
  return value
}

export async function getOrgStatus(orgId) {
  const hit = cached(orgs, orgId)
  if (hit !== undefined) return hit
  const o = await prisma.organization.findUnique({ where: { id: orgId }, select: { status: true } })
  const value = o ? o.status : null
  orgs.set(orgId, { value, exp: Date.now() + TTL_MS })
  return value
}

// Llamar después de cambiar el estado desde el panel para que aplique al instante
export function invalidateUser(userId) { users.delete(userId) }
export function invalidateOrg(orgId) { orgs.delete(orgId) }
