-- getaro: endurecimiento tras la revisión de seguridad del 20 oct 2026.
-- Cada bloque cierra algo que se podía hacer llamando a Supabase directamente, sin pasar por la app.

-- ── 1. Columnas que cada cuenta puede escribir ─────────────────────────────────
-- Antes se podía fechar un mensaje en 2036 (se quedaba "sin leer" para siempre), elegir el código de invitación
-- o el id de una sala, o poner como avatar la URL de una imagen propia (que ve la IP de quien la carga).
revoke insert on public.messages from authenticated;
grant insert (room_id, user_id, body) on public.messages to authenticated;

revoke insert on public.events from authenticated;
grant insert (room_id, title, description, start_date, end_date, created_by) on public.events to authenticated;

revoke insert on public.rooms from authenticated;
grant insert (name, owner_id, require_approval, emoji) on public.rooms to authenticated;

revoke update on public.profiles from authenticated;
grant update (display_name, color, gender) on public.profiles to authenticated;

-- anon no escribe nada; truncate, trigger y references no los usa nadie (defensa en profundidad)
revoke insert, update, delete, truncate, trigger, references on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- ── 2. Avatares: solo fotos de Google ──────────────────────────────────────────
-- raw_user_meta_data lo puede rellenar quien se registra; solo se acepta el avatar si es de Google.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, display_name, avatar_url, color)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ), 40),
    case when avatar like 'https://lh3.googleusercontent.com/%' then avatar end,
    public.default_color(new.id)
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles add constraint profiles_avatar_google
  check (avatar_url is null or avatar_url like 'https://lh3.googleusercontent.com/%');

-- ── 3. Salas: foto en su propia carpeta y código con el formato de siempre ─────
alter table public.rooms add constraint rooms_image_in_own_folder
  check (image_path is null or image_path like id::text || '/%');
alter table public.rooms add constraint rooms_invite_code_format
  check (invite_code ~ '^[A-Z0-9]{8}$');

-- ── 4. Quien crea una quedada solo la edita o borra mientras siga en la sala ───
drop policy "events_update" on public.events;
create policy "events_update" on public.events for update to authenticated
  using ((created_by = auth.uid() and public.is_room_member(room_id)) or public.is_room_owner(room_id) or public.is_admin());
drop policy "events_delete" on public.events;
create policy "events_delete" on public.events for delete to authenticated
  using ((created_by = auth.uid() and public.is_room_member(room_id)) or public.is_room_owner(room_id) or public.is_admin());

-- ── 5. Disponibilidad con id propio ────────────────────────────────────────────
-- Supabase Realtime manda los DELETE a cualquier suscriptor sin aplicar RLS, con la clave primaria de la fila.
-- Con la clave (event_id, user_id, day) eso decía quién desmarcaba qué día en quedadas ajenas; con un id, nada.
alter table public.availability drop constraint availability_pkey;
alter table public.availability add column id bigint generated always as identity;
alter table public.availability add primary key (id);
alter table public.availability add constraint availability_one_per_day unique (event_id, user_id, day);
revoke insert, update on public.availability from authenticated;
grant insert (event_id, user_id, day, status), update (event_id, user_id, day, status)
  on public.availability to authenticated;

-- ── 6. Límites contra abuso (el registro es abierto) ──────────────────────────
-- Muy por encima del uso normal de un grupo de amigos; solo frenan scripts y spam.
create or replace function public.enforce_rate_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'messages' then
    if (select count(*) from public.messages
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'rate_limited' using hint = 'Máximo 30 mensajes por minuto';
    end if;
  elsif tg_table_name = 'rooms' then
    if (select count(*) from public.rooms where owner_id = new.owner_id) >= 20 then
      raise exception 'rate_limited' using hint = 'Máximo 20 salas por persona';
    end if;
  elsif tg_table_name = 'events' then
    if (select count(*) from public.events
        where created_by = new.created_by and created_at > now() - interval '1 day') >= 30 then
      raise exception 'rate_limited' using hint = 'Máximo 30 quedadas al día por persona';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_rate_limits() from public, anon, authenticated;

create trigger limit_messages before insert on public.messages
  for each row execute function public.enforce_rate_limits();
create trigger limit_rooms before insert on public.rooms
  for each row execute function public.enforce_rate_limits();
create trigger limit_events before insert on public.events
  for each row execute function public.enforce_rate_limits();

-- ── 7. Índices para las claves foráneas (y para los límites de arriba) ────────
create index if not exists messages_user_created_idx on public.messages (user_id, created_at);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists rooms_owner_idx on public.rooms (owner_id);
create index if not exists availability_user_idx on public.availability (user_id);
