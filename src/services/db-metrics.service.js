/* Instrumentación de Prisma en memoria (desde el último reinicio del proceso).
   - Cantidad de consultas, duración promedio y consultas lentas (sin parámetros: pueden traer datos personales).
   - Errores emitidos por el motor de Prisma.
   Se resetea con cada deploy/reinicio: es una ventana de observación, no un histórico. */

const SLOW_MS = Number(process.env.SLOW_QUERY_MS || 500)
const MAX_SLOW = 50
const MAX_ERRORS = 50

const state = {
  startedAt: new Date(),
  queries: 0,
  totalMs: 0,
  slow: [],
  errors: [],
  errorCount: 0,
}

export function attachPrismaMetrics(prisma) {
  prisma.$on('query', e => {
    state.queries++
    state.totalMs += e.duration
    if (e.duration >= SLOW_MS) {
      state.slow.unshift({ at: new Date().toISOString(), ms: e.duration, query: String(e.query).slice(0, 500) })
      if (state.slow.length > MAX_SLOW) state.slow.length = MAX_SLOW
    }
  })
  prisma.$on('error', e => {
    state.errorCount++
    state.errors.unshift({ at: new Date().toISOString(), message: String(e.message).slice(0, 500) })
    if (state.errors.length > MAX_ERRORS) state.errors.length = MAX_ERRORS
  })
}

export function getDbMetrics() {
  return {
    since: state.startedAt.toISOString(),
    slowThresholdMs: SLOW_MS,
    queries: state.queries,
    avgMs: state.queries ? +(state.totalMs / state.queries).toFixed(1) : null,
    slowQueries: state.slow,
    errorCount: state.errorCount,
    errors: state.errors,
  }
}
