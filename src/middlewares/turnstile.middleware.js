import { fail } from '../utils/response.js'

// Verificación "No soy un robot" de Cloudflare Turnstile.
// Si TURNSTILE_SECRET_KEY no está configurada no exige nada (entornos sin Turnstile).
// El front manda el token del widget en req.body.turnstileToken; cada token sirve una sola vez.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const verifyTurnstile = async (req, res, next) => {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return next()

  const token = req.body?.turnstileToken
  if (!token || typeof token !== 'string') {
    return fail(res, 400, 'Completá la verificación "No soy un robot".')
  }

  const ip = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim()

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.append('remoteip', ip)

    const r = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) })
    const data = await r.json()

    if (!data.success) {
      console.warn('[turnstile] verificación rechazada:', (data['error-codes'] || []).join(', '))
      return fail(res, 400, 'La verificación "No soy un robot" falló. Probá de nuevo.')
    }
    return next()
  } catch (err) {
    // Si Cloudflare no responde no bloqueamos el acceso a todos los usuarios: se deja pasar y se registra.
    console.error('[turnstile] no se pudo verificar con Cloudflare:', err.message)
    return next()
  }
}
