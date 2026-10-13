<!-- BEGIN:state-reference -->
# Antes de empezar

Lee [`STATE.md`](STATE.md) (estado y pendientes) y [`docs/SPEC.md`](docs/SPEC.md) (decisiones de producto). Para
cualquier cambio de base de datos, [`docs/DATABASE.md`](docs/DATABASE.md).

## Reglas del proyecto

- Next.js 16 y Supabase (Auth, Postgres con RLS, Realtime, Storage). Sin ORM: consultas con `@supabase/ssr`.
- Toda la autorización vive en RLS y funciones SQL de `supabase/migrations/`. Cambios de permisos, migración nueva.
- Migraciones: aplicar con el conector de Supabase (`apply_migration`) y probar con un bloque `do $$ ... raise exception`
  que lo deshace todo, usando cuentas **no admin**.
- Nunca `grant execute on all functions`: conceder `execute` función a función (ver 0008).
- Un `insert` con `returning` exige cumplir la política `select` en ese momento (ver 0009).
- Fechas de día siempre como texto `YYYY-MM-DD` con los ayudantes de `lib/dates.ts`.
- Textos de la interfaz siempre en `lib/i18n/dictionaries.ts`, en valencià y castellano.
- Las server actions devuelven `{ error }` en lugar de lanzar: en producción Next.js oculta los mensajes lanzados.
- Las consultas de Supabase son perezosas: sin `await` o `.then()` no se envían (`void supabase.rpc(...)` no hace nada).
- Redirecciones en route handlers con `relativeRedirect` (`lib/redirect.ts`): dentro de Docker `request.url` vale
  `http://0.0.0.0:3000`.
- Antes de cada commit, `npm run check`. Tras verificar un cambio: commit y push a `main` (GitHub Actions publica la
  imagen para Unraid).

<!-- END:state-reference -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
