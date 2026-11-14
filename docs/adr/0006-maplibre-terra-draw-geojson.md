# ADR 0006 — MapLibre, Terra Draw y GeoJSON

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-003
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0004, ADR 0007, ADR 0010

## Contexto

Los mapas son el diferenciador visual de World Craft: deben permitir dibujar
formas, líneas, puntos y etiquetas, vincular elementos a fichas y exportar el
resultado sin depender de un proveedor de teselas de pago. También debe poder
usarse una imagen raster de fondo opcional para calcar o completar un mapa
dibujado a mano.

## Decisión

1. **Motor:** MapLibre GL JS con Terra Draw y datos en **GeoJSON**.
2. **Documento de mapa:** un JSON por mapa con capas y un `FeatureCollection`;
   coordenadas locales (lng/lat) sobre un mundo ficticio.
3. **Vínculos:** cada feature puede llevar `entityId`; la tabla
   `map_entity_links` relaciona mapa, entidad y feature para consultas inversas.
4. **Fondo raster:** opcional y georreferenciado mediante bbox, en una capa de
   tipo `image`. El mapa sigue siendo vectorial por defecto.
5. **Exportación:** SVG con un serializador propio sobre las capas GeoJSON y PNG
   con el canvas de MapLibre.
6. **Puerta técnica:** el spike M2-01 valida dibujo, rendimiento, gestos y
   exportación antes de comprometer el editor completo.
7. **Plan B:** si el spike falla, editor SVG propio con `d3-zoom` y
   `perfect-freehand`.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| SVG propio | Control total y exportación trivial, pero sin pan/zoom, gestos ni rendimiento nativo para muchos elementos. |
| Fabric.js | Buen editor de canvas, pero peor encaje con datos GeoJSON y con el rendering vectorial de mapas. |
| tldraw | Excelente pizarra, pero licencia y modelo de datos no encajan con mapas georreferenciados. |
| Leaflet + Geoman | Sólido, pero rendering raster y menos libertad para estilos y capas vectoriales avanzadas. |
| Teselas de pago | Rompe el objetivo de coste cero y añade dependencia externa. |

## Consecuencias

### Positivas

- Datos vectoriales nativos, exportables y portables.
- Terra Draw aporta herramientas de dibujo y edición de vértices listas.
- MapLibre renderiza con WebGL y soporta gestos táctiles y capas.
- El fondo raster opcional cubre el caso de mapas dibujados a mano.

### Negativas y riesgos

- La exportación SVG y el estilo de mapas fantásticos requieren trabajo propio.
- El rendimiento en móvil depende del número de features y del raster.
- El spike puede revelar que el plan B es necesario.
- La georreferenciación del raster añade complejidad de edición.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Controles táctiles grandes, toolbar inferior y panel de capas en drawer; edición completa en escritorio. |
| Temas (Claro/Oscuro) | Estilos de mapa con tokens y contraste comprobado en ambos temas. |
| Accesibilidad | Controles con etiqueta, foco visible, atajos documentados y alternativa de lista de elementos. |
| Seguridad y privacidad | El raster vive en R2 privado y se sirve con URL firmada. |
| Coste | Sin proveedor de teselas de pago; raster del usuario en R2. |
| Portabilidad de datos | GeoJSON y JSON de capas son formatos abiertos y exportables. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Teselas o estilos de pago | No se contratan | Estilo propio, datos abiertos y raster del usuario en R2 | ADR 0004 |
| Peso del raster | 10 GB de R2 | WebP, límite de 4096 px y miniaturas | ADR 0004 |
| Rendimiento en móvil | Límites del dispositivo | Límite de features por capa, simplificación, `maxzoom`/`minzoom` y modo lectura | M2-02 (#18) |
| Complejidad del editor | Riesgo de alcance | Spike M2-01 como puerta y plan B SVG | M2-01 (#17) |

## Plan de revisión

Se revisa al cerrar el spike M2-01, si cambia el rendimiento en móvil o si se
necesita un proveedor de teselas. Un cambio de motor de mapas exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D8
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-003
- Documentación oficial de MapLibre GL JS y Terra Draw, consultada el 12/11/2026.
