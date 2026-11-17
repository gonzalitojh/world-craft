# ADR 0004 — Cloudflare R2 como almacenamiento principal con StorageAdapter

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-17
- **Issue:** #4 (decisión) y #40 (implementación, M0-10)
- **Decisiones del registro:** D-001, D-019
- **Decisores:** usuario (aprobación del plan); agentes (diseño e implementación)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0006, ADR 0013, ADR 0019, ADR 0020

## Contexto

World Craft guarda avatares, portadas, imágenes de fichas, fondos de mapas y
assets de manuscritos. Supabase Storage Free limita a 1 GB y el egreso puede
convertirse en un cuello de botella. El proyecto necesita más capacidad sin
coste y un acceso privado controlado por membresía.

El 15/11/2026, M0-08 (issue #9) fijó el contrato `StorageAdapter`, las claves
`world/{worldId}/{assetId}.{ext}` y la tabla `assets`, pero sin bucket ni
implementación real. M0-10 (issue #40) desarrolla la versión real: adaptador
R2, adaptador local para desarrollo y pruebas, pipeline de imagen y guarda de
escritura en base de datos.

## Decisión

1. **Proveedor:** Cloudflare R2 Free como almacenamiento principal de todos los
   assets. Supabase Storage no se usa en producción. Bucket **privado**.
2. **Abstracción:** interfaz `StorageAdapter` en `src/lib/storage/types.ts` con
   `upload`, `getSignedUrl`, `delete` y `list`, más `download` opcional (aditiva)
   para que el servidor recupere un temporal y lo procese.
3. **Privacidad:** el servidor comprueba la membresía y el rol del mundo antes de
   firmar. Las claves S3 solo viven en el servidor; ninguna variable `R2_*` es
   pública ni llega al bundle del cliente.
4. **Organización de claves:**
   - Asset publicado: `world/{worldId}/{assetId}.webp`.
   - Miniatura: `world/{worldId}/{thumbnailUuid}.webp`, con
     `thumbnailUuid = UUIDv5(namespace, assetId)`; no ocupa fila ni migración.
   - Temporal de subida directa: `tmp/{worldId}/{assetId}.upload`, bajo un
     prefijo que el lifecycle purga sin tocar objetos publicados.
   - Diagnóstico: `_smoke/{uuid}.png`, reservado al self-check.
5. **Imágenes:** conversión a WebP (calidad 82, lado máximo 4096 px) y miniatura
   WebP de 480 px (calidad 72), validación de MIME real con sharp, límites de
   10 MiB, 25 MP y 8192 px de entrada, mínimo de 16 px, y eliminación de
   metadatos (no se llama a `withMetadata`). Se rechazan SVG, HEIC, TIFF y
   animaciones; un GIF estático se acepta y se convierte a WebP.
6. **Driver:** `STORAGE_DRIVER` elige `local` o `r2`; si falta, desarrollo y
   pruebas usan local cuando no hay credenciales completas y producción exige R2.
   **Producción nunca usa local**: si el driver local se fuerza o faltan
   credenciales, la operación falla cerrada con `StorageError('unavailable')`.
7. **Operación:** CORS restringido, lifecycle para `tmp/` y `_smoke/`, smoke real
   contra R2 y self-check protegido en previews. El detalle está en
   [`docs/almacenamiento.md`](../almacenamiento.md).
8. **Base de datos:** la migración `0007_asset_write_guard.sql` añade el trigger
   `guard_asset_insert` para que `authenticated` no pueda falsificar `bucket`,
   `mime`, `size`, `width`, `height` ni `path` al insertar un asset.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Supabase Storage | Solo 1 GB en Free; insuficiente para mapas, portadas y assets de manuscritos. |
| Amazon S3 | Egreso y configuración con coste; R2 ofrece egreso gratis. |
| Almacenamiento local en Vercel | El sistema de archivos de las funciones no es persistente. Solo vale en desarrollo y pruebas, tras el driver local. |
| Vercel Blob | Límites y coste fuera del objetivo de 0 €/mes. |
| Listar objetos de R2 para cada descarga | Consume operaciones Class B y añade latencia; los metadatos se guardan en `assets` y la miniatura se deriva con UUIDv5. |

## Consecuencias

### Positivas

- 10 GB y egreso gratis cubren el uso personal previsto.
- El bucket privado y las URLs firmadas mantienen el contenido inaccesible sin
  permiso; el self-check comprueba que una URL sin firma no lee.
- `StorageAdapter` permite desarrollo local, tests y una migración futura sin
  tocar los módulos de dominio.
- La re-codificación reduce peso, metadatos y superficie de ataque.
- La guarda 0007 impide que un cliente autenticado falsifique los metadatos del
  asset aunque llame directamente a la Data API.
- La subida directa firmada sortea el límite de cuerpo de Vercel (ADR 0020).

### Negativas y riesgos

- Requiere configuración S3-compatible y gestión de claves en servidor.
- Un fallo de R2 deja sin imágenes a la aplicación; el texto sigue disponible.
- La limpieza de huérfanos y el ciclo de vida añaden operación.
- La exportación de un mundo debe incluir los assets o poder reconstruirlos.
- El PUT prefirmado acota `ContentLength` y `ContentType` en la firma, pero el
  límite real se vuelve a comprobar en `finalizeUpload`; el lifecycle es la red
  de seguridad de temporales abandonados.
- La guarda 0007 cubre `INSERT`; un `UPDATE` de columnas sensibles queda limitado
  por los `grant` (solo `alt`), no por un trigger equivalente.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Imágenes con `next/image`, `sizes` correctos y placeholder; la miniatura de 480 px sirve de base. |
| Temas (Claro/Oscuro) | Las imágenes no dependen del tema; los placeholders usan tokens. |
| Accesibilidad | Texto alternativo obligatorio (`alt`, máximo 500 caracteres en el servicio) y contraste de las imágenes de fondo controlado. |
| Seguridad y privacidad | Bucket privado, comprobación de membresía y rol, URLs cortas, claves solo en servidor, `server-only` en el punto de entrada y guarda de escritura en BD. |
| Coste | 0 €/mes dentro de los límites de R2 Free. |
| Portabilidad de datos | Assets incluidos en la exportación del mundo o re-subibles desde ella. |

## Implementación (M0-10, issue #40)

### Módulos

| Ruta | Responsabilidad |
|---|---|
| `src/lib/storage/types.ts` | Contrato, `StorageError` y caducidad máxima (`MAX_SIGNED_URL_EXPIRY_SECONDS = 3600`). |
| `src/lib/storage/env.ts` | Validación estricta y perezosa de `STORAGE_*` y `R2_*` con Zod; no rompe el build sin credenciales. |
| `src/lib/storage/driver.ts` | Selección del driver y fábrica de adaptadores; bloqueo de local en producción. |
| `src/lib/storage/r2-adapter.ts` | Cliente S3 solo en servidor: región `auto`, `forcePathStyle`, checksums `WHEN_REQUIRED`, endpoint derivado de `R2_ACCOUNT_ID` o `R2_ENDPOINT`, traducción de errores. |
| `src/lib/storage/local-adapter.ts` | Adaptador de desarrollo y pruebas con URLs HMAC-SHA256, escritura atómica y sidecar `.meta.json`; directorio `.local/storage` fuera de git. |
| `src/lib/storage/local-signature.ts` | Firma y verificación de operación, caducidad y clave en tiempo constante. |
| `src/lib/storage/object-key.ts` | Validación estricta de claves y prefijos (sin `..`, barras invertidas, `:` ni controles). |
| `src/lib/storage/thumbnail-key.ts` | UUIDv5 de la miniatura y clave `world/{worldId}/{thumbnailUuid}.webp`. |
| `src/lib/storage/self-check.ts` | Ciclo booleano de diagnóstico (subida, rechazo sin firma, lectura firmada y borrado). |
| `src/lib/storage/server.ts` | Punto de entrada marcado `server-only`. |
| `src/lib/assets/*` | Límites, política de rol, pipeline sharp, `AssetStore` con `withUserSession` y servicio `requestUpload`/`finalizeUpload`/`getDownloadUrl`/`deleteAsset`/`listAssets`. |
| `src/app/api/storage/local/[...key]/route.ts` | Sirve el adaptador local solo en desarrollo y pruebas; 404 en producción. |
| `src/app/api/storage/self-check/route.ts` | Diagnóstico con `STORAGE_SMOKE_TOKEN`; 404 en producción real. |
| `scripts/storage/smoke.mjs` | Smoke real de R2 (`pnpm storage:smoke`). |

### Flujo de subida

1. `requestUpload` comprueba membresía y rol (`owner`/`editor`), normaliza el
   MIME declarado, valida tamaño y firma un `PUT` directo a R2 bajo
   `tmp/{worldId}/{assetId}.upload` con `ContentType` y `ContentLength` en la
   firma. La URL caduca en 600 s.
2. El navegador sube el archivo directo a R2 (decisión D1, ADR 0020).
3. `finalizeUpload` descarga el temporal (máximo 10 MiB), valida MIME real y
   dimensiones con sharp, publica el WebP principal y la miniatura, inserta los
   metadatos bajo `withUserSession` y borra el temporal. Si el temporal supera
   el límite o falla el procesamiento, se borra.

### Límites y caducidades

| Límite | Valor | Dónde se aplica |
|---|---|---|
| Tamaño de archivo | 10 MiB (10 485 760 bytes) | Servicio, pipeline, `download` local/R2 y guarda 0007 |
| Píxeles de entrada | 25 000 000 | Pipeline sharp |
| Lado de entrada | 8192 px | Pipeline sharp |
| Lado mínimo | 16 px | Pipeline sharp y guarda 0007 |
| Lado del WebP publicado | 4096 px | Pipeline y guarda 0007 |
| Miniatura | 480 px, calidad 72 | Pipeline |
| Calidad del WebP principal | 82 | Pipeline |
| `alt` | 500 caracteres | Servicio (sin `CHECK` en BD) |
| URL de subida | 600 s | `requestUpload` |
| URL de descarga | 300 s por defecto; máximo 3600 s | Servicio y contrato |
| Listado | 50 por defecto; máximo 200 | Servicio |

### Dependencias

- `@aws-sdk/client-s3@3.1169.0` y `@aws-sdk/s3-request-presigner@3.1169.0`
  (Apache-2.0): cliente oficial S3-compatible y firma de URLs. Alternativa
  descartada: implementar SigV4 a mano, más superficie y sin mantenimiento.
- `sharp@0.35.5` (Apache-2.0): decodificación, re-codificación y metadatos.
  Alternativa descartada: `jimp` (más lento y sin AVIF fiable).
- `sharp` figura en `serverExternalPackages` de Next.js para no empaquetar sus
  binarios nativos.

### Pruebas

- Unitarias: entorno, driver, adaptador local, adaptador R2 con dobles,
  miniaturas UUIDv5, pipeline de imagen, servicio y contrato `StorageAdapter`.
- Integración (`pnpm test:db`): servicio de assets y RLS contra PostgreSQL real,
  incluida la guarda 0007.
- Build: `pnpm build` incluye las rutas `/api/storage/local/[...key]` y
  `/api/storage/self-check`.
- Smoke real: `pnpm storage:smoke` pasó el 2026-11-17 contra el bucket de
  desarrollo (PUT, rechazo sin firma con HTTP 400, lectura firmada, caducidad y
  borrado).
- Evidencia ejecutada el 2026-11-16: `pnpm typecheck`, `pnpm lint`, `pnpm test`
  (34 archivos, 352 pruebas), `pnpm build`, `pnpm db:check`, `pnpm test:db`
  (11 archivos, 87 pruebas) y `pnpm db:verify` (8/8 migraciones).
- Re-verificación del 2026-11-17 tras las correcciones de revisión:
  `pnpm typecheck`, `pnpm lint`, `pnpm test` (39 archivos, 381 pruebas) y
  `pnpm build` en verde. Se añadieron pruebas de la ruta local, del cursor,
  del PUT firmado con tipo y longitud, del borrado de temporales que superan
  el límite y de `STORAGE_LOCAL_BASE_URL`. `pnpm test:db` y `pnpm db:verify`
  no se pudieron repetir en esa sesión por un bloqueo DNS del host de Supabase
  (solo resuelve AAAA); se conserva la evidencia verde del 2026-11-16.

### Pendientes operativos

- Crear los buckets de desarrollo y producción en Cloudflare (o prefijos
  separados), configurar CORS y lifecycle y rellenar `.env.local`.
- `pnpm storage:smoke` se ejecutó correctamente el 2026-11-17 contra el bucket de
  desarrollo: PUT directo, rechazo sin firma (HTTP 400), lectura firmada (200),
  caducidad (403), borrado y objeto borrado no accesible (404). No se
  imprimieron claves ni URLs firmadas.
- Ejecutar el self-check en una preview de Vercel con `STORAGE_SMOKE_TOKEN`.
- CSP, HSTS y `Permissions-Policy` son preexistentes y quedan fuera de #40.
- El `alt` está limitado a 500 en el servicio pero no tiene `CHECK` en base de
  datos; es una mejora futura.
- La guarda 0007 cubre `INSERT`; un `UPDATE` de columnas sensibles está acotado
  por los `grant` de columna.

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Capacidad | 10 GB | WebP, límite de dimensiones, purga de huérfanos y revisión mensual | ADR 0013; M0-10 (#40) |
| Operaciones | 1M Class A y 10M Class B al mes | Caché de URLs firmadas, miniaturas, un solo PUT por subida y evitar listados frecuentes | ADR 0013 |
| Egreso | Gratis en R2 | Sin coste previsto; se monitoriza igualmente | ADR 0013 |
| Temporales abandonados | Consumen cuota Class A/almacenamiento | Lifecycle sobre `tmp/` y `_smoke/`; borrado en `finalizeUpload` y al detectar exceso de tamaño | `docs/almacenamiento.md` |
| Pérdida o fuga de claves | Riesgo alto | Claves solo en el servidor, `.env*` fuera de git, `server-only` y gitleaks | M0-05 (#6) y M5-05 (#32) |
| Guarda de escritura incompleta | Metadatos falsificados en `UPDATE` | `grant` de columna limitado a `alt`; revisar si aparece una ruta de escritura nueva | Migración 0007 |

## Plan de revisión

Se revisa si se supera el 70 % de capacidad u operaciones, si R2 cambia sus
condiciones o si se añade un proveedor de CDN. Cualquier cambio de proveedor de
almacenamiento exige un ADR nuevo. Si se separan buckets por entorno o se
introduce un CDN, se actualiza esta decisión con un ADR que la superseda.

## Nota de actualización (2026-11-15)

La issue [#9](https://github.com/gonzalitojh/world-craft/issues/9) (M0-08) fijó el
contrato y la tabla que lo sostiene: `StorageAdapter` con `upload`,
`getSignedUrl`, `delete` y `list` (`src/lib/storage/types.ts`), caducidad máxima de
una hora (`MAX_SIGNED_URL_EXPIRY_SECONDS`), errores de dominio
(`not_found`, `invalid_key`, `invalid_expiry`, `unavailable`) y claves
`world/{worldId}/{assetId}.{ext}` con extensión de imagen validada. La tabla
`assets` guarda `bucket`, `path`, `mime`, `size`, `width`, `height` y `alt`, impone
el prefijo con un `check` y deja al cliente solo la edición de `alt`. El detalle
está en el [ADR 0019](0019-database-schema-migrations-and-rls.md) y en
[`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md) §9. Esta nota no
reescribe el histórico.

## Referencias

- Issue de la decisión: #4
- Issue de la implementación: [#40](https://github.com/gonzalitojh/world-craft/issues/40)
- [`docs/almacenamiento.md`](../almacenamiento.md): guía operativa de R2
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D6, §3.4 y §3.7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-001 y D-019
- [ADR 0020](0020-direct-signed-upload-to-r2.md): subida directa firmada
- Documentación oficial de Cloudflare R2, consultada el 12/11/2026 y el
  17/11/2026.
