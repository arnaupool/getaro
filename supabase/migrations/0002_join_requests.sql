-- getaro: solicitudes para entrar en una sala (aprobación opcional por sala)
-- Pegar entero en Supabase, SQL Editor, Run.

-- ── Interruptor por sala (activado por defecto) ─────────────
alter table public.rooms add column require_approval boolean not null default true;
grant update (name, require_approval) on public.rooms to authenticated;

-- ── Solicitudes pendientes ──────────────────────────────────
create table public.join_requests (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index join_requests_user_idx on public.join_requests (user_id);

alter table public.join_requests enable row level security;

create policy "requests_select" on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_room_owner(room_id) or public.is_admin());
-- Cancelar la propia; rechazar la dueña o admin
create policy "requests_delete" on public.join_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_room_owner(room_id) or public.is_admin());
revoke insert, update on public.join_requests from anon, authenticated;

-- La dueña necesita ver nombre y color de quien pide entrar
create or replace function public.requested_my_room(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.join_requests jr
    join public.rooms r on r.id = jr.room_id
    where jr.user_id = uid and r.owner_id = auth.uid()
  );
$$;

drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_room(id) or public.requested_my_room(id));

-- Si alguien entra (por aceptación o porque la sala no pide aprobación), su solicitud sobra
create or replace function public.handle_member_added() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.join_requests where room_id = new.room_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger on_member_added
  after insert on public.room_members
  for each row execute function public.handle_member_added();

-- ── RPCs ────────────────────────────────────────────────────
drop function public.room_preview(text);
create function public.room_preview(code text)
returns table (id uuid, name text, member_count int, already_member boolean, pending boolean, require_approval boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name,
         (select count(*)::int from public.room_members m where m.room_id = r.id),
         exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid()),
         exists (select 1 from public.join_requests j where j.room_id = r.id and j.user_id = auth.uid()),
         r.require_approval
  from public.rooms r
  where auth.uid() is not null and r.invite_code = upper(trim(code));
$$;

-- Devuelve 'member' (ya estaba), 'joined' (entra directo) o 'pending' (solicitud creada)
drop function public.join_room(text);
create function public.join_room(code text)
returns table (room_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id, require_approval, owner_id into r from public.rooms where invite_code = upper(trim(code));
  if r.id is null then raise exception 'invalid_code'; end if;

  if exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid()) then
    return query select r.id, 'member'::text;
  elsif not r.require_approval or r.owner_id = auth.uid() or public.is_admin() then
    insert into public.room_members (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
    return query select r.id, 'joined'::text;
  else
    insert into public.join_requests (room_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
    return query select r.id, 'pending'::text;
  end if;
end;
$$;

create or replace function public.accept_join_request(rid uuid, uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_room_owner(rid) or public.is_admin()) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.join_requests where room_id = rid and user_id = uid) then
    raise exception 'no_request';
  end if;
  insert into public.room_members (room_id, user_id) values (rid, uid) on conflict do nothing;
end;
$$;

-- Mis solicitudes pendientes, con el nombre de la sala (aún no soy miembro, así que no la veo por RLS)
create or replace function public.my_join_requests()
returns table (room_id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, j.created_at
  from public.join_requests j join public.rooms r on r.id = j.room_id
  where j.user_id = auth.uid()
  order by j.created_at desc;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
