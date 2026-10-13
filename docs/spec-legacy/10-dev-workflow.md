# Dev Workflow & Conventions — getaro

## Git conventions

### Branch naming
```
feature/group-creation          # Nuevas features
fix/calendar-color-picker       # Bugs específicos
chore/update-prisma             # Updates de deps/migraciones
docs/specs-update               # Cambios en documentación
```

**Reglas:**
- kebab-case
- Prefijo obligatorio: `feature/`, `fix/`, `chore/`, `docs/`
- Máximo 3 guiones en el nombre
- No usar números de issue a menos que sea hotfix urgente

### Commit style (Conventional Commits)
```
<type>(scope): <description>

[optional body]

# Ejemplos válidos:
feat(auth): add Google OAuth login flow
fix(calendar): resolve color clash when 5+ members have same hash
chore: update prisma to v6.14
docs(specs): clarify leaveGroup role transfer logic
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`  
**Scope (opcional):** auth, calendar, groups, api, ui

### PR workflow
1. **No se requieren approvals** para cambios internos menores (<50 líneas)
2. **Requieren review** si toca: API routes, Prisma schema, NextAuth config
3. **Nunca force-push** en branches compartidos
4. **Merge con squash**: un commit limpio por PR

---

## Code Review Checklist

### Antes de mergear
- [ ] `npm run lint -- --fix` pasa sin errores
- [ ] `npx prisma generate` regenera el client (no hay cambios pending)
- [ ] No hay secretos en commits (tokens, passwords, `.env`)
- [ ] Las migraciones Prisma están aplicadas o documentadas

### Reglas de estilo
| Tema | Regla | Ejemplo válido |
|------|-------|----------------|
| Naming files | kebab-case | `src/app/api/groups/[slug]/route.ts` |
| Naming components | PascalCase | `<CalendarMonth />`, no `<calendar-month />` |
| Imports | Ordenados: React → lib externas → internas → relative | No mezclar imports |
| Props | Siempre tipadas con interfaz explícita, nunca `any` | `interface CalendarProps { groupId: string }` |
| Server vs Client | `"use client"` solo cuando sea necesario | Fetch de datos siempre en server components |

---

## Database migrations workflow

### Antes de cambiar el schema
1. **Editar `schema.prisma`** con la nueva tabla o columna
2. **Crear migration**: `npx prisma migrate dev --name add_new_table`
3. **Aplicar al local**: `npx prisma db push` (si no hay migration files)
4. **Verificar en SQLite test DB**: `DATABASE_URL_TEST="file:./test.db" npm run test:integration`

### Reglas de migraciones
- **NUNCA** borrar columnas/tablas existentes sin plan de data migration
- **Siempre** nombrar migrations con verbo + sustantivo: `create_users`, `add_availability_status`
- **No** hacer cambios en schema que requieran downtime en production

---

## Environment quirks

| Variable | Default local | Production | Notas |
|----------|-------------|------------|-------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/getaro` | PostgreSQL RDS o similar | No hardcodear en `.env.example` |
| `NEXTAUTH_SECRET` | Generado con `openssl rand -base64 32` | Mínimo 32 caracteres | Cambiar cada release mayor |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth client desde Google Console | Requiere HTTPS | No funciona en localhost sin redirect config |

### Comandos de emergencia
```bash
# Reset DB local (borra todo)
npx prisma migrate reset --accept-data-loss

# Regenerar Prisma client tras cambios de schema
npx prisma generate

# Limpiar build cache y recompilar
rm -rf .next && npm run build
```
