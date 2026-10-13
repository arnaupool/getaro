-- getaro: crear una sala fallaba para cualquier cuenta que no fuera admin.
-- La app inserta con RETURNING id, y Postgres exige que la fila nueva cumpla la política SELECT;
-- la membresía la crea un trigger AFTER INSERT, que llega tarde. La titular siempre puede ver su sala.
drop policy "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms for select to authenticated
  using (owner_id = auth.uid() or public.is_room_member(id) or public.is_admin());
