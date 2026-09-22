import prisma from '../config/db.js'

export async function applyDefaultTasks(projectId, orgId, createdById) {
  const templates = await prisma.defaultTask.findMany({
    where: { organizationId: orgId },
    orderBy: { order: 'asc' }
  })
  if (!templates.length) return

  await prisma.task.createMany({
    data: templates.map(t => ({
      title:          t.title,
      description:    t.description ?? null,
      priority:       t.priority,
      assignedToId:   t.assignedToId ?? null,
      projectId,
      organizationId: orgId,
      createdById,
      status:         'todo',
    }))
  })
}
