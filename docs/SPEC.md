# getaro — Spec v2 (fuente de verdad)

> Sustituye a `docs/spec-legacy/*` (contradictorios entre sí). Decisiones tomadas el 2026-09-30.

## Qué es
Webapp para cuadrar quedadas con amigas. Cada **sala** agrupa a un grupo de gente. Dentro de la sala se crean **eventos** (una quedada concreta: "Cena octubre", "Finde playa"). En cada evento, cada persona marca los días que puede y el calendario muestra en qué días y rachas de días coincidís.

## Decisiones
| Tema | Decisión |
|------|----------|
| Stack | Next.js 16 (App Router) + Supabase (Auth, Postgres, Realtime). Deploy: Vercel + Supabase free tier |
| Auth | Google OAuth + magic link por email (sin contraseñas) |
| Organización | Sala → eventos. Cada evento tiene su propio rango de fechas y su propia disponibilidad |
| Disponibilidad | Por día. Estados: `yes` / `maybe`. Sin fila = no marcado. Clic rota vacío → sí → quizás → vacío. Arrastrar marca un rango |
| Color | Un color por persona (perfil), elegible con color picker. Por defecto derivado del id |
| Coincidencias | Días donde todas pueden (`yes`) = verde fuerte. Con algún `maybe` = verde claro. Rachas de días consecutivos se listan como "mejores fechas" |
| Cierre de evento | Quien creó el evento (o la dueña de la sala) fija la fecha final (día o rango). El evento pasa a "confirmado" |
| Crear eventos | Cualquier miembro de la sala |
| Chat | Uno por sala, en tiempo real |
| Invitaciones | Link compartible `/join/<CODE>` (8 caracteres A-Z0-9 sin ambiguos). La dueña puede regenerarlo |
| Roles | **Superadmin** global (`profiles.is_admin`) con panel `/admin`. Por sala: **dueña** (`rooms.owner_id`) y **miembros** |
| Tiempo real | Sí: chat y disponibilidad (Supabase Realtime). Si falla, un refresh basta |
| Modo oscuro | Toda la app: claro / oscuro / sistema |
| Días pasados | No se pueden marcar |

## Permisos
| Acción | Miembro | Creador/a del evento | Dueña de sala | Superadmin |
|--------|:------:|:------:|:------:|:------:|
| Ver sala, eventos, chat, disponibilidad | ✓ | ✓ | ✓ | ✓ |
| Marcar su disponibilidad | ✓ | ✓ | ✓ | — |
| Crear evento / escribir en chat | ✓ | ✓ | ✓ | — |
| Editar / fijar fecha / borrar evento | | ✓ | ✓ | ✓ |
| Borrar mensaje ajeno | | | ✓ | ✓ |
| Invitar (ver/regenerar link) | ver | ver | ✓ | ✓ |
| Expulsar miembro, transferir, renombrar, borrar sala | | | ✓ | ✓ |
| Listar/borrar usuarios, dar/quitar superadmin | | | | ✓ |

- La dueña no puede salir de la sala: primero transfiere o borra la sala.
- Si se borra una usuaria dueña de salas, la propiedad pasa al miembro más antiguo; si no queda nadie, la sala se borra.

## Modelo de datos (Postgres / Supabase)
Ver `supabase/migrations/0001_init.sql`.

- `profiles` (id = auth.users.id, display_name, avatar_url, color, is_admin)
- `rooms` (id, name, invite_code, owner_id)
- `room_members` (room_id, user_id, joined_at) — PK compuesta
- `events` (id, room_id, title, description, start_date, end_date, created_by, final_start, final_end)
- `availability` (event_id, user_id, day, status ∈ {yes, maybe}) — PK (event_id, user_id, day)
- `messages` (id, room_id, user_id, body, created_at)

Toda la autorización vive en RLS + funciones `security definer` (join por código, transferir, regenerar código, set_admin). Borrar usuarias (auth) lo hace el servidor con la service role key, tras comprobar `is_admin`.

## Pantallas
| Ruta | Contenido |
|------|-----------|
| `/login` | Google + magic link |
| `/` | Mis salas + crear sala + unirse con código |
| `/join/[code]` | Preview de la sala + "Unirme" (si no hay sesión → login → vuelve) |
| `/rooms/[id]` | Eventos de la sala · Chat · Miembros/ajustes |
| `/rooms/[id]/events/[eventId]` | Calendario del evento, mejores fechas, fijar fecha |
| `/settings` | Nombre, color, tema |
| `/admin` | Usuarios y salas: listar, borrar, dar/quitar superadmin |

## Fuera de alcance (por ahora)
Notificaciones, franjas horarias, integración con calendarios externos, invitación por email, apps nativas.
