import prisma from '../config/db.js'
import { sendMembershipReminderEmail } from './email.service.js'

// Cantidad de meses (incluyendo el actual) para los que se generan cobros pendientes
const HORIZON_MONTHS = 12

// Hoy en Argentina (UTC-3) como medianoche UTC — mismo criterio que el dashboard de Finanzas
function todayArgUTC() {
  const arg = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(arg.getUTCFullYear(), arg.getUTCMonth(), arg.getUTCDate(), 0, 0, 0, 0))
}

// Fecha de cobro de un mes: si el mes no tiene ese día (ej. 31 en febrero), usa el último día
function chargeDate(year, monthIdx, billingDay) {
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIdx, Math.min(billingDay, lastDay), 0, 0, 0, 0))
}

function periodKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function periodLabel(date) {
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// ── Sincronizar cobros pendientes de una membresía ────────────────────────────
// resetFuture: borra los pendientes desde hoy y los regenera (cambio de monto, día, cuenta, etc.).
// Los cobros ya vencidos (atrasados) y los confirmados nunca se tocan.
export async function syncMembershipCharges(membershipId, { resetFuture = false } = {}) {
  const membership = await prisma.clientMembership.findUnique({ where: { id: membershipId } })
  if (!membership) return

  const today = todayArgUTC()

  if (resetFuture || membership.status !== 'active') {
    await prisma.cashMovement.deleteMany({
      where: { membershipId, status: 'pending', date: { gte: today } },
    })
  }
  if (membership.status !== 'active') return

  const from = membership.startDate > today ? membership.startDate : today
  const charges = []
  for (let i = 0; i < HORIZON_MONTHS; i++) {
    const date = chargeDate(today.getUTCFullYear(), today.getUTCMonth() + i, membership.billingDay)
    if (date < from) continue
    if (membership.endDate && date > membership.endDate) break
    charges.push({
      orgId:         membership.orgId,
      accountId:     membership.accountId,
      type:          'income',
      concept:       'membership',
      categoryId:    membership.categoryId,
      amount:        membership.amount,
      balanceBefore: 0,
      balanceAfter:  0,
      status:        'pending',
      date,
      description:   `${membership.name} — ${periodLabel(date)}`,
      clientId:      membership.clientId,
      membershipId:  membership.id,
      period:        periodKey(date),
      createdById:   membership.createdById,
    })
  }

  // skipDuplicates + @@unique([membershipId, period]) → idempotente y respeta períodos ya cobrados
  if (charges.length > 0) {
    await prisma.cashMovement.createMany({ data: charges, skipDuplicates: true })
  }
}

// ── Extender el horizonte de todas las membresías activas (cron) ──────────────
export async function syncAllMemberships() {
  const memberships = await prisma.clientMembership.findMany({
    where:  { status: 'active' },
    select: { id: true },
  })
  for (const m of memberships) {
    try {
      await syncMembershipCharges(m.id)
    } catch (err) {
      console.error(`[cron] Error sincronizando membresía ${m.id}:`, err.message)
    }
  }
}

// ── Recordatorio por email de cobros atrasados (cron) ─────────────────────────
// Un único email por cobro, cuando pasa a estar atrasado. Solo cobros vencidos en los
// últimos 7 días, para no enviar recordatorios de deudas viejas de golpe.
export async function sendMembershipReminders() {
  const today   = todayArgUTC()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const overdue = await prisma.cashMovement.findMany({
    where: {
      status:         'pending',
      membershipId:   { not: null },
      reminderSentAt: null,
      date:           { gte: weekAgo, lt: today },
      membership:     { status: 'active' },
    },
    include: {
      membership:   { select: { name: true } },
      client:       { select: { name: true, email: true } },
      organization: { select: { name: true, logo: true, defaultCurrency: true } },
    },
  })

  for (const m of overdue) {
    const to = m.client?.email
    if (!to) continue

    try {
      // Marca atómica antes de enviar: evita duplicados si dos instancias corren a la vez
      const { count } = await prisma.cashMovement.updateMany({
        where: { id: m.id, reminderSentAt: null },
        data:  { reminderSentAt: new Date() },
      })
      if (count === 0) continue

      await sendMembershipReminderEmail({
        to,
        clientName:     m.client.name,
        orgName:        m.organization.name,
        orgLogo:        m.organization.logo,
        membershipName: m.membership.name,
        periodLabel:    periodLabel(m.date),
        dueDate:        m.date,
        amount:         m.amount,
        currency:       m.organization.defaultCurrency,
      })
    } catch (err) {
      console.error(`[cron] Error recordatorio membresía ${m.id}:`, err.message)
    }
  }
}
