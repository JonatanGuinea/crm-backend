import prisma from '../config/db.js'
import supabase from '../config/supabase.js'
import { success, fail } from '../utils/response.js'

const PLANS = ['free', 'pro', 'enterprise']
const DAY = 24 * 60 * 60 * 1000

// Tablas principales que se muestran con su cantidad de filas
const TABLES = [
  ['Usuarios',        'user'],
  ['Empresas',        'organization'],
  ['Membresías equipo', 'organizationMembership'],
  ['Clientes',        'client'],
  ['Proyectos',       'project'],
  ['Presupuestos',    'quote'],
  ['Tareas',          'task'],
  ['Productos',       'product'],
  ['Movimientos caja', 'cashMovement'],
  ['Membresías clientes', 'clientMembership'],
  ['Notificaciones',  'notification'],
]

async function getDatabaseStatus() {
  const started = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const latencyMs = Date.now() - started

  const [[info], [conn], counts] = await Promise.all([
    prisma.$queryRaw`
      SELECT version() AS version,
             pg_database_size(current_database())::bigint AS "sizeBytes"`,
    prisma.$queryRaw`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE state = 'active')::int AS active
      FROM pg_stat_activity WHERE datname = current_database()`,
    Promise.all(TABLES.map(([, model]) => prisma[model].count())),
  ])

  return {
    ok: true,
    latencyMs,
    version: String(info.version).split(' ').slice(0, 2).join(' '),
    sizeBytes: Number(info.sizeBytes),
    connections: conn,
    tables: TABLES.map(([label], i) => ({ label, rows: counts[i] })),
  }
}

async function getBackups() {
  try {
    const { data, error } = await supabase.storage
      .from('backups')
      .list('', { sortBy: { column: 'created_at', order: 'desc' } })
    if (error) throw error
    return {
      ok: true,
      files: (data || [])
        .filter(f => f.name?.startsWith('backup-'))
        .map(f => ({ name: f.name, createdAt: f.created_at, sizeBytes: f.metadata?.size ?? null })),
    }
  } catch (err) {
    return { ok: false, error: err.message || 'No se pudo leer el bucket de backups', files: [] }
  }
}

export const getOverview = async (req, res) => {
  try {
    const now = Date.now()
    const since7 = new Date(now - 7 * DAY)
    const since30 = new Date(now - 30 * DAY)

    const [database, backups, users, organizations, membershipGroups] = await Promise.all([
      getDatabaseStatus().catch(err => ({ ok: false, error: err.message })),
      getBackups(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, emailVerified: true, isSystemAdmin: true, createdAt: true,
          memberships: {
            select: { role: true, status: true, organization: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, slug: true, plan: true, createdAt: true,
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { clients: true, quotes: true, projects: true } },
        },
      }),
      prisma.organizationMembership.groupBy({
        by: ['organizationId', 'status'],
        _count: { _all: true },
      }),
    ])

    const team = {}
    for (const g of membershipGroups) {
      team[g.organizationId] ??= { active: 0, invited: 0, disabled: 0 }
      team[g.organizationId][g.status] = g._count._all
    }

    const plans = Object.fromEntries(PLANS.map(p => [p, 0]))
    for (const o of organizations) plans[o.plan] = (plans[o.plan] || 0) + 1

    return success(res, 200, {
      generatedAt: new Date(now).toISOString(),
      database,
      backups,
      summary: {
        users: {
          total: users.length,
          verified: users.filter(u => u.emailVerified).length,
          withoutOrg: users.filter(u => !u.memberships.some(m => m.status === 'active')).length,
          last7: users.filter(u => u.createdAt >= since7).length,
          last30: users.filter(u => u.createdAt >= since30).length,
        },
        organizations: {
          total: organizations.length,
          plans,
          last7: organizations.filter(o => o.createdAt >= since7).length,
          last30: organizations.filter(o => o.createdAt >= since30).length,
        },
      },
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        isSystemAdmin: u.isSystemAdmin,
        createdAt: u.createdAt,
        organizations: u.memberships
          .filter(m => m.organization)
          .map(m => ({ id: m.organization.id, name: m.organization.name, role: m.role, status: m.status })),
      })),
      organizations: organizations.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        createdAt: o.createdAt,
        owner: o.owner,
        team: team[o.id] || { active: 0, invited: 0, disabled: 0 },
        clients: o._count.clients,
        quotes: o._count.quotes,
        projects: o._count.projects,
      })),
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const updateOrganizationPlan = async (req, res) => {
  try {
    const { id } = req.params
    const { plan } = req.body || {}

    if (!PLANS.includes(plan)) {
      return fail(res, 400, `Plan inválido. Valores posibles: ${PLANS.join(', ')}`)
    }

    const current = await prisma.organization.findUnique({ where: { id }, select: { plan: true, name: true } })
    if (!current) return fail(res, 404, 'Organización no encontrada')

    const org = await prisma.organization.update({
      where: { id },
      data: { plan },
      select: { id: true, name: true, plan: true },
    })

    console.log(`[admin] Plan de "${current.name}" (${id}): ${current.plan} → ${plan} por usuario ${req.user.id}`)

    return success(res, 200, org)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
