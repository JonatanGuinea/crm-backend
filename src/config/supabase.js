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

// Copia un archivo dentro del bucket con un nombre nuevo y devuelve { name, url }
export async function copyFile(urlOrName) {
  const from = urlOrName?.split('/').pop()
  if (!from) throw new Error('Archivo de origen inválido')
  const ext  = from.includes('.') ? from.slice(from.lastIndexOf('.')) : ''
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
  const { error } = await supabase.storage.from('uploads').copy(from, name)
  if (error) throw new Error(`Supabase Storage: ${error.message}`)
  const { data } = supabase.storage.from('uploads').getPublicUrl(name)
  return { name, url: data.publicUrl }
}

export default supabase
