import { Prisma } from '@prisma/client'
import prisma from '../config/db.js'

/* Actividad de la plataforma reconstruida desde las tablas de historial que ya existen
   (presupuestos, proyectos, clientes, tareas), los movimientos de caja y la auditoría.
   Una sola consulta UNION, filtrable por empresa o por usuario, sin N+1. */

function activityUnion() {
  return Prisma.sql`
    SELECT 'quote' AS kind, h."quoteId" AS "refId", h.action, h.detail, h."userId", h."organizationId", h."createdAt" FROM "QuoteHistory" h
    UNION ALL
    SELECT 'project', h."projectId", h.action, h.detail, h."userId", h."organizationId", h."createdAt" FROM "ProjectHistory" h
    UNION ALL
    SELECT 'client', h."clientId", h.action, h.detail, h."userId", h."organizationId", h."createdAt" FROM "ClientHistory" h
    UNION ALL
    SELECT 'task', h."taskId", 'status_change', COALESCE(h."fromStatus"::text, '—') || ' → ' || h."toStatus"::text, h."userId", h."organizationId", h."createdAt" FROM "TaskHistory" h
    UNION ALL
    SELECT 'cash', m.id, m.type::text, m.concept, m."createdById", m."orgId", m."createdAt" FROM "CashMovement" m
    UNION ALL
    SELECT 'audit', a."entityId", a.action, a.entity, a."actorId", a."organizationId", a."createdAt" FROM "AuditLog" a
  `
}

export async function getActivityFeed({ organizationId, userId, limit = 20, since } = {}) {
  const where = [Prisma.sql`TRUE`]
  if (organizationId) where.push(Prisma.sql`x."organizationId" = ${organizationId}`)
  if (userId) where.push(Prisma.sql`x."userId" = ${userId}`)
  if (since) where.push(Prisma.sql`x."createdAt" >= ${since}`)
  const rows = await prisma.$queryRaw`
    SELECT x.*, u.name AS "userName", o.name AS "organizationName"
    FROM (${activityUnion()}) x
    LEFT JOIN "User" u ON u.id = x."userId"
    LEFT JOIN "Organization" o ON o.id = x."organizationId"
    WHERE ${Prisma.join(where, ' AND ')}
    ORDER BY x."createdAt" DESC
    LIMIT ${Math.min(200, limit)}`
  return rows
}

// Última actividad por empresa / usuario para una página de resultados
export async function lastActivityBy(column, ids) {
  if (!ids.length) return {}
  const col = column === 'user' ? Prisma.sql`x."userId"` : Prisma.sql`x."organizationId"`
  const rows = await prisma.$queryRaw`
    SELECT ${col} AS id, MAX(x."createdAt") AS last
    FROM (${activityUnion()}) x
    WHERE ${col} IN (${Prisma.join(ids)})
    GROUP BY ${col}`
  return Object.fromEntries(rows.map(r => [r.id, r.last]))
}

// Usuarios distintos con actividad desde una fecha (login o cualquier evento)
export async function activeUserCount(since) {
  const [row] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT id)::int AS n FROM (
      SELECT x."userId" AS id FROM (${activityUnion()}) x WHERE x."createdAt" >= ${since} AND x."userId" IS NOT NULL
      UNION
      SELECT id FROM "User" WHERE "lastLoginAt" >= ${since}
    ) t`
  return row.n
}

// Eventos por período (para el gráfico de actividad)
export async function activitySeries(since, unit) {
  return prisma.$queryRaw`
    SELECT date_trunc(${unit}, x."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires') AS bucket, COUNT(*)::int AS n
    FROM (${activityUnion()}) x
    WHERE x."createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1`
}
