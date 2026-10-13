-- getaro: mensajes sin leer por sala
alter table public.room_members add column last_read_at timestamptz not null default now();

-- Marcar como leído el chat de una sala (solo la fila propia; room_members no admite UPDATE directo)
create or replace function public.mark_room_read(rid uuid) returns void
language sql security definer set search_path = '' as $$
  update public.room_members set last_read_at = now()
  where room_id = rid and user_id = auth.uid();
$$;

-- Mensajes de otras personas posteriores a mi última lectura, por sala
create or replace function public.unread_counts()
returns table (room_id uuid, unread int)
language sql stable security definer set search_path = '' as $$
  select m.room_id, count(msg.id)::int
  from public.room_members m
  join public.messages msg
    on msg.room_id = m.room_id
   and msg.created_at > m.last_read_at
   and msg.user_id is distinct from auth.uid()
  where m.user_id = auth.uid()
  group by m.room_id;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
