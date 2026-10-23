import 'dotenv/config'
import { gunzip } from 'zlib'
import { promisify } from 'util'
import { PrismaClient } from '@prisma/client'
import supabase from '../src/config/supabase.js'

const gunzipAsync = promisify(gunzip)
const BUCKET = 'backups'

const DOKPLOY_DB_URL = process.env.DOKPLOY_DATABASE_URL
if (!DOKPLOY_DB_URL) {
  console.error('[restore] ❌ Falta DOKPLOY_DATABASE_URL en las variables de entorno')
  process.exit(1)
}

const target = new PrismaClient({ datasourceUrl: DOKPLOY_DB_URL })

async function downloadBackup() {
  const today = new Date().toISOString().slice(0, 10)
  const filename = process.argv[2] || `backup-${today}.json.gz`
  console.log(`[restore] Descargando ${filename} de Supabase Storage...`)

  const { data, error } = await supabase.storage.from(BUCKET).download(filename)
  if (error) throw new Error(`Error descargando backup: ${error.message}`)

  const buf = Buffer.from(await data.arrayBuffer())
  const raw = await gunzipAsync(buf)
  const parsed = JSON.parse(raw.toString('utf8'))
  console.log(`[restore] Backup del ${parsed.exportedAt} descargado`)
  return parsed.tables
}

async function run() {
  const tables = await downloadBackup()

  console.log('[restore] Conectando a Dokploy Postgres...')
  await target.$connect()

  console.log('[restore] Deshabilitando FK checks...')
  await target.$executeRawUnsafe(`SET session_replication_role = 'replica'`)

  try {
    // Truncar todas las tablas
    const truncateOrder = [
      'Notification', 'DefaultTask', 'CashMovement', 'CashAccount',
      'FinancialCategory', 'StockMovement', 'TaskStockItem', 'Supplier',
      'Product', 'ProductCategory', 'Attachment',
      'ClientHistory', 'ProjectHistory', 'QuoteHistory', 'TaskHistory',
      'Task', 'Expense', 'ExpenseCategory',
      'Installment', 'InvoiceItem', 'Invoice',
      'QuoteNote', 'QuoteImage', 'QuoteItem', 'Quote',
      'ProjectMember', 'Project', 'Client',
      'OrganizationMembership', 'Organization', 'User',
    ]

    process.stdout.write('[restore] Truncando tablas ')
    for (const t of truncateOrder) {
      await target.$executeRawUnsafe(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`)
      process.stdout.write('.')
    }
    console.log(' OK')

    // Insertar datos (orden respeta FK pero con replica mode no importa)
    const ops = [
      ['user',                   tables.users],
      // Organizations sin defaultCashAccountId para evitar FK circular
      ['organization',           tables.organizations.map(o => ({ ...o, defaultCashAccountId: null }))],
      ['organizationMembership', tables.memberships],
      ['client',                 tables.clients],
      ['project',                tables.projects],
      ['projectMember',          tables.projectMembers],
      ['quote',                  tables.quotes],
      ['quoteItem',              tables.quoteItems],
      ['quoteImage',             tables.quoteImages],
      ['quoteNote',              tables.quoteNotes],
      ['invoice',                tables.invoices],
      ['invoiceItem',            tables.invoiceItems],
      ['installment',            tables.installments],
      ['expenseCategory',        tables.expenseCategories],
      ['expense',                tables.expenses],
      ['task',                   tables.tasks],
      ['taskHistory',            tables.taskHistory],
      ['taskStockItem',          tables.taskStockItems],
      ['quoteHistory',           tables.quoteHistory],
      ['projectHistory',         tables.projectHistory],
      ['clientHistory',          tables.clientHistory],
      ['attachment',             tables.attachments],
      ['productCategory',        tables.productCategories],
      ['supplier',               tables.suppliers],
      ['product',                tables.products],
      ['stockMovement',          tables.stockMovements],
      ['financialCategory',      tables.financialCategories],
      ['cashAccount',            tables.cashAccounts],
      ['cashMovement',           tables.cashMovements],
      ['defaultTask',            tables.defaultTasks],
      ['notification',           tables.notifications],
    ]

    for (const [model, data] of ops) {
      if (!data?.length) {
        console.log(`[restore] ${model}: sin datos`)
        continue
      }
      await target[model].createMany({ data, skipDuplicates: true })
      console.log(`[restore] ${model}: ${data.length} registros`)
    }

    // Restaurar defaultCashAccountId en organizations (FK circular)
    let updatedOrgs = 0
    for (const org of tables.organizations) {
      if (org.defaultCashAccountId) {
        await target.organization.update({
          where: { id: org.id },
          data:  { defaultCashAccountId: org.defaultCashAccountId },
        })
        updatedOrgs++
      }
    }
    if (updatedOrgs) console.log(`[restore] defaultCashAccountId: ${updatedOrgs} org(s) actualizada(s)`)

    console.log('[restore] ✅ Restauración completada')

  } finally {
    await target.$executeRawUnsafe(`SET session_replication_role = 'origin'`)
    await target.$disconnect()
  }
}

run().catch(err => {
  console.error('[restore] ❌ Error:', err.message)
  process.exit(1)
})
