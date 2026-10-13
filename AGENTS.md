<!-- BEGIN:state-reference -->
# Estado del Proyecto

**Siempre lee `STATE.md` antes de empezar cualquier tarea**, y `docs/SPEC.md` para las decisiones de producto.
`docs/spec-legacy/` está obsoleto (contradictorio): no lo uses como referencia.

## Resumen rápido (ver STATE.md para detalles)
- Next.js 16 + Supabase (Auth, Postgres con RLS, Realtime). Sin ORM: consultas con `@supabase/ssr`.
- Toda la autorización vive en RLS/RPCs de `supabase/migrations/`. Cambios de permisos → nueva migración SQL.
- Migraciones: se aplican con el conector de Supabase (`apply_migration`) y se prueban con un bloque `do $$ ... raise exception` que lo deshace todo, usando cuentas **no admin**.
- Nunca `grant execute on all functions`: conceder EXECUTE función a función. Funciones internas y de triggers sin EXECUTE para `authenticated` (ver 0008).
- Un INSERT con RETURNING exige cumplir la política SELECT en ese momento (los triggers AFTER llegan tarde; ver 0009).
- Fechas de día siempre como strings `YYYY-MM-DD` con los helpers de `lib/dates.ts` (UTC).
- Repo `arnaupool/getaro` (privado). Tras verificar cada cambio: commit y push a `main`; GitHub Actions publica la imagen para Unraid.

<!-- END:state-reference -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
