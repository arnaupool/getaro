# getaro

Webapp para cuadrar quedadas con amigas: salas → eventos → calendario de disponibilidad compartido + chat.
Spec: [`docs/SPEC.md`](docs/SPEC.md).

Stack: Next.js 16 · React 19 · Tailwind 4 · Supabase (Auth + Postgres + Realtime).

## Puesta en marcha (≈15 min)

1. **Crear proyecto** en [supabase.com](https://supabase.com) (plan gratis, región UE).
2. **Base de datos**: Supabase → SQL Editor → pega `supabase/migrations/0001_init.sql` → Run.
3. **Claves**: Project Settings → API → copia *Project URL* y *Publishable key* en `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. **URLs de auth**: Authentication → URL Configuration
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`
5. **Arrancar**: `npm install` y `npm run dev` → http://localhost:3000. Entra con el magic link.
6. **Hacerte superadmin** (una vez, tras tu primer login), en el SQL Editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'TU_EMAIL');
   ```

### Google OAuth (opcional)
1. Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web).
2. Authorized redirect URI: `https://xxxx.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google → pega Client ID y Secret.

### Plantillas de correo
Pega las de [`supabase/email-templates`](supabase/email-templates/README.md) en Authentication, Emails.
Incluyen un código de 6 cifras para entrar aunque el enlace se abra en otro navegador.

### Envío de correos (obligatorio para que entren otras personas)
El correo de serie de Supabase solo envía a los miembros de tu organización de Supabase y unas 2 veces por hora.
Configura Resend como SMTP:
1. Resend, API Keys: crea una clave con permiso de envío.
2. Supabase, Authentication, Emails, SMTP Settings, activar Custom SMTP:
   - Sender email: una dirección de tu dominio verificado en Resend (p. ej. `getaro@tudominio.com`)
   - Sender name: `getaro`
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password: la clave del paso 1
3. Authentication, Rate Limits: sube "emails per hour" (p. ej. 30).

## Deploy en Unraid (Docker)
Cada push a `main` comprueba el código y publica `ghcr.io/arnaupool/getaro:latest` (GitHub Actions,
`.github/workflows/docker.yml`). En Unraid se instala una vez con Add Container y se actualiza con un clic.
La imagen no lleva claves: se configura con las variables `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `TZ`.
Tutorial: [`DEPLOY.md`](DEPLOY.md).

## Comandos
| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm test` | Vitest (lógica de fechas y disponibilidad) |
