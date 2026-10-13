-- getaro: cómo quiere cada persona que la trate la app (f = femenino, m = masculino, n o vacío = neutro)
alter table public.profiles add column gender text check (gender in ('f', 'm', 'n'));
grant update (display_name, avatar_url, color, gender) on public.profiles to authenticated;
