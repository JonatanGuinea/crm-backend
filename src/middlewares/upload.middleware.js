import multer from 'multer'

const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    ALLOWED_MIMETYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Tipo de archivo no permitido. Permitidos: JPG, PNG, GIF, WEBP, PDF, DOC, DOCX, XLS, XLSX'))
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})
