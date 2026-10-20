import { gzip } from 'zlib'
import { promisify } from 'util'
import prisma from '../config/db.js'
import supabase from '../config/supabase.js'
import { sendBackupFailureEmail } from './email.service.js'

const gzipAsync  = promisify(gzip)
const BUCKET     = 'backups'
const KEEP_DAYS  = 7

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false })
  }
}

async function exportAllTables() {
  const [
    users, organizations, memberships,
    clients, projects, projectMembers,
    quotes, quoteItems, quoteImages, quoteNotes,
    invoices, invoiceItems, installments,
    expenseCategories, expenses,
    tasks, taskHistory, taskStockItems,
    quoteHistory, projectHistory, clientHistory,
    attachments,
    productCategories, products, stockMovements, suppliers,
    financialCategories, cashAccounts, cashMovements,
    defaultTasks, notifications,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.organization.findMany(),
    prisma.organizationMembership.findMany(),
    prisma.client.findMany(),
    prisma.project.findMany(),
    prisma.projectMember.findMany(),
    prisma.quote.findMany(),
    prisma.quoteItem.findMany(),
    prisma.quoteImage.findMany(),
    prisma.quoteNote.findMany(),
    prisma.invoice.findMany(),
    prisma.invoiceItem.findMany(),
    prisma.installment.findMany(),
    prisma.expenseCategory.findMany(),
    prisma.expense.findMany(),
    prisma.task.findMany(),
    prisma.taskHistory.findMany(),
    prisma.taskStockItem.findMany(),
    prisma.quoteHistory.findMany(),
    prisma.projectHistory.findMany(),
    prisma.clientHistory.findMany(),
    prisma.attachment.findMany(),
    prisma.productCategory.findMany(),
    prisma.product.findMany(),
    prisma.stockMovement.findMany(),
    prisma.supplier.findMany(),
    prisma.financialCategory.findMany(),
    prisma.cashAccount.findMany(),
    prisma.cashMovement.findMany(),
    prisma.defaultTask.findMany(),
    prisma.notification.findMany(),
  ])

  return {
    users, organizations, memberships,
    clients, projects, projectMembers,
    quotes, quoteItems, quoteImages, quoteNotes,
    invoices, invoiceItems, installments,
    expenseCategories, expenses,
    tasks, taskHistory, taskStockItems,
    quoteHistory, projectHistory, clientHistory,
    attachments,
    productCategories, products, stockMovements, suppliers,
    financialCategories, cashAccounts, cashMovements,
    defaultTasks, notifications,
  }
}

async function deleteOldBackups() {
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list('', { sortBy: { column: 'created_at', order: 'asc' } })
  if (!files?.length) return

  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000)
  const old    = files.filter(f => new Date(f.created_at) < cutoff)
  if (old.length) {
    await supabase.storage.from(BUCKET).remove(old.map(f => f.name))
    console.log(`[backup] Eliminados ${old.length} backup(s) antiguos`)
  }
}

export async function runDatabaseBackup() {
  const date     = new Date().toISOString().slice(0, 10)
  const filename = `backup-${date}.json.gz`

  try {
    await ensureBucket()

    console.log(`[backup] Exportando tablas → ${filename}`)
    const tables = await exportAllTables()

    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 0)
    const buffer  = await gzipAsync(Buffer.from(payload))

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: 'application/gzip', upsert: true })

    if (error) throw new Error(`Upload fallido: ${error.message}`)

    await deleteOldBackups()
    console.log(`[backup] Completado → ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`)

  } catch (err) {
    console.error('[backup] Error:', err.message)
    await sendBackupFailureEmail(err.message).catch(() => {})
  }
}
