# Project Structure & Tech Stack — getaro

Stack y estructura de directorios para guiar la implementación.

---

## Tech Stack

| Capa | Tecnología | Versión / Notas |
|------|------------|-----------------|
| **Frontend** | Next.js 15 (App Router) | React 19, TypeScript 5.x |
| **Estilos** | Tailwind CSS 4 | Config en `tailwind.config.ts` con tema personalizado |
| **Base de datos** | PostgreSQL 15+ | Motor relacional principal |
| **ORM** | Prisma 6 | Generación automática desde schema.prisma |
| **Auth** | NextAuth v5 + Google OAuth | Session JWT, CSRF protection |
| **UI Components** | Radix UI (Headless) + shadcn/ui | Accordion, Dialog, DropdownMenu, Popover, Tooltip, Toast, Switch, Tabs |
| **Calendario** | `react-day-picker` v9 | Componente `<DayPicker>` para mensual/anual |
| **Formularios** | React Hook Form 8 + Zod | Validación client-side con esquemas Zod |
| **Testing** | Vitest + Testing Library | Unit tests, integration tests |
| **Linting** | ESLint (Next.js preset) + Prettier | Config en `.eslintrc` y `prettier.config.mjs` |

---

## Estructura de directorios

```
getaro/
├── docs/                          # Specs, guías y documentación del proyecto
│   └── spec/                      # Documentos del producto (lo que estamos construyendo)
├── prisma/
│   ├── schema.prisma              # Modelo de datos fuente para Prisma
│   └── migrations/                # Migraciones versionadas (001_*, 002_*, etc.)
├── public/                        # Assets estáticos: logos, iconos, favicons
├── src/
│   ├── app/                       # Next.js App Router — layout y páginas
│   │   ├── layout.tsx             # Layout raíz (providers, auth guard)
│   │   ├── login/page.tsx         # Página de login (Google OAuth + email/password)
│   │   ├── dashboard/page.tsx     # Panel principal post-login: grupos del usuario
│   │   ├── group/
│   │   │   └── [slug]/page.tsx    # Vista dinámica del grupo: calendario + miembros
│   │   ├── join/
│   │   │   └── [code]/page.tsx    # Flujo de unión con código de invitación
│   │   └── settings/page.tsx      # Configuración de cuenta y grupos
│   ├── components/                # Componentes React reutilizables
│   │   ├── ui/                    # Primitivos shadcn/ui (botones, inputs, toasts)
│   │   ├── calendar/              # Calendario mensual/anual + color picker
│   │   ├── groups/                # Cards de grupo, listados, forms de creación
│   │   └── layout/                # Navbar, sidebar, auth guard wrappers
│   ├── lib/                       # Lógica pura: utilidades, helpers, validadores
│   │   ├── db.ts                  # Instancia Prisma client singleton
│   │   ├── utils.ts               # Funciones genéricas (slugify, hash color, etc.)
│   │   └── validators.ts          # Esquemas Zod para formularios
│   ├── auth/                      # NextAuth config y callbacks
│   │   ├── auth.config.ts         # Providers Google + Credentials
│   │   └── auth-helpers.ts      # Helpers: getSession, requireLogin
│   ├── hooks/                     # Custom React hooks
│   │   ├── use-availability.ts    # Fetch y mutate disponibilidad por grupo
│   │   └── use-group-members.ts   # Lista de miembros + roles
│   └── types/                     # Interfaces TypeScript globales
│       ├── user.ts                # User, Session, Profile
│       ├── group.ts               # Group, MemberRole, GroupMember
│       └── availability.ts        # AvailabilityRecord, ColorScheme
├── tests/                         # Tests integration/unit
│   ├── unit/                      # Pruebas de utilidades y validadores
│   ├── integration/               # End-to-end flows: login → group → availability
│   └── fixtures/                  # Datos mock para tests
├── .github/                       # GitHub Actions, PR templates
├── .vscode/                       # Settings del IDE (formato, linting)
├── next.config.ts                 # Next.js config
├── tailwind.config.ts             # Tailwind + tema personalizado
├── prisma.schema.prisma           # Schema de Prisma
├── package.json                   # Dependencias y scripts npm
└── .env.example                   # Variables de entorno con ejemplos
```

---

## Convenciones de código

### Naming
- **Archivos**: kebab-case (`calendar-grid.tsx`, `use-group-members.ts`)
- **Componentes**: PascalCase (`CalendarGrid`, `GroupCard`)
- **Variables/funciones**: camelCase (`fetchAvailability`, `slugifyName`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_GROUP_NAME_LENGTH = 50`)

### Componentes React
- Cada componente en su propio archivo: `src/components/calendar/calendar-grid.tsx`
- Export único por archivo: `export default function CalendarGrid({ ... })`
- Props tipadas con interfaz explícita, no `any`: `interface DayPickerProps { ... }`

### Estado y datos
- **Server components** para fetch de datos (Next.js App Router)
- **Client components** solo cuando necesitan interactividad (`"use client"` explícito al inicio del archivo)
- Prisma queries en server functions o route handlers, nunca directamente en componentes cliente

### Estilos
- Tailwind classes inline en JSX: `<div className="flex flex-col gap-2">`
- No CSS files externos salvo `globals.css` para variables CSS y base styles
- Colores del tema definidos en `tailwind.config.ts` como tokens (`--color-primary`, etc.)

### Prisma schema
- Singular para tablas: `user`, `group`, `groupMember`, `availability` (Prisma convention)
- Relations con named constraints: `fk_group_members_user FOREIGN KEY (userId) REFERENCES User(id)`

---

## Comandos de desarrollo

| Acción | Comando | Notas |
|--------|---------|-------|
| Instalar dependencias | `npm install` o `pnpm install` | pnpm recomendado para speed |
| Levantar dev server | `npm run dev` | Next.js en localhost:3000 con HMR |
| Generar Prisma client | `npx prisma generate` | Tras cambios en schema.prisma |
| Aplicar migraciones | `npx prisma migrate deploy` | Solo en production; local usa `prisma migrate dev` |
| Ejecutar tests unitarios | `npm run test:unit` | Vitest con glob `tests/unit/**/*.{ts,tsx}` |
| Ejecutar tests integration | `npm run test:integration` | Requiere DB local o env de test |
| Lint + fix | `npm run lint -- --fix` | ESLint + Prettier auto-fix |
| Build production | `npm run build` | Compilación Next.js para producción |

---

## Variables de entorno

```bash
# .env.example — copiar a .env.local y llenar con valores reales
DATABASE_URL="postgresql://user:pass@localhost:5432/getaro"
NEXTAUTH_SECRET="genera-un-secreto-aleatorio-aqui"
GOOGLE_CLIENT_ID="tu-client-id-de-google-oauth"
GOOGLE_CLIENT_SECRET="tu-client-secret-de-google-oauth"
```

### Notas de entorno
- **Local dev**: `DATABASE_URL` apunta a PostgreSQL local (`localhost:5432`)
- **Test env**: Vitest inyecta `DATABASE_URL_TEST` con una DB temporal separada
- **Production**: `NEXTAUTH_SECRET` debe ser al menos 32 chars; Google OAuth requiere HTTPS
