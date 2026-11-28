# Spike M2-01 — MapLibre, Terra Draw y exportación SVG

> **Estado:** cerrado el 28/11/2026 con **GO con límites** ([ADR 0033](../adr/0033-spike-mapas-m2-01.md),
> D-057). El prototipo es **interno** y no es una funcionalidad de producto.
> **Ámbito:** validar MapLibre GL JS 6 + Terra Draw 1, la exportación SVG/PNG y el
> rendimiento con 500 elementos en Electron/Windows antes de abrir el editor de
> mapas (M2-02).
> **Evidencia:** [`tasks/task-issue-80.json`](../../tasks/task-issue-80.json) y los
> E2E de `tests/e2e/maps-spike*.spec.ts`.

## 1. Pregunta y criterios

El [ADR 0008](../adr/0008-maplibre-terra-draw-react-flow-elk.md) eligió MapLibre
y Terra Draw, pero exigió un spike antes de comprometer el editor. M2-01 debía
responder a cuatro preguntas:

1. ¿El motor arranca en el build real de Electron con `file://`, CSP estricta,
   worker local y sin red?
2. ¿Terra Draw cubre punto, línea, polígono, rectángulo, círculo, selección,
   edición de vértices y borrado con 500 elementos?
3. ¿Un serializador SVG propio produce un archivo válido, legible y pequeño, y
   el PNG del canvas es utilizable?
4. ¿Se cumplen los umbrales de rendimiento y tamaño sin comprometer los dos
   temas, la accesibilidad ni la ventana de escritorio?

Los umbrales aprobados en el plan de la issue son:

| Métrica | Umbral | Comprobación |
|---|---:|---|
| Carga de 500 features | ≤ 1.500 ms | `loadMs` |
| Paneo, percentil 95 | ≤ 33 ms | `panP95Ms` |
| SVG, tiempo | ≤ 2.000 ms | `svgMs` |
| SVG, tamaño | ≤ 5 MiB | `svgBytes` |
| PNG, tiempo | ≤ 1.000 ms | `pngMs` |
| Chunk diferido del laboratorio | ≤ 600 KiB gzip | `verify:build` |
| Long tasks durante la medición | 0 | `longTasks` |

No hay umbral fijado para la edición ni para el tamaño del PNG: se registran como
referencia.

## 2. Método reproducible

- **Ruta interna.** El prototipo se abre solo con `#/internal/maps-spike`. No
  aparece en el rail, la paleta, `lastView` ni el manual, y no se enlaza desde
  ninguna pantalla de producto.
- **Build real.** Se ejecuta sobre `pnpm build` y el binario de Electron, no
  sobre el servidor de desarrollo. El worker de MapLibre se emite junto al
  renderer y se carga por `file://` con `?worker&url` y `setWorkerUrl`.
- **Datos deterministas.** El botón de 500 genera siempre la misma colección con
  la semilla `wc-80`: 250 regiones (polígonos, rectángulos y círculos), 170
  caminos y 80 lugares. No se descargan tiles ni datos.
- **Carga.** Se mide con `performance.now()` alrededor de `draw.clear()`,
  `draw.setMode('select')` y `draw.addFeatures(...)`. **No incluye** el tiempo de
  generación determinista.
- **Paneo.** Tres pasadas de 480 ms con `panBy` alternando ±80 px y easing
  lineal; se recogen las duraciones de frame con `requestAnimationFrame` y se
  calcula el percentil 95 por rango más próximo. Con
  `prefers-reduced-motion: reduce` no se anima el paneo y su medición queda
  deshabilitada (el resto del informe sigue disponible).
- **SVG y PNG.** El SVG se serializa con el viewport actual, las capas visibles,
  `bearing`/`pitch` a 0 y sin copias del mundo; el PNG se captura del canvas con
  `toBlob`. **Las tres pasadas comparten** las mediciones de SVG, PNG y edición.
- **Edición.** Se mide `updateFeatureGeometry` sobre una **feature temporal** de
  tipo punto; no es un arrastre manual de vértices.
