import { spawn } from 'child_process'
import { createGzip } from 'zlib'
import supabase from '../config/supabase.js'
import { sendBackupFailureEmail } from './email.service.js'

const BUCKET  = 'backups'
const KEEP_DAYS = 7

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false })
  }
}

function pgDumpToBuffer() {
  return new Promise((resolve, reject) => {
    const url = process.env.SUPABASE_DIRECT_URL
    if (!url) return reject(new Error('SUPABASE_DIRECT_URL no configurada'))

    const dump  = spawn('pg_dump', ['--no-owner', '--no-privileges', '--format=plain', url])
    const gzip  = createGzip()
    const parts = []

    dump.stdout.pipe(gzip)
    gzip.on('data', chunk => parts.push(chunk))
    gzip.on('end',  () => resolve(Buffer.concat(parts)))
    gzip.on('error', reject)

    dump.stderr.on('data', d => console.error('[backup] pg_dump:', d.toString().trim()))
    dump.on('close', code => { if (code !== 0) reject(new Error(`pg_dump salió con código ${code}`)) })
  })
}

async function deleteOldBackups() {
  const { data: files } = await supabase.storage.from(BUCKET).list('', { sortBy: { column: 'created_at', order: 'asc' } })
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
  const filename = `backup-${date}.sql.gz`

  try {
    await ensureBucket()

    console.log(`[backup] Iniciando dump → ${filename}`)
    const buffer = await pgDumpToBuffer()

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
