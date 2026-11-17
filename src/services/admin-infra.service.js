import os from 'os'
import fs from 'fs'
import { Prisma } from '@prisma/client'
import prisma from '../config/db.js'
import supabase from '../config/supabase.js'
import { getDbMetrics } from './db-metrics.service.js'

/* Monitoreo técnico y backups. Todo con datos reales; lo que el entorno no expone
   se devuelve como { available: false, reason } en vez de inventarse. */

const CACHE_MS = 20_000
let infraCache = null

// ── Capacidad: cuánto espacio le queda a la base antes de llenarse ───────────
// Postgres no tiene un tope propio: colapsa cuando se queda sin disco.
// - DB_CAPACITY_BYTES (opcional): tope explícito (ej. cuota de un plan administrado).
// - Si no: disco del servidor, solo cuando la base corre en el mismo host que el backend
//   (Dokploy: host interno sin dominio). Con una base remota (ej. Supabase en desarrollo)
//   el disco local no dice nada de la base y se informa como no disponible.
export const CAPACITY_WARN = 0.8
export const CAPACITY_CRIT = 0.9

function dbHost() {
  try { return new URL(process.env.DATABASE_URL).hostname } catch { return '' }
}

async function capacity(sizeBytes) {
  const quota = Number(process.env.DB_CAPACITY_BYTES)
  if (quota > 0) {
    const usedPct = sizeBytes / quota
    return { available: true, source: 'quota', totalBytes: quota, usedBytes: sizeBytes, freeBytes: Math.max(0, quota - sizeBytes), usedPct, level: usedPct >= CAPACITY_CRIT ? 'err' : usedPct >= CAPACITY_WARN ? 'warn' : 'ok', note: 'Tope configurado en DB_CAPACITY_BYTES.' }
  }
  const host = dbHost()
  // Host interno de Docker (sin dominio) o local → la base comparte disco con el backend
  const sameHost = host === 'localhost' || host === '127.0.0.1' || (!!host && !host.includes('.'))
  if (!sameHost) {
    return { available: false, reason: `La base está en un servidor remoto (${host || 'desconocido'}): el disco del backend no representa su capacidad. Configurá DB_CAPACITY_BYTES con el tope del proveedor.` }
  }
  try {
    const st = await fs.promises.statfs(process.env.DB_DISK_PATH || '/')
    const totalBytes = st.blocks * st.bsize
    const freeBytes = st.bavail * st.bsize
    const usedBytes = totalBytes - freeBytes
    const usedPct = totalBytes ? usedBytes / totalBytes : 0
    return {
      available: true, source: 'disk', totalBytes, usedBytes, freeBytes, usedPct, dbBytes: sizeBytes,
      dbPctOfDisk: totalBytes ? sizeBytes / totalBytes : 0,
      level: usedPct >= CAPACITY_CRIT ? 'err' : usedPct >= CAPACITY_WARN ? 'warn' : 'ok',
      note: 'Disco del servidor donde corren la base y el backend (compartido con los demás contenedores del VPS).',
    }
  } catch (err) {
    return { available: false, reason: `No se pudo medir el disco: ${err.message}` }
  }
}

