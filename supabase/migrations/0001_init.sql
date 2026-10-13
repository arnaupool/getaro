-- getaro — esquema inicial (Supabase)
-- Pegar entero en Supabase → SQL Editor → Run. Es idempotente solo en instalaciones limpias.

-- ─────────────────────────────────────────────────────────────
-- Utilidades
-- ─────────────────────────────────────────────────────────────

-- Código de invitación: 8 caracteres sin ambiguos (sin 0/O, 1/I/L)
create or replace function public.gen_invite_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

create or replace function public.default_color(uid uuid) returns text
language sql immutable set search_path = '' as $$
  select (array['#e11d48','#db2777','#c026d3','#9333ea','#6366f1','#2563eb',
                '#0891b2','#0d9488','#16a34a','#ca8a04','#ea580c','#78716c'])
         [1 + abs(hashtext(uid::text)) % 12];
$$;

-- ─────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  avatar_url   text,
  color        text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 50),
  invite_code text not null unique default public.gen_invite_code(),
  owner_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.room_members (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 80),
  description text check (char_length(description) <= 1000),
  start_date  date not null,
  end_date    date not null,
  created_by  uuid references public.profiles (id) on delete set null,
  final_start date,
  final_end   date,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366),
  check ((final_start is null) = (final_end is null)),
  check (final_end >= final_start)
);
create index events_room_idx on public.events (room_id);

create table public.availability (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  status     text not null check (status in ('yes', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id, day)
);

create table public.messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_room_idx on public.messages (room_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Helpers de autorización (security definer para evitar recursión en RLS)
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_room_member(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.room_members where room_id = rid and user_id = auth.uid());
$$;

create or replace function public.is_room_owner(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms where id = rid and owner_id = auth.uid());
$$;

create or replace function public.shares_room(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members a
    join public.room_members b on a.room_id = b.room_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────

-- Crear perfil al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url, color)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url',
    public.default_color(new.id)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- La creadora de una sala entra como miembro
create or replace function public.handle_new_room() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.room_members (room_id, user_id) values (new.id, new.owner_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.handle_new_room();

-- Al borrar un perfil: la propiedad de sus salas pasa al miembro más antiguo; salas vacías se borran
create or replace function public.handle_profile_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.rooms r
     set owner_id = (
       select m.user_id from public.room_members m
       where m.room_id = r.id and m.user_id <> old.id
       order by m.joined_at limit 1)
   where r.owner_id = old.id;
  delete from public.rooms where owner_id is null;
  return old;
end;
$$;

create trigger on_profile_deleted
  before delete on public.profiles
  for each row execute function public.handle_profile_deleted();

-- Al salir/ser expulsada de una sala se borra su disponibilidad en los eventos de esa sala
create or replace function public.handle_member_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.availability a
   using public.events e
   where a.event_id = e.id and e.room_id = old.room_id and a.user_id = old.user_id;
  return old;
end;
$$;

create trigger on_member_removed
  after delete on public.room_members
  for each row execute function public.handle_member_removed();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.events       enable row level security;
alter table public.availability enable row level security;
alter table public.messages     enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_room(id));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- rooms
create policy "rooms_select" on public.rooms for select to authenticated
  using (public.is_room_member(id) or public.is_admin());
create policy "rooms_insert" on public.rooms for insert to authenticated
  with check (owner_id = auth.uid());
create policy "rooms_update" on public.rooms for update to authenticated
  using (public.is_room_owner(id) or public.is_admin());
create policy "rooms_delete" on public.rooms for delete to authenticated
  using (public.is_room_owner(id) or public.is_admin());

-- room_members (altas solo vía join_room / trigger)
create policy "members_select" on public.room_members for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "members_delete" on public.room_members for delete to authenticated
  using (
    not exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = user_id)
    and (user_id = auth.uid() or public.is_room_owner(room_id) or public.is_admin())
  );

-- events
create policy "events_select" on public.events for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "events_insert" on public.events for insert to authenticated
  with check (public.is_room_member(room_id) and created_by = auth.uid());
create policy "events_update" on public.events for update to authenticated
  using (created_by = auth.uid() or public.is_room_owner(room_id) or public.is_admin());
create policy "events_delete" on public.events for delete to authenticated
  using (created_by = auth.uid() or public.is_room_owner(room_id) or public.is_admin());

-- availability
create policy "availability_select" on public.availability for select to authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and (public.is_room_member(e.room_id) or public.is_admin())));
create policy "availability_insert" on public.availability for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.events e
    where e.id = event_id and public.is_room_member(e.room_id)
      and day between e.start_date and e.end_date
      and day >= current_date - 1));
create policy "availability_update" on public.availability for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.events e
    where e.id = event_id and public.is_room_member(e.room_id)
      and day between e.start_date and e.end_date
      and day >= current_date - 1));
create policy "availability_delete" on public.availability for delete to authenticated
  using (user_id = auth.uid());

-- messages
create policy "messages_select" on public.messages for select to authenticated
  using (public.is_room_member(room_id) or public.is_admin());
create policy "messages_insert" on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));
create policy "messages_delete" on public.messages for delete to authenticated
  using (user_id = auth.uid() or public.is_room_owner(room_id) or public.is_admin());

-- Columnas editables (evita auto-ascenso a admin, cambiar owner o invite_code a mano)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, color) on public.profiles to authenticated;
revoke update on public.rooms from anon, authenticated;
grant update (name) on public.rooms to authenticated;
revoke update on public.events from anon, authenticated;
grant update (title, description, start_date, end_date, final_start, final_end) on public.events to authenticated;
revoke insert, update on public.room_members from anon, authenticated;
revoke update on public.messages from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────

create or replace function public.room_preview(code text)
returns table (id uuid, name text, member_count int, already_member boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name,
         (select count(*)::int from public.room_members m where m.room_id = r.id),
         exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid())
  from public.rooms r
  where auth.uid() is not null and r.invite_code = upper(trim(code));
$$;

create or replace function public.join_room(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into rid from public.rooms where invite_code = upper(trim(code));
  if rid is null then raise exception 'invalid_code'; end if;
  insert into public.room_members (room_id, user_id) values (rid, auth.uid())
  on conflict do nothing;
  return rid;
end;
$$;

create or replace function public.regenerate_invite_code(rid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  if not (public.is_room_owner(rid) or public.is_admin()) then raise exception 'forbidden'; end if;
  update public.rooms set invite_code = public.gen_invite_code() where id = rid
  returning invite_code into new_code;
  return new_code;
end;
$$;

create or replace function public.transfer_room(rid uuid, new_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_room_owner(rid) or public.is_admin()) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.room_members where room_id = rid and user_id = new_owner) then
    raise exception 'not_a_member';
  end if;
  update public.rooms set owner_id = new_owner where id = rid;
end;
$$;

create or replace function public.set_admin(uid uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if uid = auth.uid() and not value then raise exception 'cannot_demote_self'; end if;
  update public.profiles set is_admin = value where id = uid;
end;
$$;

create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, color text, is_admin boolean,
               created_at timestamptz, last_sign_in_at timestamptz, rooms_count int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.color, p.is_admin, p.created_at, u.last_sign_in_at,
           (select count(*)::int from public.room_members m where m.user_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if uid = auth.uid() then raise exception 'cannot_delete_self'; end if;
  delete from auth.users where id = uid;
end;
$$;

-- Solo usuarias autenticadas pueden llamar a funciones
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages, public.availability;
