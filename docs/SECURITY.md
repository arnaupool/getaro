# Seguridad

Cómo se protege getaro y qué salió de la revisión completa del 20 de octubre de 2026.

## Modelo

- **La base de datos decide.** Todas las tablas tienen RLS y las operaciones delicadas son funciones SQL que comprueban
  permisos. La web no tiene una API propia: llama a Supabase con la sesión de quien navega. Si alguien llama a Supabase
  directamente, no puede hacer más que desde la app. Detalles en [`DATABASE.md`](DATABASE.md).
- **Columnas escribibles mínimas.** Además de RLS, cada tabla solo deja escribir las columnas que la app necesita
  (por ejemplo, un mensaje solo `room_id`, `user_id` y `body`; la fecha la pone la base de datos).
- **Defensa también en la web.** Cada página vuelve a comprobar la sesión aunque el `proxy` ya lo haga, y las
  acciones del servidor validan lo que reciben.
- **Sin secretos en el código ni en la imagen.** La imagen Docker solo recibe la URL y la clave pública de Supabase en
  tiempo de ejecución. No se usa la clave `service_role`.

## Revisión del 20 de octubre de 2026

Cada fallo se reprodujo antes de arreglarlo (en la base de datos con cuentas de prueba que se deshacen, en el código
con tests) y se comprobó después.

| Gravedad | Hallazgo | Arreglo |
|----------|----------|---------|
| Crítica | Next.js 16.2.9 tenía un fallo conocido que permitía saltarse el `proxy` | Next.js 16.4.2 y `npm audit fix`: 0 vulnerabilidades en producción |
| Alta | `/login?next=/\evil.com` mandaba a otro dominio tras iniciar sesión (los navegadores leen `\` como `/`) | `lib/safe-next.ts`, con tests |
| Media | Cualquiera podía poner como avatar una imagen de su servidor, al registrarse o después, y ver la IP de quien abriera la sala | Solo avatares de Google, en la base de datos y al pintarlos (`lib/avatar.ts`) |
| Media | Sin cabeceras de seguridad: se podía meter getaro en un iframe ajeno | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Media | Sin límites: con el registro abierto, un script podía llenar la base de datos | Máximo 30 mensajes por minuto, 20 salas por persona, 30 quedadas y 30 encuestas al día |
| Baja | Se podían crear mensajes con fecha futura (se quedaban sin leer para siempre) o elegir el código de invitación | Columnas escribibles mínimas (migración 0010) |
| Baja | La foto de una sala podía apuntar a la carpeta de otra | Restricción `image_path` en su carpeta |
| Baja | Quien salía de una sala seguía pudiendo editar sus quedadas | Las políticas exigen seguir siendo miembro |
| Baja | Realtime envía los borrados sin RLS con la clave de la fila: se veía quién desmarcaba qué día en quedadas ajenas | Id propio en `availability` y `poll_votes` |
| Baja | Un formulario de otra web podía cerrarte la sesión | El logout rechaza peticiones de otros sitios |

Antes, el 13 de octubre, ya se habían cerrado otros dos: el historial de admin se podía falsificar (migración 0008)
y crear salas fallaba para cuentas no admin (0009).

## Pendiente (riesgo bajo, aceptado)

- **Vulnerabilidades en herramientas de desarrollo** (`braces`, vía ESLint): no llegan a la imagen; arreglarlas exige
  saltos de versión con cambios incompatibles.
- **Sin `Content-Security-Policy` para scripts.** Next.js necesita scripts en línea; React ya escapa todo el contenido
  y no hay `dangerouslySetInnerHTML` con datos de usuarios.
- **Las acciones de GitHub se fijan por versión, no por commit.** Fijarlas por SHA protegería frente a una acción
  comprometida.
- **Una solicitud rechazada se puede repetir.** La titular puede regenerar el enlace si alguien insiste.

## Cómo revisar un cambio

1. Toda tabla nueva: RLS, `revoke all ... from anon, authenticated` y conceder solo lo necesario, columna a columna.
2. Funciones `security definer`: comprobar permisos dentro y conceder `execute` una a una.
3. Si va en Realtime y se borran filas, clave primaria opaca (un id), no datos.
4. Probar con el bloque `do` de [`DATABASE.md`](DATABASE.md), con cuentas **no admin**, los casos que deben funcionar
   y los que deben fallar.
5. `get_advisors` de Supabase tras cada migración.
