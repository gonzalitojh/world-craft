# ADR 0005 — Assets locales y protocolo `wc-asset://`

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-022
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0004 y ADR 0020 de la etapa web (Cloudflare R2)
- **Relacionados:** ADR 0002, ADR 0004, ADR 0012, ADR 0017

## Contexto

Las fichas, mapas y escenas usan imágenes y documentos. En una aplicación de
escritorio no hay bucket remoto ni URLs firmadas: los archivos viven en el
equipo del usuario. El renderer no puede recibir rutas absolutas ni usar
`file://`, y la importación/exportación debe seguir siendo portable.

## Decisión

1. Los assets viven en `%APPDATA%\World Craft\assets\worlds\<worldId>\<assetId>.<ext>`.
2. La base de datos guarda solo la **ruta relativa**, el MIME real, el tamaño,
   las dimensiones y el hash.
3. El renderer carga con `wc-asset://asset/<assetId>`; el protocolo:
   - resuelve el asset en la base,
   - normaliza la ruta,
   - comprueba que el destino sigue dentro de `assets/`,
   - sirve el archivo con su MIME y cabeceras seguras.
4. Las imágenes se validan por contenido, se re-codifican a WebP y generan
   miniatura.
5. Los archivos huérfanos se listan y se purgan solo con confirmación.
6. La exportación copia los assets con rutas relativas y checksums.

> **Implementación:** el «cómo» de esta decisión (sharp, tabla `assets`, límites,
> miniatura derivada y purga recuperable) se documenta en el
> [ADR 0017](0017-assets-service-sharp-orphan-purge.md), que no cambia lo aquí
> decidido. La importación y la galería visibles llegan en M1.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `file://` directo | Permite rutas arbitrarias y rompe el aislamiento del renderer. |
| Servir por HTTP local | Puerto, CORS y otra superficie de ataque; no aporta. |
| Guardar imágenes como BLOB en SQLite | Base enorme, copias lentas y peor rendimiento. |
| Cloudflare R2 u otro bucket | Requiere red, cuenta y credenciales; el producto es local. |
| Data URLs en el renderer | Memoria y tamaño; no sirve para archivos grandes. |

## Consecuencias

### Positivas

- El renderer nunca ve rutas absolutas.
- Los assets se copian y exportan con la base.
- Las imágenes se optimizan y se validan.
- Funciona sin conexión.

### Negativas y riesgos

- Hay que implementar y probar el protocolo con cuidado.
- Los archivos pueden perderse si el usuario borra la carpeta a mano.
- La re-codificación consume CPU en importaciones grandes.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Carga de imágenes sin diálogos del sistema. |
| Temas (Claro/Oscuro) | Las imágenes funcionan en ambos; los placeholders usan tokens. |
| Accesibilidad | `alt` obligatorio en imágenes de contenido. |
| Seguridad y privacidad | Validación de ruta, MIME y tamaño; sin red. |
| Datos y preservación | Assets incluidos en copias completas y exportaciones. |
| Coste | 0 €/mes. |
| Portabilidad de datos | ZIP con `assets/` y manifiesto. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Path traversal | Acceso fuera de `assets/` | Normalización y comprobación de prefijo | Security review |
| Archivo malicioso | MIME falso | Validación por contenido y re-codificación | Importación M1 |
| Crecimiento de assets | Disco del usuario | Límites, miniaturas y purga guiada | M5 |

## Plan de revisión

Se revisa si aparece una necesidad real de cifrado de assets, de almacenamiento
externo o de sincronización. Cualquier cambio de protocolo o de formato exige
un ADR nuevo y una migración.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D6 y §3.5
- [`docs/persistencia.md`](../persistencia.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-022
- Documentación del protocolo personalizado de Electron consultada el 18/11/2026.
