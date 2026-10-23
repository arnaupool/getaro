-- Ajustes generales que edita el admin desde el panel (Admin → Sistema). Una sola fila.
-- public_url: dirección externa de la app (https://getaro.example.com). Se usa en los enlaces que salen
-- de la app (invitaciones, Google Calendar); si está vacía, se usa la dirección del navegador.

create table public.app_settings (
  id         boolean primary key default true check (id),
  public_url text check (public_url ~ '^https?://[^/\s?#@]+$'),
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

alter table public.app_settings enable row level security;
create policy "app_settings_select" on public.app_settings for select to authenticated using (true);
revoke all on public.app_settings from anon;
revoke insert, update, delete, truncate on public.app_settings from authenticated;

create or replace function public.admin_set_public_url(url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.app_settings set public_url = nullif(trim(url), ''), updated_at = now();
end;
$$;

revoke execute on function public.admin_set_public_url(text) from public, anon;
grant execute on function public.admin_set_public_url(text) to authenticated;