- **Informe.** El panel genera un informe JSON y otro Markdown con semilla,
  entorno, tres pasadas, medianas, umbrales y decisión. El informe declara en
  `limitations` las tres salvedades anteriores. No se versiona un JSON de
  resultados: la evidencia queda transcrita aquí y en el task file.
- **Repetición.** La tabla siguiente agrega los rangos observados en las
  ejecuciones de implementación y de re-QA en el mismo equipo; no es un único
  informe con tres pasadas.

## 3. Entorno

| Dato | Valor |
|---|---|
| Sistema | Windows 11 |
| Equipo | Snapdragon X2 Plus, 10 núcleos |
| GPU | Adreno X2-45 |
| Memoria | 16 GB |
| Electron | 45.3.4 |
| Lienzo | Variable con el ancho y el rail: 719×335 px a 1024, 648×399 a 1280 y 931×449 a 1600 |

El informe recoge `userAgent`, `hardwareConcurrency`, `devicePixelRatio` y el
tamaño del canvas. No se envían datos a ningún servicio.

## 4. Resultados

| Métrica | Umbral | Medición | Resultado |
|---|---:|---:|---|
| Carga de 500 | ≤ 1.500 ms | 46–63 ms | Cumple |
| Paneo p95 | ≤ 33 ms | 16,8–16,9 ms | Cumple |
| Edición (geometría temporal) | Sin umbral | 4,1–15,6 ms | Referencia |
| Long tasks | 0 | 0 | Cumple |
| SVG, tiempo | ≤ 2.000 ms | 13,7–23,6 ms | Cumple |
| SVG, tamaño | ≤ 5 MiB | 141–144 kB | Cumple |
| PNG, tiempo | ≤ 1.000 ms | 60–84 ms | Cumple |
| PNG, tamaño | Sin umbral | 319–327 kB | Referencia |
| Chunk diferido | ≤ 600 KiB gzip | 335–337 KiB gzip | Cumple |
| Worker de MapLibre | Sin umbral | ≈156 KiB gzip | Referencia |

Los valores son rangos de las ejecuciones registradas, no medianas de un único
informe. La carga queda muy por debajo del umbral porque **excluye** la
generación; la edición también es optimista porque usa una feature temporal.

## 5. Calidad de SVG y PNG

- **SVG propio.** XML válido, determinista, sin HTML ni contenido remoto. Usa
  Web Mercator (`512·2^z`), el viewport actual, `renderWorldCopies` desactivado,
  orden `regions` → `paths` → `places`, agujeros con `evenodd` y estilos de las
  capas. **No incluye etiquetas** en v1: es un límite declarado.
- **Fidelidad.** El SVG reproduce las tres capas y los estilos básicos; el PNG
  reproduce solo el canvas de MapLibre, sin los controles DOM superpuestos. El
  PNG pesa más porque rasteriza, no porque el SVG pierda capas.
- **Comparación.** Los archivos exportados se validaron como SVG/PNG legibles y
  los E2E comprueban las cinco geometrías, el arrastre de un vértice y la
  selección sobre el mapa.

## 6. Verificación

- Typecheck, lint y build en verde.
- 852 pruebas unitarias (5 omitidas), 308 de componentes y 265 de integración
  (1 omitida).
- `verify:build` en verde, con el worker emitido, CSP local y sin URLs remotas
  más allá de los literales inertes permitidos.
- 6 E2E del laboratorio en verde:
  [`maps-spike.spec.ts`](../../tests/e2e/maps-spike.spec.ts) (arranque, worker y
  sin red), [`maps-spike-lab.spec.ts`](../../tests/e2e/maps-spike-lab.spec.ts)
  (dibujo, 500, métricas y exportación),
  [`maps-spike-geometry.spec.ts`](../../tests/e2e/maps-spike-geometry.spec.ts)
  (línea, rectángulo, círculo y vértice),
  [`maps-spike-layers.spec.ts`](../../tests/e2e/maps-spike-layers.spec.ts)
  (importación atómica, capas y vaciado),
  [`maps-spike-export.spec.ts`](../../tests/e2e/maps-spike-export.spec.ts)
  (guardado sin rutas) y
  [`maps-spike-layout.spec.ts`](../../tests/e2e/maps-spike-layout.spec.ts)
  (layout, temas, axe y movimiento reducido).
