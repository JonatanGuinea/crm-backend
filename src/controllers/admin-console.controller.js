import prisma from '../config/db.js'
import { success, fail } from '../utils/response.js'
import { handler, parseId, oneOf, BadRequest } from '../utils/admin-params.js'
import { logAudit } from '../services/audit.service.js'
import { invalidateOrg, invalidateUser } from '../services/account-status.service.js'
import { getDashboard } from '../services/admin-dashboard.service.js'
import {
  listOrganizations, getOrganizationDetail, listUsers, getUserDetail, assertReason, ORG_STATUS,
} from '../services/admin-tenants.service.js'
import { describeEntities, entityCounts, listRecords, getRecord, findOrphans } from '../services/admin-explorer.service.js'
import { getFinance } from '../services/admin-finance.service.js'
import { listAudit, getAuditEvent, auditFacets } from '../services/admin-audit.service.js'
import { getInfra, listBackups, backupHistory } from '../services/admin-infra.service.js'
import { runDatabaseBackup } from '../services/backup.service.js'
import { renderExport } from '../services/admin-export.service.js'

// El bucket de backups es compartido entre producción y desarrollo: fuera de producción un backup
// manual subiría la DB de desarrollo como si fuera el backup del día. Se bloquea salvo override explícito.
function manualBackupPolicy() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_MANUAL_BACKUP === 'true') return { allowed: true }
  return { allowed: false, reason: 'Fuera de producción no se ejecutan backups manuales: el bucket es compartido y se pisaría el backup real con datos de desarrollo.' }
}

/* Panel Sistema (consola de super administración). Todas las rutas pasan por
   auth + requireSystemAdmin + rate limit (ver admin.routes.js). */

// ── Dashboard ───────────────────────────────────────────────────────────────
export const dashboard = handler(async (req, res) => {
  const period = oneOf(req.query.period, ['30d', '90d', '12m'], 'period', '30d')
  success(res, 200, await getDashboard(period))
})

// ── Empresas ────────────────────────────────────────────────────────────────
export const organizations = handler(async (req, res) => success(res, 200, await listOrganizations(req.query)))

export const organizationDetail = handler(async (req, res) => {
  const org = await getOrganizationDetail(parseId(req.params.id))
  if (!org) return fail(res, 404, 'Organización no encontrada')
  success(res, 200, org)
})

export const setOrganizationStatus = handler(async (req, res) => {
  const id = parseId(req.params.id)
  const status = oneOf(req.body?.status, ORG_STATUS, 'status')
  if (!status) throw new BadRequest('Indicá el estado: active o suspended')
  const reason = assertReason(req.body?.reason, status === 'suspended')

  const before = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true, status: true, suspendedAt: true, suspendedReason: true } })
  if (!before) return fail(res, 404, 'Organización no encontrada')
  if (before.status === status) return fail(res, 409, status === 'suspended' ? 'La organización ya está suspendida' : 'La organización ya está activa')

  const after = await prisma.organization.update({
    where: { id },
    data: status === 'suspended'
      ? { status, suspendedAt: new Date(), suspendedReason: reason }
      : { status, suspendedAt: null, suspendedReason: null },
    select: { id: true, name: true, status: true, suspendedAt: true, suspendedReason: true },
  })
  invalidateOrg(id)
  await logAudit({ req, organizationId: id, action: status === 'suspended' ? 'admin.organization.suspend' : 'admin.organization.reactivate', entity: 'organization', entityId: id, before, after, meta: { reason } })
  success(res, 200, after)
})

// ── Usuarios ────────────────────────────────────────────────────────────────
export const users = handler(async (req, res) => success(res, 200, await listUsers(req.query)))

export const userDetail = handler(async (req, res) => {
  const user = await getUserDetail(parseId(req.params.id))
  if (!user) return fail(res, 404, 'Usuario no encontrado')
  success(res, 200, user)
})

