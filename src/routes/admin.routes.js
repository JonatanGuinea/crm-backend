import { Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { auth } from '../middlewares/auth.middleware.js'
import { requireSystemAdmin } from '../middlewares/requireSystemAdmin.middleware.js'
import { getOverview, updateOrganizationPlan } from '../controllers/admin.controller.js'
import * as c from '../controllers/admin-console.controller.js'

// Panel de sistema: solo administradores del sistema (User.isSystemAdmin, verificado en la DB)
const router = Router()

const limit = (windowMin, max, message) => rateLimit({
  windowMs: windowMin * 60 * 1000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => req.user?.id || ipKeyGenerator(req.ip), // por admin (las rutas ya pasaron por auth)
  message: { error: message, data: null },
})
const general = limit(15, 600, 'Demasiadas solicitudes al panel. Esperá unos minutos.')
const sensitive = limit(15, 30, 'Demasiadas operaciones administrativas. Esperá unos minutos.')
const exports = limit(15, 30, 'Demasiadas exportaciones. Esperá unos minutos.')
const backup = limit(60, 3, 'Ya se lanzaron varios backups en la última hora.')

router.use(auth, requireSystemAdmin, general)

// Existentes
router.get('/overview', getOverview)
router.patch('/organizations/:id/plan', sensitive, updateOrganizationPlan)

// Dashboard
router.get('/dashboard', c.dashboard)

// Empresas y usuarios
router.get('/organizations', c.organizations)
router.get('/organizations/:id', c.organizationDetail)
router.patch('/organizations/:id/status', sensitive, c.setOrganizationStatus)
router.get('/users', c.users)
router.get('/users/:id', c.userDetail)
router.patch('/users/:id/status', sensitive, c.setUserStatus)

// Explorador (solo lectura)
router.get('/explorer/entities', c.entities)
router.get('/explorer/orphans', c.orphans)
router.get('/explorer/:entity', c.entityRecords)
router.get('/explorer/:entity/:id', c.entityRecord)

// Finanzas
router.get('/finance', c.finance)

// Auditoría (solo lectura: no hay rutas de edición ni borrado)
router.get('/audit', c.audit)
router.get('/audit/filters', c.auditFilters)
router.get('/audit/:id', c.auditEvent)

// Infraestructura y backups
router.get('/infra', c.infra)
router.get('/backups', c.backups)
router.post('/backups/run', backup, c.runBackup)

// Exportaciones (CSV / Excel)
router.get('/export/:dataset', exports, c.exportData)

export default router
