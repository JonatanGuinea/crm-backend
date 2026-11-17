import { Prisma } from '@prisma/client'
import prisma from '../config/db.js'
import { BadRequest, parsePage, parseRange, oneOf, parseId, parseSearch, paginated } from '../utils/admin-params.js'

/* Explorador de entidades del panel Sistema (solo lectura).
   - Los modelos y campos salen del DMMF de Prisma: siempre coinciden con el schema real.
   - Nunca se seleccionan contraseñas, hashes ni tokens (ni firmas en base64, que son pesadas).
   - Filtros y orden se validan contra los campos del modelo; no hay SQL desde el front. */

// Campos que no se exponen nunca (ni en tabla, ni en detalle, ni en exportaciones)
const HIDDEN = {
  User: ['password', 'emailVerifyToken', 'passwordChangeToken', 'passwordChangeHash', 'passwordResetToken'],
  Organization: ['signature'],
  Quote: ['clientSignature'],
}
const HIDDEN_PATTERN = /password|token|secret|hash/i

// Cómo llegar a la empresa de cada modelo (campo directo o relación)
function orgScope(model, orgId) {
  const fields = model.fields.map(f => f.name)
  if (model.name === 'Organization') return { id: orgId }
  if (model.name === 'User') return { memberships: { some: { organizationId: orgId } } }
  if (fields.includes('organizationId')) return { organizationId: orgId }
  if (fields.includes('orgId')) return { orgId }
  if (model.name === 'QuoteItem') return { quote: { organizationId: orgId } }
  if (model.name === 'InvoiceItem') return { invoice: { organizationId: orgId } }
  return null
}

const models = Prisma.dmmf.datamodel.models
const enums = Object.fromEntries(Prisma.dmmf.datamodel.enums.map(e => [e.name, e.values.map(v => v.name)]))
const byName = Object.fromEntries(models.map(m => [m.name, m]))
const delegate = name => prisma[name[0].toLowerCase() + name.slice(1)]

function visibleScalars(model) {
  const hidden = HIDDEN[model.name] || []
  return model.fields.filter(f => f.kind !== 'object' && !hidden.includes(f.name) && !HIDDEN_PATTERN.test(f.name))
}

function getModel(name) {
  const m = byName[name]
  if (!m) throw new BadRequest('Entidad desconocida')
  return m
}

export function describeEntities() {
  return models.map(m => ({
    name: m.name,
    orgScoped: !!orgScope(m, 'x'),
    fields: visibleScalars(m).map(f => ({
      name: f.name, type: f.type, kind: f.kind, isId: f.isId, isRequired: f.isRequired, isList: f.isList,
      isUnique: f.isUnique, hasDefault: f.hasDefaultValue, enumValues: f.kind === 'enum' ? enums[f.type] : undefined,
      isForeignKey: m.fields.some(r => r.kind === 'object' && r.relationFromFields?.includes(f.name)),
    })),
    relations: m.fields.filter(f => f.kind === 'object').map(f => ({
      name: f.name, target: f.type, isList: f.isList, fromFields: f.relationFromFields || [], toFields: f.relationToFields || [],
    })),
  }))
}

export async function entityCounts() {
  const counts = await Promise.all(models.map(m => delegate(m.name).count().catch(() => null)))
  return Object.fromEntries(models.map((m, i) => [m.name, counts[i]]))
}

// Convierte el valor de un filtro de campo al tipo del schema (o lo rechaza)
function coerce(field, raw) {
  const v = String(raw)
  if (v === '__null') return null
  switch (field.kind === 'enum' ? 'Enum' : field.type) {
    case 'Enum':
      if (!enums[field.type].includes(v)) throw new BadRequest(`Valor inválido para ${field.name}`)
      return v
    case 'Boolean':
      if (!['true', 'false'].includes(v)) throw new BadRequest(`Valor inválido para ${field.name}`)
      return v === 'true'
    case 'Int': {
      const n = parseInt(v, 10); if (Number.isNaN(n)) throw new BadRequest(`Valor inválido para ${field.name}`); return n
    }
    case 'Float': case 'Decimal': {
      const n = Number(v); if (Number.isNaN(n)) throw new BadRequest(`Valor inválido para ${field.name}`); return n
    }
    case 'String':
      return v.slice(0, 200)
    default:
      throw new BadRequest(`No se puede filtrar por ${field.name}`)
  }
}

