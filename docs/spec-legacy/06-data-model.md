# Data Model — getaro

Modelo de base de datos relacional (PostgreSQL 15+). Todos los campos con `NOT NULL` salvo que se indique lo contrario.

---

## Tablas principales

### `users`

```sql
CREATE TABLE users (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT         UNIQUE NOT NULL,
    password    TEXT         -- BCrypt hash; NULL si login con Google OAuth
    display_name TEXT        NOT NULL,
    avatar_url  TEXT         -- URL de imagen; nullable
    created_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
```

### `groups`

```sql
CREATE TABLE groups (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50)  NOT NULL,
    slug        TEXT         UNIQUE NOT NULL,
    invite_code CHAR(6)      UNIQUE NOT NULL CHECK (LENGTH(invite_code) = 6),
    created_by  UUID         REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

-- Validación regex para invite_code
ALTER TABLE groups ADD CONSTRAINT chk_invite_code_format CHECK (invite_code ~ '^G-[A-Z0-9]{6}$');

CREATE INDEX idx_groups_slug ON groups(slug);
```

### `group_members`

```sql
CREATE TABLE group_members (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID         REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID         REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role        TEXT         CHECK (role IN ('admin', 'creator', 'user')) NOT NULL DEFAULT 'user',
    joined_at   TIMESTAMPTZ  DEFAULT NOW() NOT NULL,

    UNIQUE (group_id, user_id) -- Un usuario solo puede estar una vez en un grupo
);

CREATE INDEX idx_group_members_user ON group_members(user_id);
```

### `availability`

```sql
CREATE TABLE availability (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID         REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID         REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    start_date  DATE         NOT NULL CHECK (start_date >= CURRENT_DATE),
    end_date    DATE         NOT NULL CHECK (end_date >= start_date),
    color       TEXT         DEFAULT '#4CAF50' -- Hex string; fallback auto si cancela color picker
    type        TEXT         CHECK (type IN ('available', 'busy')) NOT NULL DEFAULT 'available',
    status      TEXT         CHECK (status IN ('confirmed', 'pending')) NOT NULL DEFAULT 'confirmed',

    created_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_availability_group ON availability(group_id);
CREATE INDEX idx_availability_user ON availability(user_id);
```

---

## Relaciones y restricciones

| Relación | Tipo | Notas |
|----------|------|-------|
| `groups.created_by → users.id` | FK con SET NULL | Si el creador se elimina, el grupo queda "huérfano" pero no se borra |
| `group_members.group_id → groups.id` | FK con CASCADE | Borrar un grupo elimina todas las membresías |
| `group_members.user_id → users.id` | FK con CASCADE | Borrar un usuario elimina sus membresías |
| `availability.group_id → groups.id` | FK con CASCADE | Borrar un grupo elimina toda su disponibilidad |
| `availability.user_id → users.id` | FK con CASCADE | Borrar un usuario elimina su disponibilidad |

## Índices y optimización

```sql
-- Para consultas frecuentes de calendario (fetch por group + date range)
CREATE INDEX idx_availability_group_dates ON availability(group_id, start_date);

-- Para verificar membresía rápida (login → "¿es miembro del grupo X?")
CREATE UNIQUE INDEX idx_group_members_user_group ON group_members(user_id, group_id);
```

## Migraciones iniciales

1. `001_create_users.sql` — Tabla users + índice email
2. `002_create_groups.sql` — Tabla groups + constraints invite_code
3. `003_create_group_members.sql` — Tabla group_members + FKs
4. `004_create_availability.sql` — Tabla availability + índices de fecha

## Notas de implementación

- **Fechas pasadas**: el constraint `CHECK (start_date >= CURRENT_DATE)` en `availability` impide insertar fechas pasadas a nivel DB, además del bloqueo visual en el frontend.
- **Superposición válida**: no hay UNIQUE o CONSTRAINT que bloquee rangos superpuestos — un usuario puede tener múltiples registros para el mismo rango sin conflicto.
- **Auto-asignación de color**: si `color` es NULL al insertar, la aplicación asignará automáticamente basado en hash de `user_id`.
