-- getaro: hora y lugar de la quedada; aceptar solicitudes al desactivar la aprobación

-- ── Hora y lugar (opcionales; se rellenan al fijar la fecha) ──
alter table public.events
  add column final_time time,
  add column location text check (char_length(location) <= 200);
grant update (title, description, start_date, end_date, final_start, final_end, final_time, location)
  on public.events to authenticated;

-- ── Si la sala deja de pedir aprobación, las solicitudes pendientes entran ──
create or replace function public.handle_approval_disabled() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.require_approval and not new.require_approval then
    insert into public.room_members (room_id, user_id)
    select room_id, user_id from public.join_requests where room_id = new.id
    on conflict do nothing;
    -- on_member_added borra cada solicitud aceptada
  end if;
  return new;
end;
$$;

create trigger on_approval_disabled
  after update of require_approval on public.rooms
  for each row execute function public.handle_approval_disabled();

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
