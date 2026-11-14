# ADR 0004 — Cloudflare R2 como almacenamiento principal con StorageAdapter

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-001
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0006, ADR 0013

## Contexto

World Craft guarda avatares, portadas, imágenes de fichas, fondos de mapas y
assets de manuscritos. Supabase Storage Free limita a 1 GB y el egreso puede
convertirse en un cuello de botella. El proyecto necesita más capacidad sin
coste y un acceso privado controlado por membresía.

## Decisión

1. **Proveedor:** Cloudflare R2 Free como almacenamiento principal de todos los
   assets. Supabase Storage no se usa en producción.
2. **Abstracción:** interfaz `StorageAdapter` con `upload`, `getSignedUrl`,
   `delete` y `list`; implementación R2 y adaptador local para desarrollo y
   tests.
3. **Privacidad:** bucket privado. El servidor comprueba la membresía del mundo
   antes de firmar una URL de corta duración. Las claves S3 solo viven en el
   servidor.
4. **Organización:** prefijos `world/{worldId}/...` y nombres con UUID.
5. **Imágenes:** compresión a WebP, límite de 4096 px en el lado mayor para
   fondos de mapa, miniaturas generadas, validación de MIME real y tamaño, y
   re-codificación para eliminar metadatos.
6. **Operación:** borrado de huérfanos, CORS restringido y reglas de ciclo de
   vida.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Supabase Storage | Solo 1 GB en Free; insuficiente para mapas, portadas y assets de manuscritos. |
| Amazon S3 | Egreso y configuración con coste; R2 ofrece egreso gratis. |
| Almacenamiento local en Vercel | El sistema de archivos de las funciones no es persistente. |
| Vercel Blob | Límites y coste fuera del objetivo de 0 €/mes. |

## Consecuencias

### Positivas

- 10 GB y egreso gratis cubren el uso personal previsto.
- El bucket privado y las URLs firmadas mantienen el contenido inaccesible sin
  permiso.
- `StorageAdapter` permite desarrollo local, tests y una migración futura sin
  tocar los módulos de dominio.
- La re-codificación reduce peso, metadatos y superficie de ataque.

### Negativas y riesgos

- Requiere configuración S3-compatible y gestión de claves en servidor.
- Un fallo de R2 deja sin imágenes a la aplicación; el texto sigue disponible.
- La limpieza de huérfanos y el ciclo de vida añaden operación.
- La exportación de un mundo debe incluir los assets o poder reconstruirlos.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Imágenes con `next/image`, `sizes` correctos y placeholder. |
| Temas (Claro/Oscuro) | Las imágenes no dependen del tema; los placeholders usan tokens. |
| Accesibilidad | Texto alternativo obligatorio y contraste de las imágenes de fondo controlado. |
| Seguridad y privacidad | Bucket privado, comprobación de membresía, URLs cortas y claves solo en servidor. |
| Coste | 0 €/mes dentro de los límites de R2 Free. |
| Portabilidad de datos | Assets incluidos en la exportación del mundo o re-subibles desde ella. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Capacidad | 10 GB | WebP, límite de dimensiones, purga de huérfanos y revisión mensual | ADR 0013; M0-10 (#40) |
| Operaciones | 1M Class A y 10M Class B al mes | Caché de URLs firmadas, miniaturas y evitar listados frecuentes | ADR 0013 |
| Egreso | Gratis en R2 | Sin coste previsto; se monitoriza igualmente | ADR 0013 |
| Pérdida o fuga de claves | Riesgo alto | Claves solo en el servidor, `.env*` fuera de git y gitleaks | M0-05 (#6) y M5-05 (#32) |

## Plan de revisión

Se revisa si se supera el 70 % de capacidad u operaciones, si R2 cambia sus
condiciones o si se añade un proveedor de CDN. Cualquier cambio de proveedor de
almacenamiento exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D6, §3.4 y §3.7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-001
- Documentación oficial de Cloudflare R2, consultada el 12/11/2026.
