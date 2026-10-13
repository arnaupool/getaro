# Plantillas de correo (Supabase)

Dónde: Supabase, Authentication, Emails (pestaña Templates).

| Plantilla en Supabase | Asunto | Cuerpo (Source) |
|-----------------------|--------|-----------------|
| Confirm signup | `Confirma el teu correu per a getaro` | `confirm-signup.html` |
| Magic Link | `El teu accés a getaro` | `magic-link.html` |

Las dos incluyen el enlace y el código (`{{ .Token }}`). El código permite entrar aunque el enlace se abra en el
navegador interno de Gmail o WhatsApp, o en otro dispositivo.

## Por qué el enlace no usa `{{ .ConfirmationURL }}`

`{{ .ConfirmationURL }}` apunta a `supabase.co`, que luego redirige a getaro. Un correo de `apool.dev` con un enlace a
otro dominio (y que acaba en una IP privada) parece phishing y Gmail lo manda a spam. Por eso el enlace va directo a
getaro: `{{ .RedirectTo }}` es la dirección `/auth/callback?next=...` que pide la app, y `token_hash` lo verifica el
servidor de getaro (`app/auth/callback/route.ts`). De paso, el enlace funciona aunque se abra en otro dispositivo.
