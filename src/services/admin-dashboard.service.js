import { Prisma } from '@prisma/client'
import prisma from '../config/db.js'
import { getDbStatus, listBackups } from './admin-infra.service.js'
import { getActivityFeed, activeUserCount, activitySeries } from './admin-activity.service.js'

/* Dashboard global del panel Sistema. Todo sale de la DB; los montos se agrupan por moneda
   (nunca se suman ARS con USD) y los presupuestos no se cuentan como ingresos. */

const TZ = 'America/Argentina/Buenos_Aires'
const DAY = 24 * 3600 * 1000

// Período → desde cuándo y con qué granularidad agrupar
export function periodConfig(period) {
  const nowAr = new Date(Date.now() - 3 * 3600 * 1000) // Argentina: UTC-3 fijo
  if (period === '12m') {
    const since = new Date(Date.UTC(nowAr.getUTCFullYear(), nowAr.getUTCMonth() - 11, 1))
    return { unit: 'month', since: new Date(since.getTime() + 3 * 3600 * 1000), startKey: since }
  }
  const days = period === '90d' ? 90 : 30
  const unit = period === '90d' ? 'week' : 'day'
  const start = new Date(Date.UTC(nowAr.getUTCFullYear(), nowAr.getUTCMonth(), nowAr.getUTCDate() - days + 1))
  return { unit, since: new Date(start.getTime() + 3 * 3600 * 1000), startKey: start }
}

// Claves de todos los buckets del período (para completar con ceros)
export function bucketKeys({ unit, startKey }) {
  const keys = []
  const nowAr = new Date(Date.now() - 3 * 3600 * 1000)
  let d = new Date(startKey)
  if (unit === 'week') { const dow = (d.getUTCDay() + 6) % 7; d = new Date(d.getTime() - dow * DAY) }
  while (d <= nowAr) {
    keys.push(d.toISOString().slice(0, 10))
    if (unit === 'month') d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    else d = new Date(d.getTime() + (unit === 'week' ? 7 : 1) * DAY)
  }
  return keys
}
const keyOf = d => new Date(d).toISOString().slice(0, 10)

export function fillSeries(keys, rows, fields) {
  const map = {}
  for (const r of rows) map[keyOf(r.bucket)] = r
  return keys.map(k => {
    const out = { bucket: k }
    for (const f of fields) out[f] = Number(map[k]?.[f] ?? 0)
    return out
  })
}

// Altas por período en una tabla (nombre de tabla de una lista fija, nunca del request)
const CREATED_TABLES = { Organization: '"Organization"', User: '"User"' }
async function createdSeries(table, cfg) {
  return prisma.$queryRaw`
    SELECT date_trunc(${cfg.unit}, "createdAt" AT TIME ZONE ${TZ}) AS bucket, COUNT(*)::int AS n
    FROM ${Prisma.raw(CREATED_TABLES[table])}
    WHERE "createdAt" >= ${cfg.since}
    GROUP BY 1 ORDER BY 1`
}

async function quoteSeries(cfg) {
  return prisma.$queryRaw`
    SELECT date_trunc(${cfg.unit}, "createdAt" AT TIME ZONE ${TZ}) AS bucket,
           COUNT(*) FILTER (WHERE status <> 'draft')::int AS emitted,
           COUNT(*) FILTER (WHERE status IN ('approved', 'signed'))::int AS approved,
           COUNT(*) FILTER (WHERE status IN ('rejected', 'expired'))::int AS lost
    FROM "Quote" WHERE "createdAt" >= ${cfg.since}
    GROUP BY 1 ORDER BY 1`
}

// Ingresos/egresos efectivamente confirmados en caja, por moneda de la cuenta
export async function cashSeries(cfg, organizationId) {
  const orgFilter = organizationId ? Prisma.sql`AND m."orgId" = ${organizationId}` : Prisma.empty
  return prisma.$queryRaw`
    SELECT date_trunc(${cfg.unit}, m.date AT TIME ZONE ${TZ}) AS bucket, a.currency,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'income'), 0)::float AS income,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'expense'), 0)::float AS expense
    FROM "CashMovement" m JOIN "CashAccount" a ON a.id = m."accountId"
    WHERE m.status = 'confirmed' AND m.type IN ('income', 'expense') AND m.date >= ${cfg.since} ${orgFilter}
    GROUP BY 1, 2 ORDER BY 1`
}

