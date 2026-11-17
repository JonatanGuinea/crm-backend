// Prueba de integración del panel Sistema contra la DB de DESARROLLO (nunca contra producción).
// Uso: node scripts/test-admin-console.mjs — firma JWTs locales, suspende/reactiva y deshabilita/rehabilita
// datos de prueba y los deja como estaban. No ejecuta backups (el bucket es compartido con producción).
import 'dotenv/config'
if (process.env.NODE_ENV === 'production' || /postgres-index-redundant/.test(process.env.DATABASE_URL || '')) {
  console.error('Esta prueba modifica datos: no se corre contra producción.'); process.exit(1)
}
import jwt from 'jsonwebtoken'
const { default: app } = await import('../src/app.js')
const { default: prisma } = await import('../src/config/db.js')

let pass = 0, failN = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg) } else { failN++; console.log('  ✗', msg) } }

const admin = await prisma.user.findFirst({ where: { isSystemAdmin: true } })
const normalM = await prisma.organizationMembership.findFirst({ where: { status: 'active', role: 'owner', user: { isSystemAdmin: false } }, include: { user: true } })
const normal = normalM.user
const sign = (u, org, role, claim) => jwt.sign({ uid: u.id, org, role, isSystemAdmin: claim }, process.env.JWT_SECRET, { expiresIn: '10m' })
const tAdmin = sign(admin, null, null, true)
const tNormal = sign(normal, normalM.organizationId, 'owner', false)
const tForged = sign(normal, normalM.organizationId, 'owner', true)

const srv = app.listen(0)
const base = `http://localhost:${srv.address().port}/api`
const call = async (method, path, token, body) => {
  const r = await fetch(base + path, { method, headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) })
  const ct = r.headers.get('content-type') || ''
  return { status: r.status, headers: r.headers, body: ct.includes('json') ? await r.json() : await r.arrayBuffer() }
}
const get = (p, t = tAdmin) => call('GET', p, t)

console.log('Seguridad')
const GETS = ['/admin/dashboard', '/admin/organizations', '/admin/users', '/admin/explorer/entities', '/admin/explorer/orphans', '/admin/explorer/User', '/admin/finance', '/admin/audit', '/admin/audit/filters', '/admin/infra', '/admin/backups']
for (const p of GETS) {
  const [a, b, c] = await Promise.all([get(p, null), get(p, tNormal), get(p, tForged)])
  ok(a.status === 401 && b.status === 403 && c.status === 403, `${p}: sin token 401 / común 403 / claim falsificado 403`)
}
ok((await get('/admin/export/users?format=csv', tNormal)).status === 403, 'export: usuario común 403')

console.log('Dashboard')
for (const period of ['30d', '90d', '12m']) {
  const r = await get(`/admin/dashboard?period=${period}`)
  ok(r.status === 200 && r.body.data.charts.users.length > 0, `period=${period}: ${r.status}, ${r.body.data?.charts.users.length} buckets`)
}
const d = (await get('/admin/dashboard')).body.data
ok(d.kpis.users.total === await prisma.user.count(), `usuarios total = ${d.kpis.users.total}`)
ok(d.kpis.organizations.total === await prisma.organization.count(), `empresas total = ${d.kpis.organizations.total}`)
const qSum = await prisma.quote.aggregate({ where: { status: { not: 'draft' } }, _sum: { total: true } })
ok(Math.abs(Object.values(d.kpis.quotes.amountByCurrency).reduce((a, b) => a + b, 0) - (qSum._sum.total || 0)) < 0.01, 'monto presupuestado coincide con la suma directa')
ok((await get('/admin/dashboard?period=7x')).status === 400, 'period inválido → 400')

