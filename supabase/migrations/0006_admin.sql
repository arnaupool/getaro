-- getaro: panel de administración v2 (actividad, historial, fichas, sistema). Diseño: docs/ADMIN.md

-- ─────────────────────────────────────────────────────────────
-- Actividad diaria: una fila por persona y día (la escribe la app al cargar páginas)
-- ─────────────────────────────────────────────────────────────
create table public.activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
create index activity_days_day_idx on public.activity_days (day);
alter table public.activity_days enable row level security;
create policy "activity_select_admin" on public.activity_days for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.activity_days from anon, authenticated;

create or replace function public.madrid_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

create or replace function public.touch_activity() returns void
language sql security definer set search_path = '' as $$
  insert into public.activity_days (user_id, day)
  select auth.uid(), public.madrid_today()
  where auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid())
  on conflict do nothing;
$$;

-- ─────────────────────────────────────────────────────────────
-- Historial de acciones delicadas (90 días). Lo escriben triggers, así no depende de la pantalla.
-- Los nombres se guardan en `details` para que sigan legibles si algo se borra después.
-- ─────────────────────────────────────────────────────────────
create table public.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor_id       uuid,
  action         text not null,
  room_id        uuid,
  target_user_id uuid,
  details        jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy "audit_select_admin" on public.audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.write_audit(
  p_action text, p_room_id uuid, p_room_name text, p_target uuid, p_target_name text, p_extra jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare actor_name text;
begin
  select display_name into actor_name from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_id, action, room_id, target_user_id, details)
  values (auth.uid(), p_action, p_room_id, p_target,
          jsonb_strip_nulls(jsonb_build_object(
            'actor_name', actor_name, 'room_name', p_room_name, 'target_name', p_target_name) || p_extra));
  delete from public.audit_log where at < now() - interval '90 days';
end;
$$;

-- Sala borrada
create or replace function public.audit_room_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('room_deleted', old.id, old.name, null, null);
  return old;
end;
$$;
create trigger audit_room_deleted after delete on public.rooms
  for each row execute function public.audit_room_deleted();

-- Cambio de titular (también cuando una sala pasa a otra persona por borrar la cuenta de su titular)
create or replace function public.audit_owner_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
    perform public.write_audit('owner_changed', new.id, new.name, new.owner_id,
      (select display_name from public.profiles where id = new.owner_id),
      jsonb_build_object('from_name', (select display_name from public.profiles where id = old.owner_id)));
  end if;
  return new;
end;
$$;
create trigger audit_owner_changed after update of owner_id on public.rooms
  for each row execute function public.audit_owner_changed();

-- Quedada borrada (se omite si es por borrar la sala entera)
create or replace function public.audit_event_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rname text;
begin
  select name into rname from public.rooms where id = old.room_id;
  if rname is not null then
    perform public.write_audit('event_deleted', old.room_id, rname, null, null, jsonb_build_object('event_title', old.title));
  end if;
  return old;
end;
$$;
create trigger audit_event_deleted after delete on public.events
  for each row execute function public.audit_event_deleted();

-- Expulsión o salida (se omite si es por borrar la sala o la cuenta)
create or replace function public.audit_member_removed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rname text; tname text;
begin
  select name into rname from public.rooms where id = old.room_id;
  select display_name into tname from public.profiles where id = old.user_id;
  if rname is not null and tname is not null then
    perform public.write_audit(
      case when old.user_id = auth.uid() then 'member_left' else 'member_removed' end,
      old.room_id, rname, old.user_id, tname);
  end if;
  return old;
end;
$$;
create trigger audit_member_removed after delete on public.room_members
  for each row execute function public.audit_member_removed();

-- Solicitud aceptada o rechazada (cancelar la propia no se registra)
create or replace function public.audit_request_resolved() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rname text; tname text;
begin
  select name into rname from public.rooms where id = old.room_id;
  select display_name into tname from public.profiles where id = old.user_id;
  if rname is null or tname is null then return old; end if;
  if exists (select 1 from public.room_members where room_id = old.room_id and user_id = old.user_id) then
    perform public.write_audit('request_accepted', old.room_id, rname, old.user_id, tname);
  elsif old.user_id is distinct from auth.uid() then
    perform public.write_audit('request_rejected', old.room_id, rname, old.user_id, tname);
  end if;
  return old;
end;
$$;
create trigger audit_request_resolved after delete on public.join_requests
  for each row execute function public.audit_request_resolved();

