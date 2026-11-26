# Arquitectura de World Craft

> **Estado:** vigente desde el 18/11/2026, tras el pivote a aplicación de
> escritorio. Actualizado el 25/11/2026 con la exportación e importación de
> mundos (#78); la dirección visual v2 llegó con tokens, tipografía y primitivas
> (#125) y shell, navegación y barra superior (#126).
> Sustituye por completo la arquitectura web anterior.
> **Ámbito:** procesos, módulos, flujos, datos y límites de confianza.
> **Fuentes:** [`docs/plan-desarrollo.md`](plan-desarrollo.md) §3,
> [`docs/adr/`](adr/README.md) y el código de `src/`.

Este documento explica **cómo está organizada la aplicación** y **por dónde pasa
una operación**. No sustituye al plan ni a los ADRs: el plan define el alcance y
los ADRs el porqué de cada decisión. Si hay discrepancia, mandan ellos.

En la fase actual el repositorio contiene el **scaffold de escritorio** (#62), el
**IPC tipado** (#63), la **persistencia local** (#64), el **sistema de diseño con
shell de escritorio** (#65), el **servicio de assets locales con
`wc-asset://`** (#66), las **copias de seguridad con restauración desde modo
seguro** (#67), el **instalador NSIS con actualizador manual** (#68), los
**mundos con CRUD, mesa de trabajo de Inicio y actividad** (#72, #127), los **tipos de entidad con
catálogo y campos personalizados** (#73), las **fichas con imágenes, etiquetas,
favoritos y editor enriquecido** (#74), las **relaciones tipadas con backlinks**
(#75), la **búsqueda global con paleta de comandos** (#76), la **papelera con
versiones de contenido** (#77), la **exportación e importación de mundos**
(#78), la **pantalla de Ajustes y datos** (#79) y la **descripción enriquecida
del mundo con el editor compartido** (#114): ventana Electron segura, preload
nominativo, renderer React con tokens,
componentes base y navegación, base SQLite con migraciones, comprobación de
integridad y modo seguro, servicio de imágenes con protocolo propio, miniaturas
y purga recuperable, copias automáticas con retención, verificación y
restauración, instalación por usuario sin administrador, actualizaciones
manuales, cancelables y consentidas, bloqueo de instancia única, gestión de
mundos con su actividad, tipos de entidad con plantillas, transferencia e índice
FTS5, y un ZIP abierto con manifiesto, contenido JSON y assets verificado con
SHA-256. La dirección visual v2 ya cubre tokens, tipografía y primitivas (#125),
el **shell v2 con navegación de producto y barra superior contextual** (#126) e
**Inicio como mesa de trabajo con tarjetas de mundo** (#127). La galería visible
está implementada desde #74 y la pantalla de Ajustes con la gestión de datos desde
#79; las copias manuales y la restauración guiada desde Ajustes siguen previstas;
la release pública y la actualización real contra GitHub Releases, en M5.
Las secciones distinguen lo implementado de lo previsto.

## 1. Vista general

```text
┌──────────────────────────────────────────────────────────────────┐
│ Proceso principal de Electron                                     │
│  ventana · SQLite · assets · backups · papelera · updates         │
│  transferencia (coordinador + utilityProcess)                     │
│  IPC allowlisted + Zod · protocolo wc-asset:// · logs locales     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ contextBridge (API tipada)
┌───────────────────────────────▼──────────────────────────────────┐
│ Renderer (React + Vite + TypeScript)                              │
│  shell · fichas · grafo · mapas · editor · juego · ajustes        │
│  transferencia (progreso y resumen)                               │
│  CSS con tokens · componentes propios · estado de UI              │
└──────────────────────────────────────────────────────────────────┘
```

| Pieza | Estado | Dónde se decide |
|---|---|---|
| Electron + Vite + React + TypeScript | Implementado (M0-02, #62) | [ADR 0001](adr/0001-electron-vite-react-typescript.md) |
| SQLite + better-sqlite3 + Drizzle + FTS5 | Implementado (M0-04, #64): base, migraciones y modo seguro; FTS5 implementado en #76 con `search_fts` y sus triggers | [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md), [ADR 0023](adr/0023-global-search-fts5-command-palette.md) |
| Instalador NSIS, actualizaciones y preservación de datos | Implementado (M0-08, #68): instalador local 0.1.0 y actualizador manual; release pública y actualización real en M5 | [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Seguridad Electron e IPC tipado | Implementado: ventana segura (#62) e IPC con allowlist y Zod (#63) | [ADR 0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales y protocolo propio | Implementado (M0-06, #66): importación a WebP, miniatura, `wc-asset://` y purga recuperable; lista e importación con UI desde #74 | [ADR 0005](adr/0005-local-assets-custom-protocol.md), [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md) |
| Dos temas y sistema de diseño | Implementado: tokens, temas, componentes base (#65) adaptados a la dirección v2 (#125), shell v2 con navegación Inicio/Mundos/Papelera y barra superior contextual (#126, #77) y preferencias de interfaz persistidas desde #132 | [ADR 0006](adr/0006-two-themes-desktop-design-system.md), [ADR 0025](adr/0025-visual-direction-v2.md), [ADR 0027](adr/0027-ui-preferences-persistence.md) |
| Tiptap y exportadores | Tiptap 3 implementado en la descripción de fichas (#74) y convertido en editor reutilizable con barra mínima y menciones `@` / `[[ ]]` (#131); desde #114 también edita la descripción del mundo | [ADR 0007](adr/0007-tiptap-editor-exporters.md), [ADR 0026](adr/0026-minimal-editor-mentions.md), [ADR 0031](adr/0031-descripcion-enriquecida-del-mundo-y-formato-v2.md) |
| MapLibre/Terra Draw y React Flow/ELK | Previsto (M2) | [ADR 0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| i18n centralizada | Implementado (M0-11, #71): catálogo tipado, proveedor y formatos `Intl`; faltan persistir el locale y las traducciones en/it | [ADR 0009](adr/0009-centralized-i18n.md) |
| Tipos de entidad y campos personalizados | Implementado (M1-02, #73): catálogo de 18 tipos, CRUD por API, validación Zod y transferencia `entity-types.v1` en dominio; gestión visual con #74 | [ADR 0020](adr/0020-entity-types-custom-fields.md) |
| Fichas, galería, etiquetas y favoritos | Implementado (M1-03, #74): CRUD, autoguardado, descripción Tiptap, imágenes y galería, etiquetas, filtros y tipos personalizados | [ADR 0021](adr/0021-entities-crud-gallery-tags-editor.md) |
| Relaciones tipadas y backlinks | Implementado (M1-04, #75): tipos del sistema y personalizados, etiquetas directa e inversa, CRUD con notas y fuerza, backlinks navegables y API de aristas para el grafo de M2 | [ADR 0022](adr/0022-relations-backlinks-graph-api.md) |
| Búsqueda global y paleta de comandos | Implementado (M1-05, #76): FTS5 con prefijos, tolerancia tipográfica, filtros, resaltado, recientes y favoritos, reconstrucción del índice y paleta `Ctrl+K` | [ADR 0023](adr/0023-global-search-fts5-command-palette.md) |
| Papelera y versiones de contenido | Implementado (M1-06, #77): vista global de papelera, restauración, purga con copia `pre-purge`, vaciado y historial de la descripción de las fichas | [ADR 0028](adr/0028-trash-versions-and-pre-purge-backup.md) |
| Exportación e importación de mundos | Implementado (M1-07, #78) y formato v2 desde #114: ZIP abierto `world-craft-world` con `manifest.json`, `world.json` y assets; worker `utilityProcess`; importación transaccional siempre como mundo nuevo y lectura de paquetes v1 | [ADR 0029](adr/0029-world-export-import.md), [ADR 0031](adr/0031-descripcion-enriquecida-del-mundo-y-formato-v2.md) |
| Ajustes y gestión de datos | Implementado (M1-08, #79): apariencia con densidad y tamaño, navegación `#/settings`, apertura de carpetas, uso de disco, biblioteca total `world-craft-library` v1 y borrado con copia `pre-delete` | [ADR 0030](adr/0030-settings-data-and-full-deletion.md) |
| Pruebas y calidad | Implementado: 762 unitarias, 251 de componentes y 231 de integración (#62-#79, #125-#133); E2E de shell, ventana, temas, axe, mundos, fichas, relaciones, búsqueda, sistema v2, Inicio, editor, preferencias, papelera, transferencia y ajustes (#70, #72, #74, #75, #76, #77, #78, #79, #125, #126, #127, #131, #132) | [ADR 0010](adr/0010-testing-strategy.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Modelo local de un solo usuario | Vigente | [ADR 0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | Implementado (M0-07, #67): copias automáticas 7/4/12, pre-migración 5, pre-purga 10 (#77), pre-delete sin poda (#79), verificación y restauración desde modo seguro; Ajustes abre copias y muestra su uso desde #79, pero las copias manuales y la restauración guiada siguen previstas | [ADR 0012](adr/0012-backup-restore-recovery.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md), [ADR 0028](adr/0028-trash-versions-and-pre-purge-backup.md), [ADR 0030](adr/0030-settings-data-and-full-deletion.md) |
| CI y releases | Parcial: lint, typecheck, test, build y package en Windows (#62–#68); releases previstos | [ADR 0013](adr/0013-ci-releases.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Estructura y tooling | Vigente | [ADR 0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional | Diferida | [ADR 0015](adr/0015-optional-code-signing-smartscreen.md) |

## 2. Procesos y directorios

Electron separa tres procesos con permisos distintos:

| Proceso | Responsabilidad | Puede acceder a |
|---|---|---|
| **Main** | Ventana, ciclo de vida, instancia única, guards de seguridad, IPC con handlers tipados, persistencia local (SQLite, migraciones, copia previa y modo seguro), servicio de assets con protocolo `wc-asset://`, servicio de mundos con CRUD y actividad, servicio de tipos de entidad con catálogo, plantillas y transferencia, servicio de fichas, etiquetas y galería, servicio de assets para el IPC, copias de seguridad con restauración, servicio de preferencias de interfaz, papelera con restauración y purga, historial de versiones, actualizador manual, coordinador de exportación e importación con su `utilityProcess` y servicio de datos de Ajustes con biblioteca total y borrado. | Node, Electron, disco. |
| **Preload** | Puente mínimo y tipado entre renderer y main: `appInfo`, `shell.openExternal`, actualizaciones, mundos, tipos de entidad, fichas, etiquetas, preferencias, assets, papelera, versiones, transferencia y datos; nunca un `invoke` genérico. | API de Electron limitada. |
| **Renderer** | Interfaz React, estado de UI, editor enriquecido reutilizable, diálogo de exportación e importación, Ajustes con apariencia y datos, mapa y grafo. | DOM, API expuesta por preload. Nunca Node ni SQLite. |

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/main/` | Composición del proceso principal, ventana, instancia única (`single-instance.ts`), guards de seguridad (`security/`), router IPC (`ipc/`), persistencia (`persistence.ts`), aviso de modo seguro (`safe-mode-*.ts`), protocolo de assets (`assets/`), composición de la recuperación y actualizador (`updates/`). | `src/shared/`, Node, Electron |
| `src/main/assets/` | Servicio de assets: importación, procesamiento con sharp, rutas, protocolo `wc-asset://`, repositorio de metadatos, huérfanos, purga y log. Sin Electron salvo la composición. | Node, sharp, Drizzle |
| `src/main/backup/` | Copias y restauración puros: manifiesto v2, creación online, verificación, inventario, rotación, programación por arranque, lock, marcador pendiente y reemplazo con rollback. No importa Electron (regla ESLint); la composición vive en `persistence.ts` y `safe-mode-recovery.ts`. | Node, better-sqlite3, Zod |
| `src/main/logging/` | Escritura JSONL con rotación compartida por el log de arranque, el de assets y el del actualizador. | Node |
| `src/main/preferences/` | Dominio de preferencias de interfaz puro: claves `ui.*`, esquemas Zod estrictos de entrada, lectura tolerante por clave, repositorio Drizzle sobre `app_settings` y servicio con escritura transaccional y reset por prefijo. No importa Electron. | Drizzle, Zod, `src/shared/` |
| `src/main/db/` | Capa de datos pura: rutas, conexión, esquema Drizzle, journal, runner de migraciones, copia previa, integridad, logger y errores estables. No importa Electron (regla ESLint). | Node, better-sqlite3, Drizzle, Zod |
| `src/main/worlds/` | Dominio de mundos puro: normalización y slugs, validación y normalización de la descripción enriquecida, repositorio Drizzle con filtros por `world_id` y `deleted_at`, servicio de CRUD y actividad con validación de enlaces internos del mundo, y errores de entrada. No importa Electron. | Drizzle, `src/shared/` |
| `src/main/entity-types/` | Dominio de tipos de entidad puro: claves, validación con Zod, repositorio con aislamiento por mundo, servicio con protección de los tipos del sistema, duplicación y transferencia JSON versionada. No importa Electron. | Drizzle, Zod, `src/shared/` |
| `src/main/trash/` | Papelera pura: listado por cursor de los tres grupos, restauración con motivos de dominio, purga física ordenada con copia previa obligatoria y vaciado serializado. No borra assets. No importa Electron. | Drizzle, `src/shared/` |
| `src/main/versions/` | Historial de la descripción: repositorio Drizzle sobre `entity_versions`, servicio de listar, guardar manual y restaurar, y política pura de agrupación, retención y poda. Se engancha a la transacción de `entities.update`. No importa Electron. | Drizzle, `src/shared/` |
| `src/main/transfer/` | Dominio de exportación e importación: contratos y límites, formato ZIP `world-craft-world` v2 con lectura de v1 (`format/`), lectura y escritura con `yauzl`/`yazl` (`archive/`), instantánea y dataset de exportación (`export/`), staging, plan, repositorio transaccional y servicio de importación (`import/`), protocolo del worker, coordinador, diálogos nativos, limpieza, log y contención de rutas. Es puro respecto a Electron salvo `composition.ts` y `dialogs.ts`; `worker-entry.ts` no importa Electron y se compila a `out/main/transfer-worker.cjs`. | Node, Drizzle, Zod, yauzl, yazl |
| `src/main/data/` | Dominio de Ajustes → Datos: resumen, uso acotado, apertura de carpetas por enum, huérfanas, biblioteca `world-craft-library` v1 (`library/`), copia verificada de assets, borrado total con `pre-delete`, errores estables, diálogo nativo, composición y sustitución en modo seguro. Solo `composition.ts` y `dialogs.ts` conocen Electron. | Node, Drizzle, Zod, `src/shared/` |
| `src/main/ipc/` | Router único, esquemas Zod de entrada, handlers por canal y errores estables. | `src/shared/`, Electron, Zod |
| `src/main/security/` | CSP, guards de sesión y navegación, y política de enlaces externos. | Electron |
| `src/main/updates/` | Máquina de estados del actualizador sin Electron, adaptador de electron-updater, allowlist de red y saneado de cabeceras, log JSONL y composición. | Node, electron-updater, `builder-util-runtime` |
| `src/main/single-instance.ts` | Adquisición del lock de instancia única y foco de la ventana en `second-instance`; se prueba sin Electron. | — |
| `src/main/messages/` | Textos tipados de los diálogos nativos del proceso principal (`es.ts`). | — |
| `src/preload/` | `contextBridge` congelado que publica solo `window.worldCraft` (`appInfo`, `shell.openExternal`, `updates`, `worlds`, `entityTypes`, `entities`, `tags`, `relationTypes`, `relations`, `search`, `preferences`, `assets`, `trash`, `versions`, `transfer` y `data`); sin lógica de negocio, `ipcRenderer` ni `invoke` genérico. | `src/shared/`, Electron |
| `src/renderer/` | UI React, mensajes tipados, tema y estilos; el CRUD de mundos (#72), las fichas con imágenes, etiquetas y editor (#74), el editor reutilizable con menciones (#131), la papelera (#77), el historial de versiones (#77), la transferencia de mundos (#78) y Ajustes con apariencia y datos (#79) están implementados. | `src/shared/`, API de `window.worldCraft` |
| `src/renderer/components/` | Componentes base implementados en #65 y adaptados en #125 (`button`, `icon-button`, `menu`, `text-field`, `text-area-field`, `select-field`, `checkbox`, `radio`, `badge`, `card`, `panel`, `skeleton`, `empty-state`, `dialog`, `tabs`, `toast`, `tooltip`), control y diálogo de actualizaciones de #68, tarjetas, diálogos de mundo y lista de actividad de #72, componentes de fichas de #74 (tarjeta, creación rápida, editor Tiptap, atributos, etiquetas, galería y gestión de tipos), componentes de relaciones de #75, búsqueda de #76 (resaltado seguro, iconos y paleta de comandos), la tarjeta y marca de mundo v2 de #127, el editor de #131 (`editor/`: `rich-text-editor`, barra mínima y menú Formato, plugin de menciones sobre `@tiptap/pm`, popup combobox/listbox, consulta y contenido de menciones y diálogo de enlace), la descripción del mundo de #114 (`worlds/`: campo con editor compartido y vista de lectura), los componentes de papelera y el historial de #77 (`trash/` y `entities/entity-history-section`), el diálogo de transferencia de #78 (`transfer/`: `world-transfer-dialog`, `transfer-progress` y `transfer-summary`) y los componentes de Ajustes de #79 (`settings/`: apariencia, idioma, atajos, actualizaciones, resumen, carpetas, uso, exportación, huérfanas, zona de peligro, reinicio y restablecer preferencias); `editors/`, `maps/` y `graph/` son previstos. | Módulos del renderer, `src/shared/` |
| `src/renderer/transfer/` | Hook `use-world-transfer.ts` (máquina de estados, filtrado de eventos y cancelación), reducer puro `state.ts` y formateadores `format.ts` (bytes, progreso y plurales). Sin acceso a Node ni a rutas. | `src/shared/`, API tipada |
| `src/renderer/updates/` | Hook compartido `use-updates.tsx` y textos de estado y acción principal del panel de actualizaciones, probados sin DOM con el idioma activo. La barra superior y Ajustes consumen el mismo estado. | `src/shared/` |
| `src/renderer/preferences/` | `use-ui-preferences.ts`: snapshot inicial desde el bootstrap de `main.tsx`, actualización optimista con secuencia, adopción de la respuesta canónica y descarte de respuestas tardías; sin `localStorage`. | `src/shared/`, tema, API tipada |
| `src/renderer/settings/` | `use-data-settings.ts` (resumen, uso, carpetas, huérfanas, exportación y borrado con secuencias y `DATA_BUSY`) y textos de error de datos. Sin acceso a Node ni a rutas. | `src/shared/`, API tipada |
| `src/renderer/shell/` | Shell v2 (`app-shell.tsx`): rail plegable con navegación Inicio/Mundos/Papelera y Ajustes en el pie, barra superior con título contextual, disparador de la paleta, una acción primaria, menú `⋯` y utilidades de actualizaciones y tema, y `main` enfocable. `views.ts` declara las vistas de producto y la acción primaria; `routes.ts` resuelve `#/settings`; `internal-views.ts` resuelve la vista interna de Muestras por hash. | Componentes, mensajes, tema |
| `src/renderer/pages/` | Vistas del shell: `home-page.tsx` (mesa de trabajo con Continuar, mundos recientes y actividad, y estado vacío), `worlds-page.tsx` (lista con búsqueda y filtros), `world-page.tsx` (ficha, progreso y actividad), `entities-page.tsx` (lista y filtros de fichas), `entity-detail-page.tsx` (ficha con autoguardado, galería, etiquetas e historial), `trash-page.tsx` (papelera global con tres grupos y diálogos destructivos), `search-page.tsx` (búsqueda global, filtros, recientes y favoritos), `settings-page.tsx` (Ajustes editorial con apariencia, idioma, atajos, actualizaciones, datos y restablecimiento) y `samples-page.tsx` (banco interno de desarrollo, solo por `#/internal/samples`). | Componentes, mensajes |
| `src/renderer/theme.ts` | Tipo `ThemeMode`, tema por defecto y `applyTheme()` sobre `data-theme`; el tema inicial llega del bootstrap de preferencias (#132). | — |
| `src/renderer/modules/` | Casos de uso de UI por dominio: worlds, entities, relations, maps, graph, writing, game, search. El de mundos aún vive en `App.tsx` y sus componentes; las carpetas de dominio llegarán con las pantallas de M1. | API tipada, shared |
| `src/renderer/messages/` | Catálogo tipado del renderer: `es.ts` (fuente del tipo), `index.ts` (registro de idiomas) y `translator.ts` (claves y parámetros tipados). | — |
| `src/renderer/i18n/` | Composición del idioma: `create.ts` (`createI18n`), `provider.tsx` (`I18nProvider`, `useI18n`, `useMessages`) y `formats.ts` (fechas, números, listas y plurales con `Intl`). | Mensajes, `src/shared/` |
| `src/renderer/styles/` | `fonts.css` (único `@font-face` local), `base.css` y `components.css` sobre los tokens de `styles/tokens/` (`palette.css`, `semantic.css` y `scales.css`). | — |
| `src/shared/` | Identidad, contratos y utilidades puras sin Node ni React. | — |
| `src/shared/contracts/` | Allowlist de canales, `IpcResult`, códigos de error, contrato de la API del preload, contrato del actualizador, contrato de idioma (`locale.ts`), contrato de mundos (`worlds.ts`), contrato de tipos de entidad (`entity-types.ts`), contrato de fichas y etiquetas (`entities.ts`), contrato de preferencias de interfaz (`preferences.ts`), contrato de assets (`assets.ts`), contrato de papelera (`trash.ts`), contrato de versiones (`versions.ts`) y contrato de transferencia (`transfer.ts`: formato, fases, límites, avisos, errores y guardas), todos con guardas estructurales. | - |
| `src/shared/entity-types/` | Catálogo del sistema en código y validación compartida con Zod de plantillas y valores de campos, reutilizable por main y por la UI de fichas. | Zod |
| `src/shared/entities/` | Validación cerrada de la descripción de ProseMirror, extracción de texto plano, eliminación de enlaces internos y patrón UUIDv7 compartido. | Zod |
| `src/shared/worlds/` | Validación de la descripción enriquecida del mundo: límites de 4.000 caracteres de texto plano y 200.000 de JSON, normalización de vacío y lectura tolerante del JSON guardado; reutiliza el esquema de las fichas. | Zod |
| `tests/unit/` | Pruebas unitarias del scaffold, del contrato IPC, de los guards, de los enlaces externos, de la capa de datos (journal, checksum, rutas, UUIDv7, logger y modo seguro), del sistema de diseño (tokens y contraste), de i18n (catálogo, formatos y cadenas hardcodeadas), del servicio de assets (rutas, URL, formatos, importación, huérfanos, protocolo y log), de copias (manifiesto, rutas de restauración, buckets y rotación), del empaquetado (configuración, iconos y licencias), del actualizador (contrato, servicio, red, log y textos), de los mundos (slug y validación), de los tipos de entidad (catálogo, plantillas, valores, claves y esquemas IPC), de las fichas (descripción, esquemas IPC, handlers y tarjetas), de las vistas del shell, de instancia única y de transferencia (formato, rutas, manifiesto, `world.json`, remapeo, plan, archivo ZIP, protocolo, coordinador, diálogos, esquemas y handlers IPC, API del preload y reducer del diálogo). | `src/` |
| `tests/integration/` | Arranque y migraciones contra una base SQLite real en `os.tmpdir()`; copia, integridad, preservación y rechazo de bases ajenas; CRUD, aislamiento y actividad de mundos; CRUD, protección, aislamiento, duplicación y transferencia de tipos de entidad; CRUD, validación, referencias, etiquetas, favoritos, galería, filtros y aislamiento de fichas; importación, protocolo, repositorio y purga de assets; creación, verificación, restauración, rotación y restauración interrumpida de copias; preservación de datos entre instalaciones; y exportación e importación de mundos con round-trip, corrupción, traversal, límites, cancelación, rollback, slugs y limpieza. | `src/` |
| `tests/components/` | Testing Library y `jsdom`: botón, pestañas, patrones de teclado, estados, formularios y tarjetas de mundo y de ficha, shell v2 (navegación, plegado, primaria y menú), diálogos de creación, lectura de textos desde el proveedor de idioma, y diálogo y hook de transferencia (progreso, cancelación, éxito, aviso, error, reintento, foco y contenido largo). | `src/renderer/` |
| `tests/e2e/` | Playwright Electron: shell y medidas del rail, ventana a 1024/1280/1600 px, temas, axe con rail expandido y plegado, CRUD de mundos, CRUD y filtros de fichas, teclado y textos largos con `userData` temporal y aislado; y transferencia real con exportación, inspección del ZIP, importación en un perfil con datos previos, traversal, ventana, temas y movimiento reducido. | `src/` |
| `resources/` | `icon.ico`, `icon.png`, `installer.nsh` y `licenses/` generados o versionados para electron-builder. | — |
| `scripts/` | Verificación de build, nativo, paquete, checksums, iconos, licencias, instalación manual y limpieza. | Node, PowerShell |
| `release/` | Salida de electron-builder (instalador, blockmap, `latest.yml`, `SHA256SUMS`); ignorada por git. | — |
| `docs/` | Plan, arquitectura, ADRs, persistencia, calidad y manual. | — |

Reglas de dependencia:

1. **Main decide y persiste; renderer presenta y compone.** El renderer no
   importa `src/main/` ni módulos de Node.
2. **Shared no depende de nadie.** Contiene contratos puros (canales,
   resultados y API) que ambos lados pueden importar; los esquemas Zod viven en
   el main.
3. **Preload no contiene reglas de negocio.** Solo traduce llamadas a canales
   IPC concretos.
4. **Los textos visibles viven en `src/renderer/messages/`.** No se escriben
   cadenas de interfaz en componentes; se leen con `useMessages()` o
   `useI18n()`.
5. **Los tokens viven en `src/renderer/styles/tokens/`.** Solo `palette.css`
   declara colores literales; los componentes usan roles semánticos, nunca la
   paleta cruda ni variantes `dark:`. Para fondo y texto base el renderer usa
   **solo `--bg` y `--fg`**, que resuelven la inversión de `--paper`/`--ink`
   entre temas; `--ink` no se usa como texto ni como fondo de componente.
6. **La lógica de negocio no vive en componentes.** Vive en casos de uso del
   renderer o en el main, según si necesita disco.

### 2.1 Estado implementado del scaffold (M0-02, #62)

- **Compilación.** electron-vite compila `main` y `preload` como CommonJS
  (`.cjs`) y el renderer como ESM. `pnpm dev` levanta Vite y la ventana;
  `pnpm build` escribe los tres artefactos en `out/` y `pnpm start` previsualiza
  el build de producción. `out/` no se versiona.
- **Ventana.** Se crea a 1280×800, con mínimo 1024×700, oculta hasta que
  coinciden `ready-to-show` y `did-finish-load` y con el fondo exactamente igual a
  `--bg` del tema persistido (#132) para evitar destellos. No recuerda tamaño ni
  posición: esa persistencia sigue prevista.
- **Preload.** `contextBridge` publica un objeto congelado con `appInfo` (nombre y
  versión); desde #63 añade `shell.openExternal` y desde #68-#74 el resto de APIs
  nominativas (sección 2.2). No expone `ipcRenderer`, `require` ni un `invoke`
  genérico.
- **CSP.** La política de producción se inyecta como `<meta>` antes de los
  scripts; la de desarrollo solo añade inline y loopback para Vite y su HMR.
- **Guards.** Se bloquean navegación, redirecciones, navegación de subframes,
  `window.open`, webviews y descargas. Los permisos del navegador se deniegan y
  las peticiones HTTP(S)/WS remotas se cancelan. `ELECTRON_RENDERER_URL` se
  ignora en la versión empaquetada y las DevTools se deshabilitan en ella.
- **Verificación.** `pnpm verify:build` comprueba que existen los tres artefactos,
  que la CSP está antes de los scripts, que no hay `unsafe-*` ni URLs remotas.
- **Tema y datos.** `prefers-color-scheme` fue un fallback provisional del
  scaffold; desde #65 el tema se aplica con `data-theme` (sección 2.4). La
  escritura en `userData`, SQLite y las migraciones se añadieron en #64
  (sección 2.3).

### 2.2 Estado implementado del IPC (#63, #68, #72, #73, #74, #75 y #76)

- **Contrato compartido.** `src/shared/contracts/` contiene la allowlist
  `IPC_CHANNELS` (hoy `shell:openExternal`, los cinco canales de actualizaciones,
  los ocho de mundos, los cinco de tipos de entidad, los seis de fichas, los dos
  de etiquetas, los cuatro de tipos de relación, los cuatro de relaciones, los
  tres de búsqueda, los tres de preferencias, los dos de assets, los siete de
  papelera y versiones, los tres de transferencia y los siete de datos), el
  resultado discriminado `IpcResult` con los códigos `INVALID_INPUT`,
  `UNKNOWN_CHANNEL`, `INTERNAL_ERROR` y `UNTRUSTED_SENDER`, y
  `createWorldCraftApi({ invoke })`, que construye la API congelada del preload.
  Son módulos puros: no importan Electron, Node ni Zod.
- **Preload nominativo.** Publica `appInfo`, `shell.openExternal(url)`, la API
  `updates` (desde #68), la API `worlds` (desde #72), la API `entityTypes`
  (desde #73), las APIs `entities`, `tags` y `assets` (desde #74), las APIs
  `relationTypes` y `relations` (desde #75), la API `search` (desde #76), la API
  `preferences` (desde #132), las APIs `trash` y `versions` (desde #77), la API
  `transfer` (desde #78) y la API `data` (desde #79). No expone `ipcRenderer`,
  `require` ni un `invoke` genérico; el renderer solo puede llamar a las
  funciones declaradas en el contrato.
- **Router único.** `src/main/ipc/` registra un handler de `ipcMain` por cada
  canal de la allowlist, comprueba el remitente (`file:` empaquetado o loopback
  de desarrollo), valida la entrada con Zod (`zod@^4.6.7`, declarado en
  `dependencies` y usado solo por el main), ejecuta el handler y envuelve el
  resultado. Un canal fuera de la lista no se registra.
- **Errores estables.** Un payload inválido devuelve `INVALID_INPUT`, un canal
  desconocido `UNKNOWN_CHANNEL`, un remitente no confiable `UNTRUSTED_SENDER` y
  cualquier excepción `INTERNAL_ERROR`, sin mensaje, stack, rutas ni valores
  recibidos.
- **Salida validada sin Zod.** El preload no valida reglas de dominio: comprueba
  la forma de `IpcResult` de manera estructural (`isIpcResult`), valida los
  snapshots del actualizador y las entidades de mundo con guardas puras, y
  degrada cualquier respuesta inesperada a `INTERNAL_ERROR`, para no empaquetar
  Zod en preload ni renderer.
- **Enlaces externos.** `src/main/security/external-links.ts` decide qué URL se
  abre: solo `https:`, sin credenciales, sin espacios ni controles, con longitud
  máxima de 2048 y rechazo de loopback y redes privadas. Se abre la URL ya
  normalizada por el parser. La política aprobada admite cualquier `https:`
  válido, sin allowlist de dominios por ahora; esa allowlist llegará con la
  pantalla de ayuda.

### 2.3 Estado implementado de la persistencia (#64)

- **Dependencia nativa.** `better-sqlite3` 13.2.0 usa Node-API 10 y un prebuild
  compartido entre Node 22.23.5 y Electron 45.3.4 (SQLite 3.54.1 con FTS5). No
  se usa `electron-rebuild`: `pnpm verify:native` comprueba ambos runtimes y la
  reconstrucción queda como contingencia si una versión futura cambia la
  compatibilidad.
- **Composición.** `src/main/persistence.ts` resuelve `userData`, arranca la base
  antes de crear la ventana y cierra la conexión en `before-quit`. En modo
  seguro, `safe-mode-dialog.ts` conecta el diálogo nativo con `safe-mode-prompt.ts`,
  que es lógica pura y testeable sin Electron.
- **Capa de datos.** `src/main/db/` no importa Electron: contiene rutas,
  conexión, esquema, journal validado con Zod, runner de migraciones, copia
  previa, integridad, logger JSONL y códigos de error. La regla ESLint lo
  impone.
- **Ubicación y pragmas.** `app.setName(APP_NAME)` antes de
  `app.getPath('userData')`; base en `userData/data/world-craft.sqlite`; una
  conexión de escritura; WAL, `synchronous = NORMAL`, `foreign_keys = ON` y
  `busy_timeout = 5000`.
- **Arranque.** Integridad antes de WAL, copia online si la base existía y hay
  migraciones pendientes, lote transaccional y comprobación posterior. Si algo
  falla, se cierra la conexión y se entra en modo seguro sin escritura.
- **Build.** `better-sqlite3` y `drizzle-orm` se externalizan (y `sharp` desde
  #66, sección 2.5); `drizzle/` se copia a `out/main/drizzle`. `pnpm verify:build`
  valida las migraciones copiadas y la externalización. El desempaquetado del
  asar y la poda x64 se completaron en #68 (sección 2.7).

### 2.4 Estado implementado del sistema de diseño (#65, #125 y #126)

- **Tokens v2.** `src/renderer/styles/tokens/` contiene `palette.css` (única
  fuente de hex y valores con alfa), `semantic.css` (roles por tema con overrides
  agrupados en `:root`/`[data-theme="light"]` y `[data-theme="dark"]`, incluidos
  `--surface-sunken`, `--border-strong` y las marcas `--entity-*`) y
  `scales.css` (espaciado, radios 4/6/8, tipografía, iconos 16/20/24 con trazo
  1,6, movimiento 120–180 ms, z-index y medidas del shell de 240/64/56 px). Se
  importan antes de `base.css` y `components.css` en `main.tsx`.
- **Tema.** `src/renderer/theme.ts` aplica `data-theme` en `<html>`. El tema
  inicial llega del bootstrap de preferencias de `main.tsx`, que se resuelve antes
  de `createRoot` con un límite de 1.500 ms (#132); el icono de la barra superior
  —sol o luna con etiqueta y tooltip— conmuta y persiste el cambio. Ajustes
  añade los radios de tema y los presets de densidad y tamaño (#79).
- **Componentes.** `src/renderer/components/` tiene primitivas nativas (botón,
  botón de icono, menú `⋯`, campo, área, selector, casilla, radio, insignia,
  tarjeta, panel, esqueleto, estado vacío, diálogo, pestañas, toast y tooltip)
  sin Radix/shadcn ni dependencias nuevas. El diálogo usa `<dialog>` con
  `showModal()`; menú y pestañas siguen sus patrones ARIA con teclado y foco.
- **Shell v2.** `src/renderer/shell/app-shell.tsx` compone el enlace de salto, el
  rail de 240 px plegable a 64 px sobre `--surface-sunken` con navegación solo
  Inicio/Mundos, la barra superior de 56 px con `h1` contextual truncado, el
  disparador `Ctrl+K`, una acción primaria, el menú `⋯`, actualizaciones y tema,
  y `main` con `tabIndex={-1}`. No hay router. El plegado expone `aria-expanded`,
  `aria-controls`, nombre accesible y tooltip; su estado se persiste desde #132 y
  llega correcto al primer render.
- **Acciones declarativas.** `src/renderer/shell/views.ts` define `AppView`,
  `AppNavView` y `ShellPrimaryAction` en un módulo sin JSX, de modo que las
  pruebas unitarias de Node lo importan sin React. `App.tsx` decide la primaria y
  las secundarias de cada vista; la barra solo las pinta.
- **Vistas.** `src/renderer/pages/home-page.tsx` muestra el estado vacío real y
  `samples-page.tsx` es el banco interno del sistema v2: paleta, tipografía con
  la serif empaquetada, primitivas, estados y contenido largo. Desde #126 no está
  en la navegación de producto: `src/renderer/shell/internal-views.ts` resuelve
  `#/internal/samples`, cualquier otro hash vuelve a Inicio y salir de la vista
  limpia el hash con `history.replaceState`.
- **Tipografía.** Interfaz y datos usan pilas del sistema (`Segoe UI Variable
  Text` y `Cascadia Mono`); contenido usa Source Serif 4 (OFL 1.1), empaquetada
  desde #125 como activo local en `src/renderer/assets/fonts/source-serif-4/`
  con dos cortes woff2 (400 y 600, subset latin). `styles/fonts.css` es el único
  archivo con `@font-face`, con rutas relativas, `font-display: swap` y
  `unicode-range`; la CSP mantiene `font-src 'self'`. El alias `--font-display`
  se retiró en #126: la marca y el chrome usan `--font-ui` y el contenido,
  `--font-content`.
- **Licencia de la fuente.** El texto OFL canónico vive junto al activo,
  `pnpm licenses:sync` lo replica en `resources/licenses/source-serif-4-OFL.txt`
  y `verify:package` lo exige en el instalador. La fuente no es una dependencia
  npm y no se descarga en tiempo de ejecución.
- **Dirección visual v2.** ADR 0025 revisa la lectura estética del ADR 0006:
  superficies neutras, verde bosque, tipografía del sistema para interfaz y
  jerarquía por espacio y contraste. #125 implementó tokens, tipografía y
  primitivas; #126, el shell; #127–#133 migraron las pantallas y #133 cerró M1.5
  con la auditoría visual.
- **Verificación.** `tests/unit/design-tokens.test.ts` resuelve los tokens de
  cada tema, calcula la tabla de contraste §4.5, comprueba la disciplina de
  capas, escalas, elevación, estados, movimiento reducido y la licencia de la
  fuente. `tests/components/shell.test.tsx` cubre navegación, plegado, primaria
  única, menú `⋯`, paleta y título truncado. `tests/e2e/accessibility.spec.ts`
  ejecuta axe sobre el shell en los dos temas con el rail expandido y plegado, y
  sobre Muestras por su hash; `tests/e2e/shell.spec.ts` comprueba la ventana a
  1024, 1280 y 1600 px, el rail a 64 px y la barra a 56 px.
  `tests/e2e/visual-audit.spec.ts` ejecuta la matriz de 3 anchos × 2 temas con
  `pnpm test:audit` y `tests/unit/design-noise.test.ts` bloquea cajas heredadas y
  selectores muertos; el informe está en
  [`diseno/auditoria-visual-issue-133.md`](diseno/auditoria-visual-issue-133.md).
  La auditoría final de accesibilidad sigue en #93.

### 2.5 Estado implementado de los assets (#66)

- **Servicio puro.** `src/main/assets/` no importa Electron: `import-asset.ts`,
  `image.ts`, `paths.ts`, `store.ts`, `orphans.ts`, `errors.ts`, `logger.ts` y
  `mutex.ts`. `composition.ts` envuelve `protocol`, resuelve `userData` y usa la
  conexión compartida; `protocol.ts` contiene el registro y el handler.
- **Importación.** Validación por magic bytes (PNG, JPEG, WebP, GIF y AVIF; SVG
  rechazado), límites de 25 MB, 8192 px por lado y 24 Mpx, orientación EXIF,
  sRGB, WebP calidad 90 y miniatura de 320 px calidad 80 sin metadatos. El
  SHA-256 se calcula sobre el WebP publicado. Se escribe en
  `assets/.tmp/<assetId>/` y se publica con `rename`; la fila se inserta después
  y, si falla, los archivos se borran. Sin deduplicación en M0.
- **Metadatos.** `src/main/db/schema/assets.ts` y la migración `0001_assets`
  definen la tabla `assets` con `CHECK` de `kind`, `size` y `hash` hexadecimal e
  índices por mundo y hash. `world_id` no tiene FK hasta M1, cuando se
  reconstruirá la tabla con `ON DELETE RESTRICT`.
- **Protocolo.** `wc-asset://asset/<uuidv7>` y `wc-asset://thumb/<uuidv7>` con
  gramática cerrada; la ruta relativa sale de SQLite, se exige coincidencia de
  ID y mundo y se valida contra `worlds/<uuid>/<uuid>.webp`. Se rechazan `..`,
  rutas absolutas, UNC, NUL, symlinks y junctions con `lstat`/`realpath`. Se
  sirve solo `image/webp` con `nosniff`, `Content-Length`, caché privada
  inmutable y CSP `default-src 'none'`; los errores son 400/403/404/413/415/500.
  El esquema se registra como `standard`, `secure` y `stream` con
  `bypassCSP:false` antes de `app.whenReady`; el handler solo se instala si la
  base arranca en `ready` y no existe en modo seguro.
- **Huérfanos.** `planOrphanCleanup` clasifica sin escribir y sin seguir enlaces;
  `purgeOrphans` exige el token `purge-orphans`, recalcula bajo mutex, revalida
  antes de copiar y de borrar, copia a `backups/orphans/<timestamp>/assets/`,
  verifica SHA-256, escribe manifiesto con `recovery` y solo entonces borra.
- **Dependencia.** `sharp@^0.35.5` se externaliza con `@img/*` en
  `electron.vite.config.ts`, se verifica en Node y Electron con
  `pnpm verify:native` y sus licencias están en `THIRD-PARTY-NOTICES.md`. #68
  desempaquetó sharp del asar e incluyó los textos completos en `licenses/`
  (sección 2.7).
- **IPC y UI desde #74.** `assets:list` e `assets:import` exponen solo metadatos
  y usan un diálogo nativo; la galería de la ficha muestra miniaturas
  `wc-asset://thumb/<id>`. La purga de huérfanos sigue sin canal ni UI. Los
  residuales de seguridad (TOCTOU, raíces no validadas antes de crear,
  `backups/orphans` sin comprobar y symlinks de archivo omitidos en Windows)
  están en el [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md).

### 2.6 Estado implementado de copias y restauración (#67)

- **Módulo puro.** `src/main/backup/` no importa Electron: `manifest.ts`,
  `create.ts`, `verify.ts`, `inventory.ts`, `rotation.ts`, `scheduler.ts`,
  `restore.ts`, `lock.ts`, `pending.ts`, `remnants.ts` y `fs.ts`. La composición
  vive en `persistence.ts` (programación al arrancar) y en
  `safe-mode-recovery.ts` (diálogo, selección de carpeta, restauración y
  `app.relaunch()`).
- **Manifiesto v2.** `formatVersion`, `reason`, `createdAt`, `databaseFile`,
  `schemaVersion`, `sizeBytes`, `sha256`, `integrity` y `assetsIncluded:false`;
  el lector acepta v1 de M0-04. Una copia contiene solo el SQLite y el
  manifiesto; los assets no se incluyen ni se sustituyen.
- **Creación.** La copia normal usa `db.backup()` (API online de SQLite), escribe
  `.partial`, verifica integridad y versión en solo lectura, publica con
  `rename`, calcula SHA-256 y escribe el manifiesto con `wx`. La copia
  pre-restauración es en bruto: copia la base y sus `-wal`/`-shm`/`-journal` sin
  abrirla, porque puede estar corrupta.
- **Verificación e inventario.** Manifiesto Zod estricto, tamaño, SHA-256,
  `integrity_check`, `user_version` y rechazo de versiones futuras. Las copias
  corruptas se marcan, no se ofrecen, no cuentan para la retención y no se
  borran.
- **Programación.** Una pasada por arranque, tras `ready` y antes de la ventana;
  buckets locales de día, semana ISO y mes; se crea el bucket actual que falte.
  Un fallo se registra y no bloquea el arranque. La rotación se ejecuta solo si
  se creó una copia nueva o una pre-migración.
- **Rotación.** 7 diarias, 4 semanales, 12 mensuales y 5 pre-migración; nunca se
  borra la copia válida más reciente ni la última de un motivo; cada candidata
  se reverifica antes de borrarse; `pre-restore` no se poda.
- **Restauración.** Se ofrece desde el diálogo nativo de modo seguro; Ajustes
  abre la carpeta de copias pero no restaura. Valida la carpeta con
  `realpath`/`relative` dentro de `backups/`, verifica antes y después, crea
  `backups/pre-restore/`, usa `.restore.lock` y `.restore.pending`, sustituye con
  `.restore.tmp` y `.rollback*`, y relanza. Un fallo vuelve al modo seguro; nunca
  se ejecuta en
  segundo plano.
- **Logs.** `backup.schedule` y `backup.restore` registran resultado y códigos
  sin rutas, nombres, tamaños, SHA, identificadores ni contenido.

### 2.7 Estado implementado del empaquetado y las actualizaciones (#68)

- **Configuración.** `electron-builder.config.cjs` declara NSIS por usuario,
  `appId` `com.gonzalitojh.worldcraft`, versión 0.1.0, recursos en `resources/`,
  salida en `release/` y `--publish never` en local. `afterPack` escribe
  `app-update.yml` también en las builds `--dir` y poda los binarios nativos que
  no son win32-x64. El icono es un ICO de 7 tamaños; `licenses:sync` copia los
  7 textos completos.
- **Paquete.** `files` incluye `out/` y `package.json`; `extraFiles` añade
  `LICENSE`, `THIRD-PARTY-NOTICES.md` y `licenses/`. `asarUnpack` cubre
  `better-sqlite3`, `sharp`, `@img` y `*.node`; `npmRebuild` está desactivado.
  Solo viajan `sharp-win32-x64` y `better-sqlite3` `win32-x64`.
- **Instancia única.** `src/main/single-instance.ts` adquiere
  `requestSingleInstanceLock()` antes de `whenReady`; un segundo proceso no toca
  base, IPC ni ventana y la instancia existente recibe `second-instance`.
- **Actualizador.** `src/main/updates/` separa la máquina de estados
  (`service.ts`) del adaptador de electron-updater (`electron-adapter.ts`), la
  política de red (`network.ts`), el log (`logger.ts`) y la composición
  (`composition.ts`). Estados `unavailable`, `idle`, `checking`, `up-to-date`,
  `available`, `downloading`, `downloaded`, `installing` y `error`; sin
  auto-check, con timeout de 30 s, `epoch`, cancelación por `CancellationToken`,
  descarga consentida e instalación solo desde `downloaded`. Se deshabilita en
  desarrollo, en modo seguro y sin `app-update.yml`.
- **Red.** Partición `electron-updater` con `cache:false`; se verifica que
  `autoUpdater.netSession` es esa sesión antes de permitir tráfico. Solo HTTPS a
  `github.com`, `api.github.com` y subdominios de `githubusercontent.com`; se
  eliminan `x-user-staging-id`, `authorization`, `private-token` y `cookie`; los
  permisos se deniegan. No se envía contenido del usuario.
- **UI e IPC.** Canales `updates:getState`, `check`, `cancel`, `download` e
  `install`, todos con `strictObject({})`, y evento `updates:stateChanged` fuera
  de la allowlist de `invoke`. El icono de la barra superior —con punto y
  `aria-live` cuando hay versión— y el diálogo muestran versión, última
  comprobación, estado, progreso y privacidad.
- **Persistencia.** `logs/updates.log` es JSONL con rotación a 256 KiB y sin
  URLs, rutas, versiones ni contenido. La caché de descargas vive en
  `%LOCALAPPDATA%`, fuera de `userData`.

### 2.8 Estado implementado de los mundos (#72)

- **Datos.** La migración `0002_worlds` crea `worlds` y `activity_log` con
  `CHECK` de estado, idioma, nombre, slug y géneros, índice único de slug e
  índices de estado y actividad. El borrado es lógico con `deleted_at` y la
  portada es una FK opcional a `assets` (`RESTRICT`).
- **Dominio.** `src/main/worlds/` no importa Electron: `slug.ts` genera y
  deduplica identificadores, `validation.ts` recorta y valida campos,
  `repository.ts` es la única capa con Drizzle y `service.ts` orquesta
  timestamps, IDs inyectables y actividad. Cada mutación y su fila de
  `activity_log` se agrupan en una transacción de better-sqlite3. La lista filtra
  `deleted_at`, la actividad se resuelve con `JOIN` y nunca se mezclan filas de
  dos mundos.
- **IPC.** Canales `worlds:list`, `get`, `create`, `update`, `duplicate`,
  `setArchived`, `remove` y `listActivity`, con esquemas Zod estrictos. Un error
  de dominio se traduce a `INVALID_INPUT`; el resto, a `INTERNAL_ERROR`. En modo
  seguro se registra un servicio no disponible que falla de forma estable.
- **UI.** El shell navega entre Inicio y Mundos. Desde #127 Inicio es una mesa de
  trabajo en una columna: «Continuar» (último mundo o ficha, persistido desde
  #132), «Mundos recientes» (cinco filas con «Ver todos los mundos» cuando
  sobran) y «Actividad reciente» (cinco entradas, secundaria), sin contadores ni
  accesos rápidos. La tarjeta de mundo comparte implementación con Mundos y
  muestra «Abrir» más un menú `⋯`. La página de un mundo muestra su ficha,
  progreso de preparación, actividad aislada y secciones previstas. Los diálogos
  de crear/editar, duplicar, archivar/restaurar y eliminar validan antes de enviar
  y piden confirmación.
- **Decisiones pendientes.** La portada se guarda y se muestra si existe, pero su
  selector llega con #115. La descripción enriquecida llegó con #114 (sección
  2.19). La papelera y la purga con copia llegaron con #77 y la FK
  `assets.world_id` se completará con #116.

### 2.9 Estado implementado de los tipos de entidad (#73)

- **Datos.** La migración `0003_entity_types` crea `entity_types` con `CHECK` de
  clave, nombre, JSON, coherencia entre `world_id` e `is_system`, índice único
  por mundo y clave, índice parcial de claves del sistema e índice de lista por
  mundo. Los 18 tipos del sistema se siembran con IDs UUIDv7 fijos.
- **Catálogo.** `src/shared/entity-types/catalog.ts` define los tipos
  (personaje, lugar, ciudad, nación, cultura, raza, organización, religión,
  deidad, magia, objeto, criatura, idioma, evento, conflicto, tecnología,
  flora/fauna y concepto) con icono Lucide, token de color y plantilla de campos.
  Una prueba compara el catálogo con el seed de la migración.
- **Plantillas y valores.** `src/shared/entity-types/fields.ts` valida con Zod la
  plantilla (claves únicas, opciones, rangos y límites) y valida los valores de
  una ficha con errores por `fieldKey`, sin textos visibles. La UI de #74
  reutilizará la misma función y el main repetirá la validación.
- **Dominio.** `src/main/entity-types/` no importa Electron: genera y deduplica
  claves, normaliza nombre, icono, color y plantilla, protege los tipos del
  sistema, aísla los personalizados por mundo, usa borrado lógico con
  `deleted_at`, duplica tipos a un mundo y exporta e importa un bloque
  `entity-types.v1` con solo los tipos personalizados.
- **IPC.** Canales `entityTypes:list`, `create`, `update`, `duplicate` y
  `remove`, con esquemas Zod estrictos y guardas en el preload. En modo seguro
  se registra un servicio no disponible. No hay UI en esta issue: la gestión
  visual de tipos y las fichas llegan con #74, y la exportación completa del
  mundo compone el bloque desde #78.
- **Mundos.** Duplicar un mundo copia sus tipos personalizados dentro de la
  misma transacción; el borrado lógico los conserva y la purga del mundo los
  elimina desde #77, salvo que se purguen individualmente antes.
- **Transferencia.** `exportTypes` e `importTypes` viven en el dominio de tipos;
  #78 integró su lógica en la exportación e importación del mundo mediante los
  bloques `entity-types.v1` y `relation-types.v1`, sin canal propio para los
  tipos.

### 2.10 Estado implementado de las fichas (#74)

- **Datos.** La migración `0004_entities` crea `entities`, `tags`, `entity_tags`
  y `entity_gallery` con FKs a `worlds`, `entity_types` y `assets`, índices por
  mundo y `CHECK` de estado, favorito, slug, JSON y posición. `user_version`
  pasa a 5 y el rollback de referencia elimina solo esas tablas.
- **Descripción.** `src/shared/entities/description.ts` valida un documento de
  ProseMirror con una lista cerrada de nodos y marcas, calcula el texto plano y
  rechaza HTML, nodos desconocidos y enlaces que no sean
  `wc-entity://<uuid>`. Tiptap 3 (MIT, ADR 0007) edita ese documento en el
  renderer; nunca se inyecta HTML. El editor de #131 vive en
  `src/renderer/components/editor/`: `RichTextEditor` compone la barra mínima de
  cinco acciones, el menú Formato, el diálogo de enlace y el typeahead de
  menciones, y `entity-description-editor.tsx` lo conecta con la ficha. La
  mención es texto con la marca `link` `wc-entity://<uuid>` insertado en una
  transacción de ProseMirror, sin HTML y sin nodo propio; el plugin de
  `extensions/mention.ts` resuelve los disparadores `@` y `[[` y el patrón
  combobox/listbox. Sin IPC ni datos nuevos (ADR 0026).
- **Dominio.** `src/main/entities/` no importa Electron: normaliza nombre, alias,
  resumen y estado; genera slugs únicos por mundo; valida la plantilla y los
  valores con la misma función de #73; comprueba referencias del mismo mundo y
  tipo; valida etiquetas y assets del mismo mundo; aplica borrado lógico y
  agrupa ficha, etiquetas y galería en una transacción. Los tipos con fichas
  vivas no se borran desde el dominio de tipos.
- **Assets.** `src/main/assets/service.ts` lista imágenes por mundo e importa las
  rutas elegidas por un diálogo nativo con el servicio de #66. El renderer solo
  recibe metadatos y usa `wc-asset://thumb/<id>` para miniaturas y
  `wc-asset://asset/<id>` para la imagen principal.
- **IPC.** Canales `entities:list`, `get`, `create`, `update`, `setFavorite` y
  `remove`; `tags:list` y `create`; y `assets:list` e `import`, todos con Zod
  estricto, guardas en el preload y servicio no disponible en modo seguro.
- **UI.** La página de fichas incluye búsqueda, filtros por tipo, etiqueta,
  favorito y estado, tarjetas con miniatura y etiquetas, y creación rápida. La
  ficha incluye autoguardado con debounce, editor Tiptap, atributos dinámicos,
  imagen principal, galería, etiquetas, favorito y borrado lógico. El diálogo de
  tipos permite crear, duplicar, editar y borrar tipos personalizados con un
  constructor de campos.
- **Papelera y versiones.** Desde #77 la ficha se restaura desde la vista
  Papelera y su descripción guarda historial en `entity_versions` (sección 2.16).
- **Pendiente.** La exportación completa con #78. El tipo de una ficha no cambia
  después de crearla.

### 2.11 Estado implementado de las relaciones (#75)

- **Datos.** La migración `0005_relations` crea `relation_types` y `relations`
  con FKs a `worlds`, `entities` y `relation_types`, índices por mundo, origen,
  destino y tipo, y `CHECK` de autorreferencia, fuerza 1–5, etiquetas, notas y
  JSON de metadatos. `user_version` pasa a 6 y el rollback de referencia elimina
  solo estas tablas.
- **Catálogo.** `src/shared/relations/catalog.ts` define los 18 tipos del
  sistema con IDs UUIDv7 fijos, clave estable, etiqueta directa, etiqueta
  inversa y token de color. Una prueba compara el catálogo con el seed.
- **Dominio.** `src/main/relations/` no importa Electron: resuelve etiquetas
  efectivas, valida origen, destino y tipo contra el mismo mundo y las fichas
  vivas, rechaza autorreferencias, duplicados exactos y el duplicado invertido
  de tipos simétricos, protege los tipos del sistema y bloquea el borrado de
  tipos personalizados en uso. Las aristas con fichas en papelera se ocultan,
  no se destruyen.
- **IPC.** Canales `relationTypes:list`, `create`, `update` y `remove`, y
  `relations:list`, `create`, `update` y `remove`, con esquemas Zod estrictos y
  guardas en el preload. En modo seguro se registra un servicio no disponible.
- **API del grafo.** `relations:list` devuelve aristas con origen, destino y
  tipo resueltos y filtros por ficha y tipo; la ficha consume la misma API con
  `entityId` y M2-04 podrá pedir el mundo completo.
- **Interfaz.** La ficha muestra relaciones salientes y backlinks con la
  etiqueta que corresponde a cada lado. Cada arista permite navegar, editar y
  eliminar con confirmación; un gestor administra los tipos personalizados.
- **Exportación.** El modelo usa IDs y claves estables; desde #78 las relaciones
  se componen en el ZIP del mundo.

### 2.12 Estado implementado de la búsqueda (#76)

- **Datos.** La migración `0006_search` crea `search_documents`, la tabla FTS5
  `search_fts` (unicode61, sin diacríticos y prefijos 2/3/4), el vocabulario
  `search_vocabulary`, las vistas `search_world_documents`,
  `search_entity_documents` y `search_relation_documents` y los triggers de
  sincronización, incluidos los de etiquetas. `user_version` pasa a 7; el índice
  es reconstruible y no se exporta.
- **Dominio.** `src/main/search/` no importa Electron. Tokeniza la consulta,
  construye un `MATCH` con prefijos, usa `bm25`, `highlight` y `snippet`,
  combina filtros en SQL, expande términos del vocabulario con Levenshtein
  acotado cuando no hay coincidencia exacta, devuelve recientes y favoritos y
  reconstruye el índice en una transacción.
- **IPC.** Canales `search:query`, `search:suggestions` y `search:rebuild`, con
  esquemas Zod estrictos, límites de consulta, `LIMIT` acotado y guardas en el
  preload. En modo seguro se registra un servicio no disponible.
- **Interfaz.** La página de búsqueda ofrece consulta, filtros combinables,
  resultados resaltados con navegación por teclado y estados de carga, error y
  vacío con recientes y favoritos. La paleta `Ctrl+K` usa combobox/listbox,
  reúne comandos y resultados rápidos y se ignora en campos editables y con
  diálogos abiertos; desde #126 se abre también con el disparador de la barra
  superior y ya no ofrece Muestras.
- **Rendimiento.** La prueba de integración con 10.000 fichas sintéticas mide la
  consulta por debajo de 150 ms en el equipo de referencia; la optimización fina
  es M5-02.

### 2.13 Estado implementado del shell v2 (#126)

- **Alcance.** Solo renderer: `src/renderer/shell/`, `App.tsx`, componentes de
  barra y estilos. No cambian `src/main`, `src/preload`, `src/shared`, el
  esquema, las migraciones, el IPC, la CSP ni las dependencias.
- **Rail.** 240 px expandido y 64 px plegado sobre `--surface-sunken`. La
  navegación de producto se reduce a **Inicio** y **Mundos**; desaparecen el
  lema permanente, la versión y la búsqueda duplicada, y no se añaden entradas
  de Manuscritos, Mapas ni Grafo hasta que esas pantallas existan. Mundos queda
  como `aria-current` también en mundo, fichas y ficha. Desde #77 se añade
  **Papelera** como tercera entrada (sección 2.16).
- **Plegado.** Iconos con `aria-label` y tooltip accesible, `aria-expanded` y
  `aria-controls` en el botón. El estado se persiste desde #132. Se sustituyó el
  `title` nativo previsto por el tooltip accesible para no duplicar bocadillos.
- **Barra superior.** 56 px con un único `h1` contextual —nombre del mundo en
  mundo, fichas y ficha; etiqueta de vista en el resto— truncado a una línea con
  `title`, el disparador de la paleta `Ctrl+K` con `aria-keyshortcuts`, una sola
  acción primaria, el menú `⋯` de secundarias, actualizaciones como icono con
  punto y `aria-live` cuando hay versión, y el tema como icono sol/luna con
  etiqueta y tooltip. No hay campana.
- **Acciones por vista.** Inicio y Mundos: «Crear mundo» en la barra solo si hay
  al menos un mundo (con cero manda el estado vacío) y «Crear una ficha» en
  `⋯`. Mundo: «Nueva ficha» como primaria y editar, duplicar,
  archivar/restaurar y eliminar en `⋯`. Fichas: «Nueva ficha» en la página y
  «Gestionar tipos» en su `⋯`. Ficha: guardado en el contenido, favorito visible
  y «Mover a la papelera» en `⋯`. Búsqueda: sin primaria y «Reconstruir el
  índice» en `⋯`.
- **Vistas y hash.** `src/renderer/shell/views.ts` declara `AppView`,
  `AppNavView` y `ShellPrimaryAction` sin JSX para probarlos en Node.
  `internal-views.ts` resuelve `#/internal/samples` como vista interna de
  Muestras; cualquier otro hash vuelve a Inicio y salir de Muestras limpia la
  URL con `history.replaceState`. Muestras no aparece en el rail, la paleta ni
  el manual como pantalla de usuario.
- **Búsqueda y paleta.** La búsqueda completa de #76 se conserva. Se entra por
  el disparador de la barra o la paleta; el comando pasa a «Abrir la página de
  búsqueda», se retira el comando de Muestras y la paleta mantiene la
  reconstrucción del índice.
- **Enlace de salto.** Enfoca `#wc-main` con `preventDefault` para no cambiar el
  hash ni la vista; el `main` conserva `tabIndex={-1}`.
- **Tipografía.** Se retira el alias `--font-display` de `scales.css`; la marca
  y el chrome usan `--font-ui` y el contenido, `--font-content`.
- **Pruebas.** `tests/unit/shell/` e `internal-views` cubren la resolución de
  vistas; `tests/components/shell.test.tsx` la navegación, el plegado, la
  primaria única y el menú; `tests/e2e/shell.spec.ts` las medidas de 64/56 px,
  el hash interno, una sola primaria por vista y la ventana a 1024/1280/1600 px;
  axe recorre los dos temas con el rail expandido y plegado. El cierre deja 447
  unitarias (4 omitidas), 87 de componentes, 134 de integración (1 omitida) y 42
  E2E en verde.

### 2.14 Estado implementado de Inicio y tarjetas de mundo (#127)

- **Alcance.** Solo `src/renderer` y estilos, más pruebas: no cambian
  `src/main`, `src/preload`, `src/shared`, el esquema, las migraciones, el IPC,
  la CSP, las dependencias ni la persistencia.
- **Composición.** `home-page.tsx` ordena «Continuar» (condicional) → «Mundos
  recientes» → «Actividad reciente» en una columna. No hay contadores, rejilla de
  accesos rápidos ni lead. Con mundos, la primaria «Crear mundo» vive en la barra
  superior y el contenido no declara ninguna; con cero mundos manda el estado
  vacío.
- **Continuar.** `resolveContinueTarget` (`lib/recent-location.ts`) valida el
  destino contra la biblioteca: si no hay destino o el mundo ya no está, devuelve
  `null` y el bloque se omite. Desde #132 el destino vive en `app_settings` y se
  conserva entre sesiones; al eliminar el mundo recordado se limpia y, si la ficha
  desapareció, se degrada al mundo con el aviso existente.
- **Tarjeta y marca.** `WorldCard` usa `WorldMark`; con `coverAssetId` pinta la
  miniatura `wc-asset://thumb/<id>` y, sin ella, un sello CSS con
  `data-motif`/`data-tone` calculados por `worldMarkVariant`
  (`lib/world-mark.ts`, FNV-1a del `id`). La tarjeta es la misma en la fila de
  Inicio y en la rejilla de Mundos; el contenedor decide la disposición y las
  acciones. «Abrir» y el menú `⋯` son los únicos controles.
- **Fechas.** `formats.ts` añade `formatRelativeTime` con
  `Intl.RelativeTimeFormat` y `now` inyectable; el `<time>` conserva `dateTime` y
  `title` con la fecha completa. Los textos viven en `messages/es.ts`.
- **Estados.** Carga con `aria-busy`, `role="status"` y tres esqueletos; error
  con `role="alert"` y reintento; vacío con una sola primaria.
- **Pruebas.** `tests/unit/` cubre formatos, marca y destino; `home-page.test` y
  `worlds.test` cubren componentes y tarjeta; `tests/e2e/worlds.spec.ts` cubre
  continuar mundo y ficha, recarga, borrado, menú, ventana y axe. El cierre deja
  447 unitarias (4 omitidas), 87 de componentes, 134 de integración (1 omitida) y
  42 E2E en verde.

### 2.15 Estado implementado de las preferencias de interfaz (#132)

- **Alcance.** Contrato compartido `src/shared/contracts/preferences.ts`, dominio
  y repositorio en `src/main/preferences/`, hook en `src/renderer/preferences/`,
  tema en `src/renderer/theme.ts`, arranque en `src/main/window.ts` y fondo nativo
  en `src/main/window-background.ts`, más IPC, preload y pruebas. No hay migración
  nueva: usa `app_settings` de `0000_init`; no toca tablas de dominio, assets,
  copias ni dependencias.
- **Contrato puro.** Define los dos temas, las cuatro secciones de ficha, el ancho
  280–360 px con 320 por defecto, las vistas persistibles —`home`, `worlds`,
  `search`, `world`, `entities`, `entity`, `trash` y `settings`, sin `samples`— y
  el último destino (mundo o ficha con nombre opcional). Incluye valores por
  defecto congelados, fusión de parches sin mutación, recorte del ancho y guardas
  estrictas de forma. #79 añade `density` y `fontScale` (sección 2.18).
- **Servicio y repositorio.** Una fila de `app_settings` por clave con prefijo
  `ui.` y valor JSON: `ui.theme`, `ui.density`, `ui.font-scale`,
  `ui.rail-collapsed`, `ui.entity-view`, `ui.last-view` y
  `ui.recent-location`. La lectura es tolerante por clave: un JSON
  roto o un valor inválido cae a su defecto sin contagiar al resto y no se
  reescribe. La escritura compara con lo almacenado, actualiza `updated_at` y
  agrupa todo en una transacción; `recentLocation: null` borra la fila. `reset`
  borra solo el prefijo `ui.` con `GLOB` sensible a mayúsculas y devuelve los
  defectos. En modo seguro, un servicio de sustitución lee los defectos, aplica el
  tema al cromo y falla al escribir.
- **IPC y preload.** Canales `preferences:get`, `preferences:update` y
  `preferences:reset` en la allowlist, con Zod estricto y al menos una clave en el
  parche; el servicio revalida aunque el router ya lo haya hecho. El preload
  publica `window.worldCraft.preferences` congelado y comprueba el snapshot con
  `isUiPreferences`; no hay `sendSync`, `invoke` genérico ni canales dinámicos.
- **Arranque sin parpadeo.** El main lee el tema antes de crear la ventana y
  aplica `nativeTheme` y el fondo nativo exactamente igual a `--bg`
  (`#f6f4ef`/`#141715`). La ventana nace oculta y se muestra cuando coinciden
  `ready-to-show` y `did-finish-load`, con un límite de 2.500 ms. El renderer lee
  el snapshot antes de montar React, fija `data-theme` antes de `createRoot`,
  descarta respuestas tardías tras 1.500 ms y nunca duplica la lectura bajo
  `StrictMode`. Si el tema no se puede leer, se abre en Claro sin bloquear.
- **Renderer.** `useUiPreferences` recibe el snapshot del bootstrap, aplica cada
  cambio de forma optimista con una secuencia que descarta respuestas viejas y
  adopta el snapshot canónico cuando llega. El tema se aplica en el mismo evento
  del clic, sin esperar al IPC. Un fallo de escritura conserva el estado de la
  sesión, sin toast, `aria-live` ni estado de «guardando». No usa `localStorage`.
- **Arranque y navegación.** La aplicación abre **siempre en Inicio**; `lastView`
  se guarda pero no navega ni toca el hash. «Continuar» valida el destino contra la
  biblioteca, se limpia al borrar el mundo o la ficha y degrada al mundo con el
  aviso existente si la ficha desapareció.
- **Datos.** Las preferencias viven en la base local, entran en las copias
  automáticas y una restauración las recupera. La exportación de un mundo no las
  incluye. El reset no borra mundos, fichas, imágenes, relaciones, copias ni
  `schema_migrations`; el panel y las secciones son globales, no por ficha ni por
  tipo, y a ≤ 1180 px el panel se apila sin aplicar el ancho guardado.
- **Pruebas.** `tests/unit/preferences/` cubre contrato, validación y handlers;
  `tests/integration/preferences/service.test.ts` la persistencia, la transacción,
  el reset y la preservación; `tests/components/preferences.test.tsx` el hook; y
  `tests/e2e/preferences.spec.ts` el reinicio, el reset por API y la matriz
  1024/1280/1600 px con ambos temas y axe. El cierre deja 518 unitarias (4
  omitidas), 171 de componentes, 146 de integración (1 omitida) y 53 E2E en verde.

### 2.16 Estado implementado de la papelera y las versiones (#77)

- **Alcance.** Migración `0007_trash_versions`; dominios puros en
  `src/main/trash/` (repositorio, servicio y normalización de cursor) y
  `src/main/versions/` (repositorio, servicio y política); copia previa en
  `src/main/backup/`; contratos `trash.ts` y `versions.ts`; siete canales IPC;
  vista Papelera, historial en la ficha, textos y estilos; y pruebas. Sin
  dependencias nuevas.
- **Datos.** `entity_versions` guarda `id`, `entity_id` con FK `ON DELETE
  CASCADE`, `description` JSON nullable, `description_text`, `label`, `origin`
  (`auto`, `manual`, `restore`) y `created_at`, con `CHECK` de origen, etiqueta
  1–120, JSON de objeto y texto ≤ 50 000. Índices
  `entity_versions_entity_created_idx`, `entities_deleted_idx` y
  `entity_types_deleted_idx`. `user_version` pasa a 8; el rollback de referencia
  solo elimina esos objetos (ADR 0028).
- **Papelera.** `trash:list` pagina por cursor `${deletedAt}:${id}` con orden
  `deleted_at DESC, id DESC` (50 por defecto, 200 máximo) y devuelve mundos,
  fichas y tipos personalizados con su origen y si el mundo está en papelera.
  Restaurar devuelve `not-found`, `already-restored`, `world-in-trash` o
  `type-unavailable` como resultado, en transacción y sin cascada. Purgar exige
  el literal `delete-forever`, crea y verifica `backups/pre-purge`, y luego borra
  en una transacción: ficha → relaciones, versiones, etiquetas y galería; mundo →
  `activity_log`, relaciones, galería, etiquetas, versiones, fichas, tipos,
  etiquetas del mundo y mundo. Vaciado: una copia, una transacción, contadores y
  tipos en uso omitidos. Una cola serializa purgas y vaciado. Los assets no se
  tocan (D8; #116).
- **Versiones.** `entities.update` llama al registrador dentro de su misma
  transacción y guarda el estado saliente solo si la descripción cambia y la
  última automática está fuera de 5 minutos. Se conservan 20 automáticas por
  ficha durante 90 días, 50 manuales con etiqueta y sin caducidad, y las de
  origen `restore` no se podan. Restaurar inserta antes una copia del estado
  actual, aplica la versión y poda automáticas. La lista solo devuelve metadatos
  y vista previa de 2 000 caracteres; una ficha en papelera no lista ni crea
  versiones y la purga las borra en cascada.
- **IPC.** `trash:list`, `restore`, `purge` y `empty`, y `versions:list`,
  `create` y `restore`, con Zod estricto, UUIDv7, límites 1–200, cursores y
  literales de confirmación; guardas en el preload y servicios `unavailable` en
  modo seguro. Los fallos de negocio viajan como resultado, no como excepción.
- **Interfaz.** Papelera como vista del rail (Inicio · Mundos · Papelera) con tres
  secciones, estados de carga, error, vacío y **Cargar más**; restauración y
  purga con diálogos destructivos, casilla obligatoria en el vaciado y foco
  devuelto. Historial como sección no persistida bajo Descripción, con origen,
  fecha, etiqueta, vista previa, **Guardar versión** y **Restaurar**.
- **Búsqueda y exportación.** Las vistas FTS5 y los canales existentes ya
  excluyen `deleted_at` y los triggers reindexan al restaurar; no se duplica la
  condición en el renderer. #78 exporta solo contenido vivo en mundos vivos e
  incluirá las versiones de las fichas exportadas.
- **Pruebas.** Unitarias de contratos, validación, handlers, política y manifiesto;
  integración de migración y preservación desde `0006`, papelera, versiones,
  copia previa, búsqueda y assets; componentes de papelera e historial; E2E del
  flujo crítico. Typecheck, lint, `db:check`, build y `verify:build` en verde; la
  suite queda en 557 unitarias (4 omitidas), 188 de componentes, 158 de
  integración (1 omitida) y los E2E de papelera y auditoría visual en verde.

### 2.17 Estado implementado de la exportación e importación (#78)

- **Alcance.** Contratos en `src/shared/contracts/transfer.ts`; dominio puro en
  `src/main/transfer/` (`format/`, `archive/`, `export/`, `import/`,
  `protocol.ts`, `worker-entry.ts`, `cleanup.ts`, `logger.ts`, `safe-paths.ts`,
  `fs.ts`, `errors.ts`, `dialogs.ts`, `composition.ts` y `coordinator.ts`); IPC
  (`transfer:exportWorld`, `transfer:importWorld` y `transfer:cancel`) y evento
  `transfer:event` fuera de la allowlist; API `transfer` en el preload; hook,
  reducer, diálogo y estilos en el renderer; pruebas; y
  `out/main/transfer-worker.cjs` en el build. La migración de #114 sube
  `user_version` a 9 y el formato a v2; se mantienen las dos dependencias MIT
  (`yauzl` y `yazl`).
- **Formato.** ZIP abierto `world-craft-world` v2 desde #114, con
  `manifest.json`, `world.json` y `assets/<uuidv7>.webp`; `formatVersion: 2`
  (lectura de 1), `schemaVersion` = `user_version` (9), `assetsIncluded: true`,
  recuentos, avisos y `files` con `path`, `size` y `sha256`; `world.json` con
  mundo y su descripción como documento ProseMirror, tipos personalizados, tipos
  de relación personalizados, etiquetas, assets, fichas con versiones, galería,
  imagen principal, atributos y etiquetas, relaciones y portada. Solo contenido
  vivo de mundos vivos y siempre con assets; fuera papelera, `activity_log`,
  FTS5, preferencias, `description_text`, miniaturas y bloques futuros. Los
  paquetes v1 se convierten al leerlos. El detalle está en
  [`formato-de-exportacion.md`](formato-de-exportacion.md), el ADR 0029 y el ADR
  0031.
- **Exportación.** `transfer:exportWorld` valida el UUID, resuelve el mundo vivo
  y abre el diálogo nativo de guardado. El worker abre SQLite en solo lectura,
  lee una instantánea diferida, construye un `world.json` determinista, verifica
  tamaño y SHA-256 de cada asset contra la base, escribe el ZIP en
  `<destino>.<uuidv7>.partial`, lo vuelve a leer para comprobar manifiesto,
  `world.json` y checksums, y publica con `rename`. Un fallo limpia el
  `.partial` y conserva el destino anterior. El nombre propuesto se sanea para
  Windows y termina en `.zip`.
- **Importación.** `transfer:importWorld` abre el selector nativo. El worker
  valida el índice del ZIP, el manifiesto —incluido que `schemaVersion` no supere
  el `user_version` instalado, que se propaga del proceso principal— y
  `world.json`, comprueba checksums,
  extrae y re-codifica los assets con los límites del servicio, genera un plan
  con UUIDv7 nuevos y remapea referencias. El proceso principal revalida rutas,
  plan y assets, abre una única transacción, inserta en orden de claves
  foráneas, renombra `assets/.tmp/<operationId>/<worldId>` a
  `assets/worlds/<worldId>` antes del commit y registra `world.imported`. Nunca
  fusiona ni sobrescribe: el mundo importado es nuevo, activo y con el slug
  global resuelto con sufijo si hacía falta.
- **Progreso y cancelación.** El coordinador añade `operationId`, `unit` y
  `cancelable` a los eventos del worker y los publica por `transfer:event`
  (`webContents.send`). `cancel` devuelve `{ cancelled: false }` si la fase es
  `saving`; en el resto aborta el `AbortController` y limpia el staging. Una
  sola operación activa devuelve `TRANSFER_BUSY`.
- **Modo seguro.** `createUnavailableTransferCoordinator` devuelve
  `TRANSFER_UNAVAILABLE` sin abrir diálogos ni escribir; el renderer muestra el
  error traducido.
- **Ciclo de vida.** `persistence.ts` limpia `imports/.tmp`, `exports/.tmp` y
  `assets/.tmp` tras un arranque `ready` y antes de la ventana, con un logger
  `logs/transfer.log`; `before-quit` llama a `dispose()` del coordinador y mata
  el worker si sigue vivo. La limpieza no toca `assets/worlds`.
- **Pruebas.** Unitarias de contrato, formato, rutas, manifiesto, `world.json`,
  remapeo, plan, ZIP, protocolo, coordinador, diálogos, IPC, preload y reducer;
  integración de exportación e importación con SQLite real (round-trip,
  determinismo, checksums, corrupción, traversal, enlaces, nombres reservados,
  límites, ratio, espacio, cancelación, rollback, slugs y limpieza);
  componentes del diálogo y del hook; y E2E de transferencia 1/1. La suite queda
  en 671 unitarias (4 omitidas), 213 de componentes y 204 de integración
  (1 omitida).

### 2.18 Estado implementado de Ajustes y datos (#79)

- **Alcance.** Contrato `src/shared/contracts/data.ts`; dominio y composición en
  `src/main/data/` (`constants`, `errors`, `counts`, `usage`, `folders`,
  `orphans`, `library/`, `verified-copy`, `delete-all`, `service`, `dialogs`,
  `composition` y `unavailable`); canales y esquemas `src/main/ipc/`; página
  `settings-page.tsx`, componentes `components/settings/`, hook
  `settings/use-data-settings.ts`, estilos `styles/settings.css` y textos en
  `src/renderer/messages/es.ts`. Se añade `settings` a las vistas persistidas y
  `routes.ts` resuelve `#/settings`. #79 no añade migración: `user_version` se
  quedó en 8 hasta `0008_world_description` (#114), que lo sube a 9.
- **Apariencia.** `UiPreferences` gana `density` (`comfortable`/`compact`) y
  `fontScale` (`small`/`normal`/`large`), con defectos y guardas en el contrato.
  `applyAppearance` fija `data-theme`, `data-density` y `data-font-scale` antes de
  `createRoot` y en cada cambio; `scales.css` redefine espaciado o tokens
  `--text-*`, nunca el tamaño raíz, `zoom` ni `transform`. «Restablecer
  apariencia» usa `update` con los valores por defecto y **no** `reset`;
  «Restablecer preferencias» usa `reset` tras confirmación.
- **Navegación.** Ajustes vive en `.wc-shell__rail-footer`, encima del botón de
  plegar, con icono, tooltip y `aria-current="page"`. También se abre con el
  comando **Abrir Ajustes** de la paleta, que usa la misma función de navegación,
  y por `#/settings`; `lastView` admite `settings` pero el arranque sigue en
  Inicio.
- **Servicio de datos.** Siete canales (`data:getSummary`, `getUsage`,
  `openFolder`, `exportAll`, `deleteAll`, `planOrphans` y `purgeOrphans`), Zod
  estricto, literales de confirmación, guardas puras en el preload y API
  congelada `window.worldCraft.data`. Los fallos de dominio viajan como
  `{ status: 'failed', code }` con códigos `DATA_*`; una entrada inválida sigue
  siendo `INVALID_INPUT`. Las lecturas no bloquean; exportar, purgar y borrar
  comparten una única mutación y la segunda recibe `DATA_BUSY`. En modo seguro,
  `unavailable` devuelve `DATA_UNAVAILABLE` para las operaciones y mantiene la
  apertura de carpetas cuando la ruta es válida.
- **Carpetas y uso.** El renderer envía un enum y recibe `{ opened: true }`; el
  main crea la carpeta, valida cada componente con `lstat`, comprueba `realpath`
  y no devuelve rutas. La interfaz solo muestra nombres y rutas relativas. La
  medición de uso se detiene a las 100 000 entradas o 4 s, marca `partial` y
  separa base, imágenes, copias, registros y temporales; `assets/.tmp` cuenta
  como temporal, igual que en el borrado.
- **Huérfanas.** El resumen agrega el plan de #66 (archivos sin referencia,
  miniaturas, temporales, ausentes, enlaces y entradas desconocidas) y la purga
  exige `purge-orphans`, crea copia verificable y no toca archivos
  referenciados.
- **Biblioteca total.** `world-craft-library` v1 con `manifest.json`,
  `settings.json`, `database/world-craft.sqlite` y un paquete #78 por mundo en
  `worlds/<slug>.zip`. La base se obtiene con `sqlite.backup`, se verifica con
  `inspectBackupFile` y es completa (papelera, actividad y preferencias, también
  `lastView` y `recentLocation`); `settings.json` omite esos dos últimos y los
  paquetes de mundo excluyen papelera, actividad y preferencias. La exportación
  usa staging en `exports/.tmp`, `.partial` junto al destino, comprobación de
  espacio, verificación del ZIP completo y `rename`; es todo-o-nada y no incluye
  copias automáticas ni huérfanas. El manifiesto se valida con Zod estricto y se
  comprueba que el conjunto real de entradas coincida (corrección del MEDIUM de
  seguridad). La importación sigue siendo mundo a mundo con #78.
- **Borrado total.** `deleteAll` comprueba la confirmación y la transferencia
  activa, valida las raíces antes y después de copiar y crea
  `backups/pre-delete/<timestamp>/` con base v2 `pre-delete`, `assets/`
  verificado con `assets-manifest.json` y `recovery.json`. Después cierra la
  persistencia y borra temporales → base → assets → logs → copias, conservando
  `pre-delete`, las entradas desconocidas de `userData`, `.updaterId` y la
  instalación. La verificación final produce `deleted` o `partial`; cualquier
  resultado exige reiniciar y la composición lanza `app.relaunch()`/`exit(0)` a
  los 750 ms. La copia `pre-delete` queda fuera de la restauración guiada.
  Exportar con una transferencia recién iniciada se rechaza con `DATA_BUSY`
  (corrección del segundo MEDIUM).
- **Privacidad y logs.** Ni los resultados ni los logs incluyen rutas, hashes,
  IDs, nombres, tamaños ni contenido. El contrato `data.operation` solo admite
  operación, resultado y código; en esta entrega no se conecta un sumidero nuevo.
- **Pruebas.** Unitarias de contratos, guardas, uso, carpetas, huérfanas,
  manifiesto, biblioteca, borrado y handlers; integración con SQLite y `userData`
  temporales (pre-delete, preservación, sentinel de instalación, fallos
  inyectados, importación de un paquete); componentes de Ajustes y datos; y E2E
  de navegación, persistencia, carpetas, exportación/importación, huérfanas,
  borrado con reinicio y matriz 1024/1280/1600 con ambos temas. La suite queda en
  762 unitarias, 251 de componentes y 231 de integración.

### 2.19 Estado implementado de la descripción enriquecida del mundo (#114)

- **Alcance.** Contrato en `src/shared/contracts/worlds.ts`; módulo compartido
  `src/shared/worlds/description.ts`; migración `0008_world_description` y
  rollback; cambios en `src/main/worlds/` (`validation`, `repository`, `service`);
  formato portable v2 y remapeo en `src/main/transfer/format/`; envoltorios
  `world-description-editor.tsx` y `world-description-view.tsx`; diálogo de
  mundo, página del mundo, mensajes y estilos. **No hay canales IPC nuevos ni
  dependencias nuevas.**
- **Módulo compartido.** `src/shared/worlds/description.ts` reutiliza la
  validación cerrada de `src/shared/entities/description.ts` y aplica los límites
  del mundo: **4.000 caracteres de texto plano** y **200.000 de JSON**. Expone
  `validateWorldDescription` y `parseWorldDescription`; una descripción vacía o
  con solo párrafos vacíos se normaliza a `null`. La lectura es tolerante: si el
  JSON guardado no encaja, el servicio reconstruye el documento desde
  `description_text`. No es una segunda lista de nodos.
- **Contrato.** `WorldDetail.description` es `WorldRichTextDocument | null`, un
  alias estructural de la descripción de ficha con solo importación de tipos.
  `WorldCreateInput.description` y `WorldUpdateInput` aceptan documento o `null`;
  `isWorldDetail` acepta `null` o `{ type: 'doc', content? }`. `WorldSummary` no
  cambia, de modo que listas y tarjetas no cargan el documento.
- **Flujo main → preload → renderer.** El renderer envía el documento por los
  canales existentes de `worlds`; el router lo valida con Zod y el servicio de
  `src/main/worlds/` normaliza, valida los enlaces contra fichas vivas del mundo,
  calcula `description_text` y escribe documento, texto y actividad en la misma
  transacción. El repositorio lee ambas columnas; el preload valida la forma con
  guardas puras y el renderer pinta el documento con `RichTextEditor`. El texto
  plano **nunca se acepta del renderer**.
- **Enlaces y duplicado.** Los `wc-entity://` solo admiten UUIDv7 de fichas no
  borradas del mismo mundo; en creación se rechaza cualquier enlace. Al duplicar
  se quitan las marcas de enlace conservando el texto y se recalcula el texto
  plano (`stripRichTextLinks`), porque las fichas no se copian.
- **Migración.** `0008_world_description` añade `description_text`, convierte el
  texto plano párrafo a párrafo (`json_object`, `json_group_array` y
  `group_concat` con orden), recrea `search_world_documents` sobre texto plano,
  repuebla `search_documents` y reconstruye FTS5. `user_version` pasa a 9. El
  runner crea la copia pre-migración y el rollback de referencia degrada a texto
  plano y restaura la vista y los triggers de `0006`.
- **Búsqueda.** La búsqueda global no cambia de canal: `search:query` sigue
  leyendo `search_documents`, que ahora recibe el texto visible del mundo desde
  `description_text`. El JSON nunca se indexa.
- **Transferencia.** `TRANSFER_FORMAT_VERSION` pasa a 2; el manifiesto acepta
  `formatVersion` 1 y 2 y escribe 2. `world.json` guarda el documento o `null`;
  un paquete v1 convierte su texto a párrafos antes de validarse y un
  `formatVersion` mayor que 2 se rechaza con `TRANSFER_FORMAT_UNSUPPORTED`. El
  remapeo de enlaces usa el mismo mapa de IDs y cuenta `broken-entity-link` si no
  puede resolver un destino. `description_text` se recalcula al importar.
- **UI.** `WorldDescriptionField` (crear/editar) y `WorldDescriptionView`
  (lectura) son envoltorios finos del editor compartido: barra de 3 controles en
  creación y 5 en edición, estados de candidatas con reintento, roles
  `combobox`/`textbox`/lectura, contador y error de 4.000, `--border-strong` en el
  formulario y navegación de enlaces solo en la página. `Dialog` ignora Escape
  con `defaultPrevented` para no cerrar el modal al cerrar un popover.
- **Pruebas.** Unitarias del módulo compartido y del remapeo; componentes de
  creación, edición, carga, error, exceso, pegado saneado, vacío y lectura;
  integración de migración `0007 → 0008`, preservación, rollback, guardado,
  duplicado y transferencia v1/v2; E2E del flujo de edición, ventana, temas, axe
  y movimiento reducido. El detalle de la decisión está en el
  [ADR 0031](adr/0031-descripcion-enriquecida-del-mundo-y-formato-v2.md).

## 3. Flujo de una operación

### 3.1 Arranque (implementado, #64, #67 y #68)

```text
requestSingleInstanceLock()               (antes de whenReady; si falla, salir)
  → app.setName(APP_NAME) → app.getPath('userData')
  → registerLocalAssetScheme()            (antes de whenReady)
  → initializePersistence()
    → rutas, carpetas y log de arranque
    → detectar restos de restauración       (.rollback*, .restore.tmp*, .pending)
    → abrir SQLite sin WAL → integrity_check
    → user_version + schema_migrations
    → copia pre-migración si la base existía y hay pendientes
    → WAL + synchronous = NORMAL
    → migraciones en una transacción
    → integrity_check posterior
    → copias automáticas del periodo en curso y rotación 7/4/12/5 más 10 pre-purga
    → ready: registrar protocolo de assets, componer actualizador, registrar IPC
      (incluidas las preferencias), leer el tema con preferences.get()
      (fallo → Claro), aplicar nativeTheme y el fondo --bg y crear la ventana
      oculta hasta ready-to-show + did-finish-load (fallback 2.500 ms)
    → safe-mode: diálogo nativo (restaurar, abrir copias, continuar o salir),
      actualizador deshabilitado y preferencias de sustitución sin escritura
```

La ventana no se crea hasta que el arranque termina. Solo en estado `ready` se
registran el handler de `wc-asset://` y el IPC, se ejecutan las copias
automáticas y se compone el actualizador. El tema se lee **antes** de crear la
ventana y se aplica a `nativeTheme` y al fondo nativo, de modo que el primer frame
ya tiene el tema guardado; el renderer, además, resuelve su bootstrap antes de
montar React. En modo seguro no hay ninguna vía de lectura ni de escritura y el
actualizador queda deshabilitado; el diálogo permite restaurar una copia
verificada desde `backups/`. Una restauración correcta relanza la aplicación y
vuelve a pasar por este flujo, incluida la copia previa a las migraciones
pendientes. `second-instance` enfoca la ventana de la instancia que ya tenía el
lock, sin adelantar la compuerta de visualización.

### 3.2 IPC

Los canales reales son `shell:openExternal`, los cinco de actualizaciones
(`updates:getState`, `check`, `cancel`, `download` e `install`), los ocho de
mundos (`worlds:list`, `get`, `create`, `update`, `duplicate`, `setArchived`,
`remove` y `listActivity`), los cinco de tipos de entidad (`entityTypes:list`,
`create`, `update`, `duplicate` y `remove`), los seis de fichas
(`entities:list`, `get`, `create`, `update`, `setFavorite` y `remove`), los dos
de etiquetas (`tags:list` y `create`), los cuatro de tipos de relación
(`relationTypes:list`, `create`, `update` y `remove`), los cuatro de relaciones
(`relations:list`, `create`, `update` y `remove`), los tres de búsqueda
(`search:query`, `suggestions` y `rebuild`), los tres de preferencias
(`preferences:get`, `update` y `reset`), los dos de assets (`assets:list` e
`import`), los siete de papelera y versiones (`trash:list`, `restore`, `purge` y
`empty`; `versions:list`, `create` y `restore`), los tres de transferencia
(`transfer:exportWorld`, `transfer:importWorld` y `transfer:cancel`) y los siete
de datos (`data:getSummary`, `getUsage`, `openFolder`, `exportAll`, `deleteAll`,
`planOrphans` y `purgeOrphans`). El evento `transfer:event` va por
`webContents.send` y no está en la allowlist de `invoke`. Una llamada a `shell:openExternal` recorre esta ruta:

```text
Llamada IPC (implementado, #63)
  renderer → window.worldCraft.shell.openExternal(url)
    → preload: función nominativa del contrato → ipcRenderer.invoke('shell:openExternal', { url })
    → main: comprueba remitente → allowlist → Zod (forma) → handler
    → handler: resolveExternalUrl(url) → shell.openExternal(url normalizada)
    → main: IpcResult<{ opened: true }> o error estable
    → preload: comprueba la forma del resultado → renderer
```

Actualizaciones (implementado, #68):

```text
renderer → window.worldCraft.updates.check()
  → preload: función nominativa → ipcRenderer.invoke('updates:check', {})
  → main: remitente + allowlist + strictObject({}) → servicio
  → snapshot inmediato (checking) y transición en segundo plano
  → evento updates:stateChanged validado por el preload → diálogo

download → consentimiento → CancellationToken + progreso
install  → solo desde downloaded → quitAndInstall (reinicio consentido)
```

Preferencias de interfaz (implementado, #132):

```text
Arranque
  main: preferences.get() → tema validado → nativeTheme + backgroundColor = --bg
    → ventana oculta → ready-to-show + did-finish-load → show()
  renderer: preferences.get() con timeout 1.500 ms → applyTheme antes de createRoot

Cambio
  clic → useUiPreferences aplica el tema en el mismo evento
    → preload preferences.update(patch) → allowlist + Zod estricto → servicio
    → fusión, escritura transaccional de lo que cambia, updated_at
    → snapshot canónico validado con isUiPreferences → adopción si es el último
```

### 3.3 Assets (implementado, #66)

```text
Carga de imagen
  renderer → <img src="wc-asset://asset/<assetId>">
    → main: protocol.handle
      → parseAssetUrl (asset|thumb + UUIDv7)
      → SELECT de la fila por id (SQLite)
      → coincidencia id y mundo → ruta relativa desde la base
      → lista blanca worlds/<uuid>/<uuid>.webp → lstat/realpath
      → Response 200 image/webp con nosniff, Content-Length, caché y CSP
    → 400/403/404/413/415/500 con cuerpo genérico y log sin rutas

Importación (servicio; IPC y UI desde #74)
  importAsset({ worldId, kind: 'image', source })
    → límite 25 MB → magic bytes → límites 8192 px / 24 Mpx
    → EXIF + sRGB + WebP 90 + miniatura 320 px
    → assets/.tmp/<assetId>/ → rename a worlds/<worldId>/
    → INSERT en assets → compensación si falla

Purga (servicio; sin IPC ni UI todavía)
  purgeOrphans({ confirmation: 'purge-orphans' })
    → plan de solo lectura → revalidar → copia en backups/orphans/
    → SHA-256 + manifiesto → borrar solo entonces
```

Cada canal nuevo se declara en `src/shared/contracts/channels.ts`, añade su
esquema Zod y su handler en `src/main/ipc/` y su función nominativa en el
contrato del preload. Los errores nunca cruzan IPC como excepciones crudas: se
convierten en `{ ok: false, error: { code } }`. `assets:list` e `assets:import`
están implementados desde #74; `assets:purgeOrphans` sigue sin IPC ni UI.

### 3.4 Flujos de dominio

El flujo de **mundos** ya está implementado en #72 y sirve de patrón:

```text
Lectura de mundos
  renderer → window.worldCraft.worlds.list()
    → preload: función nominativa → ipcRenderer.invoke('worlds:list', {})
    → main: remitente → allowlist → Zod → servicio → repositorio Drizzle
    → guarda estructural en el preload → lista o error tipado

Mutación de mundos
  renderer → window.worldCraft.worlds.create(input)
    → preload → main: Zod estricto → servicio (slug, validación, timestamps)
    → transacción SQLite (worlds + activity_log) → WorldDetail
    → el renderer refresca la biblioteca y la actividad
```

Lectura de fichas (implementado, #74):

```text
renderer → window.worldCraft.entities.list({ worldId, filter })
  → preload: función nominativa → ipcRenderer.invoke('entities:list', payload)
  → main: remitente → allowlist → Zod → Drizzle (filtro por world_id) → IpcResult
  → preload: guarda estructural → renderer: tarjetas o error tipado
```

Importación de una imagen (implementado, #74):

```text
renderer → window.worldCraft.assets.import({ worldId })
  → main: Zod → dialog.showOpenDialog → importAsset (WebP + miniatura)
  → main: fila en assets → IpcResult con id, tamaño y alt (sin rutas)
  → renderer: añade el id a la galería y muestra wc-asset://thumb/<id>
```

Purga de la papelera (implementado, #77):

```text
renderer → window.worldCraft.trash.purge({ kind, id, confirm: 'delete-forever' })
  → main: remitente → allowlist → Zod → servicio (cola serializada)
  → precheck (vivo → already-purged) → copia pre-purge verificable
  → si la copia falla: { purged: false, reason: 'backup-failed' } y no se borra
  → transacción: recheck → borrado ordenado (activity_log primero si es mundo)
  → { purged: true } o motivo de dominio
```

Versiones de una ficha (implementado, #77):

```text
entities.update({ description })
  → transacción de fichas: aplica el cambio y llama a versions.recordBeforeChange
  → guards: descripción saliente no vacía + última auto fuera de 5 min
  → INSERT en entity_versions (estado saliente) → poda 20/90 días

versions.restore({ versionId })
  → transacción: valida ficha viva y pertenencia → INSERT origin 'restore' del
    estado actual → aplica la versión → poda → { restored: true }
```

Los flujos de relaciones, mapas, manuscrito y juego son el **objetivo** una vez
existan sus tablas e issues; todavía no tienen canales ni consultas.

### 3.5 Exportación e importación (implementado, #78)

```text
Exportar mundo
  renderer → window.worldCraft.transfer.exportWorld({ worldId })
    → preload nominativo → transfer:exportWorld → allowlist + Zod (UUIDv7)
    → coordinador: mundo vivo → dialog.showSaveDialog → nombre .zip saneado
    → utilityProcess.fork('out/main/transfer-worker.cjs')
    → worker: SQLite readonly → snapshot diferida → world.json determinista
      → assets verificados (kind image, MIME WebP, tamaño y SHA-256)
      → ZIP en <destino>.<uuidv7>.partial → relectura y checksums
    → main: rename atómico al destino
    → eventos transfer:event (fase, progreso, avisos, cancelable)
    → resultado { worldId, worldName, fileName, size, counts, warnings }
```

```text
Importar mundo
  renderer → window.worldCraft.transfer.importWorld()
    → preload → transfer:importWorld → allowlist + strictObject({})
    → coordinador: dialog.showOpenDialog → operationId UUIDv7
    → utilityProcess.fork('out/main/transfer-worker.cjs')
    → worker: índice ZIP cerrado → manifest + world.json + checksums
      → extracción a imports/.tmp/<operationId>/assets
      → WebP por magic bytes → re-codificación + miniatura
      → plan.json con IDs nuevos y remapeo
      → assets/.tmp/<operationId>/<worldId>
    → main: valida rutas, plan, assets y espacio
    → transacción: worlds → entity_types → relation_types → tags → assets →
      entities → entity_tags → entity_gallery → entity_versions → relations
      → rename assets/.tmp/…/<worldId> → assets/worlds/<worldId>
      → UPDATE cover_asset_id → activity_log('world.imported') → commit
    → resultado { worldId, worldName, slug, slugAdjusted, counts, warnings }
```

El coordinador es la única pieza que conoce Electron: abre los diálogos, arranca
el worker, traduce los mensajes con Zod y publica los eventos. El renderer nunca
recibe rutas ni IDs internos de filas: solo fase, progreso, recuentos, el nombre
y el id del mundo y el nombre del archivo de salida. `saving` no se puede
cancelar; antes de esa fase, `transfer:cancel` aborta y limpia el staging. El
detalle del formato está en
[`formato-de-exportacion.md`](formato-de-exportacion.md).

### 3.6 Ajustes, exportación total y borrado (implementado, #79)

```text
Abrir Ajustes
  rail (pie) o paleta → navigate('settings') → hash #/settings
    → SettingsPage: preferencias, apariencia, idioma, atajos, actualizaciones y datos
    → applyAppearance(data-theme, data-density, data-font-scale) antes de createRoot
    → preferences.update({ density, fontScale, theme }) → snapshot canónico

Exportar todos los datos
  renderer → window.worldCraft.data.exportAll()
    → preload → data:exportAll → allowlist + strictObject({})
    → main: mutación exclusiva → dialog.showSaveDialog (cancelar = cancelled)
    → transferencia activa tras el diálogo = DATA_BUSY
    → staging exports/.tmp/<operationId>: paquete #78 por mundo,
      settings.json y database/world-craft.sqlite (sqlite.backup verificado)
    → manifiesto con tamaños y SHA-256 → espacio libre → .partial → relectura
      completa y verificación → rename al destino
    → resultado { fileName, size, worlds, counts, warnings } o failed/cancelled

Eliminar todos los datos
  renderer: frase ELIMINAR TODO + keepBackups → data:deleteAll
    → preload fija delete-all-data → Zod literal + boolean
    → main: DATA_BUSY si hay transferencia → validar raíces
    → backups/pre-delete/<timestamp>/: base v2 pre-delete + assets verificados
      + recovery.json → volver a validar raíces → cerrar persistencia
    → borrar temporales → data → assets → logs → copias (salvo keepBackups)
    → verificación final → deleted/partial + restartRequired
    → app.relaunch() + app.exit(0) a los 750 ms
```

El renderer nunca recibe rutas, nombres de archivo internos ni hashes; los
resultados solo llevan recuentos, el nombre de la biblioteca elegido por el
usuario y códigos estables. La copia `pre-delete` no se ofrece en la restauración
guiada del modo seguro.

## 4. Persistencia y datos

La persistencia local está implementada desde M0-04 (#64), el servicio de assets
desde M0-06 (#66), las copias automáticas con restauración desde M0-07 (#67), el
empaquetado con actualización manual desde M0-08 (#68) y la pantalla de Ajustes
con la gestión de datos desde M1-08 (#79). Las copias manuales y la restauración
guiada desde Ajustes siguen previstas.

- **SQLite** en `%APPDATA%\World Craft\data\world-craft.sqlite`, con una única
  conexión de escritura en el proceso principal.
- **WAL** para lecturas concurrentes y escrituras rápidas; `foreign_keys=ON`,
  `busy_timeout=5000`, `synchronous=NORMAL`.
- **Drizzle ORM** para el esquema y las consultas tipadas. Drizzle Kit solo
  genera y revisa migraciones; el runner propio las aplica.
- **Migraciones** en `drizzle/`: `0000_init` crea `schema_migrations` y
  `app_settings`; `0001_assets` crea `assets`; `0002_worlds` crea `worlds` y
  `activity_log`; `0003_entity_types` crea `entity_types` y siembra los tipos
  del sistema; `0004_entities` crea `entities`, `tags`, `entity_tags` y
  `entity_gallery`; `0005_relations` crea `relation_types` y `relations` y
  siembra los tipos de relación del sistema; `0006_search` crea el índice FTS5,
  sus vistas y triggers; `0007_trash_versions` crea `entity_versions` y los
  índices de papelera; y `0008_world_description` añade `worlds.description_text`,
  convierte las descripciones planas y redirige la vista del mundo al texto plano.
  `PRAGMA user_version` guarda el número de migraciones aplicadas (hoy 9).
- **Copias** en `%APPDATA%\World Craft\backups\`: `daily` (7), `weekly` (4),
  `monthly` (12), `pre-migration` (5), `pre-purge` (10), `pre-delete` (sin poda)
  y `pre-restore` (sin poda). Cada copia lleva `manifest.json` v2, SHA-256 e
  integridad; las automáticas solo contienen SQLite, no assets. `pre-delete` es
  la excepción: copia también los assets y `recovery.json` porque el borrado
  total los elimina. La restauración se ofrece desde el diálogo de modo seguro de
  M0-07; Ajustes abre la carpeta de copias pero no restaura. La purga de la
  papelera exige una copia `pre-purge` verificable y el borrado total, una
  `pre-delete` verificable.
- **FTS5** está disponible en el binario; `search_fts` indexa mundos, fichas y
  relaciones y se mantiene con triggers desde #76. Los tipos de mapa,
  manuscrito y escena se añadirán a las vistas y triggers con sus migraciones de
  M2 (mapas) y M3 (manuscritos y escenas).
- **Assets** en `%APPDATA%\World Craft\assets\worlds\<worldId>\<assetId>.webp`
  con miniatura `.thumb.webp`, `.tmp/` para escrituras y `backups/orphans/` para
  la purga recuperable (implementado, #66). La purga de la papelera **no borra
  assets**: las filas de un mundo purgado quedan huérfanas hasta que #116 añada
  la FK `assets.world_id` y su cuarentena.
- **Papelera y versiones** viven en la base: `deleted_at` en mundos, fichas y
  tipos, y `entity_versions` con el estado saliente de la descripción. Entran en
  las copias y una restauración las recupera; lo purgado solo se recupera desde
  la copia `pre-purge`.
- **Preferencias de interfaz** en `app_settings` con claves `ui.*` y valor JSON
  (`ui.theme`, `ui.density`, `ui.font-scale`, `ui.rail-collapsed`,
  `ui.entity-view`, `ui.last-view` y `ui.recent-location`), sin migración nueva
  desde #132/#79. La lectura es tolerante por clave, la escritura es
  transaccional y el reset solo borra ese prefijo. Como viven en la misma base,
  las copias automáticas las incluyen, la exportación de un mundo no y la
  biblioteca total sí, dentro de su copia completa de SQLite.
- **Exportación e importación** de mundo implementadas (#78) y en formato v2
  desde #114: ZIP abierto `world-craft-world` con `manifest.json`, `world.json`
  (incluye la descripción del mundo como documento y los bloques
  `entity-types.v1` y `relation-types.v1` con los tipos personalizados) y
  `assets/<uuidv7>.webp`. La exportación se publica en el destino elegido por el
  usuario; el staging vive en `imports/.tmp` y `assets/.tmp` y se limpia al
  arrancar. La importación siempre crea un mundo nuevo con IDs regenerados y
  acepta paquetes v1. El detalle está en
  [`persistencia.md`](persistencia.md) §8 y
  [`formato-de-exportacion.md`](formato-de-exportacion.md).
- **Biblioteca total y borrado** implementados en #79: `world-craft-library` v1
  con `manifest.json`, `settings.json`, un paquete #78 por mundo y
  `database/world-craft.sqlite` (copia completa y verificada); borrado total con
  `backups/pre-delete` de base y assets, confirmación tipada, verificación y
  reinicio. Sin migración y sin dependencias nuevas.

El detalle está en [`docs/persistencia.md`](persistencia.md),
[`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md) y
[`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 5. Seguridad y límites de confianza

- **Renderer no confiable.** Implementado: `contextIsolation`, `sandbox`,
  `nodeIntegration: false`, `webSecurity: true` y `webviewTag: false`; además
  `app.enableSandbox()` antes de crear ventanas.
- **Preload mínimo.** Implementado: publica un objeto congelado con `appInfo` y
  las APIs nominativas de actualizaciones, mundos, tipos, fichas, etiquetas,
  assets, preferencias, papelera, versiones, transferencia y datos; nunca
  `ipcRenderer`, `require`, rutas del sistema ni un `invoke` genérico.
- **CSP estricta.** Implementada: producción sin `unsafe-eval`, `unsafe-inline`
  ni orígenes remotos, inyectada antes de los scripts; desarrollo solo permite
  inline y loopback para Vite. `img-src` admite `wc-asset:` desde #66.
- **Navegación y ventanas.** Implementado: `will-navigate`, `will-redirect`,
  `will-frame-navigate`, `setWindowOpenHandler` y `will-attach-webview` deniegan
  cualquier salto o ventana nueva. `setWindowOpenHandler` abre los destinos
  `https:` válidos en el navegador del sistema con el `shell.openExternal` del
  proceso principal y deniega siempre la ventana de Electron.
- **Red y permisos.** Implementado: todos los permisos se deniegan, las descargas
  se cancelan y `webRequest` cancela HTTP(S) y WebSocket remotos; en desarrollo
  solo deja pasar loopback. `ELECTRON_RENDERER_URL` se ignora empaquetado.
- **DevTools.** Implementado: deshabilitadas en la versión empaquetada.
- **IPC allowlisted.** Implementado (#63): allowlist de canales en
  `src/shared/contracts/channels.ts`, comprobación del remitente, validación Zod
  de la entrada en el main, respuesta `IpcResult` y errores tipados sin detalles
  internos. La salida se comprueba estructuralmente en el preload, sin Zod.
- **Enlaces externos.** Implementado (#63): solo `https:` absolutas, sin
  credenciales, sin espacios ni controles, con longitud máxima de 2048 y rechazo
  de loopback y redes privadas. Se abre la URL normalizada. Un fallo al abrir no
  navega la ventana: el guard lo descarta y el canal lo devuelve como
  `INTERNAL_ERROR`. La política aprobada admite cualquier `https:` válido; la
  allowlist de dominios llegará con la pantalla de ayuda.
- **Datos y Ajustes.** Implementado (#79): el renderer solo envía enums,
  booleanos y tokens fijados en el preload; el main resuelve rutas, valida
  contención con `lstat`/`realpath` sin seguir enlaces y no devuelve rutas. El
  borrado valida todas las raíces antes y después de copiar y conserva
  `userData`, `.updaterId` y la instalación. La biblioteca se lee entera para
  verificar hashes antes de publicarse y el manifiesto se valida con Zod
  estricto. Los canales están en la allowlist y las guardas del preload rechazan
  formas inesperadas. Sin red ni telemetría.
- **Base de datos.** Implementado (#64): vive solo en `userData`, el renderer no
  tiene acceso, `src/main/db/` no importa Electron y los errores usan códigos
  estables. El journal se valida con Zod, el checksum es SHA-256 y el SQL de
  migración se revisa. El guard de base ajena mira tablas: una base con solo
  vistas, triggers o índices no se detecta, pero la migración choca y deja modo
  seguro sin escribir (LOW aceptado).
- **Modo seguro.** Implementado (#64, ampliado en #67): sin conexión de
  escritura, log JSONL con rotación y sin SQL, filas, rutas ni contenido, y
  diálogo nativo con rutas ya resueltas en `main`. Desde M0-07 el aviso permite
  restaurar una copia verificada; desde #79 Ajustes muestra los datos como no
  disponibles, mantiene la apertura de carpetas y no permite exportar ni borrar.
- **Copias y restauración.** Implementado (#67): la carpeta elegida se valida con
  `realpath`/`relative` dentro de `backups/`; cada copia se verifica por
  manifiesto, tamaño, SHA-256, `integrity_check` y `user_version`; se rechazan
  las versiones futuras y las copias `pre-restore`; antes de reemplazar se crea
  una copia en bruto de la base actual; `.restore.lock` y `.restore.pending`
  evitan restauraciones solapadas y la creación de una base vacía tras un cierre
  abrupto; el reemplazo usa `.rollback*` y revierte si falla. Los logs
  `backup.schedule` y `backup.restore` no incluyen rutas, nombres, tamaños,
  SHA, identificadores ni contenido. El lock de restauración no es una exclusión
  mutua entre procesos, pero el bloqueo de instancia única de #68 impide que dos
  procesos compitan por restaurar. Residuales: un lock obsoleto o ilegible puede
  requerir borrado manual, una base de 0 bytes se considera nueva, una base
  válida con restos obliga a modo seguro, la limpieza fallida de `.rollback*`
  puede repetir el modo seguro y la durabilidad cubre el cierre del proceso, no
  un corte de energía.
- **Instancia única.** Implementado (#68): `requestSingleInstanceLock()` antes
  de `whenReady`, de la base, del IPC y de la ventana; el segundo proceso sale y
  la instancia existente recibe `second-instance` y enfoca su ventana. El lock
  de restauración sigue siendo una protección adicional dentro del proceso.
- **Actualizador.** Implementado (#68): sin auto-check, consulta solo desde la UI,
  descarga con consentimiento, cancelación real, instalación solo desde
  `downloaded` y actualización deshabilitada en desarrollo, modo seguro o sin
  `app-update.yml`. La partición `electron-updater` usa `cache:false` y solo
  permite HTTPS a GitHub y sus descargas; se sanean `x-user-staging-id`,
  `authorization`, `private-token` y `cookie`, y los permisos se deniegan.
  `logs/updates.log` no incluye URLs, rutas, versiones ni contenido. La
  verificación de la firma está desactivada de forma coherente con el instalador
  sin firmar (ADR 0015); la firma Ed25519 de manifiestos se decide en M5. La
  cancelación de la comprobación descarta el resultado por `epoch`, pero no
  aborta el socket de `checkForUpdates()` (LOW aceptado).
- **Firma y distribución.** El instalador y `latest.yml` no están firmados. La
  integridad se apoya en HTTPS, SHA-512 y `SHA256SUMS`; SmartScreen se documenta
  en el manual. La firma Authenticode es opcional y de pago (ADR 0015).
- **Assets y rutas.** Implementado (#66): gramática cerrada de `wc-asset://`, la
  ruta relativa sale de SQLite, coincidencia de ID y mundo, lista blanca
  `worlds/<uuid>/<uuid>.webp`, rechazo de `..`, rutas absolutas, UNC, NUL,
  symlinks y junctions con `lstat`/`realpath`, MIME único y cabeceras seguras.
  Importación por magic bytes con límites y re-codificación; purga con token,
  copia verificada y manifiesto. Residuales aceptados en el
  [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md): TOCTOU de escritura
  temporal y de lectura, raíces creadas antes de validar contención,
  `backups/orphans` sin inspeccionar y symlinks de archivo sin cubrir en Windows
  sin modo desarrollador.
- **Exportación e importación.** Implementado (#78): el worker de transferencia
  usa una ruta fija, no importa Electron, no usa red, `eval` ni
  `child_process`, valida cada mensaje con Zod y abre SQLite en solo lectura para
  exportar; el proceso principal ejecuta la transacción y comprueba las rutas
  que devuelve el worker antes de leer o borrar. La importación aplica una
  política cerrada de entradas (traversal, absolutas, UNC, `\`, `:`, nombres
  reservados, mayúsculas, duplicados, directorios, enlaces y cifrado), límites
  D4 antes y durante la extracción, ratio 100:1, checksums SHA-256, detección por
  magic bytes y re-codificación de imágenes con los límites del servicio. El
  staging y el renombrado están contenidos con `lstat`/`realpath` y rechazo de
  junctions; la transacción única y el rollback no dejan filas parciales. Los
  canales están en la allowlist, el preload valida la forma del resultado,
  `fileName` es solo un nombre sin separadores y los logs no incluyen rutas, IDs,
  nombres ni contenido. Sin copia previa: la operación solo añade.
- **Contenido rico.** Previsto (M3): JSON de ProseMirror; HTML saneado solo al
  exportar.
- **Secretos.** No hay claves de servicios en la app. Los certificados de firma,
  si existen, viven fuera del repositorio.
- **Privacidad.** Sin telemetría, cuentas ni subida de datos.

El detalle está en el [ADR 0004](adr/0004-electron-security-typed-ipc.md) y en
[`SECURITY.md`](../SECURITY.md).

## 6. Calidad, CI y distribución

- **Pruebas.** `pnpm test` ejecuta 671 pruebas unitarias (4 omitidas por
  symlinks en Windows sin modo desarrollador), 213 de componentes y 204 de
  integración (1 omitida): scaffold (ventana, navegación, CSP e identidad),
  contrato IPC, router IPC, API del preload, enlaces externos, journal, checksum,
  rutas, UUIDv7, logger, modo seguro, tokens, contraste y licencia de fuentes, servicio de assets
  (URL, rutas, formatos, importación, huérfanos, protocolo y log), copias
  (manifiesto, rutas de restauración, buckets, rotación y recuperación),
  empaquetado (configuración, iconos y licencias), actualizador (contrato,
  servicio, red, log y textos), mundos (slug, validación, esquemas IPC y guardas),
  tipos de entidad (catálogo, plantillas, valores, claves y esquemas IPC),
  fichas (descripción, esquemas IPC, handlers y tarjetas), relaciones
  (validación, catálogo, esquemas y handlers), búsqueda (consulta, esquemas,
  handlers y API), fechas relativas, marca procedural y destino de «Continuar»,
  preferencias de interfaz (contrato, validación, handlers, persistencia y reset),
  transferencia (formato, rutas, manifiesto, `world.json`, remapeo, plan, ZIP,
  protocolo, coordinador, diálogos, IPC y reducer) e instancia única; además,
  arranque, migraciones, copia, corrupción, versión adelantada, base ajena,
  preservación, rollback de referencia, importación, protocolo, repositorio y
  purga con SQLite real, CRUD, aislamiento, actividad y atomicidad de mundos,
  CRUD, protección, aislamiento, duplicación y transferencia de tipos, CRUD,
  etiquetas, favoritos, galería y filtros de fichas, relaciones y backlinks,
  indexación, prefijos, filtros, reconstrucción y rendimiento de búsqueda,
  creación, restauración, rotación y restauración interrumpida de copias,
  preservación entre instalaciones y round-trip, corrupción, traversal, límites,
  cancelación, rollback, slugs y limpieza de la transferencia.
  `pnpm test:e2e` abre la aplicación real con Playwright Electron y un `userData`
  temporal: shell y medidas del rail, ventana a 1024, 1280 y 1600 px, temas, axe
  sobre el shell con rail expandido y plegado y sobre Muestras por su hash,
  design v2 con tooltip y menú abiertos, CRUD de mundos, continuidad entre
  sesiones en Inicio, preferencias persistentes con reinicio y reset por API,
  tarjetas de mundo, fichas, relaciones y búsqueda con teclado y textos largos, y
  transferencia real 1/1 con exportación, inspección del ZIP, importación en un
  perfil con datos previos, preservación, avisos, traversal, ventana, temas y
  movimiento reducido. `pnpm build` y
  `pnpm verify:build` validan los artefactos, incluido
  `out/main/transfer-worker.cjs`; `pnpm verify:worker` comprueba SQLite y libvips
  dentro del utility process; `pnpm verify:native` comprueba
  better-sqlite3 y sharp en Node y Electron; `pnpm verify:package` valida el
  paquete y `scripts/verify-install.ps1` prueba la instalación real.
- **CI.** GitHub Actions: jobs `lint` (con `format:check`), `typecheck`, `test` y
  `build` (con `db:check` y `verify:build`) en `ubuntu-latest`; `package` en
  `windows-latest` con `verify:native`, `dist`, `verify:build`,
  `package:checksums` y `verify:package --installer`; `gitleaks` y `audit`. Los
  cuatro primeros son required desde #69; `package` sigue sin serlo hasta M5, y
  gitleaks y audit no bloquean. `test` incluye las pruebas de componentes desde
  #70; los E2E no tienen job de PR (Windows-only) y se ejecutan en local antes
  de `review` y en el workflow de release de M5. El job `package` no publica, no
  usa `GH_TOKEN` y no sube artefactos. La caché de pnpm se configura en
  `.github/actions/setup` con `cache: pnpm`, sin secretos ni servicios de pago.
- **Instalador.** Implementado (#68): electron-builder 26.18.0 con NSIS por
  usuario; `pnpm dist` genera `release/world-craft-0.1.0-setup.exe` y
  `pnpm dist:dir` una carpeta desempaquetada para pruebas. El paquete desempaqueta
  `better-sqlite3` y `sharp` del asar, poda los binarios no x64 e incluye
  `LICENSE`, `THIRD-PARTY-NOTICES.md` y `licenses/`. La release pública sigue
  prevista para M5.
- **Release.** Prevista (M5): tag `vX.Y.Z`, workflow que compila, publica en
  GitHub Releases con `latest.yml` y los checksums, y prueba la actualización
  real. La firma de código sigue siendo opcional (ADR 0015).
- **Actualización.** Implementada (#68) como comprobación manual desde la barra
  superior y desde Ajustes, descarga consentida y cancelable, e instalación solo
  con reinicio consentido. El auto-check y su interruptor siguen previstos para
  M5-05; la actualización real contra GitHub Releases se prueba en M5.
- **Datos.** El instalador por usuario y el desinstalador no tocan `userData`; la
  app migra con copia previa. La prueba real de 0.1.0→0.1.1 conservó 194 archivos.

El detalle está en el [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md),
[ADR 0013](adr/0013-ci-releases.md) y
[`docs/calidad/plan-de-pruebas.md`](calidad/plan-de-pruebas.md).

## 7. Evolución por fases

| Fase | Qué añade a la arquitectura |
|---|---|
| **M0** | Baseline, ventana segura, SQLite/Drizzle, IPC, diseño, assets, backups, CI, instalador y actualizador manual. |
| **M1** | Mundos, fichas, tipos, etiquetas, relaciones, búsqueda, Ajustes con apariencia y datos, papelera, exportación e importación de mundos y biblioteca total. El interruptor de actualizaciones queda para M5-05. |
| **M2** | Mapas vectoriales y grafo. |
| **M3** | Editor de manuscritos, herramientas de escritura y exportadores. |
| **M4** | Dados, tablas de inspiración y packs de contenido. |
| **M5** | Auditoría de a11y/temas/rendimiento, release, auto-update, manual y beta 1.0. |

Cada fase puede añadir módulos en `src/renderer/modules/` y canales IPC, pero no
cambia las reglas de dependencia de la sección 2.

## 8. Cómo se mantiene

Este documento se actualiza cuando cambian **procesos, módulos, dependencias o
flujos**. Si el cambio fija una decisión arquitectónica, se crea o supersede un
ADR y se enlaza desde la tabla de la sección 1. El registro histórico de
decisiones está en [`docs/registro-decisiones.md`](registro-decisiones.md).

## 9. Enlaces

- [Plan de desarrollo](plan-desarrollo.md)
- [Registro de decisiones](registro-decisiones.md)
- [Índice de ADRs](adr/README.md)
- [Proceso SDD](proceso-sdd.md)
- [Persistencia](persistencia.md)
- [Modelo de datos](base-de-datos/esquema.md)
- [Migraciones](base-de-datos/migraciones.md)
- [ADR 0016: SQLite, migraciones y modo seguro](adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017: Servicio de assets y purga recuperable](adr/0017-assets-service-sharp-orphan-purge.md)
- [ADR 0018: Empaquetado NSIS, actualizador manual y preservación](adr/0018-nsis-packaging-and-update-service.md)
- [ADR 0019: Mundos del MVP](adr/0019-worlds-crud-mvp.md)
- [ADR 0020: Tipos de entidad y campos personalizados](adr/0020-entity-types-custom-fields.md)
- [ADR 0027: Preferencias de interfaz persistentes](adr/0027-ui-preferences-persistence.md)
- [ADR 0028: Papelera, versiones y copia previa a la purga](adr/0028-trash-versions-and-pre-purge-backup.md)
- [ADR 0029: Exportación e importación de mundos](adr/0029-world-export-import.md)
- [Formato de exportación](formato-de-exportacion.md)
- [Continuidad y copias](continuidad.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
- [Cambio a escritorio](cambio-a-escritorio.md)
