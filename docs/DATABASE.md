# Base de datos

getaro usa Postgres de Supabase. No hay ORM: las páginas y las server actions consultan con `@supabase/ssr` usando la
sesión de la persona, y **la base de datos decide qué puede ver y hacer cada una**.

## Tablas

| Tabla | Para qué |
|-------|----------|
| `profiles` | Una fila por cuenta: nombre visible, color, género, si es admin. Se crea sola al registrarse |
| `rooms` | Salas: nombre, código de invitación, titular, si pide aprobación, emoji y foto |
| `room_members` | Quién está en cada sala y hasta cuándo ha leído el chat (`last_read_at`) |
| `join_requests` | Solicitudes pendientes para entrar en salas con aprobación |
| `events` | Quedadas: rango de fechas, fecha elegida, hora y lugar |
| `availability` | Un día marcado por persona y quedada (`yes` o `maybe`) |
| `messages` | Mensajes del chat de cada sala |
| `activity_days` | Una fila por persona y día con actividad (para el panel de admin) |
| `audit_log` | Historial de acciones delicadas, 90 días |

Las fotos de sala están en Supabase Storage, en el bucket público `room-images`, con la ruta `<id_sala>/<archivo>`.

## Modelo de seguridad

1. **RLS en todas las tablas.** Ejemplos: los mensajes solo los ven los miembros de su sala; la disponibilidad solo la
   escribe su dueño y solo dentro del rango de la quedada y desde hoy; `audit_log` y `activity_days` solo los lee un
   admin.
2. **Columnas editables limitadas.** Además de RLS, los permisos de columna impiden, por ejemplo, que alguien se marque
   como admin o cambie el titular de una sala con un `update` directo.
3. **Operaciones delicadas como funciones SQL** (`security definer`) que comprueban permisos por dentro:
   `join_room`, `accept_join_request`, `transfer_room`, `regenerate_invite_code`, `set_admin`, `admin_*`...
4. **Ayudantes para las políticas**: `is_admin()`, `is_room_member(sala)`, `is_room_owner(sala)`, `shares_room(persona)`.
   Son `security definer` para que las políticas no se llamen a sí mismas en bucle.
5. **Triggers** para lo que debe pasar siempre, se haga desde donde se haga: crear el perfil, meter a la titular en su
   sala, repartir las salas de una cuenta borrada, borrar la disponibilidad de quien sale, y escribir el historial.

## Migraciones

Están en [`supabase/migrations`](../supabase/migrations) y se aplican en orden. Nunca se edita una ya aplicada: cada
cambio es un archivo nuevo.

| Archivo | Qué hace |
|---------|----------|
| `0001_init.sql` | Esquema base: perfiles, salas, miembros, quedadas, disponibilidad, chat, RLS y funciones |
| `0002_join_requests.sql` | Aprobación para entrar en una sala |
| `0003_gender.sql` | Cómo quiere cada persona que la trate la app |
| `0004_unread.sql` | Mensajes sin leer |
| `0005_event_details_autoaccept.sql` | Hora y lugar de la quedada; aceptar solicitudes al quitar la aprobación |
| `0006_admin.sql` | Actividad diaria, historial y funciones del panel de admin |
| `0007_room_image.sql` | Emoji o foto de sala y permisos de Storage |
| `0008_revoke_internal_functions.sql` | Quita el permiso de ejecución a funciones internas (arregla historial falsificable) |
| `0009_rooms_owner_select.sql` | La titular ve su sala desde el primer momento (arregla crear sala sin ser admin) |

Para aplicarlas: SQL Editor de Supabase (pegar y ejecutar), o el conector de Supabase con `apply_migration`.

## Reglas para migraciones nuevas

- **Conceder `execute` función a función**, nunca `grant execute on all functions`. Las funciones de triggers y las
  internas no deben ser ejecutables por `authenticated` (lección de la 0008).
- **Un `insert ... returning` exige cumplir la política `select` en ese momento.** Los triggers `after` llegan tarde
  (lección de la 0009).
- **Probar con cuentas que no sean admin.** El admin salta muchas políticas y esconde errores.

## Cómo probar una migración sin dejar rastro

Un bloque `do` que crea cuentas de prueba, actúa como ellas y termina lanzando una excepción con el resultado. Postgres
deshace todo al lanzarla:

```sql
do $$
declare a uuid := gen_random_uuid(); res text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'prova@getaro.test', '{"full_name":"Prova"}', now(), now());

  -- actuar como esa cuenta
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.rooms (name, owner_id) values ('Sala de prova', a);
  reset role;

  select 'salas=' || count(*) into res from public.rooms where owner_id = a;
  raise exception 'RESULTADO (todo deshecho): %', res;
end $$;
```