export function buildQuery(entity, query) {
  const model = getModel(entity)
  const scalars = visibleScalars(model)
  const byField = Object.fromEntries(scalars.map(f => [f.name, f]))
  const and = []

  // Empresa
  const orgId = parseId(query.orgId, 'orgId')
  if (orgId) {
    const scope = orgScope(model, orgId)
    if (!scope) throw new BadRequest('Esta entidad no se puede filtrar por empresa')
    and.push(scope)
  }

  // Búsqueda: contiene (sin distinguir mayúsculas) en los campos de texto, o id exacto
  const q = parseSearch(query.q)
  if (q) {
    const textFields = scalars.filter(f => f.type === 'String' && !f.isList && f.kind === 'scalar')
    and.push({ OR: [...textFields.map(f => ({ [f.name]: { contains: q, mode: 'insensitive' } }))] })
  }

  // Filtros por campo: f.<campo>=valor
  for (const [k, raw] of Object.entries(query)) {
    if (!k.startsWith('f.')) continue
    const field = byField[k.slice(2)]
    if (!field || field.isList) throw new BadRequest(`Campo de filtro inválido: ${k.slice(2)}`)
    and.push({ [field.name]: coerce(field, raw) })
  }

  // Rango de fechas sobre un campo DateTime (por defecto createdAt)
  const dateFields = scalars.filter(f => f.type === 'DateTime').map(f => f.name)
  const { from, to } = parseRange(query)
  if (from || to) {
    const df = oneOf(query.dateField, dateFields, 'dateField', dateFields.includes('createdAt') ? 'createdAt' : dateFields[0])
    if (!df) throw new BadRequest('Esta entidad no tiene campos de fecha')
    and.push({ [df]: { ...(from && { gte: from }), ...(to && { lte: to }) } })
  }

  // Orden
  const sortable = scalars.filter(f => !f.isList && f.type !== 'Json').map(f => f.name)
  const defaultSort = sortable.includes('createdAt') ? 'createdAt' : model.fields.find(f => f.isId)?.name
  const sort = oneOf(query.sort, sortable, 'sort', defaultSort)
  const order = oneOf(query.order, ['asc', 'desc'], 'order', 'desc')
  const idField = model.fields.find(f => f.isId)?.name

  return {
    model,
    where: and.length ? { AND: and } : {},
    orderBy: sort === idField || !idField ? [{ [sort]: order }] : [{ [sort]: order }, { [idField]: 'asc' }],
    select: Object.fromEntries(scalars.map(f => [f.name, true])),
  }
}

// Agrega el nombre de la empresa a cada fila (una consulta por página, sin N+1)
async function withOrgNames(model, rows) {
  const key = ['organizationId', 'orgId'].find(k => model.fields.some(f => f.name === k))
  if (!key || !rows.length) return rows
  const ids = [...new Set(rows.map(r => r[key]).filter(Boolean))]
  const orgs = await prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  const names = Object.fromEntries(orgs.map(o => [o.id, o.name]))
  return rows.map(r => ({ ...r, __orgName: names[r[key]] ?? null }))
}

export async function listRecords(entity, query) {
  const { model, where, orderBy, select } = buildQuery(entity, query)
  const p = parsePage(query, { defaultSize: 25, maxSize: 100 })
  const d = delegate(model.name)
  const [total, rows] = await Promise.all([d.count({ where }), d.findMany({ where, orderBy, select, skip: p.skip, take: p.take })])
  return paginated(await withOrgNames(model, rows), total, p)
}

export async function exportRecords(entity, query, cap) {
  const { model, where, orderBy, select } = buildQuery(entity, query)
  const rows = await delegate(model.name).findMany({ where, orderBy, select, take: cap })
  return { columns: Object.keys(select), rows: await withOrgNames(model, rows) }
}

// Detalle: campos + relaciones 1→1 (resumidas) + cantidad de registros en relaciones 1→N
export async function getRecord(entity, id) {
  const model = getModel(entity)
  const idField = model.fields.find(f => f.isId)
  if (!idField) throw new BadRequest('Entidad sin id')
  const toOne = model.fields.filter(f => f.kind === 'object' && !f.isList)
  const toMany = model.fields.filter(f => f.kind === 'object' && f.isList)

  const select = Object.fromEntries(visibleScalars(model).map(f => [f.name, true]))
  for (const rel of toOne) {
    const target = byName[rel.type]
    select[rel.name] = { select: Object.fromEntries(visibleScalars(target).filter(f => ['id', 'name', 'title', 'number', 'email', 'status', 'sku', 'concept'].includes(f.name)).map(f => [f.name, true])) }
  }
  if (toMany.length) select._count = { select: Object.fromEntries(toMany.map(r => [r.name, true])) }

  const record = await delegate(model.name).findUnique({ where: { [idField.name]: id }, select })
  if (!record) return null

  const { _count, ...rest } = record
  const relations = [
    ...toOne.map(r => ({ name: r.name, target: r.type, isList: false, fromFields: r.relationFromFields || [], value: rest[r.name] ?? null })),
    ...toMany.map(r => ({ name: r.name, target: r.type, isList: true, count: _count?.[r.name] ?? 0, backField: byName[r.type].fields.find(f => f.relationName === r.relationName && f.kind === 'object')?.relationFromFields?.[0] ?? null })),
  ]
  for (const r of toOne) delete rest[r.name]
  return { entity: model.name, record: rest, relations }
}

