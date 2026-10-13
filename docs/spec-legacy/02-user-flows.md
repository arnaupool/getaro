# User Flows — getaro

## Flow A: Sign up / Login

### A1: Google OAuth (happy path)
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario hace clic en "Continuar con Google" | Redirige a Google Auth, luego vuelve a la app con token | — | Cancela Google → login fallido |
| 2 | Sistema recibe email del perfil de Google | Crea usuario si no existe; si existe, valida que sea el mismo | Email, nombre, avatar URL | Conflicto: cuenta existente con otro email → error "Esa cuenta ya está en uso" |
| 3 | Usuario queda logueado | Redirige al dashboard (lista de grupos) | Session token | — |

### A2: Email + password signup (happy path)
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario rellena email y contraseña | Valida formato email, mínimo 8 caracteres en password | Email, password | Password < 8 chars → error inline |
| 2 | Sistema crea cuenta con Supabase Auth | Devuelve session token + user object | — | Email ya existe → redirige a login |
| 3 | Usuario queda logueado | Redirige al dashboard | — | — |

### A3: Email login (happy path)
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario rellena email y password | Valida formato | Email, password | — |
| 2 | Sistema valida credenciales con Supabase Auth | Devuelve session token | — | Credenciales inválidas → error "Email o contraseña incorrectos" |
| 3 | Usuario queda logueado | Redirige al dashboard | — | — |

### A4: Returning user with existing Google account
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario con cuenta Google existente hace clic en "Continuar con Google" | Redirige a Google Auth, luego vuelve a la app con token | — | Cancela → login fallido |
| 2 | Sistema encuentra usuario existente por email | Actualiza provider (si cambió), mantiene session | — | — |
| 3 | Usuario queda logueado | Redirige al dashboard | — | — |

---

## Flow B: Create a group

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario logueado hace clic en "Crear nuevo grupo" | Abre formulario con campo "nombre del grupo" | — | Cancela → vuelve al dashboard |
| 2 | Usuario escribe nombre (ej. "Chicas del viernes") | Sistema genera slug automáticamente (`chicas-del-vie`) y código de invitación único (`G-abc12345`) | Nombre del grupo | — |
| 3 | Usuario confirma la creación | Crea registro en tabla `groups`, marca al usuario como admin + creator | Nombre, slug, invite_code | Fallo de red → retry con backoff |
| 4 | Muestra pantalla de invitación: código copiable + link de invitación | — | Invite code, group ID | — |

### Error paths
- **Nombre vacío**: botón deshabilitado hasta que haya texto ≥ 3 caracteres
- **Nombre duplicado entre todos los grupos del usuario**: warning "Ya tienes un grupo con ese nombre" → permite continuar o cambiar
- **Invitado no logueado hace clic en link de invitación**: redirige a login, luego vuelve al flujo de join

---

## Flow C: Join a group (unirse a un grupo)

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario logueado hace clic en "Unirse a un grupo" o abre link de invitación directo | Si viene del link → procesa automáticamente; si no → pide código manual | Código o URL | Cancela → vuelve al dashboard |
| 2 | Sistema valida el código con la tabla `groups` | Busca por invite_code, verifica que existe y no está expirado | Invite code | — |
| 3 | Muestra preview del grupo: nombre, avatar (si tiene), miembros actuales, botón "Unirme" | — | Group name, member count | — |
| 4 | Usuario hace clic en "Unirme" | Crea registro en `group_members` con rol = user, añade al calendario vacío | — | Fallo de red → retry con backoff |
| 5 | Redirige al dashboard o a la vista del grupo recién unido | — | — | — |

### Error paths
- **Código inválido**: error "Ese código no existe o ya expiró"
- **Ya es miembro**: aviso "Ya estás en este grupo" → redirige al grupo
- **No está logueado**: redirige a login, luego vuelve automáticamente con el mismo código

---

