# Almacenamiento: Cloudflare R2 y adaptador local

> **Estado:** vigente desde el 17/11/2026 (issue
> [#40](https://github.com/gonzalitojh/world-craft/issues/40), M0-10).
> **Ámbito:** variables, buckets, CORS, lifecycle, límites, smoke y rotación de
> credenciales.
> **Decisiones asociadas:** [ADR 0004](adr/0004-cloudflare-r2-storage-adapter.md)
> y [ADR 0020](adr/0020-direct-signed-upload-to-r2.md).
> **Manual de usuario:** no aplica; esta issue no añade interfaz visible.

Esta guía explica cómo dejar el almacenamiento listo y cómo comprobarlo. El
código vive en `src/lib/storage/` y `src/lib/assets/`; el contrato y los límites
se describen en el [ADR 0004](adr/0004-cloudflare-r2-storage-adapter.md).

## 1. Variables de entorno

Todas son **solo de servidor**. Ninguna lleva prefijo `NEXT_PUBLIC_` y ninguna
debe copiarse a un componente cliente. `.env.example` es la plantilla
versionada; `.env.local` no se sube al repositorio.

### 1.1 Cloudflare R2

| Variable | Obligatoria | Formato y uso |
|---|---|---|
| `R2_ACCOUNT_ID` | Sí, salvo que exista `R2_ENDPOINT` | 32 caracteres hexadecimales. Construye `https://<account>.r2.cloudflarestorage.com`. |
| `R2_ACCESS_KEY_ID` | Sí | Credencial de un token de API de R2 con permiso sobre el bucket. |
| `R2_SECRET_ACCESS_KEY` | Sí | Secreto del token. Nunca se imprime ni se registra. |
| `R2_BUCKET_NAME` | Sí | 3–63 caracteres en minúsculas, dígitos o guiones. Bucket **privado**. |
| `R2_ENDPOINT` | Alternativa a `R2_ACCOUNT_ID` | URL `http(s)` de un endpoint S3-compatible distinto. |

### 1.2 Driver y desarrollo

| Variable | Por defecto | Uso |
|---|---|---|
| `STORAGE_DRIVER` | Autodetectado | `local` o `r2`. Si falta, producción exige R2 y desarrollo usa local cuando no hay credenciales completas. **Producción nunca usa local.** |
| `STORAGE_LOCAL_DIR` | `.local/storage` | Directorio de objetos locales; está dentro de `.local/`, ignorado por git. |
| `STORAGE_LOCAL_BASE_URL` | `http://localhost:3000` | Origen con el que se firman las URLs locales; cámbialo si `next dev` usa otro puerto u host. |
| `STORAGE_LOCAL_SECRET` | Generado en `.local/storage-secret` | Secreto HMAC de 16–256 caracteres. Si se deja vacío, se genera la primera vez. |
| `STORAGE_SMOKE_TOKEN` | — | Token de 16–256 caracteres para `GET /api/storage/self-check` en desarrollo y preview. En producción real la ruta devuelve 404 aunque exista. |

La validación es **estricta y perezosa** (`src/lib/storage/env.ts`): el build, la
CI y las pruebas unitarias funcionan sin credenciales; el error aparece al crear
el adaptador y enumera la variable que falta, nunca su valor.

## 2. Crear los buckets

Se recomienda **un bucket por entorno** (desarrollo y producción). Si se usa uno
solo, separa al menos por prefijo y asume el riesgo de que un error de
configuración mezcle objetos.

1. En el panel de Cloudflare, abre **R2** y crea el bucket de desarrollo
   (`world-craft-dev`, por ejemplo). Repite para producción cuando se publique.
2. **No actives acceso público ni un dominio público.** El bucket debe ser
   privado: todo acceso pasa por URLs firmadas.
3. Crea un token de API de R2 con permiso de lectura y escritura **solo sobre
   esos buckets**. No reutilices credenciales de producción en local.
4. Copia `.env.example` a `.env.local` y rellena `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET_NAME` con el bucket
   de desarrollo.
5. Comprueba que el bucket no es público: una petición al endpoint sin firma
   debe responder 403 o 404. Lo verifica `pnpm storage:smoke`.

### 2.1 CORS

El navegador hace un `PUT` directo a R2, así que el bucket necesita CORS. La
configuración exacta es:

```json
[
  {
    "AllowedOrigins": [
      "https://<proyecto>.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

- Sustituye `<proyecto>.vercel.app` por el dominio real de producción y añade el
  dominio de la preview si se prueba el self-check desde ella.
- `PUT` es necesario para la subida firmada; `GET`, para las URLs firmadas de
  lectura (incluido el self-check).
- No uses `*` como origen: la URL firmada ya acota la operación, pero CORS debe
  limitar quién puede iniciarla.

### 2.2 Lifecycle

Crea una regla de ciclo de vida que **borre los objetos bajo `tmp/` y `_smoke/`
al cabo de 1 día**. Son temporales de subida y objetos de diagnóstico: no deben
acumularse ni consumir cuota. No apliques la regla a `world/`.

El lifecycle es la **red de seguridad**: `finalizeUpload` borra el temporal al
terminar y al detectar un exceso de tamaño, pero un cliente que abandona la
subida deja el objeto en `tmp/` hasta que la regla lo purga.

## 3. Claves y prefijos

| Prefijo | Contenido | Vida |
|---|---|---|
| `world/{worldId}/{assetId}.webp` | Asset publicado (WebP). | Permanente hasta borrar el asset. |
| `world/{worldId}/{thumbnailUuid}.webp` | Miniatura de 480 px; `thumbnailUuid = UUIDv5(namespace, assetId)`. Sin fila en `assets`. | Igual que el asset. |
| `tmp/{worldId}/{assetId}.upload` | Temporal de la subida directa. | 10 minutos de URL; lifecycle de 1 día. |
| `_smoke/{uuid}.png` | Objeto del self-check. | Se borra al terminar; lifecycle de 1 día. |

Los identificadores son UUID y las claves pasan `assertSafeStorageObjectKey`:
sin `..`, barras invertidas, rutas absolutas, dobles barras, `:` ni caracteres de
control.

## 4. Límites

| Límite | Valor | Dónde se aplica |
|---|---|---|
| Tamaño de archivo | 10 MiB (10 485 760 bytes) | `requestUpload`, pipeline, `download` y guarda 0007 |
| Píxeles de entrada | 25 000 000 (25 MP) | Pipeline sharp |
| Lado de entrada | 8192 px | Pipeline sharp |
| Lado mínimo | 16 px | Pipeline sharp y guarda 0007 |
| Lado del WebP publicado | 4096 px | Pipeline y guarda 0007 |
| Miniatura | 480 px, calidad 72 | Pipeline |
| WebP principal | Calidad 82, sin metadatos | Pipeline |
| Texto alternativo | 500 caracteres | Servicio (sin `CHECK` en BD) |
| URL de subida | 10 minutos | `requestUpload` |
| URL de descarga | 5 minutos por defecto; máximo 1 hora | Servicio y contrato |

### 4.1 Formatos y MIME real

- Entrada admitida: PNG, JPEG, WebP, AVIF y **GIF estático**.
- El MIME **declarado** solo se usa para firmar el `PUT`. En `finalizeUpload` se
  detecta el MIME real con sharp: un archivo de texto renombrado a `.png` se
  rechaza.
- Los GIF animados, SVG, HEIC, TIFF y cualquier animación se rechazan.
- La salida es siempre WebP con miniatura WebP; no se conservan metadatos (no se
  llama a `withMetadata`).

## 5. Smoke real contra R2

```bash
pnpm storage:smoke
```

El script `scripts/storage/smoke.mjs` carga `.env.local` (o `.env`), sube un PNG
de 32×32 con un `PUT` directo, comprueba que una URL sin firma no lee, que una
URL firmada devuelve 200, que una URL con TTL de 1 s caduca y que el borrado deja
el objeto inaccesible. Nunca imprime claves completas, URLs firmadas ni
credenciales.

Si faltan variables se detiene con un mensaje explícito:

- «Falta `R2_ACCOUNT_ID` o `R2_ENDPOINT`» cuando no se puede construir el
  endpoint.
- «Falta `R2_ACCESS_KEY_ID`», «Falta `R2_SECRET_ACCESS_KEY`» o
  «Falta `R2_BUCKET_NAME`» cuando falta una credencial o el bucket.

**Estado actual:** el smoke real se ejecutó correctamente el 17/11/2026 contra el
bucket de desarrollo: PUT directo, rechazo sin firma (HTTP 400), lectura firmada
(200), caducidad (403), borrado y objeto borrado no accesible (404). No se
imprimieron claves ni URLs firmadas. Queda probar el self-check en una preview de
Vercel y confirmar CORS y lifecycle en Cloudflare.

## 6. Self-check en preview de Vercel

`GET /api/storage/self-check` ejecuta un ciclo completo sin tocar la base de
datos: genera un PNG con sharp, lo sube bajo `_smoke/`, comprueba que sin firma
no se lee, firma una lectura y la comprueba, y borra el objeto. Solo devuelve
booleanos y el nombre del driver.

- Requiere la cabecera `x-storage-smoke-token` con el valor de
  `STORAGE_SMOKE_TOKEN` y se compara en tiempo constante.
- Responde 404 si `STORAGE_SMOKE_TOKEN` no está configurado.
- Responde 404 en producción real (`NODE_ENV=production` sin
  `VERCEL_ENV=preview`).
- Existe en **preview de Vercel** (`VERCEL_ENV=preview`): allí `NODE_ENV` también
  es `production`, por eso se decide por `VERCEL_ENV`.
- Sin token o con token incorrecto responde 401.

Pasos para probarlo en una preview:

1. En Vercel → Project Settings → Environment Variables, define `R2_*` (bucket de
   desarrollo o uno de preview), `STORAGE_DRIVER=r2` y `STORAGE_SMOKE_TOKEN`
   para el entorno **Preview**.
2. Añade el dominio de la preview a `AllowedOrigins` de CORS en R2.
3. Despliega una rama y abre:
   `https://<preview>.vercel.app/api/storage/self-check` con la cabecera
   `x-storage-smoke-token`.
4. `200` con `ok: true` significa que driver, sharp, CORS, firma y bucket
   funcionan. `503` señala un paso fallido; revisa `driver`, `sharp` y el objeto
   `storage`.

En local se usa el mismo endpoint con el driver local; si `next dev` no usa el
puerto 3000, ajusta `STORAGE_LOCAL_BASE_URL`.

## 7. Rotación de credenciales

1. Crea un token nuevo en Cloudflare con permiso solo sobre los buckets de la
   aplicación.
2. Actualiza `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en `.env.local` y en las
   variables de Vercel (Preview y Production por separado).
3. Redespliega para que las funciones tomen los valores nuevos.
4. Ejecuta `pnpm storage:smoke` en local y el self-check en preview.
5. Revoca el token antiguo en Cloudflare.
6. Si una clave se ha filtrado: detente, no la commitees, revócala de inmediato,
   revisa los logs del proveedor y documenta el incidente. `gitleaks` corre en CI
   para detectar secretos versionados.

## 8. Comprobaciones de seguridad

- El bucket es privado y no tiene dominio público ni acceso anónimo.
- Las variables `R2_*` solo existen en el servidor; el punto de entrada
  `src/lib/storage/server.ts` está marcado `server-only`.
- Ninguna clave, URL firmada ni credencial se escribe en el repositorio, en
  capturas, en logs o en task files.
- La ruta `/api/storage/local/[...key]` devuelve 404 en producción; el driver
  local falla cerrado fuera de desarrollo y pruebas.
- La subida directa no permite publicar en `world/`: el `PUT` firmado solo
  escribe en `tmp/`, y la publicación la hace el servidor tras validar la imagen.
- La guarda `guard_asset_insert` de la migración 0007 impide que `authenticated`
  falsifique `bucket`, `mime`, `size`, `width`, `height` o `path` al insertar un
  asset.
- El endpoint de self-check está apagado en producción real.

## 9. Limitación conocida

En R2, el `PUT` prefirmado incluye `ContentLength` y `ContentType` en la firma,
pero **eso no sustituye al límite real**: `finalizeUpload` vuelve a comprobar el
tamaño y el MIME verdadero antes de publicar. El lifecycle de 1 día sobre `tmp/`
y `_smoke/` es la red de seguridad para temporales abandonados. En el adaptador
local, la firma HMAC no liga tipo ni tamaño: la ruta aplica el tope de 10 MiB y
`finalizeUpload` revalida; el adaptador local lee el archivo antes de comprobar
`maxBytes`, algo aceptable porque solo existe en desarrollo y pruebas.

## 10. Pendientes

- Confirmar en Cloudflare el CORS exacto y el lifecycle de `tmp/` y `_smoke/`.
- Probar el self-check en una preview de Vercel.
- Crear el bucket de producción al publicar.
- Añadir `CHECK` de longitud de `alt` en una migración futura si se considera
  necesario (hoy solo lo limita el servicio).
- CSP, HSTS y `Permissions-Policy` son preexistentes y quedan fuera de la issue
  #40.

## 11. Referencias

- [ADR 0004](adr/0004-cloudflare-r2-storage-adapter.md): R2 y `StorageAdapter`
- [ADR 0020](adr/0020-direct-signed-upload-to-r2.md): subida directa firmada
- [Esquema de base de datos](base-de-datos/esquema.md) §9: tabla `assets` y claves
- [Operación de la base de datos](base-de-datos/operacion.md): migraciones y
  verificación
- Issue [#40](https://github.com/gonzalitojh/world-craft/issues/40)
