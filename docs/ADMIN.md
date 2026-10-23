# Panel de administración v2 (diseño)

Estado: implementado (13 oct 2026), pendiente de ejecutar `supabase/migrations/0006_admin.sql` y desplegar. Diseño pensado para móvil: tarjetas en lugar de tablas.

## Decisiones

| # | Tema | Decisión |
|---|------|----------|
| 1 | Visitas y uso | Actividad real en la BD: personas activas por día, 7 y 30 días y gráfica de 30 días, a partir de accesos y acciones (mensajes, días marcados, quedadas creadas). Sin rastreo externo ni páginas vistas. |
| 2 | Resumen inicial | Solo "Personas activas": hoy, 7 y 30 días, y gráfica de 30 días. |
| 3 | Acciones sobre cuentas | Además de borrar y dar/quitar admin: ver ficha (salas, última actividad, mensajes, días marcados), cerrar sus sesiones en todos los dispositivos, editar su nombre visible. Sin suspender. |
| 4 | Acciones sobre salas | Además de borrar: ver ficha (miembros, quedadas, solicitudes, actividad) y cambiar titular. |
| 5 | Registro | Abierto. La protección es la aprobación de cada sala; las cuentas desconocidas se borran desde Admin. |
| 6 | Historial | Acciones delicadas de todo el mundo, visibles en Admin, se guardan 90 días. |
| 7 | Salud del sistema | Estado de Supabase (responde y latencia), espacio usado de 500 MB, versión desplegada (commit y fecha). Dirección pública de la app (enlaces de invitación y Google Calendar). |

## Estructura

Cinco pestañas en `/admin`:

1. **Resum**: tarjeta "Persones actives" (hui, 7 dies, 30 dies) y gráfica de barras de los últimos 30 días.
2. **Comptes**: lista en tarjetas (nombre, correo, nº de salas, última actividad) con buscador. Al tocar una, su ficha:
   salas a las que pertenece, última actividad, mensajes y días marcados (30 días), y acciones:
   editar nombre, dar/quitar admin, cerrar sesiones, borrar.
3. **Sales**: lista en tarjetas (nombre, titular, personas, quedadas, actividad). Ficha: miembros, quedadas,
   solicitudes pendientes, mensajes de los últimos 30 días; acciones: cambiar titular, abrir la sala, borrar.
4. **Historial**: últimas acciones delicadas, filtrables por tipo, con quién, qué, dónde y cuándo.
5. **Sistema**: estado de Supabase con latencia, MB usados sobre 500, commit y fecha de la imagen, y la dirección
   pública.

## Datos necesarios (migración 0006)

- **Actividad diaria**: tabla `activity_days (user_id, day)` con clave primaria compuesta. La app la rellena con un
  `upsert` (RPC `touch_activity`) en cada carga de página con sesión; una fila por persona y día, así que ocupa muy poco
  (unas 30 personas dan unas 11.000 filas al año). Las acciones (mensajes, marcados, quedadas) salen de sus tablas.
- **Historial**: tabla `audit_log (id, at, actor_id, action, room_id, target_user_id, details jsonb)`, escrita por
  triggers para que no dependa de la pantalla desde la que se hace:
  - borrar sala o quedada; expulsar o salir de una sala; cambiar titular;
  - aceptar o rechazar solicitud; borrar cuenta; dar/quitar admin; editar nombre por admin; cerrar sesiones.
  Cada inserción borra lo anterior a 90 días. Solo admin puede leerla.
- **RPCs de admin** (`security definer`, comprueban `is_admin()`): `admin_activity_summary()`,
  `admin_user_detail(uid)`, `admin_room_detail(rid)`, `admin_rename_user(uid, name)`,
  `admin_sign_out_user(uid)` (borra sus filas de `auth.sessions`; el acceso que ya tenga caduca en menos de 1 hora),
  `admin_db_size()`. Cambiar titular reutiliza `transfer_room`, que ya permite admin.

## Versión desplegada

GitHub Actions pasa `GIT_SHA` y `BUILD_DATE` como build args; el Dockerfile los deja como variables de entorno y el
panel las muestra con enlace al commit.

## Fuera de alcance

Páginas vistas, analítica externa, suspender cuentas, lista de correos permitidos, alertas por correo.
