# Arquitectura de World Craft

> **Estado:** vigente desde el 18/11/2026, tras el pivote a aplicación de
> escritorio. Sustituye por completo la arquitectura web anterior.
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
**mundos con CRUD, dashboard y actividad** (#72) y los **tipos de entidad con
catálogo y campos personalizados** (#73): ventana Electron segura, preload
nominativo, renderer React con tokens, componentes base y navegación, base
SQLite con migraciones, comprobación de integridad y modo
seguro, servicio de imágenes con protocolo propio, miniaturas y purga
recuperable, copias automáticas con retención, verificación y restauración,
instalación por usuario sin administrador, actualizaciones manuales, cancelables
y consentidas, bloqueo de instancia única, gestión de mundos con su actividad y
tipos de entidad con plantillas y transferencia. La subida y la galería
visibles, la interfaz de Ajustes y las copias manuales llegan en M1; la release
pública y la actualización real contra GitHub Releases, en M5. Las secciones
distinguen lo implementado de lo previsto.

## 1. Vista general

```text
┌──────────────────────────────────────────────────────────────────┐
│ Proceso principal de Electron                                     │
│  ventana · SQLite · assets · backups · export/import · updates    │
│  IPC allowlisted + Zod · protocolo wc-asset:// · logs locales     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ contextBridge (API tipada)
┌───────────────────────────────▼──────────────────────────────────┐
│ Renderer (React + Vite + TypeScript)                              │
│  shell · fichas · grafo · mapas · editor · juego · ajustes        │
│  CSS con tokens · componentes propios · estado de UI              │
└──────────────────────────────────────────────────────────────────┘
```

| Pieza | Estado | Dónde se decide |
|---|---|---|
| Electron + Vite + React + TypeScript | Implementado (M0-02, #62) | [ADR 0001](adr/0001-electron-vite-react-typescript.md) |
| SQLite + better-sqlite3 + Drizzle + FTS5 | Implementado (M0-04, #64): base, migraciones y modo seguro; FTS5 disponible en el binario, esquema en M1 | [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md) |
| Instalador NSIS, actualizaciones y preservación de datos | Implementado (M0-08, #68): instalador local 0.1.0 y actualizador manual; release pública y actualización real en M5 | [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Seguridad Electron e IPC tipado | Implementado: ventana segura (#62) e IPC con allowlist y Zod (#63) | [ADR 0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales y protocolo propio | Implementado (M0-06, #66): importación a WebP, miniatura, `wc-asset://` y purga recuperable; sin IPC ni UI en M0 | [ADR 0005](adr/0005-local-assets-custom-protocol.md), [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md) |
| Dos temas y sistema de diseño | Implementado: tokens, temas, componentes base y shell (#65); tema en memoria hasta Ajustes | [ADR 0006](adr/0006-two-themes-desktop-design-system.md) |
| Tiptap y exportadores | Previsto (M3) | [ADR 0007](adr/0007-tiptap-editor-exporters.md) |
| MapLibre/Terra Draw y React Flow/ELK | Previsto (M2) | [ADR 0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| i18n centralizada | Implementado (M0-11, #71): catálogo tipado, proveedor y formatos `Intl`; faltan persistir el locale y las traducciones en/it | [ADR 0009](adr/0009-centralized-i18n.md) |
| Tipos de entidad y campos personalizados | Implementado (M1-02, #73): catálogo de 18 tipos, CRUD por API, validación Zod y transferencia `entity-types.v1` en dominio; la UI llega con #74 | [ADR 0020](adr/0020-entity-types-custom-fields.md) |
| Pruebas y calidad | Implementado: 339 unitarias (4 omitidas), 19 de componentes y 108 de integración (1 omitida) (#62-#73); E2E de shell, ventana, temas, axe y mundos (#70, #72) | [ADR 0010](adr/0010-testing-strategy.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Modelo local de un solo usuario | Vigente | [ADR 0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | Implementado (M0-07, #67): copias automáticas 7/4/12, pre-migración 5, verificación y restauración desde modo seguro; UI de Ajustes y copias manuales en M1 | [ADR 0012](adr/0012-backup-restore-recovery.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md) |
| CI y releases | Parcial: lint, typecheck, test, build y package en Windows (#62–#68); releases previstos | [ADR 0013](adr/0013-ci-releases.md), [ADR 0018](adr/0018-nsis-packaging-and-update-service.md) |
| Estructura y tooling | Vigente | [ADR 0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional | Diferida | [ADR 0015](adr/0015-optional-code-signing-smartscreen.md) |

## 2. Procesos y directorios

Electron separa tres procesos con permisos distintos:

| Proceso | Responsabilidad | Puede acceder a |
|---|---|---|
| **Main** | Ventana, ciclo de vida, instancia única, guards de seguridad, IPC con handlers tipados, persistencia local (SQLite, migraciones, copia previa y modo seguro), servicio de assets con protocolo `wc-asset://`, servicio de mundos con CRUD y actividad, servicio de tipos de entidad con catálogo, plantillas y transferencia, copias de seguridad con restauración y actualizador manual; la UI de Ajustes llegará con su issue. | Node, Electron, disco. |
| **Preload** | Puente mínimo y tipado entre renderer y main: `appInfo`, `shell.openExternal`, actualizaciones, mundos y tipos de entidad; nunca un `invoke` genérico. | API de Electron limitada. |
| **Renderer** | Interfaz React, estado de UI, editor, mapa y grafo. | DOM, API expuesta por preload. Nunca Node ni SQLite. |

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/main/` | Composición del proceso principal, ventana, instancia única (`single-instance.ts`), guards de seguridad (`security/`), router IPC (`ipc/`), persistencia (`persistence.ts`), aviso de modo seguro (`safe-mode-*.ts`), protocolo de assets (`assets/`), composición de la recuperación y actualizador (`updates/`). | `src/shared/`, Node, Electron |
| `src/main/assets/` | Servicio de assets: importación, procesamiento con sharp, rutas, protocolo `wc-asset://`, repositorio de metadatos, huérfanos, purga y log. Sin Electron salvo la composición. | Node, sharp, Drizzle |
| `src/main/backup/` | Copias y restauración puros: manifiesto v2, creación online, verificación, inventario, rotación, programación por arranque, lock, marcador pendiente y reemplazo con rollback. No importa Electron (regla ESLint); la composición vive en `persistence.ts` y `safe-mode-recovery.ts`. | Node, better-sqlite3, Zod |
| `src/main/logging/` | Escritura JSONL con rotación compartida por el log de arranque, el de assets y el del actualizador. | Node |
| `src/main/db/` | Capa de datos pura: rutas, conexión, esquema Drizzle, journal, runner de migraciones, copia previa, integridad, logger y errores estables. No importa Electron (regla ESLint). | Node, better-sqlite3, Drizzle, Zod |
| `src/main/worlds/` | Dominio de mundos puro: normalización y slugs, repositorio Drizzle con filtros por `world_id` y `deleted_at`, servicio de CRUD y actividad, y errores de entrada. No importa Electron. | Drizzle, `src/shared/` |
| `src/main/entity-types/` | Dominio de tipos de entidad puro: claves, validación con Zod, repositorio con aislamiento por mundo, servicio con protección de los tipos del sistema, duplicación y transferencia JSON versionada. No importa Electron. | Drizzle, Zod, `src/shared/` |
| `src/main/ipc/` | Router único, esquemas Zod de entrada, handlers por canal y errores estables. | `src/shared/`, Electron, Zod |
| `src/main/security/` | CSP, guards de sesión y navegación, y política de enlaces externos. | Electron |
| `src/main/updates/` | Máquina de estados del actualizador sin Electron, adaptador de electron-updater, allowlist de red y saneado de cabeceras, log JSONL y composición. | Node, electron-updater, `builder-util-runtime` |
| `src/main/single-instance.ts` | Adquisición del lock de instancia única y foco de la ventana en `second-instance`; se prueba sin Electron. | — |
| `src/main/messages/` | Textos tipados de los diálogos nativos del proceso principal (`es.ts`). | — |
| `src/preload/` | `contextBridge` congelado que publica solo `window.worldCraft` (`appInfo`, `shell.openExternal`, `updates`, `worlds` y `entityTypes`); sin lógica de negocio, `ipcRenderer` ni `invoke` genérico. | `src/shared/`, Electron |
| `src/renderer/` | UI React, mensajes tipados, tema y estilos; el CRUD de mundos y su dashboard están implementados en #72. | `src/shared/`, API de `window.worldCraft` |
| `src/renderer/components/` | Componentes base implementados en #65 (`button`, `text-field`, `text-area-field`, `select-field`, `badge`, `card`, `empty-state`, `dialog`, `tabs`, `toast`, `tooltip`), control y diálogo de actualizaciones de #68 y tarjetas, diálogos de mundo y lista de actividad de #72; `editors/`, `maps/` y `graph/` son previstos. | Módulos del renderer, `src/shared/` |
| `src/renderer/updates/` | Textos de estado y acción principal del panel de actualizaciones, probados sin DOM con el idioma activo. | `src/shared/` |
| `src/renderer/shell/` | Shell de escritorio (`app-shell.tsx`): navegación, rail plegable, barra superior y `main` enfocable. | Componentes, mensajes, tema |
| `src/renderer/pages/` | Vistas del shell: `home-page.tsx` (dashboard y estado vacío), `worlds-page.tsx` (lista con búsqueda y filtros), `world-page.tsx` (ficha, progreso y actividad) y `samples-page.tsx` (muestras de desarrollo). | Componentes, mensajes |
| `src/renderer/theme.ts` | Tipo `ThemeMode`, tema por defecto y `applyTheme()` sobre `data-theme`; la persistencia llegará con Ajustes. | — |
| `src/renderer/modules/` | Casos de uso de UI por dominio: worlds, entities, relations, maps, graph, writing, game, search. El de mundos aún vive en `App.tsx` y sus componentes; las carpetas de dominio llegarán con las pantallas de M1. | API tipada, shared |
| `src/renderer/messages/` | Catálogo tipado del renderer: `es.ts` (fuente del tipo), `index.ts` (registro de idiomas) y `translator.ts` (claves y parámetros tipados). | — |
| `src/renderer/i18n/` | Composición del idioma: `create.ts` (`createI18n`), `provider.tsx` (`I18nProvider`, `useI18n`, `useMessages`) y `formats.ts` (fechas, números, listas y plurales con `Intl`). | Mensajes, `src/shared/` |
| `src/renderer/styles/` | `base.css` y `components.css` sobre los tokens de `styles/tokens/` (`palette.css`, `semantic.css` y `scales.css`). | — |
| `src/shared/` | Identidad, contratos y utilidades puras sin Node ni React. | — |
| `src/shared/contracts/` | Allowlist de canales, `IpcResult`, códigos de error, contrato de la API del preload, contrato del actualizador, contrato de idioma (`locale.ts`), contrato de mundos (`worlds.ts`) y contrato de tipos de entidad (`entity-types.ts`) con guardas estructurales. | - |
| `src/shared/entity-types/` | Catálogo del sistema en código y validación compartida con Zod de plantillas y valores de campos, reutilizable por main y por la futura UI de fichas. | Zod |
| `tests/unit/` | Pruebas unitarias del scaffold, del contrato IPC, de los guards, de los enlaces externos, de la capa de datos (journal, checksum, rutas, UUIDv7, logger y modo seguro), del sistema de diseño (tokens y contraste), de i18n (catálogo, formatos y cadenas hardcodeadas), del servicio de assets (rutas, URL, formatos, importación, huérfanos, protocolo y log), de copias (manifiesto, rutas de restauración, buckets y rotación), del empaquetado (configuración, iconos y licencias), del actualizador (contrato, servicio, red, log y textos), de los mundos (slug y validación), de los tipos de entidad (catálogo, plantillas, valores, claves y esquemas IPC) y de instancia única. | `src/` |
| `tests/integration/` | Arranque y migraciones contra una base SQLite real en `os.tmpdir()`; copia, integridad, preservación y rechazo de bases ajenas; CRUD, aislamiento y actividad de mundos; CRUD, protección, aislamiento, duplicación y transferencia de tipos de entidad; importación, protocolo, repositorio y purga de assets; creación, verificación, restauración, rotación y restauración interrumpida de copias; preservación de datos entre instalaciones. | `src/` |
| `tests/components/` | Testing Library y `jsdom`: botón, pestañas, patrones de teclado, estados, formularios y tarjetas de mundo, y lectura de textos desde el proveedor de idioma. | `src/renderer/` |
| `tests/e2e/` | Playwright Electron: shell, ventana a 1024/1280/1600 px, temas, axe, CRUD de mundos, teclado y textos largos con `userData` temporal e aislado. | `src/` |
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
- **Ventana.** Se crea a 1280×800, con mínimo 1024×700, oculta hasta
  `ready-to-show` y con fondo acorde a `nativeTheme` para evitar destellos. No
  recuerda tamaño ni posición: esa persistencia sigue prevista.
- **Preload.** `contextBridge` publica un objeto congelado con `appInfo` (nombre y
  versión); desde #63 añade también `shell.openExternal` (sección 2.2). No expone
  `ipcRenderer`, `require` ni un `invoke` genérico.
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

### 2.2 Estado implementado del IPC (#63, #68 y #72)

- **Contrato compartido.** `src/shared/contracts/` contiene la allowlist
  `IPC_CHANNELS` (hoy `shell:openExternal`, los cinco canales de actualizaciones,
  los ocho de mundos y los cinco de tipos de entidad), el resultado discriminado
  `IpcResult` con los códigos
  `INVALID_INPUT`, `UNKNOWN_CHANNEL`, `INTERNAL_ERROR` y `UNTRUSTED_SENDER`, y
  `createWorldCraftApi({ invoke })`,
  que construye la API congelada del preload. Son módulos puros: no importan
  Electron, Node ni Zod.
- **Preload nominativo.** Publica `appInfo`, `shell.openExternal(url)`, la API
  `updates` (desde #68), la API `worlds` (desde #72) y la API `entityTypes`
  (desde #73). No expone `ipcRenderer`,
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

### 2.4 Estado implementado del sistema de diseño (#65)

- **Tokens.** `src/renderer/styles/tokens/` contiene `palette.css` (única fuente
  de hex y valores con alfa), `semantic.css` (roles por tema con overrides
  agrupados en `:root`/`[data-theme="light"]` y `[data-theme="dark"]`) y
  `scales.css` (espaciado, radios, tipografía, movimiento, z-index y medidas del
  shell de 240/64/56 px). Se importan antes de `base.css` y `components.css` en
  `main.tsx`.
- **Tema.** `src/renderer/theme.ts` aplica `data-theme` en `<html>` y arranca en
  Claro (`DEFAULT_THEME`). El botón de la barra superior conmuta en memoria; la
  persistencia en `config.json` y la pantalla de Ajustes son posteriores.
- **Componentes.** `src/renderer/components/` tiene componentes nativos
  (botón, campo de texto, insignia, tarjeta, estado vacío, diálogo, pestañas,
  toast y tooltip) sin Radix/shadcn ni dependencias nuevas. El diálogo usa
  `<dialog>` con `showModal()`; las pestañas siguen el patrón ARIA con flechas e
  Inicio/Fin.
- **Shell.** `src/renderer/shell/app-shell.tsx` compone el enlace de salto, el
  rail de 240 px plegable a 64 px, la barra superior de 56 px, la navegación con
  `aria-current` y `main` con `tabIndex={-1}`. No hay router.
- **Vistas.** `src/renderer/pages/home-page.tsx` muestra el estado vacío real y
  `samples-page.tsx` revisa los componentes con contenido largo; la página de
  muestras es solo de desarrollo.
- **Tipografía.** Las pilas de `scales.css` usan Fraunces, Inter y JetBrains Mono
  con respaldo del sistema; el empaquetado OFL de las fuentes sigue pendiente y
  no hay `@font-face` ni recursos remotos.
- **Verificación.** `tests/unit/design-tokens.test.ts` resuelve los tokens de
  cada tema, calcula contraste WCAG y comprueba la disciplina de colores.
  `tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell en los dos temas
  y `tests/e2e/shell.spec.ts` comprueba la ventana a 1024, 1280 y 1600 px. La
  matriz visual completa, las capturas y la auditoría de todas las pantallas
  siguen en #93.

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
- **Sin IPC ni UI.** No hay canal nuevo: la subida y la galería llegan con las
  fichas (M1). Los residuales de seguridad (TOCTOU, raíces no validadas antes de
  crear, `backups/orphans` sin comprobar y symlinks de archivo omitidos en
  Windows) están en el [ADR 0017](adr/0017-assets-service-sharp-orphan-purge.md).

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
- **Restauración.** Se ofrece desde el diálogo nativo de modo seguro (la UI de
  Ajustes llega en M1). Valida la carpeta con `realpath`/`relative` dentro de
  `backups/`, verifica antes y después, crea `backups/pre-restore/`, usa
  `.restore.lock` y `.restore.pending`, sustituye con `.restore.tmp` y
  `.rollback*`, y relanza. Un fallo vuelve al modo seguro; nunca se ejecuta en
  segundo plano.
- **Logs.** `backup.schedule` y `backup.restore` registran resultado y códigos
  sin rutas, nombres, tamaños, SHA, identificadores ni contenido.

### 2.7 Estado implementado del empaquetado y las actualizaciones (#68)

- **Configuración.** `electron-builder.config.cjs` declara NSIS por usuario,
  `appId` `com.gonzalitojh.worldcraft`, versión 0.1.0, recursos en `resources/`,
  salida en `release/` y `--publish never` en local. `afterPack` escribe
  `app-update.yml` también en las builds `--dir` y poda los binarios nativos que
  no son win32-x64. El icono es un ICO de 7 tamaños; `licenses:sync` copia los
  5 textos completos.
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
  de la allowlist de `invoke`. El botón de la barra superior y el diálogo
  muestran versión, última comprobación, estado, progreso y privacidad.
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
- **UI.** El shell navega entre Inicio, Mundos y Muestras; Inicio es el dashboard
  con resumen, tarjetas, actividad global etiquetada por mundo y accesos rápidos.
  La página de un mundo muestra su ficha, progreso de preparación, actividad
  aislada y secciones previstas. Los diálogos de crear/editar, duplicar,
  archivar/restaurar y eliminar validan antes de enviar y piden confirmación.
- **Decisiones pendientes.** La portada se guarda y se muestra si existe, pero su
  selector llega con #115; la descripción es texto plano hasta #114; la papelera
  visible y la purga llegan con #77; la FK `assets.world_id` se completará con
  #116.

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
  mundo compondrá el bloque en #78.
- **Mundos.** Duplicar un mundo copia sus tipos personalizados dentro de la
  misma transacción; el borrado lógico los conserva y la purga los eliminará en
  cascada cuando llegue #77.
- **Transferencia sin canal propio.** `exportTypes` e `importTypes` viven en el
  dominio y todavía no tienen canal IPC ni UI; #78 los integrará en la
  exportación e importación del mundo.

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
    → copias automáticas del periodo en curso y rotación 7/4/12/5
    → ready: registrar protocolo de assets, componer el actualizador,
      registrar el IPC (incluido updates) y crear la ventana
    → safe-mode: diálogo nativo (restaurar, abrir copias, continuar o salir)
      y actualizador deshabilitado
```

La ventana no se crea hasta que el arranque termina. Solo en estado `ready` se
registran el handler de `wc-asset://` y el IPC, se ejecutan las copias
automáticas y se compone el actualizador. En modo seguro no hay ninguna vía de
lectura ni de escritura y el actualizador queda deshabilitado; el diálogo permite
restaurar una copia verificada desde `backups/`. Una restauración correcta
relanza la aplicación y vuelve a pasar por este flujo, incluida la copia previa a
las migraciones pendientes. `second-instance` enfoca la ventana de la instancia
que ya tenía el lock.

### 3.2 IPC

Los canales reales son `shell:openExternal`, los cinco de actualizaciones
(`updates:getState`, `check`, `cancel`, `download` e `install`), los ocho de
mundos (`worlds:list`, `get`, `create`, `update`, `duplicate`, `setArchived`,
`remove` y `listActivity`) y los cinco de tipos de entidad (`entityTypes:list`,
`create`, `update`, `duplicate` y `remove`). Una llamada a `shell:openExternal`
recorre esta ruta:

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

Importación (servicio, sin IPC en M0)
  importAsset({ worldId, kind: 'image', source })
    → límite 25 MB → magic bytes → límites 8192 px / 24 Mpx
    → EXIF + sRGB + WebP 90 + miniatura 320 px
    → assets/.tmp/<assetId>/ → rename a worlds/<worldId>/
    → INSERT en assets → compensación si falla

Purga (servicio, sin IPC en M0)
  purgeOrphans({ confirmation: 'purge-orphans' })
    → plan de solo lectura → revalidar → copia en backups/orphans/
    → SHA-256 + manifiesto → borrar solo entonces
```

Cada canal nuevo se declara en `src/shared/contracts/channels.ts`, añade su
esquema Zod y su handler en `src/main/ipc/` y su función nominativa en el
contrato del preload. Los errores nunca cruzan IPC como excepciones crudas: se
convierten en `{ ok: false, error: { code } }`. La importación y la purga por
IPC (`assets:import`, `assets:list` y `assets:purgeOrphans`) se definirán en M1.

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

Los flujos de fichas, relaciones, mapas, manuscrito y juego son el **objetivo**
una vez existan sus tablas e issues; todavía no tienen canales ni consultas.

```text
Lectura de fichas (previsto)
  renderer → window.worldCraft.entities.list({ worldId })
    → preload: función nominativa → ipcRenderer.invoke('entities:list', payload)
    → main: remitente → allowlist → Zod → consulta Drizzle/SQLite → IpcResult
    → renderer: pinta datos o error tipado

Exportación (previsto)
  renderer → window.worldCraft.backup.exportWorld(worldId)
    → main: consulta → ZIP temporal → dialog.save → IpcResult
```

## 4. Persistencia y datos

La persistencia local está implementada desde M0-04 (#64), el servicio de assets
desde M0-06 (#66), las copias automáticas con restauración desde M0-07 (#67) y el
empaquetado con actualización manual desde M0-08 (#68). La interfaz de Ajustes y
las copias manuales siguen previstas para M1.

- **SQLite** en `%APPDATA%\World Craft\data\world-craft.sqlite`, con una única
  conexión de escritura en el proceso principal.
- **WAL** para lecturas concurrentes y escrituras rápidas; `foreign_keys=ON`,
  `busy_timeout=5000`, `synchronous=NORMAL`.
- **Drizzle ORM** para el esquema y las consultas tipadas. Drizzle Kit solo
  genera y revisa migraciones; el runner propio las aplica.
- **Migraciones** en `drizzle/`: `0000_init` crea `schema_migrations` y
  `app_settings`; `0001_assets` crea `assets`; `0002_worlds` crea `worlds` y
  `activity_log`; `0003_entity_types` crea `entity_types` y siembra los tipos
  del sistema. `PRAGMA user_version` guarda el número de migraciones aplicadas
  (hoy 4).
- **Copias** en `%APPDATA%\World Craft\backups\`: `daily` (7), `weekly` (4),
  `monthly` (12), `pre-migration` (5) y `pre-restore` (sin poda). Cada copia
  lleva `manifest.json` v2, SHA-256 e integridad; solo contiene SQLite, no
  assets. La restauración se ofrece desde el diálogo de modo seguro de M0-07.
- **FTS5** está disponible en el binario; la tabla `search_fts` y sus triggers
  llegan con las tablas de dominio de M1.
- **Assets** en `%APPDATA%\World Craft\assets\worlds\<worldId>\<assetId>.webp`
  con miniatura `.thumb.webp`, `.tmp/` para escrituras y `backups/orphans/` para
  la purga recuperable (implementado, #66).
- **Exportación** de mundo en ZIP con `manifest.json`, `world.json` (incluye el
  bloque `entity-types.v1` con los tipos personalizados) y `assets/` (prevista,
  M1).

El detalle está en [`docs/persistencia.md`](persistencia.md),
[`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md) y
[`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 5. Seguridad y límites de confianza

- **Renderer no confiable.** Implementado: `contextIsolation`, `sandbox`,
  `nodeIntegration: false`, `webSecurity: true` y `webviewTag: false`; además
  `app.enableSandbox()` antes de crear ventanas.
- **Preload mínimo.** Implementado: publica un objeto congelado con `appInfo` y
  `shell.openExternal`; nunca `ipcRenderer`, `require`, rutas del sistema ni un
  `invoke` genérico.
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
- **Base de datos.** Implementado (#64): vive solo en `userData`, el renderer no
  tiene acceso, `src/main/db/` no importa Electron y los errores usan códigos
  estables. El journal se valida con Zod, el checksum es SHA-256 y el SQL de
  migración se revisa. El guard de base ajena mira tablas: una base con solo
  vistas, triggers o índices no se detecta, pero la migración choca y deja modo
  seguro sin escribir (LOW aceptado).
- **Modo seguro.** Implementado (#64, ampliado en #67): sin conexión de
  escritura, log JSONL con rotación y sin SQL, filas, rutas ni contenido, y
  diálogo nativo con rutas ya resueltas en `main`. Desde M0-07 el aviso permite
  restaurar una copia verificada; no hay UI de Ajustes hasta M1.
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
- **Importación.** Previsto: ZIP/JSON validados con Zod, límites de tamaño y de
  número de archivos, transacción y carpeta temporal.
- **Contenido rico.** Previsto (M3): JSON de ProseMirror; HTML saneado solo al
  exportar.
- **Secretos.** No hay claves de servicios en la app. Los certificados de firma,
  si existen, viven fuera del repositorio.
- **Privacidad.** Sin telemetría, cuentas ni subida de datos.

El detalle está en el [ADR 0004](adr/0004-electron-security-typed-ipc.md) y en
[`SECURITY.md`](../SECURITY.md).

## 6. Calidad, CI y distribución

- **Pruebas.** `pnpm test` ejecuta 339 pruebas unitarias (4 omitidas por
  symlinks en Windows sin modo desarrollador), 19 de componentes y 108 de
  integración (1 omitida): scaffold (ventana, navegación, CSP e identidad),
  contrato IPC, router IPC, API del preload, enlaces externos, journal, checksum,
  rutas, UUIDv7, logger, modo seguro, tokens y contraste, servicio de assets
  (URL, rutas, formatos, importación, huérfanos, protocolo y log), copias
  (manifiesto, rutas de restauración, buckets, rotación y recuperación),
  empaquetado (configuración, iconos y licencias), actualizador (contrato,
  servicio, red, log y textos), mundos (slug, validación, esquemas IPC y guardas),
  tipos de entidad (catálogo, plantillas, valores, claves y esquemas IPC) e
  instancia única; además, arranque, migraciones, copia, corrupción, versión
  adelantada, base ajena, preservación, rollback de referencia, importación,
  protocolo, repositorio y purga con SQLite real, CRUD, aislamiento, actividad y
  atomicidad de mundos, CRUD, protección, aislamiento, duplicación y
  transferencia de tipos, creación, restauración, rotación y restauración
  interrumpida de copias, y preservación entre instalaciones. `pnpm test:e2e`
  abre la aplicación real con Playwright Electron y un `userData` temporal:
  shell, ventana a 1024, 1280 y 1600 px, temas, axe y CRUD de mundos con teclado
  y textos largos. `pnpm build` y `pnpm verify:build` validan los
  artefactos; `pnpm verify:native` comprueba better-sqlite3 y sharp en Node y
  Electron; `pnpm verify:package` valida el paquete y
  `scripts/verify-install.ps1` prueba la instalación real.
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
  superior, descarga consentida y cancelable, e instalación solo con reinicio
  consentido. El auto-check y su interruptor llegan con Ajustes (M1); la
  actualización real contra GitHub Releases se prueba en M5.
- **Datos.** El instalador por usuario y el desinstalador no tocan `userData`; la
  app migra con copia previa. La prueba real de 0.1.0→0.1.1 conservó 194 archivos.

El detalle está en el [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md),
[ADR 0013](adr/0013-ci-releases.md) y
[`docs/calidad/plan-de-pruebas.md`](calidad/plan-de-pruebas.md).

## 7. Evolución por fases

| Fase | Qué añade a la arquitectura |
|---|---|
| **M0** | Baseline, ventana segura, SQLite/Drizzle, IPC, diseño, assets, backups, CI, instalador y actualizador manual. |
| **M1** | Mundos, fichas, tipos, etiquetas, relaciones, búsqueda, ajustes (incluido el interruptor de actualizaciones) y papelera. |
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
- [Continuidad y copias](continuidad.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
- [Cambio a escritorio](cambio-a-escritorio.md)
