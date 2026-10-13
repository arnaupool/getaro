# Plantillas de correo (Supabase)

Dónde: Supabase, Authentication, Emails (pestaña Templates).

| Plantilla en Supabase | Asunto | Cuerpo (Source) |
|-----------------------|--------|-----------------|
| Confirm signup | `Confirma el teu correu per a getaro` | `confirm-signup.html` |
| Magic Link | `El teu accés a getaro` | `magic-link.html` |

Las dos incluyen el enlace y el código (`{{ .Token }}`). El código permite entrar aunque el enlace se abra en el
navegador interno de Gmail o WhatsApp, o en otro dispositivo.
