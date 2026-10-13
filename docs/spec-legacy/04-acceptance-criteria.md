# Acceptance Criteria — getaro

Criterios verificables por QA para validar que cada feature está "terminada". Cada AC es binario: pasa o falla.

---

## AC-F1: Login (Google OAuth + email/password)

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F1-01 | Un nuevo usuario con Google OAuth puede registrarse y aterriza en el dashboard | Registrar cuenta nueva → login exitoso → URL `/dashboard` |
| F1-02 | Un usuario existente con Google OAuth mantiene su sesión sin duplicar registro | Login con email ya registrado → no se crea segundo user, session persiste |
| F1-03 | Email + password funciona con validación de mínimo 8 caracteres | Intentar registrar con 7 chars → error visible; con 8+ → éxito |
| F1-04 | Session persiste entre recargas del navegador | Recargar página → usuario sigue logueado, UI muestra avatar y nombre |
| F1-05 | Logout cierra sesión en todas las pestañas | Login en pestaña A y B → logout desde A → B también muestra login |
| F1-06 | Cancelar OAuth redirige a login page con mensaje "Inicio cancelado" | Clic en cancelar durante flujo Google → URL `/login` + toast |

---

## AC-F2: Groups creation and management

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F2-01 | Crear grupo con nombre válido genera slug y código de invitación únicos | Nombre "Chicas del Vie" → slug `chicas-del-vie`, código `G-XXXXXX` en DB |
| F2-02 | Slug se deriva automáticamente del nombre, sanitizado a ASCII | Nombres con ñ, acentos o caracteres especiales → slug limpio |
| F2-03 | Código de invitación tiene formato `G-` + 6 chars alfanuméricos | Regex: `^G-[A-Z0-9]{6}$` en cada registro de grupo |
| F2-04 | Nombre duplicado entre grupos del mismo usuario → warning pero permite continuar | Crear segundo grupo con nombre idéntico → toast "Ya tienes un grupo con ese nombre" + slug auto-sufijado |
| F2-05 | Slug conflict entre usuarios diferentes → añade sufijo numérico | Dos usuarios crean "chicas-del-vie" → uno tiene `chicas-del-vie`, otro `chicas-del-vie-2` |

---

## AC-F3: Invitations (send + accept)

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F3-01 | Un código de invitación válido permite unirse al grupo con un clic | Copiar link `/join/G-XXXXXX` → pegar en navegador nuevo → join exitoso → aparece en grupos del usuario |
| F3-02 | Código inválido o expirado muestra error claro | Ingresar `G-ZZZZZZ` inexistente → toast "Ese código no existe" |
| F3-03 | Unirse a un grupo donde ya es miembro → redirección directa al grupo, sin duplicación | Click en link de grupo existente → URL `/group/{slug}` sin crear segundo registro |
| F3-04 | Usuario no logueado que hace clic en invite link → login + auto-redirección con el mismo código | Abrir link sin session → tras login → redirige a join flow automáticamente (código preservado) |

---

## AC-F4: Availability marking

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F4-01 | Seleccionar rango de días y confirmar guarda un registro con color y tipo | Click drag del 5 al 8 → color picker (verde) → "Marcar como disponible" → DB tiene availability con start_date, end_date, color, type="available" |
| F4-02 | Selector de fecha deshabilita visualmente los días pasados | Intentar seleccionar un día anterior a hoy → no es seleccionable |
| F4-03 | Un usuario puede añadir rangos adicionales que se superponen sin conflicto | Marcar 5-8 como disponible, luego 7-12 como ocupado → ambos registros existen en DB |
| F4-04 | Un usuario puede modificar un registro existente (cambiar tipo o color) | Click en día ya marcado → editar a "ocupado" con nuevo color → registro actualizado |
| F4-05 | Un usuario puede eliminar su propio registro de disponibilidad | Click en día marcado → opción eliminar → registro borrado, calendario se limpia |
| F4-06 | Color picker cancelado asigna color auto (determinista basado en user_id hash) | Cancelar modal de color → registro guardado con color generado automáticamente |

---

## AC-F5: Visual calendar view

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F5-01 | Vista mensual muestra celdas coloreadas según disponibilidad de cada miembro | Grupo con 3 miembros y sus registros → calendario muestra grid con colores correspondientes |
| F5-02 | Vista anual muestra mini-celdas para todo el año con indicadores de color | Toggle "Anual" → grid 12×7 con celdas pequeñas coloreadas |
| F5-03 | Tooltip en hover/touch muestra nombre del miembro y tipo de disponibilidad | Hover sobre celda verde → tooltip "María — Disponible (verde)" |
| F5-04 | Sin miembros en el grupo → estado vacío con texto e invitación | Grupo recién creado, sin membresías → mensaje "Invita a alguien para ver la disponibilidad" + botón |
| F5-05 | Datos corruptos o inconsistentes → celdas "?" con tooltip de error | Inyectar registro con color inválido en DB → celda muestra "?" y tooltip "Error al cargar disponibilidad" |
| F5-06 | Grupo con >20 miembros → leyenda con scroll horizontal, toggle para mostrar/ocultar individuos | Simular 25 membresías → leyenda scrolleable + botones de toggle por miembro |

---

## AC-F6: Manage group roles

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F6-01 | Admin puede cambiar el rol de cualquier miembro (admin, creator, user) | Settings del grupo → dropdown sobre un miembro → elegir "admin" → role actualizado en DB |
| F6-02 | No se permite quitar el último admin del grupo | Grupo con 1 admin → intentar cambiar su rol a "user" → error "Debe haber al menos un admin" |

---

## AC-F7: Leave a group

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| F7-01 | Salir de un grupo elimina la membresía y oculta disponibilidad | Settings → "Salir del grupo" → confirmación → registro `group_members` borrado, disponibilidad no visible en calendario |
| F7-02 | El único admin no puede salir sin transferir el rol o eliminar el grupo | Grupo con 1 admin → intentar salir → warning + opciones: transferir rol o eliminar grupo |

---

## AC-Cross-cutting (UI/UX)

| ID | Criterio | Cómo verificar |
|----|----------|----------------|
| UX-01 | Toast de éxito se auto-elimina después de 3 segundos | Marcar disponibilidad → toast visible → esperar 3s → toast desaparece |
| UX-02 | Skeleton loader se muestra mientras cargan datos del calendario | Abrir grupo → antes de que lleguen los datos reales → grid gris animado |
| UX-03 | Empty states muestran mensajes contextuales + botón de acción relevante | Sin grupos → "No tienes grupos. ¡Crea uno o únete con un código!" + botones |
