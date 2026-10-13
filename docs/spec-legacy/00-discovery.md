# Discovery — getaro

## Problem statement
Coordinar días entre amigas y amigos con agendas apretadas es difícil: nadie se pone de acuerdo y los grupos de WhatsApp no sirven para esto. Esta app busca resolverlo visualizando quién está disponible en cada día/hora, sin necesidad de sugerencias automáticas ni notificaciones — el acuerdo final se hace por otro canal (WhatsApp, etc.).

## Target users
- **Primarios**: círculo social cercano del creador (amigas y amigos)
- **Secundarios**: cualquier persona invitada a un grupo
- **No hay usuarios anónimos**: todos tienen cuenta y pertenecen explícitamente a grupos

## Core features (MVP)
| # | Feature | Description |
|---|---------|-------------|
| F1 | Login | Google OAuth o email + contraseña |
| F2 | Grupos / salas | Crear un espacio compartido donde se agrupan personas |
| F3 | Invitaciones | El admin/creator invita a otros usuarios; el invitado acepta o rechaza |
| F4 | Disponibilidad | Marcar días y/o franjas horarias como disponible u ocupado en un calendario mensual/anual |
| F5 | Vista visual | Ver el calendario con los días marcados por color según cada integrante del grupo |

## Out of scope (not now)
- Sugerencia automática de día óptimo
- Notificaciones push o email
- Tiempo real — se usa refresh
- Historial de cambios o auditoría
- Integración con calendarios externos (Google Calendar, etc.)
- Apps nativas mobile/desktop

## User roles
| Role | Permissions |
|------|-------------|
| **Admin** | Poder supremo: eliminar salas, eliminar usuarios, cambiar otros roles |
| **Creator** | Puede crear nuevas salas/grupos |
| **User** | Invitado a una sala, puede marcar su disponibilidad y ver la del grupo |

Roles son por grupo (scoped), no globales. El admin de un grupo es el que creó esa sala.

## User flows — simplified

### Flow 1: Unirse a un grupo
```
Usuario llega → login (Google o email) → ve "unirse a un grupo" con código/link de invitación → acepta → aparece en la lista del grupo → puede ver calendario vacío
```

### Flow 2: Crear un grupo y marcar disponibilidad
```
Usuario logueado → "crear nuevo grupo" → pone nombre → obtiene un código/link de invitación → invita a amigas (envía link) → marca sus días/horas disponibles en el calendario → los otros ven los colores al refrescar
```

### Flow 3: Marcar disponibilidad
```
Usuario abre su grupo → ve calendario mensual/anual → clic en día o selecciona rango → marca como "disponible" u "ocupado" → se guarda → los demás ven el color al refrescar
```

## Calendar interaction (preliminary)
- Vista mensual y vista anual (ambas navegables)
- Clic en un día o arrastrar para seleccionar rango de días
- Opción adicional: marcar franjas horarias dentro del día (ej. "8am–12pm")
- **Color picker**: cada usuario elige su propio color con un color picker (no fijo por ID)

## Non-functional requirements
| Category | Requirement |
|----------|-------------|
| **Platform** | Web responsive, mobile-first |
| **Real-time** | No — refresh manual es suficiente |
| **Performance** | Carga del calendario < 2s en 4G (grupo de ~10-30 personas) |
| **Security** | OAuth con Google o email tradicional; cada grupo está aislado (un usuario no ve datos de otros grupos sin invitación) |

## Assumptions
- Los grupos son privados, accesibles solo por invitación
- No hay concepto de "evento" ni "reunión programada" — el acuerdo se hace fuera de la app
- La persistencia es local-first (el repo está vacío, aún no definimos stack)
- Un usuario puede pertenecer a múltiples grupos

## Open questions / decisions needed
| # | Question | Status |
|---|----------|--------|
| 1 | Email vs OAuth: ¿solo Google o también email+password? → **Decidido**: ambos | ✅ Cerrada |
| 2 | Colores de usuarios: ¿fijos por usuario o color picker? → **Decidido**: color picker | ✅ Cerrada |
| 3 | Mobile-first responsive vs PWA: ¿solo web o también instalación como app? → **Decidido**: solo web responsive | ✅ Cerrada |
| 4 | Persistencia: qué stack usar (el repo está vacío) → **Decidido**: Next.js + Supabase | ✅ Cerrada |

## Glossary
- **Grupo / Sala**: un espacio compartido donde se agrupan personas y comparten disponibilidad
- **Disponibilidad**: marcaje de días, rangos de días, o franjas horarias como "libre" u "ocupado"
- **Admin**: el creador del grupo + puede delegar a otros
- **Creator**: usuario con permiso para crear nuevas salas dentro de un grupo
- **User**: cualquier persona invitada que marca su disponibilidad