/* Chequeos de integridad: referencias que Postgres no puede garantizar con FKs
   (polimórficas o sin constraint) y cruces entre empresas (aislamiento multi-tenant). */
export async function findOrphans() {
  const checks = [
    {
      key: 'attachments', label: 'Adjuntos que apuntan a un registro inexistente',
      sql: Prisma.sql`
        SELECT a.id, a."organizationId", a."entityType"::text AS detail FROM "Attachment" a
        WHERE (a."entityType" = 'client'  AND NOT EXISTS (SELECT 1 FROM "Client"  c WHERE c.id = a."entityId"))
           OR (a."entityType" = 'project' AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p.id = a."entityId"))
           OR (a."entityType" = 'quote'   AND NOT EXISTS (SELECT 1 FROM "Quote"   q WHERE q.id = a."entityId"))
           OR (a."entityType" = 'invoice' AND NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = a."entityId"))
        LIMIT 200`, entity: 'Attachment',
    },
    {
      key: 'defaultCashAccount', label: 'Empresas con cuenta de caja por defecto inexistente o de otra empresa',
      sql: Prisma.sql`
        SELECT o.id, o.id AS "organizationId", o."defaultCashAccountId" AS detail FROM "Organization" o
        WHERE o."defaultCashAccountId" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "CashAccount" a WHERE a.id = o."defaultCashAccountId" AND a."orgId" = o.id)
        LIMIT 200`, entity: 'Organization',
    },
    {
      key: 'usersWithoutOrg', label: 'Usuarios sin ninguna membresía (no son systemadmin)',
      sql: Prisma.sql`
        SELECT u.id, NULL AS "organizationId", u.email AS detail FROM "User" u
        WHERE u."isSystemAdmin" = false AND NOT EXISTS (SELECT 1 FROM "OrganizationMembership" m WHERE m."userId" = u.id)
        LIMIT 200`, entity: 'User',
    },
    {
      key: 'orgsWithoutOwner', label: 'Empresas sin dueño activo en el equipo',
      sql: Prisma.sql`
        SELECT o.id, o.id AS "organizationId", o.name AS detail FROM "Organization" o
        WHERE NOT EXISTS (SELECT 1 FROM "OrganizationMembership" m WHERE m."organizationId" = o.id AND m.role = 'owner' AND m.status = 'active')
        LIMIT 200`, entity: 'Organization',
    },
    {
      key: 'crossTenantProjects', label: 'Proyectos cuyo cliente pertenece a otra empresa',
      sql: Prisma.sql`
        SELECT p.id, p."organizationId", c."organizationId" AS detail FROM "Project" p JOIN "Client" c ON c.id = p."clientId"
        WHERE p."organizationId" <> c."organizationId" LIMIT 200`, entity: 'Project',
    },
    {
      key: 'crossTenantQuotes', label: 'Presupuestos cuyo cliente o proyecto pertenece a otra empresa',
      sql: Prisma.sql`
        SELECT q.id, q."organizationId", COALESCE(c."organizationId", p."organizationId") AS detail FROM "Quote" q
        LEFT JOIN "Client" c ON c.id = q."clientId" LEFT JOIN "Project" p ON p.id = q."projectId"
        WHERE (c.id IS NOT NULL AND c."organizationId" <> q."organizationId") OR (p.id IS NOT NULL AND p."organizationId" <> q."organizationId")
        LIMIT 200`, entity: 'Quote',
    },
    {
      key: 'crossTenantCash', label: 'Movimientos de caja con cuenta de otra empresa',
      sql: Prisma.sql`
        SELECT m.id, m."orgId" AS "organizationId", a."orgId" AS detail FROM "CashMovement" m JOIN "CashAccount" a ON a.id = m."accountId"
        WHERE m."orgId" <> a."orgId" LIMIT 200`, entity: 'CashMovement',
    },
    {
      key: 'crossTenantStock', label: 'Movimientos de stock con producto de otra empresa',
      sql: Prisma.sql`
        SELECT s.id, s."orgId" AS "organizationId", p."orgId" AS detail FROM "StockMovement" s JOIN "Product" p ON p.id = s."productId"
        WHERE s."orgId" <> p."orgId" LIMIT 200`, entity: 'StockMovement',
    },
  ]
  const results = await Promise.all(checks.map(async c => {
    try {
      const rows = await prisma.$queryRaw(c.sql)
      return { key: c.key, label: c.label, entity: c.entity, count: rows.length, capped: rows.length === 200, rows }
    } catch (err) {
      return { key: c.key, label: c.label, entity: c.entity, error: err.message.split('\n')[0] }
    }
  }))
  return { generatedAt: new Date().toISOString(), checks: results }
}
