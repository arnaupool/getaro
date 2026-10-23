-- Arregla admin_set_public_url (0012): en las peticiones de la API, Supabase activa pg_safeupdate, que rechaza
-- cualquier UPDATE o DELETE sin WHERE ("UPDATE requires a WHERE clause"), también dentro de funciones.
-- Las pruebas con execute_sql no lo detectan porque no pasan por la API.

create or replace function public.admin_set_public_url(url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.app_settings set public_url = nullif(trim(url), ''), updated_at = now() where id;
end;
$$;
