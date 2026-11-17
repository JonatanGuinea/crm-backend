import ExcelJS from 'exceljs'
import { BadRequest, oneOf } from '../utils/admin-params.js'
import { allOrganizations, allUsers } from './admin-tenants.service.js'
import { allAudit } from './admin-audit.service.js'
import { exportRecords } from './admin-explorer.service.js'
import { getFinance } from './admin-finance.service.js'

/* Exportaciones del panel Sistema (CSV y Excel).
   Usan exactamente los mismos filtros que las pantallas y los mismos select que excluyen
   contraseñas, hashes y tokens. Tope de filas para no cargar tablas enormes en memoria. */

export const EXPORT_CAP = 50_000

const fmtDate = v => (v instanceof Date ? v.toISOString() : v)

const DATASETS = {
  organizations: async query => {
    const rows = await allOrganizations(query, EXPORT_CAP)
    return {
      columns: ['id', 'name', 'slug', 'plan', 'status', 'suspendedAt', 'suspendedReason', 'ownerName', 'ownerEmail', 'membersActive', 'membersInvited', 'clients', 'projects', 'quotes', 'products', 'createdAt', 'lastActivityAt'],
      rows: rows.map(o => ({
        ...o, ownerName: o.owner?.name, ownerEmail: o.owner?.email,
        membersActive: o.team.active, membersInvited: o.team.invited,
      })),
    }
  },
  users: async query => {
    const rows = await allUsers(query, EXPORT_CAP)
    return {
      columns: ['id', 'name', 'email', 'phone', 'kind', 'emailVerified', 'isSystemAdmin', 'disabledAt', 'disabledReason', 'createdAt', 'lastLoginAt', 'lastActivityAt', 'organizations'],
      rows: rows.map(u => ({ ...u, organizations: u.organizations.map(o => `${o.name} (${o.role}/${o.status})`).join('; ') })),
    }
  },
  audit: async query => {
    const rows = await allAudit(query, EXPORT_CAP)
    return {
      columns: ['id', 'createdAt', 'actorName', 'actorEmail', 'actorId', 'organizationName', 'organizationId', 'action', 'entity', 'entityId', 'success', 'statusCode', 'ip', 'userAgent'],
      rows,
    }
  },
  finance: async query => {
    const f = await getFinance(query)
    return {
      columns: ['organizationName', 'organizationId', 'currency', 'approved', 'quotePending', 'collected', 'spent', 'pendingIncome'],
      rows: f.tenantFinance.byOrganization,
    }
  },
}

export async function buildExport(dataset, query) {
  let data
  if (dataset.startsWith('entity:')) data = await exportRecords(dataset.slice(7), query, EXPORT_CAP)
  else if (DATASETS[dataset]) data = await DATASETS[dataset](query)
  else throw new BadRequest('Exportación desconocida')
  if (data.rows.some(r => '__orgName' in r)) data.columns = [...data.columns, '__orgName']
  return data
}

function cell(v) {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') return typeof v.toFixed === 'function' ? v.toString() : JSON.stringify(v) // Decimal o JSON
  return v
}

function toCsv({ columns, rows }) {
  const esc = v => {
    const s = String(cell(v))
    // Evita inyección de fórmulas al abrir en Excel
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const header = columns.map(c => (c === '__orgName' ? 'organizacion' : c)).join(',')
  return '﻿' + [header, ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\r\n')
}

async function toXlsx({ columns, rows }, sheetName) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DanteUP — panel Sistema'
  wb.created = new Date()
  const ws = wb.addWorksheet(sheetName.slice(0, 31))
  ws.columns = columns.map(c => ({ header: c === '__orgName' ? 'organizacion' : c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map(c => {
    const v = r[c]
    return [c, v instanceof Date ? v : (typeof v === 'number' || typeof v === 'boolean' ? v : cell(fmtDate(v)))]
  })))
  return wb.xlsx.writeBuffer()
}

export async function renderExport(dataset, query) {
  const format = oneOf(query.format, ['csv', 'xlsx'], 'format', 'csv')
  const data = await buildExport(dataset, query)
  const name = `danteup-${dataset.replace(':', '-')}-${new Date().toISOString().slice(0, 10)}`
  if (format === 'csv') {
    return { format, rows: data.rows.length, filename: `${name}.csv`, contentType: 'text/csv; charset=utf-8', body: toCsv(data) }
  }
  return {
    format, rows: data.rows.length, filename: `${name}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Buffer.from(await toXlsx(data, dataset.replace('entity:', ''))),
  }
}
