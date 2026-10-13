# UI Component Library — getaro

Componentes principales del calendario y grupos con props, estados e interacciones. Todos usan React 19 + Tailwind CSS.

---

## Calendario Mensual (`CalendarMonth`)

```typescript
interface CalendarMonthProps {
  groupId: string;
  members: GroupMember[]; // [{ id, userId, role, user }]
  availabilityRecords: AvailabilityRecord[];
  onCellClick?: (date: Date) => void;
  onRangeSelect?: (start: Date, end: Date) => void;
  selectedRange?: { start: Date; end: Date } | null;
}

export default function CalendarMonth({ ... }: CalendarMonthProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `groupId` | string | Sí | Identificador del grupo para fetch de datos |
| `members` | `GroupMember[]` | Sí | Lista de miembros con roles (para leyenda y filtros) |
| `availabilityRecords` | `AvailabilityRecord[]` | Sí | Registros de disponibilidad del grupo |
| `onCellClick` | `(date: Date) => void` | No | Callback al hacer clic en una celda individual |
| `onRangeSelect` | `(start, end) => void` | No | Callback cuando el usuario selecciona un rango (drag) |
| `selectedRange` | `{ start, end } \| null` | No | Rango actualmente seleccionado (highlight visual) |

### Estados y renderizado
- **Loading**: skeleton grid con celdas grises animadas (`animate-pulse`)
- **Empty state**: mensaje "Invita a alguien para ver la disponibilidad" + botón de invitar
- **Error**: celda "?" con tooltip "Error al cargar disponibilidad"
- **Normal**: grid 7-columnas × N filas, celdas coloreadas por miembro

### Interacciones clave
| Acción | Comportamiento |
|--------|----------------|
| Hover sobre celda | Tooltip: `{userName} — {type} ({color})` |
| Click en celda vacía | Abre `ColorPickerModal` con tipo pre-seleccionado ("disponible") |
| Drag en rango de días | Resalta selección en tiempo real; al soltar → abre `ColorPickerModal` |
| Click en celda ya marcada | Muestra detalle: editar tipo, color o eliminar registro |
| Hover sobre leyenda | Filtra calendario mostrando solo ese miembro |

---

## Calendario Anual (`CalendarYear`)

```typescript
interface CalendarYearProps {
  groupId: string;
  members: GroupMember[];
  availabilityRecords: AvailabilityRecord[];
  selectedMonth?: number; // 0-11, defaults to current month
}

