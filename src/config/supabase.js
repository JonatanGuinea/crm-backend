import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function uploadFile(buffer, name, mimetype) {
  const { error } = await supabase.storage
    .from('uploads')
    .upload(name, buffer, { contentType: mimetype, upsert: false })
  if (error) throw new Error(`Supabase Storage: ${error.message}`)
  const { data } = supabase.storage.from('uploads').getPublicUrl(name)
  return data.publicUrl
}

export async function deleteFile(urlOrName) {
  if (!urlOrName) return
  // Funciona con URL completa o solo nombre de archivo
  const name = urlOrName.split('/').pop()
  if (!name) return
  await supabase.storage.from('uploads').remove([name])
}

export default supabase
