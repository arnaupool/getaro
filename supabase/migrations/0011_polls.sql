-- getaro: encuestas en cada quedada.
-- Decisiones (20 oct 2026): cualquier miembro las crea; quien la crea elige una o varias respuestas; los votos se ven
-- con nombres; solo quien la crea añade opciones. Se puede cambiar el voto hasta que se cierra.

create table public.polls (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  question   text not null check (char_length(trim(question)) between 1 and 140),
  multiple   boolean not null default false,
  closed     boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index polls_event_idx on public.polls (event_id);
create index polls_created_by_idx on public.polls (created_by);

create table public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls (id) on delete cascade,
  label    text not null check (char_length(trim(label)) between 1 and 80),
  position int not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id);

-- id propio: Realtime manda los DELETE sin RLS con la clave primaria (ver 0010)
create table public.poll_votes (
  id         bigint generated always as identity primary key,
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);
create index poll_votes_poll_user_idx on public.poll_votes (poll_id, user_id);
create index poll_votes_user_idx on public.poll_votes (user_id);

-- Sala a la que pertenece una encuesta (para las políticas)
create or replace function public.poll_room(pid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.room_id from public.polls p join public.events e on e.id = p.event_id where p.id = pid;
$$;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- Ver: miembros de la sala (y admin)
create policy "polls_select" on public.polls for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id
                 and (public.is_room_member(e.room_id) or public.is_admin())));
create policy "poll_options_select" on public.poll_options for select to authenticated
  using (public.is_room_member(public.poll_room(poll_id)) or public.is_admin());
create policy "poll_votes_select" on public.poll_votes for select to authenticated
  using (public.is_room_member(public.poll_room(poll_id)) or public.is_admin());

-- Cerrar, reabrir o borrar: quien la creó (si sigue en la sala), titular o admin
create policy "polls_update" on public.polls for update to authenticated
  using ((created_by = auth.uid() and public.is_room_member(public.poll_room(id)))
         or public.is_room_owner(public.poll_room(id)) or public.is_admin());
create policy "polls_delete" on public.polls for delete to authenticated
  using ((created_by = auth.uid() and public.is_room_member(public.poll_room(id)))
         or public.is_room_owner(public.poll_room(id)) or public.is_admin());

-- Permisos de tabla: lectura, y en polls solo cambiar "closed" y borrar. Crear y votar, por funciones.
revoke all on public.polls, public.poll_options, public.poll_votes from anon, authenticated;
grant select on public.polls, public.poll_options, public.poll_votes to authenticated;
grant update (closed), delete on public.polls to authenticated;

-- ── Crear encuesta con sus opciones (2 a 10) ──────────────────────────────────
create or replace function public.create_poll(eid uuid, question text, multiple boolean, options text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare rid uuid; pid uuid; opts text[]; i int;
begin
  select room_id into rid from public.events where id = eid;
  if rid is null or not public.is_room_member(rid) then raise exception 'forbidden'; end if;
  select array_agg(trim(o)) into opts from unnest(options) o where char_length(trim(o)) > 0;
  if coalesce(array_length(opts, 1), 0) not between 2 and 10 then raise exception 'invalid_options'; end if;
  if (select count(*) from public.polls where created_by = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limited';
  end if;

  insert into public.polls (event_id, question, multiple, created_by)
  values (eid, trim(question), coalesce(multiple, false), auth.uid())
  returning id into pid;
  for i in 1 .. array_length(opts, 1) loop
    insert into public.poll_options (poll_id, label, position) values (pid, opts[i], i);
  end loop;
  return pid;
end;
$$;

-- ── Votar: sustituye el voto de la persona en esa encuesta (lista vacía = quitar el voto) ──
create or replace function public.vote_poll(pid uuid, option_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare p record; n int;
begin
  select id, multiple, closed into p from public.polls where id = pid;
  if p.id is null or not public.is_room_member(public.poll_room(pid)) then raise exception 'forbidden'; end if;
  if p.closed then raise exception 'poll_closed'; end if;
  n := coalesce(array_length(option_ids, 1), 0);
  if not p.multiple and n > 1 then raise exception 'single_choice'; end if;
  if n > 0 and (select count(*) from public.poll_options where poll_id = pid and id = any (option_ids)) <> n then
    raise exception 'invalid_option';
  end if;

  delete from public.poll_votes where poll_id = pid and user_id = auth.uid();
  insert into public.poll_votes (poll_id, option_id, user_id)
  select pid, o, auth.uid() from unnest(option_ids) o;
end;
$$;

-- ── Añadir una opción: solo quien la creó, mientras esté abierta (máximo 10) ──
create or replace function public.add_poll_option(pid uuid, label text) returns void
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  select id, created_by, closed into p from public.polls where id = pid;
  if p.id is null or p.created_by is distinct from auth.uid() or not public.is_room_member(public.poll_room(pid)) then
    raise exception 'forbidden';
  end if;
  if p.closed then raise exception 'poll_closed'; end if;
  if (select count(*) from public.poll_options where poll_id = pid) >= 10 then raise exception 'too_many_options'; end if;
  insert into public.poll_options (poll_id, label, position)
  values (pid, trim(label), (select coalesce(max(position), 0) + 1 from public.poll_options where poll_id = pid));
end;
$$;

revoke execute on function public.poll_room(uuid), public.create_poll(uuid, text, boolean, text[]),
  public.vote_poll(uuid, uuid[]), public.add_poll_option(uuid, text) from public, anon;
grant execute on function public.poll_room(uuid), public.create_poll(uuid, text, boolean, text[]),
  public.vote_poll(uuid, uuid[]), public.add_poll_option(uuid, text) to authenticated;

-- Resultados en directo
alter publication supabase_realtime add table public.polls, public.poll_options, public.poll_votes;
