-- getaro: emoji o foto por sala. Las fotos van a Supabase Storage (bucket público "room-images"),
-- ya reducidas a 256 px en el móvil. Ruta: <room_id>/<uuid>.webp

alter table public.rooms
  add column emoji text check (char_length(emoji) <= 16),
  add column image_path text check (char_length(image_path) <= 200);
grant update (name, require_approval, emoji, image_path) on public.rooms to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Primera carpeta de la ruta = id de la sala (null si no es un uuid válido)
create or replace function public.room_id_from_path(path text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(path))[1]::uuid;
exception when others then
  return null;
end;
$$;

-- Leer es público (bucket público). Subir, cambiar o borrar: titular de la sala o admin.
create policy "room_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'room-images' and (public.is_room_owner(public.room_id_from_path(name)) or public.is_admin()));
create policy "room_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'room-images' and (public.is_room_owner(public.room_id_from_path(name)) or public.is_admin()));
create policy "room_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'room-images' and (public.is_room_owner(public.room_id_from_path(name)) or public.is_admin()));

-- La página del enlace de invitación también muestra la imagen de la sala
drop function public.room_preview(text);
create function public.room_preview(code text)
returns table (id uuid, name text, member_count int, already_member boolean, pending boolean,
               require_approval boolean, emoji text, image_path text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name,
         (select count(*)::int from public.room_members m where m.room_id = r.id),
         exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid()),
         exists (select 1 from public.join_requests j where j.room_id = r.id and j.user_id = auth.uid()),
         r.require_approval, r.emoji, r.image_path
  from public.rooms r
  where auth.uid() is not null and r.invite_code = upper(trim(code));
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
