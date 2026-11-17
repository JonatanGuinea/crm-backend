import { Prisma } from '@prisma/client'
import prisma from '../config/db.js'
import { parseRange, parseId } from '../utils/admin-params.js'
import { periodConfig, bucketKeys, cashSeries, seriesByCurrency } from './admin-dashboard.service.js'

/* Finanzas consolidadas de las empresas que usan el CRM.
   Reglas:
   - Todo se agrupa por moneda (presupuesto/factura: su moneda; caja: moneda de la cuenta).
   - Presupuestado ≠ facturado ≠ cobrado: cada concepto sale de su propia tabla.
   - Cobrado = movimientos de caja de tipo ingreso CONFIRMADOS (sin transferencias, ajustes ni anulados).
   - Los ingresos propios de DanteUP (planes) no existen como modelo: se informan como no disponibles. */

const TZ = 'America/Argentina/Buenos_Aires'

function filters(query) {
  const organizationId = parseId(query.orgId, 'orgId')
  const { from, to } = parseRange(query)
  return { organizationId, from, to }
}

function dateCond(col, from, to) {
  const parts = []
  if (from) parts.push(Prisma.sql`${Prisma.raw(col)} >= ${from}`)
  if (to) parts.push(Prisma.sql`${Prisma.raw(col)} <= ${to}`)
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, ' AND ')}` : Prisma.empty
}
const orgCond = (col, id) => id ? Prisma.sql`AND ${Prisma.raw(col)} = ${id}` : Prisma.empty

export async function getFinance(query) {
  const { organizationId, from, to } = filters(query)
  const cfg = periodConfig('12m')
  const keys = bucketKeys(cfg)

  const [quotes, invoices, installments, cash, monthlyCash, monthlyQuotes, byOrg] = await Promise.all([
    // Presupuestos por moneda y estado (fecha de creación)
    prisma.$queryRaw`
      SELECT currency, status::text AS status, COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS total
      FROM "Quote" WHERE TRUE ${orgCond('"organizationId"', organizationId)} ${dateCond('"createdAt"', from, to)}
      GROUP BY 1, 2`,
    // Facturas por moneda y estado
    prisma.$queryRaw`
      SELECT currency, status::text AS status, COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS total
      FROM "Invoice" WHERE TRUE ${orgCond('"organizationId"', organizationId)} ${dateCond('"createdAt"', from, to)}
      GROUP BY 1, 2`,
    // Cuotas: cobradas en el período (paidAt) / pendientes y vencidas a hoy
    prisma.$queryRaw`
      SELECT COALESCE(q.currency, i.currency, 'ARS') AS currency,
             COUNT(*) FILTER (WHERE c.status = 'paid' ${from || to ? Prisma.sql`AND c."paidAt" IS NOT NULL ${dateCond('c."paidAt"', from, to)}` : Prisma.empty})::int AS "paidCount",
             COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'paid' ${from || to ? Prisma.sql`AND c."paidAt" IS NOT NULL ${dateCond('c."paidAt"', from, to)}` : Prisma.empty}), 0)::float AS paid,
             COUNT(*) FILTER (WHERE c.status = 'pending')::int AS "pendingCount",
             COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending'), 0)::float AS pending,
             COUNT(*) FILTER (WHERE c.status = 'pending' AND c."dueDate" < NOW())::int AS "overdueCount",
             COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'pending' AND c."dueDate" < NOW()), 0)::float AS overdue
      FROM "Installment" c LEFT JOIN "Quote" q ON q.id = c."quoteId" LEFT JOIN "Invoice" i ON i.id = c."invoiceId"
      WHERE TRUE ${orgCond('c."organizationId"', organizationId)}
      GROUP BY 1`,
    // Caja: cobrado/pagado confirmado en el período y pendientes (a hoy)
    prisma.$queryRaw`
      SELECT a.currency,
             COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'confirmed' AND m.type = 'income' ${dateCond('m.date', from, to)}), 0)::float AS collected,
             COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'confirmed' AND m.type = 'expense' ${dateCond('m.date', from, to)}), 0)::float AS spent,
             COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'pending' AND m.type = 'income'), 0)::float AS "pendingIncome",
             COUNT(*) FILTER (WHERE m.status = 'pending' AND m.type = 'income')::int AS "pendingIncomeCount",
             COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'pending' AND m.type = 'income' AND m.date < NOW()), 0)::float AS "overdueIncome",
             COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'pending' AND m.type = 'expense'), 0)::float AS "pendingExpense"
      FROM "CashMovement" m JOIN "CashAccount" a ON a.id = m."accountId"
      WHERE TRUE ${orgCond('m."orgId"', organizationId)}
      GROUP BY 1`,
    cashSeries(cfg, organizationId),
    prisma.$queryRaw`
      SELECT date_trunc('month', "createdAt" AT TIME ZONE ${TZ}) AS bucket, currency,
             COALESCE(SUM(total) FILTER (WHERE status IN ('approved', 'signed')), 0)::float AS approved,
             COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0)::float AS pending
      FROM "Quote" WHERE "createdAt" >= ${cfg.since} ${orgCond('"organizationId"', organizationId)}
      GROUP BY 1, 2 ORDER BY 1`,
    // Distribución por empresa y moneda
    prisma.$queryRaw`
      WITH q AS (
        SELECT "organizationId" AS org, currency,
               COALESCE(SUM(total) FILTER (WHERE status IN ('approved', 'signed')), 0)::float AS approved,
               COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0)::float AS "quotePending"
        FROM "Quote" WHERE TRUE ${orgCond('"organizationId"', organizationId)} ${dateCond('"createdAt"', from, to)}
        GROUP BY 1, 2
      ), c AS (
        SELECT m."orgId" AS org, a.currency,
               COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'confirmed' AND m.type = 'income' ${dateCond('m.date', from, to)}), 0)::float AS collected,
               COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'confirmed' AND m.type = 'expense' ${dateCond('m.date', from, to)}), 0)::float AS spent,
               COALESCE(SUM(m.amount) FILTER (WHERE m.status = 'pending' AND m.type = 'income'), 0)::float AS "pendingIncome"
        FROM "CashMovement" m JOIN "CashAccount" a ON a.id = m."accountId"
        WHERE TRUE ${orgCond('m."orgId"', organizationId)}
        GROUP BY 1, 2
      )
      SELECT o.id AS "organizationId", o.name AS "organizationName", COALESCE(q.currency, c.currency) AS currency,
             COALESCE(q.approved, 0) AS approved, COALESCE(q."quotePending", 0) AS "quotePending",
             COALESCE(c.collected, 0) AS collected, COALESCE(c.spent, 0) AS spent, COALESCE(c."pendingIncome", 0) AS "pendingIncome"
      FROM q FULL OUTER JOIN c ON c.org = q.org AND c.currency = q.currency
      JOIN "Organization" o ON o.id = COALESCE(q.org, c.org)
      ORDER BY o.name, 3`,
  ])

  // Resumen de presupuestos por moneda
  const quoteSummary = {}
  for (const r of quotes) {
    const s = (quoteSummary[r.currency] ||= { total: 0, count: 0, approved: 0, approvedCount: 0, pending: 0, pendingCount: 0, draft: 0, lost: 0, byStatus: {} })
    s.byStatus[r.status] = { count: r.n, total: r.total }
    if (r.status !== 'draft') { s.total += r.total; s.count += r.n }
    if (['approved', 'signed'].includes(r.status)) { s.approved += r.total; s.approvedCount += r.n }
    if (r.status === 'sent') { s.pending += r.total; s.pendingCount += r.n }
    if (r.status === 'draft') s.draft += r.total
    if (['rejected', 'expired'].includes(r.status)) s.lost += r.total
  }
  const invoiceSummary = {}
  for (const r of invoices) {
    const s = (invoiceSummary[r.currency] ||= { issued: 0, issuedCount: 0, paid: 0, overdue: 0, byStatus: {} })
    s.byStatus[r.status] = { count: r.n, total: r.total }
    if (!['draft', 'cancelled'].includes(r.status)) { s.issued += r.total; s.issuedCount += r.n }
    if (r.status === 'paid') s.paid += r.total
    if (r.status === 'overdue') s.overdue += r.total
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: { organizationId: organizationId ?? null, from: from ?? null, to: to ?? null },
    tenantFinance: {
      quotes: quoteSummary,
      invoices: invoiceSummary,
      installments: installments,
      cash,
      monthly: {
        cash: seriesByCurrency(keys, monthlyCash, ['income', 'expense']),
        quotes: seriesByCurrency(keys, monthlyQuotes, ['approved', 'pending']),
      },
      byOrganization: byOrg,
    },
    platformRevenue: {
      available: false,
      reason: 'DanteUP no registra cobros de planes en la base: Organization.plan es solo un dato. Para ver ingresos propios hace falta integrar un sistema de suscripciones (ej. Mercado Pago) y su modelo de pagos.',
    },
    notes: [
      'Presupuestado: suma de presupuestos no borrador según su estado; no es dinero cobrado.',
      'Cobrado: ingresos de caja confirmados (excluye transferencias, ajustes y anulados).',
      'Pendiente de cobro: cuotas pendientes + ingresos de caja pendientes (ej. membresías a cobrar).',
      'El módulo de facturas no tiene registros si las empresas no lo usan.',
    ],
  }
}
