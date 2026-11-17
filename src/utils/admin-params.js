/* Validación de parámetros de query para el panel Sistema.
   Todo filtro u orden que llega del front se valida contra una lista blanca. */

export class BadRequest extends Error {
  constructor(message) { super(message); this.status = 400 }
}

export function parsePage(query, { defaultSize = 25, maxSize = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function parseDate(value, name) {
  if (value == null || value === '') return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new BadRequest(`Fecha inválida en "${name}"`)
  return d
}

// "to" inclusivo: si viene solo la fecha (YYYY-MM-DD) se lleva al final del día
export function parseRange(query) {
  const from = parseDate(query.from, 'from')
  let to = parseDate(query.to, 'to')
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to = new Date(to.getTime() + 24 * 3600 * 1000 - 1)
  if (from && to && from > to) throw new BadRequest('El rango de fechas es inválido')
  return { from, to }
}

export function oneOf(value, allowed, name, fallback) {
  if (value == null || value === '') return fallback
  if (!allowed.includes(value)) throw new BadRequest(`Valor inválido para "${name}"`)
  return value
}

export function parseId(value, name = 'id') {
  if (value == null || value === '') return undefined
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(value))) throw new BadRequest(`Identificador inválido en "${name}"`)
  return String(value)
}

export function parseSearch(value) {
  if (value == null) return undefined
  const s = String(value).trim().slice(0, 100)
  return s || undefined
}

export function paginated(items, total, { page, pageSize }) {
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

// Envuelve controladores async: BadRequest → 400, el resto → 500 (mensaje genérico en prod)
export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res)
    } catch (err) {
      const status = err.status || 500
      if (status >= 500) console.error('[admin]', req.method, req.originalUrl, err)
      const message = status === 500 && process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message
      if (!res.headersSent) res.status(status).json({ error: message, data: null })
    }
  }
}
