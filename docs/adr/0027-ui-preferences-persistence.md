# ADR 0027 — Preferencias de interfaz persistentes

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-23
- **Fecha del documento:** 2026-11-24
- **Issue:** #132 (`M1.5`), dentro del epic #123 (`M1.5-00`)
- **Decisiones del registro:** D-050
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0004, ADR 0006, ADR 0016, ADR 0021, ADR 0025
- **Consumidor previsto:** Ajustes (#79)
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-23/24) y PASS de
  `security-champion` con 0 HIGH (2026-11-24)

## Contexto

El tema, la barra lateral, el panel de propiedades, su ancho, las secciones de la
ficha y el último mundo o ficha de «Continuar» vivían en memoria desde #126–#131.
Al cerrar o recargar la aplicación se perdían: el tema volvía a Claro y el rail y
el panel arrancaban en su estado por defecto. La issue #132 pedía persistirlos sin
parpadeo, sin exponer canales inseguros y sin poner en riesgo los datos de
dominio.

La base ya tenía `app_settings` desde `0000_init`, sin uso de producto. El
renderer no puede acceder a SQLite ni a Node (ADR 0004), así que la lectura y la
escritura tenían que pasar por la allowlist IPC y el preload. Además, el tema
debía estar fijado **antes del primer pintado**: si el renderer esperaba al IPC
después de montar React, aparecía un destello Claro al abrir en Oscuro, y el fondo
nativo de la ventana podía quedar desincronizado.

Había tres decisiones de producto abiertas:

1. si la aplicación debía restaurar automáticamente la última vista;
2. cómo exponer el restablecimiento sin una pantalla de Ajustes todavía;
3. qué hacer si una preferencia guardada es inválida o la escritura falla.

