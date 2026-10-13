# Estado de getaro (13 oct 2026)

Resumen para retomar el trabajo. El producto está en [`docs/SPEC.md`](docs/SPEC.md); la base de datos, en
[`docs/DATABASE.md`](docs/DATABASE.md).

## En producción

- Imagen `ghcr.io/arnaupool/getaro:latest` en Unraid, publicada por GitHub Actions en cada push a `main`.
- Supabase con las migraciones `0001` a `0009` aplicadas y probadas con cuentas no admin.
- Funcionalidad completa de la spec: salas con aprobación, quedadas con calendario y mejores fechas, chat con no
  leídos, imagen de sala, idiomas, género, PWA y panel de admin.

## Pendiente

- Probar el flujo completo con varias personas reales en el móvil (unirse, aceptar, marcar a la vez, chat, admin).
- Configuración fuera del código: plantillas de correo y SMTP en Supabase, ruta del túnel de Cloudflare.
- Opcional: avisos de rendimiento de Supabase (índices en claves foráneas, `auth.uid()` en políticas). Irrelevantes
  con pocas decenas de personas.

## Cómo se trabaja

- `npm run check` antes de cada commit (tipos, lint y tests); GitHub lo repite antes de publicar.
- Tras verificar un cambio: commit y push a `main`. En Unraid, Edit y Apply (o force update) para actualizar.
- Cambios de base de datos: migración nueva en `supabase/migrations`, aplicada con el conector de Supabase y probada
  con el bloque `do` de `docs/DATABASE.md`.
