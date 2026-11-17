# CHANGELOG — crm-backend

## 2026-11-17 — Consola de super administración (panel Sistema)

**Cambio:** se amplía el panel Sistema a una consola completa, con auditoría, suspensión de empresas, cuentas deshabilitables y monitoreo.

**Schema** (aditivo, `prisma/manual-migrations/2026-11-17-super-admin.sql`):
- `Organization`: `status` (enum `OrgStatus` active/suspended, por defecto active), `suspendedAt` y `suspendedReason`.
- `User`: `disabledAt`, `disabledReason` y `lastLoginAt`.
- Tabla `AuditLog` con 5 índices. No tiene FKs, para que el evento sobreviva al borrado del usuario o la empresa.
- Generator: `previewFeatures = ["metrics"]` para las métricas del pool de Prisma.

**Endpoints nuevos.** Todos pasan por `auth`, `requireSystemAdmin` y un rate limit por admin:
- `GET /api/admin/dashboard?period=30d|90d|12m`
- `GET /api/admin/organizations` (búsqueda, filtros, orden y paginación en el servidor), `GET /api/admin/organizations/:id` y `PATCH /api/admin/organizations/:id/status`
- `GET /api/admin/users` y `GET /api/admin/users/:id`, `PATCH /api/admin/users/:id/status`
- `GET /api/admin/explorer/entities`, `GET /api/admin/explorer/orphans`, `GET /api/admin/explorer/:entity` y `GET /api/admin/explorer/:entity/:id`
- `GET /api/admin/finance`
- `GET /api/admin/audit`, `GET /api/admin/audit/filters` y `GET /api/admin/audit/:id`
- `GET /api/admin/infra`, `GET /api/admin/backups` y `POST /api/admin/backups/run`
- `GET /api/admin/export/:dataset?format=csv|xlsx`
- `POST /api/auth/logout`, que solo registra el cierre de sesión en la auditoría.

**Seguridad:**
- `auth` verifica en la DB, con caché de 30 s, si la cuenta está deshabilitada o borrada. El valor de `isSystemAdmin` sale de la DB, no del claim del JWT.
- `requireMembership` bloquea a los miembros de una empresa suspendida.
- El login rechaza las cuentas deshabilitadas, guarda `lastLoginAt`, audita los ingresos exitosos y los fallidos, y prefiere una empresa no suspendida como empresa inicial.
- `switch-organization` no permite entrar a una empresa suspendida.
- Validación con listas blancas de todos los filtros y órdenes (`utils/admin-params.js`). No hay SQL arbitrario.
- El explorador y las exportaciones nunca exponen password, hashes, tokens ni firmas.
- Un admin no puede deshabilitarse a sí mismo ni deshabilitar a otro systemadmin.
- El backup manual se bloquea fuera de producción, porque el bucket es compartido.
- Rate limits: 600 pedidos cada 15 min en general, 30 cada 15 min en acciones y exportaciones, y 3 backups por hora.

**Auditoría:**
- El middleware `auditMutations` registra toda escritura de la API: usuario, empresa, entidad, id, IP, user-agent y resultado. No guarda el body.
- Las acciones administrativas guardan los valores antes y después.
- También se auditan los backups (cron o manual) y las exportaciones.

**Monitoreo:**
- Postgres: versión, tamaño, conexiones y máximo de conexiones, tamaño de tablas e índices, uso de índices y `pg_stat_statements` cuando está disponible.
- Prisma: pool, cantidad de queries, consultas lentas sin parámetros y errores.
- Proceso: memoria, CPU y uptime.
- La respuesta se cachea 20 s.

**Capacidad de la base:**
- Postgres colapsa al quedarse sin disco, así que la capacidad sale de dos fuentes:
  - `DB_CAPACITY_BYTES`, una cuota explícita, si está definida;
  - si no, el disco del servidor medido con `statfs`, solo cuando la base comparte host con el backend.
- En prod (Dokploy) el disco del VPS es de 96 GB.
- Las bases remotas se informan como no disponibles.
- Alertas al 80 % y al 90 % en el dashboard.

**Finanzas:**
- Todo se agrupa por moneda.
- Presupuestado, facturado y cobrado son conceptos separados. Cobrado son los ingresos de caja confirmados.
- Los ingresos propios del SaaS se informan como no disponibles, porque no hay un modelo de cobro de planes.

**Otros:**
- `backup.service.js` devuelve el resultado de cada ejecución y lo registra en la auditoría.
- CORS expone `Content-Disposition` y `X-Row-Count`.
- Dependencia nueva: `exceljs`.

**Archivos:**
- Servicios `admin-*.service.js`, `audit.service.js`, `account-status.service.js` y `db-metrics.service.js`.
- `controllers/admin-console.controller.js`, `utils/admin-params.js` y `routes/admin.routes.js`.
- `config/db.js` y los middlewares `auth` y `requireMembership`.
- Controladores `login` y `auth`, `app.js` y `backup.service.js`.
- Scripts `scripts/apply-sql.js` y `scripts/test-admin-console.mjs`.

**Validación:**
- `scripts/test-admin-console.mjs` contra la DB de desarrollo: 74 de 74 OK.
- Lo que cubre: permisos (401, 403, claim falsificado), cálculos contra sumas directas, filtros, paginación, campos sensibles, suspensión y deshabilitación con efecto inmediato, auditoría con valores antes y después, exportaciones CSV y XLSX, infraestructura y el bloqueo del backup.

**Deploy:** aplicar primero el SQL en la DB de Dokploy, que es aditivo, y recién después deployar.

## 2026-11-16 — Panel de sistema (`/api/admin`)

**Cambio:** endpoints nuevos, solo para administradores del sistema (`User.isSystemAdmin`).

- `GET /api/admin/overview` (solo lectura):
  - **Base de datos:** ping y latencia, tamaño (`pg_database_size`), versión de Postgres, conexiones a la DB y filas de las tablas principales.
  - **Backups:** archivos del bucket `backups` de Supabase Storage, con fecha y peso.
  - **Resumen:** usuarios (total, verificados, sin empresa, altas de 7 y 30 días) y empresas (total, por plan, altas).
  - **Usuarios:** nombre, email, verificación, alta y empresas con rol y estado.
  - **Empresas:** dueño, equipo (activos, invitados, deshabilitados), clientes, presupuestos, proyectos, plan y alta.
- `PATCH /api/admin/organizations/:id/plan` con body `{ plan: 'free' | 'pro' | 'enterprise' }`. Queda registrado en el log como `[admin] Plan de …`.

**Motivo:** ver desde el CRM el estado de la base, los usuarios registrados y las empresas, y cambiar el plan de una empresa.

**Archivos:**
- `src/middlewares/requireSystemAdmin.middleware.js` (nuevo): además del claim del JWT, vuelve a leer `isSystemAdmin` en la DB en cada pedido. Así, quitar el permiso tiene efecto inmediato y no a las 24 h, cuando vence el token.
- `src/controllers/admin.controller.js` (nuevo)
- `src/routes/admin.routes.js` (nuevo)
- `src/app.js`: monta `/api/admin`.

**Impacto:**
- No cambia el schema ni las rutas existentes.
- Hoy `Organization.plan` no habilita ni limita ninguna función: cambiarlo solo actualiza el dato.
- Para usarlo en producción, el usuario necesita `isSystemAdmin = true` en la DB de Dokploy.

**Validación (DB de desarrollo):**
- Sin token: 401. Usuario común: 403, incluso con un JWT que dice `isSystemAdmin: true`.
- Systemadmin: 200, con datos correctos.
- Plan inválido: 400. Cambio de plan y vuelta atrás: 200.
