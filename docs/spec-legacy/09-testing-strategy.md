# Testing Strategy & Test Fixtures — getaro

## Estrategia por capa

| Capa | Herramienta | Cobertura | Ejecución |
|------|-------------|-----------|-----------|
| Unit | Vitest + `@testing-library/react` | Utils, validators, Zod schemas | `npm run test:unit` (isolado) |
| Integration | Vitest + Prisma mock client | API routes, server actions | `npm run test:integration` (DB real en memory SQLite) |
| Component | Vitest + `@testing-library/react` | CalendarMonth, ColorPicker, GroupCard | `npm run test:component -- --coverage` |

## Estructura de fixtures

```
tests/fixtures/
├── users.ts           # UserFactory: default role 'user', email válido, password 8+ chars
├── groups.ts          # GroupFactory: name ≤50 chars, slug auto-sanitized
├── members.ts         # MemberFactory: groupId + userId, role 'admin'/'creator'/'user'
└── availability.ts    # AvailabilityFactory: start_date ≥ hoy, end_date ≥ start_date, type 'available'|'busy'
```

## Unit Tests (sin DB)

### Validadores Zod (`src/lib/validators.ts`)
- `createGroupSchema.parse({ name: "..." })` → success
- `inviteCodeSchema.parse("G-A3F8K2")` → success
- `inviteCodeSchema.parse("X-A3F8K2")` → throws error
- `dateRangeSchema.parse({ start: today, end: future })` → success
- `colorHexSchema.parse("#4CAF50")` → success

### Utilidades (`src/lib/utils.ts`)
- `slugify("Mi Grupo de Trabajo")` → `"mi-grupo-de-trabajo"`
- `hashColor(userId)` → string hex válido (determinístico, consistente)
- `generateInviteCode()` → matches `^G-[A-Z0-9]{6}$`, único en 1M llamadas

## Integration Tests (Prisma con SQLite real)

En tests de integración usa SQLite en memory para validar FKs y constraints reales:
```typescript
import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, it, expect } from 'vitest';

const prisma = new PrismaClient(); // Vitest inyecta DATABASE_URL_TEST con SQLite file

describe('API Groups', () => {
  it('createGroup returns redirect to slug', async () => {
    const res = await fetch('/api/groups', { method: 'POST', body: JSON.stringify({ name: 'Test' }) });
    expect(res.status).toBe(302); // Redirect a /group/{slug}
  });

  it('getGroupBySlug returns members + availability', async () => {
    const res = await fetch('/api/groups/test-slug');
    const data = await res.json();
    expect(data.group.name).toBe('Test');
    expect(Array.isArray(data.members)).toBe(true);
  });

  it('joinGroup via inviteCode adds member to group', async () => {
    const code = generateInviteCode(); // 'G-XXXXXX'
    await prisma.group.create({ data: { name: 'Joined Group', inviteCode: code } });
    const res = await fetch('/api/invite/join', { method: 'POST', body: JSON.stringify({ code }) });
    expect(res.status).toBe(200);
  });

  it('leaveGroup removes member + transfers role if last admin', async () => {
    // Setup: grupo con 1 admin, otro miembro como user
    // Action: admin se va
    // Assert: rol transferido al primer user o grupo eliminado si es único admin
  });
});
```

## Component Tests (UI)

### CalendarMonth (`tests/unit/components/calendar-month.test.tsx`)
- `render(<CalendarMonth groupId="1" members={[]} availabilityRecords={[]})` → skeleton loading visible
- `await userEvent.click(cell)` → abre ColorPickerModal
- `await userEvent.drag(start, end)` → selecciona rango, abre ColorPickerModal

### ColorPicker (`tests/unit/components/color-picker.test.tsx`)
- `render(<ColorPicker isOpen={true} />)` → presets + custom input renderizados
- `await userEvent.type(input, "#FF0000")` → valida formato hex (muestra error si inválido)
- `await userEvent.click(confirmButton)` → llama a onConfirm(color, type)

## Ejecución local

| Comando | Descripción |
|---------|-------------|
| `npm run test:unit` | Vitest con glob `tests/unit/**/*.{ts,tsx}` (sin DB, mocks Prisma) |
| `npm run test:integration` | Vitest con SQLite en memory (`DATABASE_URL_TEST="file:./test.db"`) |
| `npm run test:component` | Vitest + Testing Library para UI components |
| `npm run test -- --coverage` | Genera reporte (target ≥ 80%) |

## Reglas de testing
1. **Nunca hardcodear IDs** — usar factories (`UserFactory.build()`)
2. **Mockear Prisma en unit tests** — no ejecutar queries reales
3. **Integration tests con SQLite real** — valida FKs, constraints, migraciones
4. **Componentes UI sin mocks de fetch** — usar `msw` (Mock Service Worker) para interceptar API calls
5. **E2E (futuro)** — Playwright para flujos completos: login → group → availability

## Flaky test warnings
- **CalendarMonth hover**: no es determinista en CI headless; usar `data-testid="cell"` y click directo en lugar de hover
- **ColorPicker preset selection**: Vitest puede no renderizar correctamente el primer color; añadir `await sleep(10)` si falla intermitentemente
