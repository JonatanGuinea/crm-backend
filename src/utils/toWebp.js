import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'

const IMAGE_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function toWebp(file, uploadsDir) {
  if (!IMAGE_MIMETYPES.has(file.mimetype)) return file.filename

  const srcPath  = path.join(uploadsDir, file.filename)
  const newName  = `${randomUUID()}.webp`
  const destPath = path.join(uploadsDir, newName)

  await sharp(srcPath).webp({ quality: 80 }).toFile(destPath)
  fs.unlink(srcPath, () => {})

  return newName
}