export default function CalendarYear({ ... }: CalendarYearProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `groupId` | string | Sí | Identificador del grupo |
| `members` | `GroupMember[]` | Sí | Lista de miembros (para leyenda) |
| `availabilityRecords` | `AvailabilityRecord[]` | Sí | Registros de disponibilidad |
| `selectedMonth` | number \| undefined | No | Mes seleccionado por defecto (0-11); si no se pasa, muestra año completo |

### Renderizado
- Grid 12 columnas × N filas (meses × semanas)
- Cada mini-celda representa un día con indicador de color (punto o barra pequeña)
- Si hay >5 miembros activos, muestra overlay "Vista compacta: más de 5 miembros" para evitar clutter visual

### Interacciones clave
| Acción | Comportamiento |
|--------|----------------|
| Hover sobre mini-celda | Tooltip con resumen del día (todos los registros) |
| Click en mes específico | Abre `CalendarMonth` con ese mes seleccionado |
| Scroll vertical | Navega entre meses (si está en modo compacto) |

---

## Color Picker (`ColorPicker`)

```typescript
interface ColorPickerProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm?: (color: string, type: 'available' \| 'busy') => void;
  initialType?: 'available' \| 'busy'; // Defaults to "available"
}

export default function ColorPicker({ ... }: ColorPickerProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `isOpen` | boolean | Sí | Controla visibilidad del modal |
| `onClose` | `() => void` | No | Callback al cerrar (cancelar) |
| `onConfirm` | `(color, type) => void` | No | Callback al confirmar selección |
| `initialType` | `'available' \| 'busy'` | No | Tipo pre-seleccionado en el UI |

### Renderizado y estados
- **Presets**: 6 colores comunes (verde, azul, naranja, rojo, morado, amarillo)
- **Custom input**: campo de texto para hex (#RRGGBB) o RGB
- **Cancelación**: si cierra sin confirmar → asigna color auto basado en hash de `userId`

### Interacciones clave
| Acción | Comportamiento |
|--------|----------------|
| Click en preset | Selecciona ese color inmediatamente (highlight visual) |
| Input hex | Valida formato (#RRGGBB); muestra error si inválido |
| Botón "Marcar como disponible" | Cierra modal + dispara `onConfirm(color, type)` |
| Botón "Cancelar" | Cierra modal; si hay rango seleccionado → asigna color auto y guarda registro |

---

## Group Card (`GroupCard`)

```typescript
interface GroupCardProps {
  group: Group; // { id, name, slug, inviteCode }
  memberCount?: number;
  onClick?: () => void;
}

export default function GroupCard({ ... }: GroupCardProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `group` | `Group` | Sí | Objeto completo del grupo |
| `memberCount` | number \| undefined | No | Número de miembros (si no se pasa, lo calcula internamente) |
| `onClick` | `() => void` | No | Callback al hacer clic en la card |

### Renderizado
- Layout horizontal: avatar placeholder + nombre del grupo + código de invitación
- Badge con número de miembros (si disponible)
- Hover effect: sombra y borde resaltado

---

## Date Range Picker (`DateRangePicker`)

```typescript
interface DateRangePickerProps {
  isOpen: boolean;
  selectedRange?: { start: Date; end: Date } | null;
  minDate?: Date; // Defaults to today (past dates blocked)
  maxDate?: Date; // Optional, defaults to far future
  onConfirm?: (start: Date, end: Date) => void;
  onCancel?: () => void;
}

export default function DateRangePicker({ ... }: DateRangePickerProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `isOpen` | boolean | Sí | Controla visibilidad del modal |
| `selectedRange` | `{ start, end } \| null` | No | Rango actualmente seleccionado (highlight visual) |
| `minDate` | Date | No | Fecha mínima; por defecto es hoy (días pasados bloqueados) |
| `maxDate` | Date | No | Fecha máxima; por defecto, futuro lejano |
| `onConfirm` | `(start, end) => void` | No | Callback al confirmar selección |
| `onCancel` | `() => void` | No | Callback al cancelar |

### Renderizado y estados
- **Loading**: skeleton loader con grid gris animado
- **Empty state**: mensaje "Selecciona un rango de fechas para marcar disponibilidad"
- **Normal**: calendario mensual con días seleccionables (resaltados en azul)

### Interacciones clave
| Acción | Comportamiento |
|--------|----------------|
| Click en día inicial | Marca inicio del rango; resalta desde hoy hasta ese día |
| Drag o click en otro día | Define fin del rango; ambos resaltados |
| Hover sobre celda ya marcada | Tooltip con detalles del registro existente |
| Botón "Marcar como disponible" | Cierra modal + dispara `onConfirm(start, end)` |

---

## Legend (`Legend`)

```typescript
interface LegendProps {
  members: GroupMember[]; // [{ id, userId, role, user }]
  onToggle?: (userId: string) => void; // Toggle visibility for a member
  isCompact?: boolean; // If true, shows scrollable horizontal legend
}

export default function Legend({ ... }: LegendProps)
```

### Props y comportamiento
| Prop | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `members` | `GroupMember[]` | Sí | Lista de miembros con colores asignados |
| `onToggle` | `(userId: string) => void` | No | Callback al hacer clic en un miembro (mostrar/ocultar) |
| `isCompact` | boolean \| undefined | No | Si true, muestra leyenda scrolleable horizontalmente (>20 miembros) |

### Renderizado
- Lista vertical de items: `{color} {userName}`
- Cada item tiene botón toggle (eye icon) para mostrar/ocultar ese miembro en el calendario
- Si hay >20 miembros: `isCompact` = true → leyenda scrolleable horizontalmente con botones de toggle por grupo

### Interacciones clave
| Acción | Comportamiento |
|--------|----------------|
| Hover sobre item | Resalta ese miembro en el calendario (highlight) |
| Click en toggle | Oculta/muestra ese miembro del calendario |
| Scroll horizontal (>20 miembros) | Navega entre grupos de miembros con flechas izquierda/derecha |

---

## Notes for Implementation

- **Todos los componentes deben ser TypeScript typed** — no usar `any` ni props implícitas
- **Color scheme**: definir en `tailwind.config.ts` como tokens (`--color-available`, `--color-busy`, etc.)
- **Responsive**: todos los calendarios deben funcionar en móvil (touch events, drag simplificado)
- **Accessibility**: tooltips con `aria-describedby`, legendarios con `role="list"`, botones con `aria-label`
