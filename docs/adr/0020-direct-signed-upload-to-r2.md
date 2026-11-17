# ADR 0020 — Subida directa firmada a R2 con finalización en servidor

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-16
- **Fecha del documento:** 2026-11-17
- **Issue:** #40
- **Decisiones del registro:** D-019
- **Decisores:** usuario (aprobación del plan); agentes (diseño e implementación)
- **Supersede:** —
- **Relacionados:** ADR 0004, ADR 0019

## Contexto

Las imágenes de World Craft pueden llegar a 10 MiB. El cuerpo de una Server
Action o de un Route Handler en Vercel Hobby está limitado a 4,5 MB, así que el
servidor no puede recibir el archivo completo sin rechazar subidas válidas. A la
vez, el bucket es privado y las credenciales S3 no pueden viajar al navegador.

La decisión D1 de M0-10 resuelve el conflicto: el navegador sube el archivo
directo a R2 con una URL firmada y el servidor solo procesa el objeto temporal
después, con sharp, antes de publicarlo.

## Decisión

1. **`requestUpload` firma un `PUT` directo a R2** con el presigner del SDK,
   bajo `tmp/{worldId}/{assetId}.upload`, con `ContentType` y `ContentLength`
   incluidos en la firma y una caducidad de 600 s. La clave temporal está fuera
   de `world/` para que el lifecycle pueda purgarla sin tocar los assets
   publicados.
2. **El navegador sube el archivo** a esa URL; el servidor nunca recibe el
   cuerpo por una Server Action.
3. **`finalizeUpload` cierra la subida en servidor:** descarga el temporal con
   un máximo de 10 MiB, valida MIME real y dimensiones con sharp, publica el WebP
   principal y la miniatura (UUIDv5), inserta los metadatos bajo
   `withUserSession` y borra el temporal. Si el objeto supera el límite o falla
   el procesamiento, se borra el temporal.
4. **La autorización va antes de firmar:** `requestUpload`, `finalizeUpload` y
   `deleteAsset` comprueban membresía y rol de escritura (`owner`/`editor`); un
   `viewer` recibe `forbidden` y un no miembro `not_found`.
5. **Idempotencia acotada:** `finalizeUpload` no es idempotente por diseño; un
   segundo intento sin temporal devuelve `not_found`. Si la inserción falla, se
   consulta la fila existente antes de compensar, para no borrar objetos que una
   fila ya referencia.
6. **Temporales huérfanos:** el lifecycle de `tmp/` y `_smoke/` es la red de
   seguridad. Además, un temporal que supera el límite se borra en cuanto se
   detecta.
7. **Adaptador local equivalente:** en desarrollo y pruebas se firma contra
   `/api/storage/local/[...key]` con HMAC-SHA256 y la misma semántica de
   operación, caducidad y clave. En producción esa ruta devuelve 404.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Server Action con el cuerpo del archivo | El límite de 4,5 MB de Vercel Hobby rechaza imágenes válidas de hasta 10 MiB; subir el límite exige un plan de pago. |
| Proxy propio que reenvíe el cuerpo a R2 | Duplica el tráfico, añade latencia y sigue topando con el límite de cuerpo y de duración de la función. |
| Subida directa sin finalización en servidor | El cliente podría publicar cualquier MIME, tamaño o contenido; se perdería la validación con sharp y la re-codificación. |
| Firmar también el `upload` final (PUT a `world/…`) | Permitiría al cliente escribir directamente en el espacio publicado y saltarse la guarda 0007 y el pipeline. |
| Subida multipart en varias peticiones | Complejidad y estados intermedios no justificados para archivos de 10 MiB. |

## Consecuencias

### Positivas

- Se supera el límite de Vercel sin plan de pago y sin proxy intermedio.
- El binario no pasa por la función: menos memoria, menos tiempo de ejecución y
  menos coste.
- La validación real (MIME, dimensiones, tamaño, metadatos) sigue en servidor y
  el cliente no puede saltársela.
- La URL de subida caduca en 10 minutos y solo permite un `PUT` sobre una clave
  temporal concreta.

### Negativas y riesgos

- **Doble viaje:** el cliente sube a R2 y el servidor vuelve a descargar el
  temporal para procesarlo; consume una operación Class A y una Class B por
  subida.
- **El límite de la firma no es una garantía absoluta:** `ContentLength` y
  `ContentType` se incluyen en la firma, pero el límite real se vuelve a
  comprobar en `finalizeUpload`; una firma manipulada o un objeto antiguo no
  pueden saltarse esa comprobación.
- **Temporales abandonados:** si el cliente no llama a `finalizeUpload`, el
  temporal queda en `tmp/` hasta que el lifecycle lo purga (1 día recomendado).
- **No idempotente:** un reintento tras éxito devuelve `not_found`; el cliente
  debe tratar ese caso.
- **Dependencia de CORS:** R2 debe permitir `PUT` desde el origen de la
  aplicación; una mala configuración rompe la subida.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | No aplica: no hay interfaz en esta issue; la primera pantalla que sube assets llega con M1-03. |
| Temas (Claro/Oscuro) | No aplica: sin elementos visibles. |
| Accesibilidad | No aplica por ahora; el `alt` se valida en el servicio para cuando exista interfaz. |
| Seguridad y privacidad | Bucket privado, URL de `PUT` de corta duración y clave temporal, autorización previa a firmar, validación en servidor y guarda 0007. |
| Coste | 0 €/mes: una operación Class A y una Class B por subida dentro de los límites de R2 Free. |
| Portabilidad de datos | El temporal y el asset publicado viven en el mismo bucket; la exportación debe incluir los objetos o poder reconstruirlos. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Operaciones Class A | 1M/mes | Un `PUT` firmado y un `DELETE` por subida; sin reintentos automáticos | ADR 0013 |
| Operaciones Class B | 10M/mes | Una descarga del temporal y una lectura firmada; miniaturas para listados | ADR 0013 |
| Almacenamiento de temporales | 10 GB compartidos | Lifecycle de 1 día sobre `tmp/` y `_smoke/`; borrado explícito en `finalizeUpload` | `docs/almacenamiento.md` |
| Límite de Vercel | 4,5 MB de cuerpo | La subida directa evita enviar el binario por la función | ADR 0005 |
| Fallo de `finalizeUpload` | Objetos huérfanos | La compensación borra lo publicado si no hay fila; el lifecycle limpia lo demás | Servicio de assets |

## Plan de revisión

Se revisa si R2 cambia el soporte de URLs prefirmadas o CORS, si Vercel amplía el
límite de cuerpo de las funciones, si aparece una subida multipart real (>100
MiB) o si se añade un CDN. Cualquier cambio en el flujo de subida exige un ADR
nuevo que superseda a este.

## Referencias

- Issue: [#40](https://github.com/gonzalitojh/world-craft/issues/40)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D6 y §3.4
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-019
- [ADR 0004](0004-cloudflare-r2-storage-adapter.md): R2 y `StorageAdapter`
- [ADR 0019](0019-database-schema-migrations-and-rls.md): esquema y migración 0007
- [`docs/almacenamiento.md`](../almacenamiento.md): guía operativa
- Documentación de Cloudflare R2 sobre URLs prefirmadas y CORS, consultada el
  17/11/2026.