-- Admin dado/quitado y nombre cambiado por otra persona
create or replace function public.audit_profile_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_admin is distinct from old.is_admin then
    perform public.write_audit(case when new.is_admin then 'admin_granted' else 'admin_revoked' end,
      null, null, new.id, new.display_name);
  end if;
  if new.display_name is distinct from old.display_name and new.id is distinct from auth.uid() then
    perform public.write_audit('renamed_by_admin', null, null, new.id, new.display_name,
      jsonb_build_object('from_name', old.display_name));
  end if;
  return new;
end;
$$;
create trigger audit_profile_changed after update on public.profiles
  for each row execute function public.audit_profile_changed();

-- Cuenta borrada (antes de que desaparezca el nombre)
create or replace function public.audit_profile_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.write_audit('account_deleted', null, null, old.id, old.display_name);
  return old;
end;
$$;
create trigger audit_profile_deleted before delete on public.profiles
  for each row execute function public.audit_profile_deleted();

-- ─────────────────────────────────────────────────────────────
-- RPCs del panel (todas comprueban is_admin)
-- ─────────────────────────────────────────────────────────────

-- Personas activas: hoy, 7 y 30 días, y serie diaria de 30 días (con ceros)
create or replace function public.admin_activity_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare today date := public.madrid_today();
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'today', (select count(distinct user_id) from public.activity_days where day = today),
    'week',  (select count(distinct user_id) from public.activity_days where day > today - 7),
    'month', (select count(distinct user_id) from public.activity_days where day > today - 30),
    'series', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'active', coalesce(a.n, 0)) order by d)
      from generate_series(today - 29, today, interval '1 day') d
      left join (select day, count(*) as n from public.activity_days where day > today - 30 group by day) a
        on a.day = d::date
    )
  );
end;
$$;

-- Lista de cuentas con última actividad
drop function public.admin_list_users();
create function public.admin_list_users()
returns table (id uuid, email text, display_name text, color text, is_admin boolean,
               created_at timestamptz, last_active date, rooms_count int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.color, p.is_admin, p.created_at,
           (select max(a.day) from public.activity_days a where a.user_id = p.id),
           (select count(*)::int from public.room_members m where m.user_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- Ficha de una cuenta
create or replace function public.admin_user_detail(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (
    select jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'color', p.color, 'avatar_url', p.avatar_url,
      'gender', p.gender, 'is_admin', p.is_admin, 'created_at', p.created_at,
      'email', u.email, 'last_sign_in_at', u.last_sign_in_at,
      'last_active', (select max(day) from public.activity_days where user_id = p.id),
      'active_days_30', (select count(*) from public.activity_days where user_id = p.id and day > public.madrid_today() - 30),
      'messages_30', (select count(*) from public.messages where user_id = p.id and created_at > now() - interval '30 days'),
      'marked_days_30', (select count(*) from public.availability where user_id = p.id and updated_at > now() - interval '30 days'),
      'events_created', (select count(*) from public.events where created_by = p.id),
      'sessions', (select count(*) from auth.sessions where user_id = p.id),
      'rooms', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'is_owner', r.owner_id = p.id) order by r.name)
        from public.room_members m join public.rooms r on r.id = m.room_id
        where m.user_id = p.id), '[]'::jsonb)
    )
    from public.profiles p join auth.users u on u.id = p.id
    where p.id = uid
  );
end;
$$;

create or replace function public.admin_rename_user(uid uuid, new_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if char_length(trim(new_name)) not between 1 and 40 then raise exception 'invalid_name'; end if;
  update public.profiles set display_name = trim(new_name) where id = uid;
end;
$$;

-- Cierra sus sesiones: no podrá renovar el acceso; el que ya tiene caduca en menos de 1 hora
create or replace function public.admin_sign_out_user(uid uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from auth.sessions where user_id = uid;
  get diagnostics n = row_count;
  perform public.write_audit('sessions_revoked', null, null, uid,
    (select display_name from public.profiles where id = uid), jsonb_build_object('sessions', n));
  return n;
end;
$$;

-- Ficha de una sala: actividad del chat (el resto se lee con las políticas de admin)
create or replace function public.admin_room_stats(rid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'messages_30', (select count(*) from public.messages where room_id = rid and created_at > now() - interval '30 days'),
    'last_message_at', (select max(created_at) from public.messages where room_id = rid)
  );
end;
$$;

create or replace function public.admin_db_size() returns bigint
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return pg_database_size(current_database());
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