console.log('Empresas y usuarios')
const orgs = (await get('/admin/organizations?pageSize=2&sort=clients&order=desc')).body.data
ok(orgs.items.length <= 2 && orgs.total >= orgs.items.length, `paginación empresas: ${orgs.items.length} de ${orgs.total}, ${orgs.pages} páginas`)
ok(orgs.items.length < 2 || orgs.items[0].clients >= orgs.items[1].clients, 'orden por clientes desc')
ok((await get('/admin/organizations?sort=password')).status === 400, 'sort inválido → 400')
const org1 = (await get(`/admin/organizations/${normalM.organizationId}`)).body.data
ok(org1.members.length > 0 && org1.recent && org1.counts, `detalle empresa: ${org1.members.length} miembros`)
const us = (await get('/admin/users?kind=owner&pageSize=50')).body.data
ok(us.items.every(u => u.kind === 'owner'), `filtro kind=owner (${us.items.length})`)
ok(!JSON.stringify(us).match(/password|Token"/), 'listado de usuarios sin password ni tokens')
const ud = (await get(`/admin/users/${normal.id}`)).body.data
ok(ud.id === normal.id && Array.isArray(ud.accesses), 'detalle usuario con historial de accesos')
ok(!JSON.stringify(ud).includes('"password"'), 'detalle usuario sin password')

console.log('Explorador')
const ents = (await get('/admin/explorer/entities')).body.data
ok(ents.length >= 30, `${ents.length} entidades detectadas`)
const userEnt = ents.find(e => e.name === 'User')
ok(!userEnt.fields.some(f => /password|Token|Hash/.test(f.name)), 'User: campos sensibles fuera de la estructura')
const recs = (await get('/admin/explorer/User?pageSize=5')).body.data
ok(recs.items.length <= 5 && !JSON.stringify(recs).includes('password'), `User registros paginados sin password (${recs.total} total)`)
const qr = (await get(`/admin/explorer/Quote?orgId=${normalM.organizationId}&pageSize=100`)).body.data
ok(qr.items.every(q => q.organizationId === normalM.organizationId), `Quote filtrado por empresa (${qr.total})`)
ok((await get('/admin/explorer/Quote?f.status=draft')).body.data.items.every(q => q.status === 'draft'), 'filtro por campo enum')
ok((await get('/admin/explorer/Quote?f.status=hackeo')).status === 400, 'valor de enum inválido → 400')
ok((await get('/admin/explorer/User?f.password=x')).status === 400, 'no se puede filtrar por password → 400')
ok((await get('/admin/explorer/User?sort=password')).status === 400, 'no se puede ordenar por password → 400')
ok((await get('/admin/explorer/Nada')).status === 400, 'entidad desconocida → 400')
const det = (await get(`/admin/explorer/Organization/${normalM.organizationId}`)).body.data
ok(det.relations.some(r => r.isList && r.count > 0) && !('signature' in det.record), 'detalle con relaciones y sin firma')
const orph = (await get('/admin/explorer/orphans')).body.data
ok(orph.checks.every(c => !c.error), `chequeos de integridad: ${orph.checks.map(c => `${c.key}=${c.count}`).join(', ')}`)

console.log('Finanzas')
const fin = (await get(`/admin/finance?orgId=${normalM.organizationId}`)).body.data
const conf = await prisma.cashMovement.aggregate({ where: { orgId: normalM.organizationId, status: 'confirmed', type: 'income' }, _sum: { amount: true } })
const collected = fin.tenantFinance.cash.reduce((a, c) => a + c.collected, 0)
ok(Math.abs(collected - Number(conf._sum.amount || 0)) < 0.01, `cobrado de la empresa = ${collected}`)
ok(fin.platformRevenue.available === false, 'ingresos de la plataforma: no disponible (sin modelo)')
ok((await get('/admin/finance?from=2026-12-01&to=2026-01-01')).status === 400, 'rango invertido → 400')

console.log('Acciones administrativas')
ok((await call('PATCH', `/admin/users/${admin.id}/status`, tAdmin, { disabled: true, reason: 'prueba' })).status === 400, 'no puede deshabilitarse a sí mismo')
ok((await call('PATCH', `/admin/users/${normal.id}/status`, tAdmin, { disabled: true })).status === 400, 'deshabilitar sin motivo → 400')
ok((await call('PATCH', `/admin/users/${normal.id}/status`, tAdmin, { disabled: true, reason: 'prueba automatizada' })).status === 200, 'deshabilitar usuario')
ok((await get('/clients', tNormal)).status === 403, 'usuario deshabilitado: su token deja de funcionar (403)')
ok((await call('PATCH', `/admin/users/${normal.id}/status`, tAdmin, { disabled: false })).status === 200, 'rehabilitar usuario')
ok((await get('/clients', tNormal)).status === 200, 'usuario rehabilitado vuelve a operar')
ok((await call('PATCH', `/admin/organizations/${normalM.organizationId}/status`, tAdmin, { status: 'suspended', reason: 'prueba automatizada' })).status === 200, 'suspender empresa')
ok((await get('/clients', tNormal)).status === 403, 'empresa suspendida: sus miembros reciben 403')
ok((await call('PATCH', `/admin/organizations/${normalM.organizationId}/status`, tAdmin, { status: 'suspended', reason: 'otra vez' })).status === 409, 'suspender dos veces → 409')
ok((await call('PATCH', `/admin/organizations/${normalM.organizationId}/status`, tAdmin, { status: 'active' })).status === 200, 'reactivar empresa')
ok((await get('/clients', tNormal)).status === 200, 'empresa reactivada: vuelve a operar')
const plan0 = (await prisma.organization.findUnique({ where: { id: normalM.organizationId } })).plan
await call('PATCH', `/admin/organizations/${normalM.organizationId}/plan`, tAdmin, { plan: plan0 === 'pro' ? 'free' : 'pro' })
await call('PATCH', `/admin/organizations/${normalM.organizationId}/plan`, tAdmin, { plan: plan0 })
ok((await call('POST', '/admin/backups/run', tAdmin, {})).status === 400, 'backup manual sin confirmación → 400 (no se ejecuta)')
ok((await call('POST', '/admin/backups/run', tAdmin, { confirm: true })).status === 409, 'backup manual fuera de producción → 409 (protege el bucket compartido)')

console.log('Auditoría')
await new Promise(r => setTimeout(r, 1500))
const au = (await get(`/admin/audit?entityId=${normalM.organizationId}`)).body.data
const acts = au.items.map(i => i.action)
ok(['admin.organization.suspend', 'admin.organization.reactivate', 'admin.organization.plan'].every(a => acts.includes(a)), `eventos de empresa auditados: ${[...new Set(acts)].join(', ')}`)
const ev = (await get(`/admin/audit/${au.items.find(i => i.action === 'admin.organization.suspend').id}`)).body.data
ok(ev.before?.status === 'active' && ev.after?.status === 'suspended', 'evento con valores antes/después')
const uau = (await get(`/admin/audit?entityId=${normal.id}`)).body.data
ok(uau.items.some(i => i.action === 'admin.user.disable'), 'deshabilitación de usuario auditada')
ok((await call('DELETE', `/admin/audit/${ev.id}`, tAdmin)).status === 404, 'no existe ruta para borrar auditoría (404)')
ok((await call('PATCH', `/admin/audit/${ev.id}`, tAdmin, {})).status === 404, 'no existe ruta para editar auditoría (404)')
// Login fallido (Turnstile en modo prueba)
await call('POST', '/auth/login', null, { email: normal.email, password: 'contraseña-incorrecta', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' })
await new Promise(r => setTimeout(r, 800))
ok((await prisma.auditLog.count({ where: { action: 'auth.login_failed', actorId: normal.id } })) > 0, 'login fallido auditado')
// Mutación común auditada por el middleware
await call('PATCH', `/notifications/read-all`, tNormal)
await new Promise(r => setTimeout(r, 800))
ok((await prisma.auditLog.count({ where: { actorId: normal.id, entity: 'notifications' } })) > 0, 'escrituras de la API auditadas por el middleware')

console.log('Exportaciones')
const csv = await get(`/admin/export/users?format=csv&kind=owner`)
const txt = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csv.body)
ok(csv.status === 200 && txt.startsWith('﻿id,name,email') && !/password/i.test(txt), `CSV usuarios (${csv.headers.get('x-row-count')} filas) sin password`)
const xl = await get(`/admin/export/entity:Quote?format=xlsx&orgId=${normalM.organizationId}`)
ok(xl.status === 200 && new Uint8Array(xl.body)[0] === 0x50, `Excel presupuestos de una empresa (${xl.headers.get('x-row-count')} filas, zip válido)`)
for (const ds of ['organizations', 'audit', 'finance', 'entity:StockMovement', 'entity:CashMovement']) {
  const r = await get(`/admin/export/${ds}?format=csv`)
  ok(r.status === 200, `export ${ds}: ${r.headers.get('x-row-count')} filas`)
}
ok((await get('/admin/export/entity:User?format=csv')).status === 200 && !/password|Token/.test(new TextDecoder().decode((await get('/admin/export/entity:User?format=csv')).body)), 'export de User sin campos sensibles')
ok((await prisma.auditLog.count({ where: { action: 'admin.export' } })) > 0, 'exportaciones auditadas')

console.log('Infraestructura')
const inf = (await get('/admin/infra?fresh=1')).body.data
ok(inf.database.ok && inf.tables.length > 10 && inf.indexes.length > 10, `DB ${inf.database.version}, ${inf.tables.length} tablas, ${inf.indexes.length} índices, max conexiones ${inf.database.connections.max}`)
ok(inf.prisma.pool.available, `pool Prisma: ${JSON.stringify(inf.prisma.pool)}`)
ok(inf.prisma.queries > 0, `métricas Prisma: ${inf.prisma.queries} queries, prom ${inf.prisma.avgMs} ms, ${inf.prisma.slowQueries.length} lentas`)
console.log('    pg_stat_statements:', inf.slowStatements.available ? `${inf.slowStatements.rows.length} filas` : inf.slowStatements.reason)
const bk = (await get('/admin/backups')).body.data
ok(bk.ok && bk.files.length > 0, `backups: ${bk.files.length} archivos`)

// limpieza de los eventos de auditoría generados por la prueba (solo en dev)
srv.close()
console.log(`\n${pass} OK, ${failN} fallidas`)
await prisma.$disconnect()
process.exit(failN ? 1 : 0)
