# Glossary — getaro

Glosario de términos del dominio y su significado exacto en este proyecto.

---

## Group (Grupo)

Colección de personas que comparten un calendario de disponibilidad. Cada grupo tiene un identificador único (`group_id`, UUID), un nombre, un slug URL-amigable y un código de invitación.

| Campo | Valor | Notas |
|-------|-------|-------|
| `id` | UUID v4 | Identificador interno |
| `name` | string (max 50) | Nombre legible por el usuario |
| `slug` | string, único por usuario | Versión URL-safe del nombre; si hay conflicto entre usuarios, se añade sufijo numérico (`-2`, `-3`) |
| `invite_code` | string, formato `G-XXXXXX` | Código alfanumérico de 6 caracteres usado para invitar a otros |
| `created_by` | UUID FK → users.id | Quién creó el grupo |

## Member (Miembro)

Persona que pertenece a un grupo. La membresía se representa como registro en la tabla `group_members`.

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Admin** | Propietario o delegado del grupo. Puede eliminar miembros, cambiar roles y eliminar el grupo. | Todos los permisos |
| **Creator** | Miembro con permisos de edición (marcar disponibilidad). No puede gestionar otros miembros ni eliminar el grupo. | Marcar disponibilidad, editar su propia disponibilidad |
| **User** | Miembro estándar del grupo. Puede ver calendario y marcar disponibilidad. | Ver calendario, marcar disponibilidad |

## Availability (Disponibilidad)

Registro que indica cuándo un miembro está libre u ocupado dentro de un rango de fechas. Cada registro tiene un color asociado para visualización en el calendario.

| Campo | Valor | Notas |
|-------|------|-------|
| `type` | `"available"` o `"busy"` | Significado semántico: día libre o día no disponible |
| `color` | Hex string (ej. `"#4CAF50"`) | Color visual para la celda del calendario; si el usuario cancela el color picker, se asigna automáticamente basado en hash de `user_id` |
| `status` | `"confirmed"` o `"pending"` | Confirmado = guardado explícitamente; pendiente = auto-save temporal |
| `time_slots` | JSON array `{start: "08:00", end: "12:00"}` | Opcional. Si no se especifica, el rango completo del día está marcado |

### Reglas de disponibilidad
- Los usuarios pueden **añadir**, **modificar** o **eliminar** sus registros libremente en cualquier momento. No hay sets rígidos ni límites.
- Rangos que se superponen son válidos: un usuario puede tener un registro "disponible" del 5 al 8 y otro "ocupado" del 7 al 12 sin conflicto.
- Los días pasados **no pueden** ser marcados (selector deshabilita visualmente).

## Invitation Code (Código de invitación)

String único con formato `G-` seguido de 6 caracteres alfanuméricos mayúsculas y dígitos. Se genera automáticamente al crear un grupo. Sirve para que otros usuarios se unan al grupo sin compartir el link completo.

| Formato | Ejemplo |
|---------|---------|
| `^G-[A-Z0-9]{6}$` | `G-A3F8K2` |

## Join Flow (Flujo de unión)

Proceso por el cual un usuario se une a un grupo existente usando un código o link de invitación:

1. Usuario ingresa al link `/join/G-{code}` o escribe manualmente el código
2. Sistema valida que el código existe y no ha expirado
3. Si el usuario ya es miembro → redirección directa al grupo (sin duplicar)
4. Si el usuario no está logueado → redirección a login, luego vuelve automáticamente con el mismo código
5. Si el usuario no es miembro → crea registro en `group_members` y redirige al calendario del grupo

## Calendar View (Vista de calendario)

Representación visual de la disponibilidad del grupo. Dos modos:

| Modo | Descripción |
|------|-------------|
| **Mensual** | Grid 7-columnas por mes, celdas coloreadas según disponibilidad de cada miembro |
| **Anual** | Vista compacta con mini-celdas para cada día del año, indicadores de color por disponibilidad |

## Dashboard (Panel principal)

Vista post-login que muestra los grupos del usuario y accesos rápidos: "Crear grupo", "Unirse a grupo". Es la página default tras autenticación.

---

## Términos UI no técnicos

| Término | Significado |
|---------|-------------|
| **Toast** | Notificación emergente temporal (3s para éxito, botón retry para error) |
| **Skeleton loader** | Placeholder animado con grid gris mientras cargan datos reales |
| **Empty state** | Pantalla que muestra cuando no hay datos (ej. "No tienes grupos") con mensaje contextual y botón de acción |
