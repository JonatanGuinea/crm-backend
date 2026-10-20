import sharp from 'sharp'
import path from 'path'
import { randomUUID } from 'crypto'

const IMAGE_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function toWebp(file) {
  if (!IMAGE_MIMETYPES.has(file.mimetype)) {
    const ext = path.extname(file.originalname) || ''
    return { buffer: file.buffer, name: `${randomUUID()}${ext}`, mimetype: file.mimetype }
  }
  const name   = `${randomUUID()}.webp`
  const buffer = await sharp(file.buffer).webp({ quality: 80 }).toBuffer()
  return { buffer, name, mimetype: 'image/webp' }
}
