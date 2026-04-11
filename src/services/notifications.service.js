import prisma from '../config/db.js'

export async function notify({ type, title, message, userId, orgId, refId }) {
  try {
    await prisma.notification.upsert({
      where: {
        type_userId_organizationId_refId: { type, userId, organizationId: orgId, refId }
      },
      update: {},
      create: { type, title, message, userId, organizationId: orgId, refId }
    })
  } catch {
    // Notificaciones son no-críticas, no interrumpir el flujo principal
  }
}

export async function checkTimeAlerts(orgId) {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [adminMembers, allMembers, overdueInvoices, expiringQuotes, upcomingProjects] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, status: 'active', role: { in: ['owner', 'admin'] } },
      select: { userId: true }
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, status: 'active' },
      select: { userId: true }
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId, status: 'sent', dueDate: { lt: now } },
      select: { id: true, number: true, title: true }
    }),
    prisma.quote.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['draft', 'sent'] },
        validUntil: { gte: now, lte: in7Days }
      },
      select: { id: true, number: true, title: true, validUntil: true }
    }),
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['approved', 'in_progress'] },
        endDate: { gte: now, lte: in7Days }
      },
      select: { id: true, title: true, endDate: true }
    })
  ])

  const upserts = []

  // Facturas vencidas: actualizar estado y notificar a owner/admin
  for (const inv of overdueInvoices) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'overdue' } })
    for (const m of adminMembers) {
      upserts.push({
        type: 'invoice_overdue',
        title: 'Factura vencida',
        message: `La factura #${inv.number} "${inv.title}" está vencida`,
        userId: m.userId,
        organizationId: orgId,
        refId: inv.id
      })
    }
  }

  // Presupuestos por vencer en 7 días
  for (const q of expiringQuotes) {
    const daysLeft = Math.max(0, Math.ceil((new Date(q.validUntil) - now) / (1000 * 60 * 60 * 24)))
    for (const m of adminMembers) {
      upserts.push({
        type: 'quote_expiring',
        title: 'Presupuesto por vencer',
        message: `El presupuesto #${q.number} "${q.title}" vence en ${daysLeft} día(s)`,
        userId: m.userId,
        organizationId: orgId,
        refId: q.id
      })
    }
  }

  // Proyectos con deadline en 7 días
  for (const p of upcomingProjects) {
    const daysLeft = Math.max(0, Math.ceil((new Date(p.endDate) - now) / (1000 * 60 * 60 * 24)))
    for (const m of allMembers) {
      upserts.push({
        type: 'project_deadline',
        title: 'Proyecto próximo a vencer',
        message: `El proyecto "${p.title}" vence en ${daysLeft} día(s)`,
        userId: m.userId,
        organizationId: orgId,
        refId: p.id
      })
    }
  }

  if (upserts.length > 0) {
    await Promise.all(upserts.map(n =>
      prisma.notification.upsert({
        where: {
          type_userId_organizationId_refId: {
            type: n.type,
            userId: n.userId,
            organizationId: n.organizationId,
            refId: n.refId
          }
        },
        update: {},
        create: n
      })
    ))
  }
}
