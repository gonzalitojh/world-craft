# ADR 0008 — MapLibre + Terra Draw y React Flow + ELK

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-028
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0006 y ADR 0007 de la etapa web
- **Relacionados:** ADR 0002, ADR 0006

## Contexto

World Craft necesita mapas vectoriales dibujables y un grafo de relaciones
navegable. En la etapa web ya se habían evaluado MapLibre + Terra Draw y React
Flow + ELK; el pivote no cambia la necesidad, pero sí el entorno: escritorio,
ratón, ventana y datos locales.

## Decisión

### Mapas

- **MapLibre GL JS** para render y navegación.
- **Terra Draw** para punto, línea, polígono, rectángulo, círculo, trazo libre,
  selección y edición de vértices.
- Datos en **GeoJSON** dentro del documento del mapa (capas + features).
- Exportación **SVG** con serializador propio sobre las capas GeoJSON y **PNG**
  con el canvas de MapLibre.
- Imagen raster de fondo opcional y georreferenciada.

### Grafo

- **React Flow 12** para nodos y aristas.
- **ELK.js** para layout automático.
- Nodos como componentes React (avatar, tipo, color, acciones).
- Filtros por tipo y etiqueta, expansión de vecinos y carga bajo demanda.
- Layout en Web Worker para no bloquear la UI.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| SVG propio para mapas | Sin herramientas de dibujo ni pan/zoom maduros; más trabajo. |
| Fabric.js | Buen canvas, pero menos datos vectoriales y exportación. |
| tldraw | Licencia y enfoque de pizarra, no de mapa. |
| Leaflet + Geoman | Menos rendimiento y menos control de capas vectoriales. |
| Cytoscape/Sigma | Mejor a gran escala, pero peor integración con React y nodos personalizados. |
| D3 puro | Mucho trabajo de interacción y accesibilidad. |

## Consecuencias

### Positivas

- Herramientas de dibujo y edición listas.
- Datos vectoriales portables.
- Nodos de grafo personalizados y accesibles.
- Sin dependencia de servicios de mapas.

### Negativas y riesgos

- El estilo de mapas fantásticos y la exportación SVG requieren trabajo.
- El rendimiento del grafo cae con miles de nodos.
- MapLibre y Terra Draw evolucionan; hay que fijar versiones.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Pan/zoom con ratón, atajos y paneles laterales. |
| Temas (Claro/Oscuro) | Estilos de mapa y nodos con tokens en ambos temas. |
| Accesibilidad | Controles de teclado, alternativas a arrastrar y texto en nodos. |
| Seguridad y privacidad | Sin tiles remotos obligatorios; datos locales. |
| Datos y preservación | GeoJSON y documento del mapa en SQLite; exportación. |
| Coste | 0 €/mes; librerías de código abierto. |
| Portabilidad de datos | GeoJSON, SVG y PNG. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Estilo de mapas | Trabajo de diseño | Spike con un mapa de ejemplo | M2 |
| Exportación SVG | Pérdida de fidelidad | Comparar SVG y PNG en pruebas | M2 |
| Grafos grandes | Rendimiento | Filtros, expansión y límite de nodos | M2 |

## Plan de revisión

Se revisa tras el spike de M2. Si la exportación SVG o el rendimiento no
cumplen, se valora un editor SVG propio o Cytoscape. Cualquier cambio de motor
exige un ADR nuevo.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D7–D8
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), mapas y relaciones
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-028
- Documentación de MapLibre, Terra Draw, React Flow y ELK consultada el 18/11/2026.
