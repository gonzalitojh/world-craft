# ADR 0033 — Spike de mapas M2-01: GO con límites para MapLibre y Terra Draw

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-28
- **Fecha del documento:** 2026-11-28
- **Issue:** #80
- **Decisiones del registro:** D-057
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0008, ADR 0004, ADR 0010

## Contexto

El [ADR 0008](0008-maplibre-terra-draw-react-flow-elk.md) eligió MapLibre GL JS y
Terra Draw para los mapas vectoriales, pero dejó la validación en un spike
temprano antes de comprometer el editor completo. La decisión dependía de que el
motor funcionara dentro de Electron con `file://`, contexto aislado, una CSP
estricta y sin red; de que Terra Draw cubriera dibujo y edición de las cinco
geometrías del alcance; y de que un serializador SVG propio produjera un archivo
útil con 500 elementos sin disparar el tiempo ni el tamaño.

M2-01 (#80) construyó un prototipo **interno**, accesible solo por el hash
`#/internal/maps-spike`, fuera del rail, la paleta, `lastView` y el manual. No es
una funcionalidad de producto: sirve para medir y decidir. Este ADR registra el
resultado y fija las restricciones con las que M2-02 puede abrir el editor.

## Decisión

**GO con límites.** MapLibre GL JS, Terra Draw y la exportación SVG propia son
viables en la aplicación de escritorio, con los límites que se enumeran abajo.
El ADR 0008 queda **validado**, no supersedido.

1. **Stack validado y fijado.** `maplibre-gl@6.20.0` (BSD-3-Clause),
   `terra-draw@1.40.0` (MIT) y `terra-draw-maplibre-gl-adapter@1.5.0` (MIT), en
   versiones exactas. Se declaran como dependencias de desarrollo porque Vite
   empaqueta su código en el renderer, igual que React; sus licencias viajan en
   `resources/licenses/` y en [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md).
2. **Base técnica para M2-02.** Worker de MapLibre local emitido con
   `?worker&url` y `setWorkerUrl`, bajo `worker-src 'self'`; `img-src ... blob:`
   solo para previsualizaciones locales; sin estilos, tiles, glifos ni sprites
   remotos. Mapa inline con tres capas 1:1 con la geometría (`regions` para
   polígonos, `paths` para líneas y `places` para puntos), Terra Draw con
   `point`, `linestring`, `polygon`, `rectangle`, `circle` y `select`, edición de
   vértices y coordenadas, borrado y vaciado. Importación y exportación GeoJSON
   atómicas por capa; SVG propio y PNG del canvas.
3. **SVG v1 y PNG.** El serializador es propio, determinista y sin HTML:
   Web Mercator (`512·2^z`), viewport actual, `bearing` y `pitch` a 0,
   `renderWorldCopies` desactivado, orden de capas, agujeros con `evenodd` y sin
   etiquetas. El PNG se captura del canvas de MapLibre con
   `preserveDrawingBuffer: true` y `toBlob`.
4. **Importación acotada.** Máximo 5 MiB y 2.000 features; se rechazan `Multi*`,
   `GeometryCollection` y polígonos con agujeros porque Terra Draw no los admite;
   se exigen coordenadas finitas y en rango; las propiedades se sanean y no se
   inyecta HTML. El lote es atómico: si una feature falla, no se aplica ninguna.
5. **Guardado acotado, solo para el laboratorio.** El canal
   `mapsSpike:saveExport` acepta únicamente el tipo y los bytes; el proceso
   principal decide la carpeta (`userData/data/spike-maps`), genera el nombre
   (`wc-m2-01-<kind>-<token>.<ext>`), valida con Zod, escribe con `wx` y no
   devuelve rutas al renderer. En modo seguro queda inerte. **No es un canal de
   producto**: M2-02 definirá su propia persistencia.
6. **Límites aceptados y trasladados a M2-02.** SVG v1 sin etiquetas; `Multi*` y
   agujeros no editables; dibujo y selección solo con ratón (el teclado cubre
   pan/zoom); 500 elementos validados y 2.000 pendientes de medir; coste de
   `preserveDrawingBuffer`; exportaciones acumulativas sin retención; aviso de
   Vite por chunk >500 kB; redacción de rutas del informe incompleta (LOW);
   allowlist estática de hosts de `verify:build` (LOW); TOCTOU local del almacén
   de exportaciones (LOW).
7. **Excepción de antigüedad de `maplibre-gl@6.20.0` (riesgo MEDIUM aceptado).**
   Se mantiene la versión aprobada y validada de extremo a extremo en el spike.
   `6.19.0` ya incluye los arreglos de `file://` y CJS, pero no se revalidó con
   Terra Draw, la CSP ni el worker. La exclusión está documentada en
   `pnpm-workspace.yaml` y se retira cuando la política de antigüedad considere
   madura la versión o, como muy tarde, al abrir M2-02. En M2-02 se evalúa bajar a
   `6.19.0` si `6.20.0` no aporta un arreglo imprescindible; si se baja, se
   revalida el spike y se elimina la exclusión.
8. **El prototipo no se publica como función.** Sigue oculto tras la ruta
   interna hasta que M2-02 lo sustituya; no aparece en navegación, paleta,
   `lastView` ni manual, y sus exportaciones son archivos de laboratorio.
9. **Plan B no activado.** Si el motor, la CSP/worker, WebGL2, el rendimiento o
   la calidad SVG fallaran, el plan B es un editor SVG propio. No se activa. Si
   se activara, exigiría un ADR nuevo y no se abriría M2-02 con MapLibre.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| **NO-GO** y plan B con editor SVG propio | Los umbrales se cumplen con margen y los límites son acotados; un editor propio añadiría pan/zoom, dibujo, selección y edición desde cero, con más riesgo y coste. Se conserva como plan B documentado. |
| Bajar de inmediato a `maplibre-gl@6.19.0` | `6.20.0` es la versión aprobada y validada en el spike; `6.19.0` incluye los arreglos de `file://` y CJS, pero no se revalidó. El riesgo de cadena de suministro se mitiga con lockfile, integridad y una exclusión documentada; la bajada se decide en M2-02. |
| Mantener MapLibre y sustituir Terra Draw por edición propia | Terra Draw cubrió las cinco geometrías y la edición de vértices; sustituirlo duplicaría trabajo sin una ganancia medida. |
| Presentar el prototipo como editor de producto | Le faltan etiquetas, edición de `Multi*` y agujeros, dibujo por teclado y la medición de 2.000; presentarlo como terminado rompería la Definition of Done y el manual. |
| Cambiar de motor (Leaflet + Geoman, Fabric.js, tldraw) | El plan ya los descartó por rendimiento, modelo de datos, licencia o enfoque; el spike no aportó evidencia nueva que reabra esa comparación. |

## Consecuencias

### Positivas

- El motor funciona en el build real de Electron con `file://`, worker local,
  CSP estricta y sin red.
- Las cinco geometrías, la edición de vértices y coordenadas y el borrado se
  validaron con 500 elementos.
- El SVG propio es válido, legible, determinista y pequeño (141–144 kB) frente
  al PNG (319–327 kB), con tiempos muy por debajo de los umbrales.
- La importación y la exportación GeoJSON son atómicas y acotadas, y el guardado
  no expone rutas al renderer.
- Los límites y el plan B quedan explícitos antes de abrir M2-02.
- Las licencias BSD-3 y MIT están completas; el coste sigue en 0 €/mes.

### Negativas y riesgos

- El SVG v1 no lleva etiquetas: M2-02 tendrá que añadirlas o declarar el límite
  en el producto.
- `Multi*`, `GeometryCollection` y los polígonos con agujeros no son editables
  con Terra Draw; M2-02 debe decidir si los aplana, los rechaza o los edita en
  otra capa.
- El dibujo y la selección exigen ratón; el teclado solo cubre pan/zoom. Es una
  deuda de accesibilidad para el editor.
- La carga de 2.000 está pendiente; el límite de importación no está avalado por
  una medición.
- `preserveDrawingBuffer` tiene coste y las exportaciones se acumulan sin
  retención.
- La excepción de antigüedad de `maplibre-gl@6.20.0` es un riesgo MEDIUM de
  cadena de suministro, aceptado con lockfile e integridad exactos.
- El chunk diferido del laboratorio pesa 335–337 KiB gzip y provoca el aviso de
  Vite de chunk >500 kB, aunque queda por debajo del umbral de 600 KiB del plan.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Layout comprobado a 1024, 1280 y 1600 px, con rail expandido y plegado, sin scroll horizontal; el lienzo varía con el ancho y el rail (719×335, 648×399 y 931×449). El dibujo y la selección son de ratón. |
| Temas (Claro/Oscuro) | Estilos de mapa, Terra Draw y panel de métricas con tokens en ambos temas; cambiar de tema no recrea el mapa. Contraste AA y sin elementos invisibles. |
| Accesibilidad | axe sin violaciones en el laboratorio; foco visible, controles etiquetados, canvas con `aria-describedby` y pan/zoom por teclado. El dibujo y la selección por ratón quedan como límite declarado. |
| Seguridad y privacidad | Worker local, CSP con `worker-src 'self'` e `img-src ... blob:`, sin contenido remoto ni peticiones HTTP; IPC con allowlist, Zod, nombre generado y carpeta acotada; modo seguro inerte. Riesgos LOW/MEDIUM aceptados y documentados. |
| Datos y preservación | Sin cambios en SQLite, assets, copias ni preferencias. El GeoJSON vive en memoria y las exportaciones solo en `userData/data/spike-maps`; el borrado total elimina `data/`. |
| Coste | 0 €/mes; tres librerías de código abierto y ninguna tile, cuenta ni servicio externo. |
| Portabilidad de datos | GeoJSON por capas, SVG propio y PNG; formatos abiertos y locales. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Dependencia de un servicio de mapas | No aplica: no se usan tiles, estilos, glifos ni cuentas remotas; todo es local. | Estilo propio y worker empaquetado. | — |
| Evolución de MapLibre y Terra Draw | Versiones exactas y lockfile; actualizar exige revalidar CSP, worker y SVG. | Fijar versiones y revisar en M2-02. | M2-02 |
| `maplibre-gl@6.20.0` recién publicado | Riesgo MEDIUM de cadena de suministro aceptado. | Lockfile con integridad, exclusión documentada y bajada evaluada en M2-02. | M2-02 |
| Fidelidad SVG sin etiquetas | Límite funcional, no de coste. | Declararlo y añadir etiquetas en M2-02. | M2-02 |
| Rendimiento con 2.000 | Sin medir; 500 sí validado. | Medir antes de prometer el límite. | M2-02 |

## Plan de revisión

- **M2-02 (editor de mapas)** reabre esta decisión para añadir etiquetas, decidir
  el tratamiento de `Multi*` y agujeros, medir 2.000, resolver el teclado y
  definir la persistencia de producto.
- La **exclusión de `maplibre-gl@6.20.0`** se retira cuando la política de
  antigüedad la considere madura o, como muy tarde, al abrir M2-02. Si se baja a
  `6.19.0`, se revalida el spike antes de quitar la exclusión.
- Un cambio de motor, de CSP, de worker o del modelo de datos de mapas exige un
  ADR nuevo; este ADR no se edita para cambiar la decisión.
- El plan B (editor SVG propio) solo se activa si falla el motor, la CSP/worker,
  WebGL2, el rendimiento o la calidad SVG, y también exige un ADR nuevo.

## Referencias

- Issue: #80
- [`tasks/task-issue-80.json`](../../tasks/task-issue-80.json): plan, evidencia de
  QA y seguridad y resultados.
- [`docs/mapas/spike-m2-01.md`](../mapas/spike-m2-01.md): método, métricas,
  umbrales, límites y veredicto.
- [`docs/adr/0008-maplibre-terra-draw-react-flow-elk.md`](0008-maplibre-terra-draw-react-flow-elk.md),
  D-028: elección del motor que este spike valida.
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-057.
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D7 y §4.6.
- [`docs/arquitectura.md`](../arquitectura.md), §2.22.
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), §3.22.
- [`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md) y
  `resources/licenses/`.
- Documentación oficial de MapLibre GL JS 6.20.0 y Terra Draw 1.40.0 consultada
  el 28/11/2026.