## Flow D: Set availability (marcar disponibilidad)

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario abre su grupo → ve calendario mensual | Muestra celdas vacías para todos los miembros | Group ID, member list | — |
| 2 | Usuario hace clic o arrastra (drag) para seleccionar rango de días | Resalta el rango seleccionado en color "preview" | Start date, end date | Cancela/clic fuera → cancela selección |
| 3 | Abre color picker (modal o inline) | Muestra presets comunes + input custom hex/rgb | Color elegido | Cancela → vuelve al calendario sin guardar |
| 4 | Usuario confirma disponibilidad ("Marcar como disponible") | Guarda registro en `availability` con type="available" y status="confirmed". Si ya hay un registro existente para esos días → lo actualiza (cambia tipo/color) o añade como nuevo registro independiente según el contexto. No hay sets rígidos: el usuario puede añadir, modificar o desmarcar libremente en cualquier momento. | group_id, user_id, start_date, end_date, color, type, status | — |

### Availability detail sub-flow
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario hace clic en un día ya marcado | Muestra detalle: tipo (disponible/ocupado), color, franjas horarias (si hay) | Availability ID | — |
| 2 | Puede editar o eliminar el registro | Guarda cambios o elimina registro | — | Cancela → vuelve al calendario |

### Error paths
- **Fecha en el pasado**: bloqueado — no se permite marcar días pasados, el selector de fecha lo impide visualmente (disabled)
- **Selección de un solo día sin rango**: funciona igual, se trata como start_date = end_date

---

## Flow E: View group calendar (ver calendario del grupo)

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario abre un grupo → ve vista mensual | Muestra grid de días con celdas coloreadas por miembro disponible | Group ID, member availability records | — |
| 2 | Navega entre meses (flechas o swipe en móvil) | Recarga la vista del mes actual | New month/year | — |
| 3 | Cambia a vista anual (toggle superior) | Muestra mini-celdas para cada día del año, con indicadores de color por disponibilidad | Year | — |
| 4 | Pasa el mouse/touch sobre una celda | Tooltip muestra: "María — Disponible (verde)" o "María — Ocupado (gris)" | Availability data for that cell | — |

### Error paths
- **Sin miembros aún**: estado vacío con texto "Invita a alguien para ver la disponibilidad" + botón de invitar
- **Cargando datos**: skeleton loader en lugar del calendario
- **Datos corruptos o inconsistentes**: muestra celdas como "?" con tooltip "Error al cargar disponibilidad"

---

## Flow F: Manage group roles (gestión de roles)

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Admin abre settings del grupo → ve lista de miembros con sus roles | Muestra tabla: nombre, avatar, rol (admin/creator/user) | Group members list | — |
| 2 | Admin hace clic en "Cambiar rol" sobre un miembro | Dropdown con opciones: admin, creator, user | New role selection | Cancela → vuelve a la lista |
| 3 | Confirma el cambio | Actualiza `role` en `group_members` | Group ID, member ID, new role | — |

### Error paths
- **Cambiar el último admin**: no permite quitar rol de admin al único admin → error "Debe haber al menos un admin"
- **Intentar subirse a sí mismo como admin desde otro contexto**: bloqueado si no es admin del grupo

---

## Flow G: Leave a group (salir de un grupo)

### Happy path
| Step | Action | System response | Data needed | Divergence/abort |
|------|--------|-----------------|-------------|------------------|
| 1 | Usuario va a settings del grupo → clic en "Salir del grupo" | Muestra confirmación: "¿Seguro que quieres salir? Perderás acceso al calendario y tu disponibilidad se ocultará" | — | Cancela → vuelve al grupo |
| 2 | Confirma la salida | Elimina registro de `group_members`, oculta disponibilidad, redirige al dashboard | — | — |

### Error paths
- **Salir si es el único admin**: warning "No puedes salir: eres el único admin. Transfiere el rol primero o elimina el grupo" → opciones: transferir rol o eliminar grupo

---

## Appendix: Common UI patterns

### Toast notifications
- Éxito guardado: "Disponibilidad actualizada ✓" — auto-dismiss 3s
- Error: "No se pudo conectar al servidor" — botón retry visible
- Info: "Invitación enviada" — con link para copiar

### Skeleton loaders
- Calendario muestra grid gris animado mientras carga datos reales
- Lista de miembros muestra avatares y nombres como placeholders

### Empty states
- Sin grupos: "No tienes grupos. ¡Crea uno o únete con un código!" → botones "Crear grupo" + "Unirse a grupo"
- Grupo sin miembros: "Invita a alguien para empezar a cuadrar días" → botón "Enviar invitación"
- Sin disponibilidad marcada: "Marca tus días disponibles para que todos sepan cuándo puedes" → botón "Marcar disponibilidad"