export const setUserStatus = handler(async (req, res) => {
  const id = parseId(req.params.id)
  if (typeof req.body?.disabled !== 'boolean') throw new BadRequest('Indicá disabled: true o false')
  const disabled = req.body.disabled
  const reason = assertReason(req.body?.reason, disabled)

  if (id === req.user.id) return fail(res, 400, 'No podés deshabilitar tu propia cuenta')
  const before = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isSystemAdmin: true, disabledAt: true, disabledReason: true } })
  if (!before) return fail(res, 404, 'Usuario no encontrado')
  // Evita que un systemadmin bloquee a otro desde el panel (y el riesgo de quedarse sin acceso)
  if (disabled && before.isSystemAdmin) return fail(res, 403, 'No se puede deshabilitar a un administrador del sistema desde el panel')
  if (!!before.disabledAt === disabled) return fail(res, 409, disabled ? 'La cuenta ya está deshabilitada' : 'La cuenta ya está habilitada')

  const after = await prisma.user.update({
    where: { id },
    data: disabled ? { disabledAt: new Date(), disabledReason: reason } : { disabledAt: null, disabledReason: null },
    select: { id: true, email: true, isSystemAdmin: true, disabledAt: true, disabledReason: true },
  })
  invalidateUser(id)
  await logAudit({ req, action: disabled ? 'admin.user.disable' : 'admin.user.enable', entity: 'user', entityId: id, before, after, meta: { reason } })
  success(res, 200, after)
})

// ── Explorador ──────────────────────────────────────────────────────────────
export const entities = handler(async (req, res) => {
  const [schema, counts] = await Promise.all([describeEntities(), entityCounts()])
  success(res, 200, schema.map(e => ({ ...e, count: counts[e.name] })))
})

export const entityRecords = handler(async (req, res) => success(res, 200, await listRecords(req.params.entity, req.query)))

export const entityRecord = handler(async (req, res) => {
  const r = await getRecord(req.params.entity, parseId(req.params.id))
  if (!r) return fail(res, 404, 'Registro no encontrado')
  success(res, 200, r)
})

export const orphans = handler(async (req, res) => success(res, 200, await findOrphans()))

// ── Finanzas ────────────────────────────────────────────────────────────────
export const finance = handler(async (req, res) => success(res, 200, await getFinance(req.query)))

// ── Auditoría ───────────────────────────────────────────────────────────────
export const audit = handler(async (req, res) => success(res, 200, await listAudit(req.query)))
export const auditFilters = handler(async (req, res) => success(res, 200, await auditFacets()))
export const auditEvent = handler(async (req, res) => {
  const ev = await getAuditEvent(parseId(req.params.id))
  if (!ev) return fail(res, 404, 'Evento no encontrado')
  success(res, 200, ev)
})

// ── Infraestructura y backups ───────────────────────────────────────────────
export const infra = handler(async (req, res) => success(res, 200, await getInfra({ fresh: req.query.fresh === '1' })))

export const backups = handler(async (req, res) => {
  const [files, history] = await Promise.all([listBackups(), backupHistory()])
  success(res, 200, {
    ...files,
    history,
    schedule: process.env.DISABLE_CRONS === 'true' ? 'Desactivado en este entorno (DISABLE_CRONS=true)' : 'Diario a las 03:00 hora del servidor (UTC, 00:00 en Argentina), retención 7 días',
    manualRun: manualBackupPolicy(),
    restore: 'La restauración no se ejecuta desde la web: se corre con scripts/restore-backup.js en el contenedor, con confirmación explícita, porque reemplaza datos de producción.',
  })
})

export const runBackup = handler(async (req, res) => {
  if (req.body?.confirm !== true) throw new BadRequest('Confirmá la operación (confirm: true)')
  const policy = manualBackupPolicy()
  if (!policy.allowed) return fail(res, 409, policy.reason)
  const result = await runDatabaseBackup({ trigger: 'manual', req })
  if (!result.ok) return fail(res, 502, `El backup falló: ${result.error}`)
  success(res, 200, result)
})

// ── Exportaciones ───────────────────────────────────────────────────────────
export const exportData = handler(async (req, res) => {
  const dataset = String(req.params.dataset || '')
  const out = await renderExport(dataset, req.query)
  const { format, page, pageSize, ...filters } = req.query
  await logAudit({ req, action: 'admin.export', entity: dataset, meta: { format: out.format, rows: out.rows, filters } })
  res.setHeader('Content-Type', out.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Row-Count', String(out.rows))
  res.send(out.body)
})