export function seriesByCurrency(keys, rows, fields) {
  const byCur = {}
  for (const r of rows) (byCur[r.currency] ||= []).push(r)
  return Object.fromEntries(Object.entries(byCur).map(([cur, rs]) => [cur, fillSeries(keys, rs, fields)]))
}

const sumByCurrency = rows => Object.fromEntries(rows.map(r => [r.currency, Number(r._sum?.total ?? r.total ?? 0)]))

export async function getDashboard(period = '30d') {
  const cfg = periodConfig(period)
  const keys = bucketKeys(cfg)
  const since30 = new Date(Date.now() - 30 * DAY)

  const [
    orgByStatus, orgByPlan, orgsInPeriod,
    usersTotal, usersDisabled, usersInPeriod, active30,
    clients, projects, projectsByStatus,
    quotesEmitted, quotesAmount, quotesInPeriod,
    invoicesCount, invoicesAmount,
    pendingInstallments, pendingCash,
    products, stockMovements,
    orgSeries, userSeries, actSeries, qSeries, cSeries,
    latestOrgs, latestUsers, activity,
    db, backups, failedLogins24h, overdueInstallments, unverified,
  ] = await Promise.all([
    prisma.organization.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.organization.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.organization.count({ where: { createdAt: { gte: cfg.since } } }),
    prisma.user.count(),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: cfg.since } } }),
    activeUserCount(since30),
    prisma.client.count(),
    prisma.project.count(),
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.quote.count({ where: { status: { not: 'draft' } } }),
    prisma.quote.groupBy({ by: ['currency'], where: { status: { not: 'draft' } }, _sum: { total: true } }),
    prisma.quote.count({ where: { status: { not: 'draft' }, createdAt: { gte: cfg.since } } }),
    prisma.invoice.count({ where: { status: { notIn: ['draft', 'cancelled'] } } }),
    prisma.invoice.groupBy({ by: ['currency'], where: { status: { notIn: ['draft', 'cancelled'] } }, _sum: { total: true } }),
    // Cuotas pendientes: la moneda es la del presupuesto o factura de origen
    prisma.$queryRaw`
      SELECT COALESCE(q.currency, i.currency, 'ARS') AS currency, SUM(c.amount)::float AS total, COUNT(*)::int AS n
      FROM "Installment" c LEFT JOIN "Quote" q ON q.id = c."quoteId" LEFT JOIN "Invoice" i ON i.id = c."invoiceId"
      WHERE c.status = 'pending' GROUP BY 1`,
    // Cobros pendientes de caja (ej. membresías a cobrar), por moneda de la cuenta
    prisma.$queryRaw`
      SELECT a.currency, SUM(m.amount)::float AS total, COUNT(*)::int AS n
      FROM "CashMovement" m JOIN "CashAccount" a ON a.id = m."accountId"
      WHERE m.status = 'pending' AND m.type = 'income' GROUP BY 1`,
    prisma.product.count(),
    prisma.stockMovement.count(),
    createdSeries('Organization', cfg),
    createdSeries('User', cfg),
    activitySeries(cfg.since, cfg.unit),
    quoteSeries(cfg),
    cashSeries(cfg),
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, name: true, plan: true, status: true, createdAt: true, owner: { select: { name: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' }, take: 6,
      select: { id: true, name: true, email: true, createdAt: true, disabledAt: true, emailVerified: true },
    }),
    getActivityFeed({ limit: 12 }),
    getDbStatus(),
    listBackups(),
    prisma.auditLog.count({ where: { action: 'auth.login_failed', createdAt: { gte: new Date(Date.now() - DAY) } } }),
    prisma.installment.count({ where: { status: 'pending', dueDate: { lt: new Date() } } }),
    prisma.user.count({ where: { emailVerified: false } }),
  ])

  const statusCount = Object.fromEntries(orgByStatus.map(r => [r.status, r._count._all]))
  const orgsTotal = orgByStatus.reduce((a, r) => a + r._count._all, 0)

  // Alertas: solo condiciones reales y accionables
  const alerts = []
  const lastBackup = backups.files[0]
  const backupAgeH = lastBackup ? (Date.now() - new Date(lastBackup.updatedAt || lastBackup.createdAt)) / 3.6e6 : null
  if (!backups.ok) alerts.push({ level: 'err', text: `No se pudo leer el bucket de backups: ${backups.error}`, to: '/admin/backups' })
  else if (backupAgeH == null) alerts.push({ level: 'err', text: 'No hay ningún backup en el bucket', to: '/admin/backups' })
  else if (backupAgeH > 30) alerts.push({ level: 'warn', text: `El último backup tiene ${Math.round(backupAgeH)} h`, to: '/admin/backups' })
  if (!db.ok) alerts.push({ level: 'err', text: `Base de datos sin conexión: ${db.error}`, to: '/admin/infra' })
  else if (db.latencyMs > 1000) alerts.push({ level: 'warn', text: `Latencia alta de la base: ${db.latencyMs} ms`, to: '/admin/infra' })
  const cap = db.ok && db.capacity
  if (cap?.available && cap.level !== 'ok') {
    alerts.push({ level: cap.level, text: `${cap.source === 'disk' ? 'Disco del servidor' : 'Capacidad de la base'} al ${Math.round(cap.usedPct * 100)}%: quedan ${(cap.freeBytes / 1024 ** 3).toFixed(1)} GB libres`, to: '/admin/infra' })
  }
  if (statusCount.suspended) alerts.push({ level: 'info', text: `${statusCount.suspended} empresa(s) suspendida(s)`, to: '/admin/organizations?status=suspended' })
  if (usersDisabled) alerts.push({ level: 'info', text: `${usersDisabled} usuario(s) deshabilitado(s)`, to: '/admin/users?status=disabled' })
  if (failedLogins24h >= 10) alerts.push({ level: 'warn', text: `${failedLogins24h} intentos de login fallidos en 24 h`, to: '/admin/audit?action=auth.login_failed' })
  if (overdueInstallments) alerts.push({ level: 'warn', text: `${overdueInstallments} cuota(s) vencida(s) sin cobrar en las empresas`, to: '/admin/finances' })
  if (unverified) alerts.push({ level: 'info', text: `${unverified} usuario(s) sin verificar el email`, to: '/admin/users?verified=no' })

  return {
    generatedAt: new Date().toISOString(),
    period, unit: cfg.unit, since: cfg.since,
    kpis: {
      organizations: { total: orgsTotal, active: statusCount.active || 0, suspended: statusCount.suspended || 0, inPeriod: orgsInPeriod },
      users: { total: usersTotal, enabled: usersTotal - usersDisabled, disabled: usersDisabled, active30, inactive30: Math.max(0, usersTotal - usersDisabled - active30), inPeriod: usersInPeriod },
      clients, projects,
      quotes: { emitted: quotesEmitted, inPeriod: quotesInPeriod, amountByCurrency: sumByCurrency(quotesAmount) },
      invoices: { count: invoicesCount, amountByCurrency: sumByCurrency(invoicesAmount) },
      pendingPayments: {
        installments: pendingInstallments.map(r => ({ currency: r.currency, total: r.total, count: r.n })),
        cash: pendingCash.map(r => ({ currency: r.currency, total: r.total, count: r.n })),
      },
      products, stockMovements,
    },
    charts: {
      organizations: fillSeries(keys, orgSeries, ['n']),
      users: fillSeries(keys, userSeries, ['n']),
      activity: fillSeries(keys, actSeries, ['n']),
      quotes: fillSeries(keys, qSeries, ['emitted', 'approved', 'lost']),
      cash: seriesByCurrency(keys, cSeries, ['income', 'expense']),
      projectsByStatus: Object.fromEntries(projectsByStatus.map(r => [r.status, r._count._all])),
      orgsByPlan: Object.fromEntries(orgByPlan.map(r => [r.plan, r._count._all])),
    },
    latest: { organizations: latestOrgs, users: latestUsers, activity },
    alerts,
    platform: {
      database: db,
      lastBackup: lastBackup ? { name: lastBackup.name, at: lastBackup.updatedAt || lastBackup.createdAt, sizeBytes: lastBackup.sizeBytes, ageHours: +backupAgeH.toFixed(1) } : null,
      uptimeSeconds: Math.round(process.uptime()),
      cronsEnabled: process.env.DISABLE_CRONS !== 'true',
    },
  }
}
