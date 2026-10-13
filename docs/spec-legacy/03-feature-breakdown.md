# Feature Breakdown — getaro

## F1: Login (Google OAuth + email/password)

### Description
Permite a los usuarios autenticarse con Google OAuth o con email y contraseña para acceder a la app.

### Inputs
| Input | Type | Required | Notes |
|-------|------|----------|-------|
| Provider choice | enum | Yes | `google` or `email` |
| Email (OAuth) | string | Conditional | From Google profile |
| Name (OAuth) | string | Conditional | From Google profile |
| Password | string | Conditional | Min 8 chars, email flow only |

### Outputs
| Output | Type | Notes |
|--------|------|-------|
| Session token | JWT | Supabase auth session |
| User object | JSON | id, email, name, avatar_url, provider |
| Redirect URL | string | Dashboard after successful login |

### Edge cases
- **Google account con email ya registrado**: si el email ya existe en la DB pero con otro provider → error "Esa cuenta ya está en uso" (no se permite merge automático)
- **Usuario Google existente**: si el usuario ya tiene cuenta con ese email, actualiza el provider y mantiene session
- **Cancelación de OAuth**: redirige a login page con mensaje "Inicio cancelado"
- **Múltiples pestañas logueadas**: session persiste en todas las pestañas; logout invalida todas

