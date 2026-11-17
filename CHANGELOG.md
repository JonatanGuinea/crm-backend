# CHANGELOG — crm-backend

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