El usuario aprobó abrir siempre en Inicio, exponer el restablecimiento solo por
API hasta Ajustes (#79) y degradar en silencio sin bloquear el arranque.

## Decisión

1. **Claves `ui.*` en `app_settings`, una fila por preferencia y valor JSON.**
   `ui.theme` (`light`/`dark`), `ui.rail-collapsed` (booleano), `ui.entity-view`
   (panel visible, ancho entero de 280 a 360 px con 320 por defecto y las cuatro
   secciones), `ui.last-view` (`home`, `worlds`, `search`, `world`, `entities` o
   `entity`, nunca `samples`) y `ui.recent-location` (mundo o ficha con nombre
   opcional). El prefijo queda reservado por completo a las preferencias de
   interfaz. No hay migración nueva.
2. **Tres canales nominativos: `preferences:get`, `preferences:update` y
   `preferences:reset`.** El parche se valida con Zod estricto y no puede estar
   vacío; el servicio lo revalida aunque el router ya lo haya hecho. El preload
   publica `window.worldCraft.preferences` congelado y comprueba cada snapshot con
   `isUiPreferences`. Sin `sendSync`, `invoke` genérico, canales dinámicos,
   `localStorage` ni acceso del renderer a Node.
3. **Bootstrap antes del primer pintado.** El proceso principal lee el tema antes
   de crear la ventana y aplica `nativeTheme` y el `backgroundColor` exactamente
   igual a `--bg` (`#f6f4ef` en Claro y `#141715` en Oscuro). La ventana nace
   oculta y se muestra cuando coinciden `ready-to-show` y `did-finish-load`, con
   un límite de 2.500 ms. El renderer lee el snapshot antes de `createRoot`, fija
   `data-theme` y descarta una respuesta tardía tras 1.500 ms; bajo `StrictMode`
   hay una sola lectura efectiva y un solo commit inicial.
4. **Reset limitado al prefijo `ui.`.** `DELETE ... WHERE key GLOB 'ui.*'`
   sensible a mayúsculas, seguido de los valores por defecto. No toca claves no-UI
   de `app_settings`, mundos, fichas, imágenes, relaciones, copias ni
   `schema_migrations`. Se adopta en caliente, sin recargar ni cerrar diálogos.
   **No tiene control visible**: llegará con Ajustes (#79).
5. **No se restaura la vista.** La aplicación abre siempre en Inicio. `lastView`
   se guarda como preferencia, pero nunca navega ni toca el hash. «Continuar»
   retoma el último mundo o ficha, se valida contra la biblioteca, se limpia al
   borrar el destino y degrada al mundo con el aviso existente si la ficha
   desapareció.
6. **Lectura tolerante y escritura transaccional.** Leer no crea filas, no repara
   y no reescribe; cada clave inválida cae a su defecto sin contagiar al resto. Se
   escribe solo lo que cambia, con `updated_at`, en una transacción.
   `recentLocation: null` borra la fila.
7. **Fallo de escritura silencioso.** El renderer conserva el estado optimista de
   la sesión y el tema ya aplicado; no hay toast, anuncio ni estado de
   «guardando». El tema se aplica a `nativeTheme` y al fondo aunque la persistencia
   falle, también en modo seguro.
8. **Modo seguro sin persistencia simulada.** Sin base, la lectura devuelve los
   valores por defecto, la escritura falla de forma estable y el cromo conserva el
   último tema aplicado durante la sesión (`lastAppliedTheme`).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Una única clave JSON con todo el snapshot | Un valor corrupto invalida todas las preferencias, no hay `updated_at` por preferencia y cada cambio reescribe el bloque completo. Las claves separadas aíslan el fallo y permiten evolucionar sin migrar. |
| Pasar el estado inicial por `webPreferences.additionalArguments` o variables de entorno | Acopla el arranque a la cadena de argumentos, no se valida como un contrato tipado y queda obsoleto en cuanto cambia el tema durante la sesión. |
| Leer el tema de un parámetro de la URL del renderer | Contamina la navegación y el hash interno, no hay validación en el main y rompe la separación entre datos y ubicación. |
| Inyectar un script inline con el tema en `index.html` | La CSP de producción prohíbe el inline; además abre una superficie de inyección y duplica la fuente de verdad. |
| `ipcRenderer.sendSync` para tener el tema antes de pintar | Bloquea el proceso principal, no tiene timeout y va contra el IPC asíncrono tipado del ADR 0004. |
| `localStorage` en el renderer | El renderer no puede ser la fuente de verdad, no entra en las copias ni en la restauración, no se valida en el main y duplicaría el estado de la base. |
| Restaurar la última vista al arrancar | Navegación implícita y difícil de deshacer, sin router todavía; el usuario aprobó abrir en Inicio y dejar la reanudación explícita en «Continuar». |
| Guardar en un `config.json` aparte | Separa las preferencias de la base y de sus copias, rompe la atomicidad y obliga a una segunda capa de recuperación. |
| Exponer el reset con un botón provisional | No hay pantalla de Ajustes ni textos nuevos en el alcance; la API sola permite que #79 lo consuma sin duplicar lógica. |

## Consecuencias

### Positivas

- La interfaz arranca con el estado que el usuario dejó, sin destello y sin saltos
  de layout en el rail o el panel.
- Las preferencias entran en las copias automáticas y una restauración las
  recupera; no hace falta un formato de exportación nuevo.
- El reset es seguro por construcción: un prefijo reservado y una prueba de
  preservación impiden que borre datos de dominio.
- Ajustes (#79) reutiliza contrato, servicio y hook sin reimplementar validación,
  IPC ni persistencia.
- No hay dependencias, migraciones ni servicios nuevos; el coste sigue en 0 €/mes.

### Negativas y riesgos

- Una lectura con timeout puede caer en Claro aunque hubiera un tema guardado; es
  preferible a bloquear el arranque, pero conviene vigilar el rendimiento en
  equipos lentos.
- El estado es global: no se puede tener un panel distinto por ficha o por tipo.
  Es una decisión de producto explícita y coincide con #129.
- El ancho guardado no se aplica por debajo de 1180 px; al cambiar de tamaño hay
  que explicar que el panel se apila.
- El reset existe sin UI: un consumidor externo podría invocarlo sin diálogo. Solo
  borra `ui.*` y la API está aprobada como interna hasta Ajustes.
- El parseo de JSON en la lectura no tiene cota de tamaño previa; es un residual
  LOW local, no una superficie remota.
- Si en el futuro se añade el modo «sistema», habrá que revisar el contrato y este
  ADR.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Escritorio | La ventana sigue siendo 1280×800 con mínimo 1024×700; el fondo nativo coincide con `--bg`; el panel se apila a ≤ 1180 px y recupera el ancho guardado al ensanchar. |
| Temas (Claro/Oscuro) | El tema se aplica antes del primer pintado en `data-theme`, `nativeTheme` y el fondo; sin colores nuevos y con AA en ambos modos. |
| Accesibilidad | Sin controles ni textos nuevos; el foco y los patrones de teclado no cambian. No hay estado de «guardando» ni anuncio por un fallo de preferencias. |
| Seguridad y privacidad | Tres canales en allowlist, Zod estricto, guardas en el preload, sin `sendSync`, sin HTML dinámico, sin red y sin acceso del renderer a SQLite. |
| Datos y preservación | Sin migración; las preferencias viven en `app_settings`, entran en las copias y el reset solo borra `ui.*`. La exportación de un mundo no las incluye. |
| Coste | 0 €/mes: sin dependencias nuevas, servicios ni telemetría. |
| Portabilidad | Las preferencias son de aplicación y no viajan con un mundo; una instalación nueva empieza con los valores por defecto. |

## Riesgos y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Destello del tema al arrancar | Percepción visual | Tema en el main antes de la ventana, `data-theme` antes de `createRoot`, compuerta `ready-to-show` + `did-finish-load` y fallback | #132, #133 |
| Fondo de ventana desincronizado | Cromo y contenido con colores distintos | Constantes `#f6f4ef`/`#141715` y prueba unitaria que falla si no coinciden con `--bg` | #132 |
| Respuesta tardía que cambia el tema tras pintar | Parpadeo | Timeout de 1.500 ms, descarte de respuestas tardías y una sola lectura bajo `StrictMode` | #132 |
| Escritura fallida que revierte la sesión | Pérdida de la elección actual | Estado optimista, tema aplicado al cromo y fallo silencioso sin toast | #132 |
| Reset que borra datos de dominio | Pérdida grave | `GLOB 'ui.*'` sensible a mayúsculas y pruebas de preservación de mundos, fichas, assets, copias y migraciones | #132, #79 |
| Clave inválida que contamina el resto | Arranque incorrecto | Lectura tolerante por clave sin reparar ni reescribir | #132 |
| Panel a 360 px en ventana estrecha | Layout y scroll | Apilado a ≤ 1180 px sin aplicar el ancho guardado; recuperación al ensanchar; matriz 1024/1280/1600 | #132, #133 |
| Reset sin diálogo | Invocación por API | Solo por API hasta #79, limitado a `ui.*` y con decisión D2 aprobada | #79 |

No hay riesgos de free tier: la decisión no añade servicios, cuentas ni
dependencias de pago.

## Plan de revisión

- Se revisa si Ajustes (#79) añade el control de restablecimiento, el modo
  «sistema» o preferencias nuevas fuera del prefijo `ui.`.
- Se revisa si cambia el modelo de ventana (tamaño y posición) o el arranque sin
  ventana.
- La auditoría visual de #133 comprueba contraste, fondo de ventana y ausencia de
  destellos en ambos temas.
- Cualquier cambio de formato de las claves o del ámbito por ficha exige un ADR
  nuevo que superseda a este.

## Referencias

- Issue: #132
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md), §3.1, §9,
  §10.1, §10.2, §10.4, §10.7, §10.8 y §17
- [`docs/persistencia.md`](../persistencia.md), §3.4
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), §3.2
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), §3.18
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), §3.3, §3.5, §4.2, §5.2,
  §11, §12 y §17
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-050
- [`docs/adr/0004-electron-security-typed-ipc.md`](0004-electron-security-typed-ipc.md)
- [`docs/adr/0006-two-themes-desktop-design-system.md`](0006-two-themes-desktop-design-system.md)
- [`docs/adr/0025-visual-direction-v2.md`](0025-visual-direction-v2.md)
- Epic #123 y issues #129, #132, #79 y #133
- WCAG 2.2, criterios 1.4.3, 1.4.11 y 2.4.7, consultados el 24/11/2026.
