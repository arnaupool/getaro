# Especificación de getaro

Qué hace la app y por qué. Es la referencia para cualquier cambio de producto; si algo de aquí cambia, se actualiza
este documento en el mismo commit.

## Idea

Coordinar días entre un grupo de amigos con agendas apretadas es difícil en un chat. getaro lo resuelve con un
calendario compartido por cada quedada: cada persona marca lo que puede y la app enseña dónde coincidís.

Vocabulario:

- **Sala**: un grupo de gente (la colla del divendres, la família...). Es privada.
- **Quedada**: un plan concreto dentro de una sala, con un rango de fechas en el que buscar día. Una sala puede tener
  varias a la vez.
- **Disponibilidad**: lo que cada persona marca en cada día de una quedada: *puc*, *potser* o nada.
- **Titular**: la persona que gestiona una sala.
- **Admin**: quien administra toda la app (panel `/admin`).

## Decisiones

| Tema | Decisión |
|------|----------|
| Stack | Next.js 16 y Supabase (Auth, Postgres, Realtime, Storage). Imagen Docker en Unraid |
| Inicio de sesión | Enlace mágico por correo con código de 6 cifras de respaldo; Google opcional. Sin contraseñas |
| Registro | Abierto. Lo que protege el contenido es la aprobación de cada sala |
| Organización | Sala, y dentro quedadas. Cada quedada tiene su rango de fechas y su disponibilidad |
| Disponibilidad | Por día: `yes` o `maybe`; sin fila es "no marcado". Tocar rota nada, sí, quizás; arrastrar marca un rango. Los días pasados no se pueden marcar |
| Color | Uno por persona, elegido en Ajustes; por defecto se deriva de su id |
| Coincidencias | Verde intenso si puede todo el grupo; verde claro si todo el grupo pero con algún `maybe`; violeta proporcional al resto |
| Mejores fechas | Rachas de días consecutivos con el máximo de gente disponible, ordenadas por duración |
| Fijar fecha | Quien creó la quedada o la titular. Día o rango, con hora y lugar opcionales |
| Calendario personal | Botón "Afegir a Google Calendar" en la fecha elegida: abre Google Calendar con título, día, hora (2 h por defecto), lugar y enlace a la quedada ya rellenados; solo hay que pulsar Guardar. Sin hora, evento de día completo |
| Entrar en una sala | Enlace `/join/<código>` (8 caracteres sin ambiguos). Con aprobación activada (por defecto) se crea una solicitud; la titular acepta o rechaza |
| Chat | Uno por sala, en tiempo real, con contador de no leídos guardado en la base de datos |
| Encuestas | En cada quedada. Las crea cualquier miembro, que elige si se puede votar una o varias opciones (de 2 a 10). Los votos se ven con nombre y se pueden cambiar hasta que se cierra. Solo quien la crea añade opciones; la cierra o borra quien la creó o la titular |
| Imagen de sala | Foto (reducida a 256 px en el navegador, en Supabase Storage) o emoji |
| Idioma | Valencià por defecto y castellano. Se elige en la cabecera y se guarda en una cookie |
| Género | Cada persona elige cómo la trata la app (femenino, masculino o neutro). Los textos sobre el grupo son neutros |
| Tema | Claro, oscuro o el del sistema |
| Móvil | Diseño pensado primero para móvil; instalable como app (manifest e iconos) |

## Permisos

| Acción | Miembro | Creador de la quedada | Titular | Admin |
|--------|:-------:|:---------------------:|:-------:|:-----:|
| Ver sala, quedadas, chat y disponibilidad | sí | sí | sí | sí |
| Marcar su disponibilidad, crear quedadas, escribir | sí | sí | sí | no (solo mira) |
| Editar, fijar fecha o borrar una quedada | | sí | sí | sí |
| Borrar mensajes de otras personas | | | sí | sí |
| Crear encuestas y votar | sí | sí | sí | no (solo mira) |
| Cerrar o borrar una encuesta | quien la creó | quien la creó | sí | sí |
| Aceptar o rechazar solicitudes, expulsar | | | sí | sí |
| Renombrar, cambiar imagen, regenerar enlace, borrar sala | | | sí | sí |
| Pasar la sala a otra persona | | | sí | sí |
| Panel de administración | | | | sí |

- La titular no puede salir de su sala: primero la pasa a otra persona o la borra.
- Si se borra la cuenta de una titular, la sala pasa al miembro más antiguo; si no queda nadie, se borra.
- Al salir o ser expulsado de una sala se borra su disponibilidad en las quedadas de esa sala.

## Pantallas

| Ruta | Contenido |
|------|-----------|
| `/login` | Correo (enlace y código), Google si está activado, acceso de pruebas solo en desarrollo |
| `/` | Mis salas (con no leídos y solicitudes), próximas quedadas, salas en espera, crear sala, unirse con código |
| `/join/[code]` | Vista previa de la sala: entrar, pedir entrar o "esperando aprobación" |
| `/rooms/[id]` | Pestañas Quedades, Xat y Gent (miembros, solicitudes, invitación y ajustes de la sala) |
| `/rooms/[id]/events/[eventId]` | Calendario, mejores fechas, quién ha marcado, fecha elegida con hora y lugar, encuestas |
| `/settings` | Nombre, cómo te trata la app, color y tema |
| `/admin` | Resum, Comptes, Sales, Historial y Sistema (ver [`ADMIN.md`](ADMIN.md)) |
| `/unavailable` | Aviso si Supabase no responde |

## Fuera de alcance

Notificaciones push o por correo, franjas horarias dentro del día, integración con calendarios externos, apps nativas.