### Dependencies
- Requires: none (it's the entry point)

---

## F2: Groups / Salas creation and management

### Description
Los usuarios pueden crear grupos con nombre único, generar código de invitación y gestionar miembros dentro del grupo.

### Inputs
| Input | Type | Required | Notes |
|-------|------|----------|-------|
| Group name | string | Yes | Min 3 chars, max 50 chars |
| Slug (auto-generated) | string | Auto | Derived from name, unique per user |
| Invite code | string | Auto | Format: `G-` + random 6-char alphanumeric |

### Outputs
| Output | Type | Notes |
|--------|------|-------|
| Group record | JSON | id, name, slug, invite_code, created_by (user_id) |
| Invite link | string | `/join/{invite_code}` |
| Dashboard update | event | New group appears in user's group list |

### Edge cases
- **Nombre duplicado entre grupos del mismo usuario**: warning "Ya tienes un grupo con ese nombre" → permite continuar o cambiar nombre
- **Slug conflict**: si el slug ya existe, añade sufijo numérico (`chicas-del-vie-2`)
- **Fallo de red al crear**: retry con backoff exponencial (1s, 2s, 4s)
- **Nombre con caracteres especiales**: sanitiza a slug ASCII, mantiene nombre original en display

### Dependencies
- Requires: F1 (Login) — user must be authenticated
- Produces: group_id used by F3, F4, F5

---

## F3: Invitations (send + accept/reject)

### Description
El admin o creator puede invitar a otros usuarios mediante un código/link único. El invitado acepta o rechaza la invitación para unirse al grupo.

### Inputs
| Input | Type | Required | Notes |
|-------|------|----------|-------|
| Invite code | string | Yes | Format: `G-xxxxxx` |
| Invite link | URL | Conditional | `/join/{invite_code}` |
| Action | enum | Yes | `accept` or `reject` (implicit by joining) |

### Outputs
| Output | Type | Notes |
|--------|------|-------|
| Group membership record | JSON | id, group_id, user_id, role = "user" |
| Toast notification | string | "¡Te uniste al grupo!" or "Código inválido" |
| Redirect | URL | Dashboard or group view after join |

### Edge cases
- **Código inválido o expirado**: error "Ese código no existe o ya expiró"
- **Ya es miembro**: aviso "Ya estás en este grupo" → redirige al grupo directamente
- **No está logueado al hacer clic en link**: redirige a login, luego vuelve automáticamente con el mismo código (stored in session)
- **Concurrent join**: si dos personas intentan unirse simultáneamente, primera gana, segunda recibe aviso "El grupo se actualizó" y refresco automático

### Dependencies
- Requires: F2 (Groups) — needs group_id and invite_code
- Produces: membership records used by F4, F5

---

## F4: Availability marking (días/rangos/horas + color picker)

### Description
Los miembros del grupo pueden marcar días o franjas horarias como "disponible" u "ocupado", eligiendo su propio color con un color picker.

### Inputs
| Input | Type | Required | Notes |
|-------|------|----------|-------|
| group_id | string/uuid | Yes | From current group context |
| user_id | string/uuid | Auto | From authenticated session |
| start_date | date | Yes | Inclusive, YYYY-MM-DD format |
| end_date | date | Conditional | Same as start_date if single day |
| color | hex/rgb | Yes | Chosen via color picker; fallback to auto-assign if cancelled |
| type | enum | Yes | `available` or `busy` |
| status | enum | Auto | `confirmed` (user confirmed) or `pending` (auto-save) |
| time_slots | array of objects | Conditional | `{start: "08:00", end: "12:00"}` per day in range |

### Outputs
| Output | Type | Notes |
|--------|------|-------|
| Availability record | JSON | id, group_id, user_id, start_date, end_date, color, type, status |
| Calendar refresh | event | Group calendar updates with new color on affected cells |
| Toast notification | string | "Disponibilidad actualizada ✓" (auto-dismiss 3s) |

### Edge cases
- **Fecha en el pasado**: bloqueado — no se permite marcar días pasados, el selector de fecha lo impide visualmente (disabled)
- **Disponibilidad existente**: cada usuario puede añadir, modificar o desmarcar libremente. No hay sets rígidos: si marca un rango ya cubierto, actualiza ese registro (cambia tipo/color). También puede añadir rangos adicionales que se superponen sin conflicto.
- **Color picker cancelado**: fallback a color auto-asignado por sistema (determinista, basado en user_id hash)

### Dependencies
- Requires: F1 (Login), F3 (Invitations — must be a group member)
- Produces: availability records used by F5 (calendar view)

---

## F5: Visual calendar view (mensual/anual, colores por miembro)

### Description
Muestra un calendario mensual o anual con los días marcados en color según la disponibilidad de cada integrante del grupo. Permite navegar entre meses y ver el overview anual.

### Inputs
| Input | Type | Required | Notes |
|-------|------|----------|-------|
| group_id | string/uuid | Yes | From current group context |
| view | enum | Conditional | `monthly` (default) or `annual` |
| month/year | date params | Conditional | Current month/year; defaults to today |

### Outputs
| Output | Type | Notes |
|--------|------|-------|
| Calendar grid | HTML/JSX | Monthly view: 7-column grid per month with colored cells |
| Annual overview | HTML/JSX | Mini-cells for each day of the year, color indicators |
| Cell tooltips | HTML | Hover/touch shows "User Name — Available (color)" or "Busy" |
| Legend | UI element | Shows member names mapped to colors |

### Edge cases
- **Sin miembros en el grupo**: empty state con texto "Invita a alguien para ver la disponibilidad" + botón de invitar
- **Cargando datos**: skeleton loader en lugar del calendario (grid gris animado)
- **Datos corruptos o inconsistentes**: celdas marcadas como "?" con tooltip "Error al cargar disponibilidad"
- **Grupo con muchos miembros (>20)**: scroll horizontal en la leyenda, no se muestran todos los colores simultáneamente — toggle para mostrar/ocultar miembros individuales
- **Navegación rápida entre meses**: si hay un registro nuevo sin confirmar, pregunta "Tienes cambios pendientes. ¿Guardar antes de cambiar?" → opciones: sí, no, cancelar
- **Ad-blocker en móvil**: si el color picker usa un componente externo bloqueado, fallback a input hex manual

### Dependencies
- Requires: F1 (Login), F3 (Invitations — must be member), F4 (Availability data)
- Depends on: group_id from F2

---

## Data model sketch (reference for implementation)

```
groups:
  id: uuid PK
  name: string
  slug: string (unique per user)
  invite_code: string (unique, format "G-xxxxxx")
  created_by: uuid FK → users.id
  created_at: timestamp
  updated_at: timestamp

users:
  id: uuid PK (Supabase auth.uid)
  email: string unique
  name: string
  avatar_url: string nullable
  provider: enum ("google", "email")
  created_at: timestamp

group_members:
  id: uuid PK
  group_id: uuid FK → groups.id
  user_id: uuid FK → users.id
  role: enum ("admin", "creator", "user") DEFAULT "user"
  joined_at: timestamp
  UNIQUE (group_id, user_id)

availability:
  id: uuid PK
  group_id: uuid FK → groups.id
  user_id: uuid FK → users.id
  start_date: date
  end_date: date
  color: string (hex)
  type: enum ("available", "busy")
  status: enum ("confirmed", "pending") DEFAULT "confirmed"
  time_slots: jsonb nullable [{start, end}] per day in range
  created_at: timestamp
```
