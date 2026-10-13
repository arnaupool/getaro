# Estado del Proyecto — getaro (actualizado 30 sep 2026)

Fuente de verdad del producto: `docs/SPEC.md`. Los docs de `docs/spec-legacy/` están obsoletos (contradictorios).

## ✅ Hecho (v2, reescritura sobre Supabase)
- **Stack**: Next.js 16.2 + React 19.2 + Tailwind 4 + `@supabase/ssr`. Prisma y NextAuth eliminados.
- **DB**: `supabase/migrations/0001_init.sql` — tablas, RLS, triggers, RPCs, publicación realtime.
- **Auth**: Google OAuth + magic link. `proxy.ts` refresca sesión y redirige a `/login?next=`.
- **Pantallas**: login, dashboard de salas, join por enlace, sala (eventos / chat / gente), evento con calendario, ajustes (nombre, color, tema), panel admin (usuarias y salas).
- **Calendario** (`app/rooms/[id]/events/[eventId]/EventCalendar.tsx`): tocar rota sí → quizás → nada, arrastrar marca rango, heatmap de coincidencias, mejores fechas (rachas), detalle por día, fijar fecha final, realtime.
- **Chat** por sala en tiempo real.
- **Modo oscuro** en toda la app.
- **Idiomas**: valencià (por defecto) y castellano. Textos en `lib/i18n/dictionaries.ts`, cookie `lang`, selector en Ajustes y en login.
- **Móvil**: revisado a 375 y 320 px sin desbordes; inputs a 16px (sin zoom en iOS); safe-area; borrar mensajes visible en táctil.
- **Docker**: imagen `ghcr.io/arnaupool/getaro:latest` construida por GitHub Actions en cada push a `main` (tsc, lint y tests antes). Config en tiempo de ejecución (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TZ`) vía `lib/config.ts`; el navegador la recibe en `window.__SUPABASE__` desde el layout. Instalación en Unraid con Add Container: `DEPLOY.md`.
- **Keepalive** (`instrumentation.ts`): en producción consulta Supabase al arrancar y cada 24 h para que el plan gratis no pause el proyecto.
- **Errores**: las server actions devuelven `{ error }` (no lanzan) para que el mensaje se vea en producción. Página `/unavailable` si Supabase no responde o falta el perfil (evita bucle de redirecciones).
- **Login**: el botón de Google solo aparece si Google está activado en Supabase. Además del enlace, se puede entrar con el código del correo (`verifyOtp`); plantillas en `supabase/email-templates/`. En `npm run dev` hay un "Accés de proves" con contraseña para usuarias de prueba creadas en Supabase (oculto en producción).
- **Tests**: `lib/availability.test.ts` (8 tests de lógica pura).
- Verificado: `tsc`, `eslint`, `next build`, y UI del calendario revisada en navegador con datos falsos.

## ⬜ Pendiente
- Probar el flujo completo con varias usuarias reales (login → sala → evento → marcar → chat → admin).
- Pegar plantillas de correo, configurar SMTP de Resend, instalar en Unraid, ruta en Cloudflare Tunnel.

## 📁 Estructura
```
app/
  actions.ts                 server actions (salas, eventos, perfil, admin)
  login/, auth/callback, auth/signout
  page.tsx                   dashboard
  join/[code]/               unirse por enlace
  rooms/[id]/                sala: EventsTab, Chat, PeopleTab
  rooms/[id]/events/[eventId]/  calendario del evento
  settings/, admin/
components/                  Header, Avatar, ThemeToggle, forms (ActionForm, SubmitButton, CopyButton)
lib/                         supabase/{server,client}, auth, room, dates, availability, types
supabase/migrations/         SQL
proxy.ts                     sesión + protección de rutas (Next 16: middleware → proxy)
```