// ── Estado básico de la base (barato, se usa también en el dashboard) ─────────
export async function getDbStatus() {
  try {
    const t0 = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - t0
    const [[info], [conn], [max]] = await Promise.all([
      prisma.$queryRaw`SELECT version() AS version, pg_database_size(current_database())::bigint AS "sizeBytes"`,
      prisma.$queryRaw`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE state = 'active')::int AS active,
               count(*) FILTER (WHERE state = 'idle')::int AS idle,
               count(*) FILTER (WHERE state LIKE 'idle in transaction%')::int AS "idleInTransaction"
        FROM pg_stat_activity WHERE datname = current_database()`,
      prisma.$queryRaw`SELECT setting::int AS max FROM pg_settings WHERE name = 'max_connections'`,
    ])
    const sizeBytes = Number(info.sizeBytes)
    return {
      ok: true,
      latencyMs,
      version: String(info.version).split(' ').slice(0, 2).join(' '),
      sizeBytes,
      connections: { ...conn, max: max?.max ?? null },
      capacity: await capacity(sizeBytes),
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ── Backups (bucket privado "backups" de Supabase + historial en AuditLog) ───
export async function listBackups() {
  try {
    const { data, error } = await supabase.storage
      .from('backups')
      .list('', { sortBy: { column: 'created_at', order: 'desc' } })
    if (error) throw error
    return {
      ok: true,
      files: (data || [])
        .filter(f => f.name?.startsWith('backup-'))
        .map(f => ({ name: f.name, createdAt: f.created_at, updatedAt: f.updated_at, sizeBytes: f.metadata?.size ?? null })),
    }
  } catch (err) {
    return { ok: false, error: err.message || 'No se pudo leer el bucket de backups', files: [] }
  }
}

export async function backupHistory(limit = 30) {
  return prisma.auditLog.findMany({
    where: { action: { in: ['backup.run', 'backup.failed'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, createdAt: true, action: true, success: true, actorId: true, actorEmail: true, meta: true },
  })
}

// ── Monitoreo completo (cacheado: no se ejecuta en cada render) ──────────────
let cpuSample = { at: Date.now(), usage: process.cpuUsage() }
function cpuPercent() {
  const now = Date.now()
  const usage = process.cpuUsage()
  const elapsedMs = now - cpuSample.at
  const usedMs = ((usage.user - cpuSample.usage.user) + (usage.system - cpuSample.usage.system)) / 1000
  cpuSample = { at: now, usage }
  if (elapsedMs < 500) return null
  return +((usedMs / elapsedMs) * 100 / os.cpus().length).toFixed(1)
}

async function tableStats() {
  const rows = await prisma.$queryRaw`
    SELECT c.relname AS "table",
           s.n_live_tup::bigint AS "rowsEstimate",
           pg_table_size(c.oid)::bigint AS "tableBytes",
           pg_indexes_size(c.oid)::bigint AS "indexBytes",
           pg_total_relation_size(c.oid)::bigint AS "totalBytes",
           s.seq_scan::bigint AS "seqScans",
           COALESCE(s.idx_scan, 0)::bigint AS "idxScans",
           s.last_autovacuum AS "lastAutovacuum",
           s.last_autoanalyze AS "lastAutoanalyze"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC`
  return rows.map(r => ({
    ...r,
    rowsEstimate: Number(r.rowsEstimate), tableBytes: Number(r.tableBytes), indexBytes: Number(r.indexBytes),
    totalBytes: Number(r.totalBytes), seqScans: Number(r.seqScans), idxScans: Number(r.idxScans),
  }))
}

async function indexStats() {
  const rows = await prisma.$queryRaw`
    SELECT s.relname AS "table", s.indexrelname AS "index",
           s.idx_scan::bigint AS scans,
           pg_relation_size(s.indexrelid)::bigint AS bytes,
           i.indexdef AS definition
    FROM pg_stat_user_indexes s
    JOIN pg_indexes i ON i.indexname = s.indexrelname AND i.schemaname = s.schemaname
    WHERE s.schemaname = 'public'
    ORDER BY s.relname, s.indexrelname`
  return rows.map(r => ({ ...r, scans: Number(r.scans), bytes: Number(r.bytes) }))
}

async function slowStatements() {
  try {
    const [ext] = await prisma.$queryRaw`SELECT 1 AS ok FROM pg_extension WHERE extname = 'pg_stat_statements'`
    if (!ext) return { available: false, reason: 'La extensión pg_stat_statements no está instalada en este Postgres.' }
    const rows = await prisma.$queryRaw`
      SELECT left(query, 300) AS query, calls::bigint AS calls,
             round(mean_exec_time::numeric, 1)::float AS "meanMs",
             round(max_exec_time::numeric, 1)::float AS "maxMs",
             round(total_exec_time::numeric, 0)::float AS "totalMs"
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY mean_exec_time DESC LIMIT 15`
    return { available: true, rows: rows.map(r => ({ ...r, calls: Number(r.calls) })) }
  } catch (err) {
    return { available: false, reason: `pg_stat_statements no es accesible: ${err.message.split('\n')[0]}` }
  }
}

async function prismaPool() {
  try {
    const m = await prisma.$metrics.json()
    const g = Object.fromEntries(m.gauges.map(x => [x.key, x.value]))
    const c = Object.fromEntries(m.counters.map(x => [x.key, x.value]))
    return {
      available: true,
      open: g.prisma_pool_connections_open ?? null,
      busy: g.prisma_pool_connections_busy ?? null,
      idle: g.prisma_pool_connections_idle ?? null,
      waiting: g.prisma_client_queries_wait ?? null,
      opened: c.prisma_pool_connections_opened_total ?? null,
      closed: c.prisma_pool_connections_closed_total ?? null,
      queriesTotal: c.prisma_client_queries_total ?? null,
    }
  } catch (err) {
    return { available: false, reason: err.message.split('\n')[0] }
  }
}

function servicesStatus(db, backups) {
  const env = process.env
  return [
    { name: 'PostgreSQL', ok: db.ok, detail: db.ok ? `${db.latencyMs} ms` : db.error },
    { name: 'Supabase Storage (backups y archivos)', ok: backups.ok, detail: backups.ok ? `${backups.files.length} backups en el bucket` : backups.error },
    { name: 'Email SMTP', ok: !!(env.SMTP_HOST && env.SMTP_USER), detail: env.SMTP_HOST ? 'Configurado (no se verifica la conexión)' : 'Sin configurar' },
    { name: 'Cloudflare Turnstile', ok: !!env.TURNSTILE_SECRET_KEY, detail: env.TURNSTILE_SECRET_KEY ? 'Configurado' : 'Sin configurar' },
    { name: 'Tareas programadas (crons)', ok: env.DISABLE_CRONS !== 'true', detail: env.DISABLE_CRONS === 'true' ? 'Desactivadas (DISABLE_CRONS=true)' : 'Activas' },
  ]
}

export async function getInfra({ fresh = false } = {}) {
  if (!fresh && infraCache && infraCache.exp > Date.now()) return infraCache.value

  const [db, backups, tables, indexes, slow, pool] = await Promise.all([
    getDbStatus(),
    listBackups(),
    tableStats().catch(err => ({ error: err.message })),
    indexStats().catch(err => ({ error: err.message })),
    slowStatements(),
    prismaPool(),
  ])
  const mem = process.memoryUsage()

  const value = {
    generatedAt: new Date().toISOString(),
    cacheSeconds: CACHE_MS / 1000,
    database: db,
    tables,
    indexes,
    slowStatements: slow,
    prisma: { version: Prisma.prismaVersion.client, pool, ...getDbMetrics() },
    server: {
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      env: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.round(process.uptime()),
      hostUptimeSeconds: Math.round(os.uptime()),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
      host: { totalMem: os.totalmem(), freeMem: os.freemem(), cpus: os.cpus().length, loadAvg: os.loadavg() },
      cpuPercent: cpuPercent(),
    },
    services: servicesStatus(db, backups),
  }
  infraCache = { value, exp: Date.now() + CACHE_MS }
  return value
}
