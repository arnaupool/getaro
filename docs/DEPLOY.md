# Desplegar getaro en Unraid

La imagen se construye sola en GitHub en cada cambio y se publica en `ghcr.io/arnaupool/getaro:latest`.
En Unraid se instala una vez desde el formulario de Docker y después se actualiza con un clic.
No hace falta terminal ni plugins: solo Docker activado (Settings, Docker, Enable Docker: Yes).

## Instalar (una vez, unos 10 minutos)

1. Unraid, pestaña **Docker**, abajo **Add Container**.
2. Rellena:

   | Campo | Valor |
   |-------|-------|
   | Name | `getaro` |
   | Repository | `ghcr.io/arnaupool/getaro:latest` |
   | Network Type | `Bridge` |
   | WebUI | `http://[IP]:[PORT:3000]/` |

3. Pulsa **Add another Path, Port, Variable, Label or Device** y añade estos cuatro (cambia "Config Type" en cada uno):

   | Config Type | Name | Valor |
   |-------------|------|-------|
   | Port | `Puerto web` | Container Port `3000`, Host Port `3010` (o cualquier puerto libre) |
   | Variable | `Supabase URL` | Key `SUPABASE_URL`, Value: la Project URL de Supabase |
   | Variable | `Supabase key` | Key `SUPABASE_PUBLISHABLE_KEY`, Value: la Publishable key de Supabase |
   | Variable | `Zona horaria` | Key `TZ`, Value `Europe/Madrid` |

   Las dos claves están en Supabase, Project Settings, API (son las mismas de tu `.env.local`).

4. **Apply**. Unraid descarga la imagen y arranca el contenedor. Pulsa su icono, **WebUI**, para abrirla.

Para cambiar el puerto o las claves más adelante: icono del contenedor, **Edit**, cambia el valor y **Apply**.

## Actualizar (cada vez que haya cambios)

Cuando se sube un cambio a GitHub, la imagen nueva está lista en unos 4 minutos. Entonces:

Pestaña Docker, icono de getaro, **Edit** y **Apply** sin cambiar nada: Unraid descarga la imagen nueva y recrea el
contenedor. Otra forma: activa **Advanced View** (arriba a la derecha) y pulsa **force update** en la fila de getaro.

Para confirmar la versión: getaro, Admin, Sistema, "Versió desplegada" muestra el commit en marcha.

## Acceso desde fuera de casa (Cloudflare Tunnel)

1. Cloudflare, Zero Trust, Networks, Tunnels: abre tu túnel, Public Hostname, Add a public hostname.
2. Subdomain `getaro`, tu dominio. Service `HTTP`, URL `IP-UNRAID:3010` (el Host Port que elegiste).

## Avisar a Supabase de la dirección (una vez)

Supabase, Authentication, URL Configuration:

- Site URL: `https://getaro.tudominio.com`
- Redirect URLs: añade `https://getaro.tudominio.com/**` (y `http://IP-UNRAID:3010/**` si entras por la red local)

## Problemas frecuentes

| Síntoma | Causa y solución |
|---------|------------------|
| Al aplicar: `port is already allocated` | Edit, cambia el Host Port por otro libre |
| La página da error nada más abrirla | Faltan o están mal `SUPABASE_URL` o `SUPABASE_PUBLISHABLE_KEY` (Edit) |
| El enlace del correo lleva a `localhost` | Falta el paso "Avisar a Supabase" |
| Al pulsar un botón sale un error de "Server Action" por el túnel | En la ruta del túnel, deja vacío "HTTP Host Header" |
| Tras actualizar sigue la versión anterior | Mira que el último "Imagen Docker" de GitHub (pestaña Actions) esté en verde y repite Edit, Apply |
| No deja entrar tras una semana sin uso | Supabase (plan gratis) pausa el proyecto tras 7 días sin actividad. getaro lo evita con una consulta diaria mientras el contenedor esté encendido; si aun así pasa, entra en supabase.com y pulsa Restore |