- Layout 1024/1280/1600 px × Claro/Oscuro × rail expandido/plegado sin scroll
  horizontal de página; contraste AA y axe sin violaciones.
- Datos solo en `userData/data/spike-maps`; `lastView` intacto; ninguna petición
  HTTP durante las pruebas.

## 7. Límites

| Límite | Consecuencia | Tratamiento |
|---|---|---|
| SVG v1 sin etiquetas | No sirve como salida cartográfica completa | Añadir en M2-02 o declararlo en el producto |
| `Multi*` y `GeometryCollection` rechazados | No se importan ni editan | Aplanar o rechazar con mensaje en M2-02 |
| Polígonos con agujeros rechazados | Terra Draw no los admite | Igual que `Multi*`; la ayuda debe explicarlo mejor |
| Dibujo y selección con ratón | El teclado solo cubre pan/zoom | Deuda de accesibilidad para M2-02 |
| 500 validadas, 2.000 pendientes | El tope de importación no está medido | Medir antes de prometer 2.000 |
| `preserveDrawingBuffer` | Coste de memoria/GPU en el canvas | Evaluar alternativas al capturar PNG en M2-02 |
| Exportaciones acumulativas | Cada guardado deja un archivo nuevo sin retención | Añadir limpieza o cuota en una tarea futura |
| Aviso de Vite >500 kB | El chunk del laboratorio pesa 335–337 KiB gzip y activa el aviso | Por debajo del umbral de 600 KiB; dividir si crece |
| Redacción de rutas del informe | No cubre todas las formas de ruta (LOW) | Ampliar si el informe se comparte |
| Allowlist estática de hosts | `verify:build` deja de marcar literales de MapLibre (LOW) | Mantener la lista mínima y documentada |
| TOCTOU local del almacén | Ventana entre comprobación y escritura (LOW) | Sin vector desde el renderer; aceptado |

No se añaden datos de producto, migraciones, assets, copias ni preferencias. El
borrado total de Ajustes elimina `data/`, incluida la carpeta de exportaciones del
laboratorio.

## 8. Veredicto

**GO con límites.** Los cinco umbrales del plan se cumplen con margen, el motor
funciona sin red ni contenido remoto y el SVG propio es viable. Los límites son
conocidos y no bloquean M2-02, pero deben resolverse o declararse antes de
presentar el editor como terminado. El riesgo MEDIUM de la exclusión de
antigüedad de `maplibre-gl@6.20.0` queda aceptado y documentado en
`pnpm-workspace.yaml`; se reevalúa en M2-02.

## 9. Plan B

Si el motor, la CSP/worker, WebGL2, el rendimiento o la calidad SVG fallaran, el
plan B es un **editor SVG propio** sobre el mismo GeoJSON, sin MapLibre ni Terra
Draw, con controles propios de pan/zoom, dibujo y edición. **No se activa.** Si se
activara, exigiría un ADR nuevo y no se abriría M2-02 con MapLibre.

## 10. Referencias

- Issue: #80
- [`tasks/task-issue-80.json`](../../tasks/task-issue-80.json)
- [`docs/adr/0033-spike-mapas-m2-01.md`](../adr/0033-spike-mapas-m2-01.md)
- [`docs/adr/0008-maplibre-terra-draw-react-flow-elk.md`](../adr/0008-maplibre-terra-draw-react-flow-elk.md)
- [`docs/arquitectura.md`](../arquitectura.md), §2.22
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), §3.22
- [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md) y
  `resources/licenses/`
- `tests/e2e/maps-spike*.spec.ts`
