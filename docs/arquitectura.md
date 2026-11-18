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
**IPC tipado** (#63) y la **persistencia local** (#64): ventana Electron segura,
preload nominativo, renderer React con una pantalla provisional, un único canal
IPC (`shell:openExternal`) y una base SQLite con migraciones, comprobación de
integridad y modo seguro. Todavía no hay sistema de diseño ni assets: eso llega
con #65 y #66. Las secciones distinguen lo implementado de lo previsto.

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
│  Zustand · React Hook Form · Tailwind + shadcn/ui                 │
└──────────────────────────────────────────────────────────────────┘
```

| Pieza | Estado | Dónde se decide |
|---|---|---|
| Electron + Vite + React + TypeScript | Implementado (M0-02, #62) | [ADR 0001](adr/0001-electron-vite-react-typescript.md) |
| SQLite + better-sqlite3 + Drizzle + FTS5 | Implementado (M0-04, #64): base, migraciones y modo seguro; FTS5 disponible en el binario, esquema en M1 | [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md) |
| Instalador NSIS, actualizaciones y preservación de datos | Previsto (M0/M5, #68) | [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md) |
| Seguridad Electron e IPC tipado | Implementado: ventana segura (#62) e IPC con allowlist y Zod (#63) | [ADR 0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales y protocolo propio | Previsto (#66) | [ADR 0005](adr/0005-local-assets-custom-protocol.md) |
| Dos temas y sistema de diseño | Parcial: pantalla provisional (#62); sistema previsto (#65) | [ADR 0006](adr/0006-two-themes-desktop-design-system.md) |
| Tiptap y exportadores | Previsto (M3) | [ADR 0007](adr/0007-tiptap-editor-exporters.md) |
| MapLibre/Terra Draw y React Flow/ELK | Previsto (M2) | [ADR 0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| i18n centralizada | Parcial: mensajes tipados del scaffold (#62) | [ADR 0009](adr/0009-centralized-i18n.md) |
| Pruebas y calidad | Parcial: 89 unitarias y 18 de integración (#62–#64); E2E previsto (#70) | [ADR 0010](adr/0010-testing-strategy.md) |
| Modelo local de un solo usuario | Vigente | [ADR 0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | Parcial: copia pre-migración y modo seguro (#64); restauración, retención y UI previstas (M0-07) | [ADR 0012](adr/0012-backup-restore-recovery.md), [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md) |
| CI y releases | Parcial: lint, typecheck, test, db:check y build (#62–#64); releases previstos | [ADR 0013](adr/0013-ci-releases.md) |
| Estructura y tooling | Vigente | [ADR 0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional | Diferida | [ADR 0015](adr/0015-optional-code-signing-smartscreen.md) |

## 2. Procesos y directorios

Electron separa tres procesos con permisos distintos:

| Proceso | Responsabilidad | Puede acceder a |
|---|---|---|
| **Main** | Ventana, ciclo de vida, guards de seguridad, IPC con handlers tipados y persistencia local (SQLite, migraciones, copia previa y modo seguro); backups de usuario, updates y protocolo de assets llegarán con sus issues. | Node, Electron, disco. |
| **Preload** | Puente mínimo y tipado entre renderer y main: solo `appInfo` y funciones nominativas. | API de Electron limitada. |
| **Renderer** | Interfaz React, estado de UI, editor, mapa y grafo. | DOM, API expuesta por preload. Nunca Node ni SQLite. |

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/main/` | Composición del proceso principal, ventana, guards de seguridad (`security/`), router IPC (`ipc/`), persistencia (`persistence.ts`) y aviso de modo seguro (`safe-mode-*.ts`); assets, backups de usuario y updates llegarán con sus issues. | `src/shared/`, Node, Electron |
| `src/main/db/` | Capa de datos pura: rutas, conexión, esquema Drizzle, journal, runner de migraciones, copia previa, integridad, logger y errores estables. No importa Electron (regla ESLint). | Node, better-sqlite3, Drizzle, Zod |
| `src/main/ipc/` | Router único, esquemas Zod de entrada, handlers por canal y errores estables. | `src/shared/`, Electron, Zod |
| `src/main/security/` | CSP, guards de sesión y navegación, y política de enlaces externos. | Electron |
| `src/main/messages/` | Textos tipados de los diálogos nativos del proceso principal (`es.ts`). | — |
| `src/preload/` | `contextBridge` congelado que publica solo `window.worldCraft` (`appInfo` y `shell.openExternal`); sin lógica de negocio, `ipcRenderer` ni `invoke` genérico. | `src/shared/`, Electron |
| `src/renderer/` | UI React, mensajes tipados y estilos provisionales; las pantallas y módulos de dominio se añadirán con sus issues. | `src/shared/`, API de `window.worldCraft` |
| `src/renderer/components/` | `ui/` base, `shell/`, `editors/`, `maps/`, `graph/`. Prevista. | Módulos del renderer, shared |
| `src/renderer/modules/` | Casos de uso de UI por dominio: worlds, entities, relations, maps, graph, writing, game, search. Prevista. | API tipada, shared |
| `src/renderer/messages/` | Catálogo tipado del renderer (hoy `es.ts`). | — |
| `src/renderer/styles/` | Base provisional; tokens definitivos y movimiento en #65. | — |
| `src/shared/` | Identidad, contratos y utilidades puras sin Node ni React. | — |
| `src/shared/contracts/` | Allowlist de canales, `IpcResult`, códigos de error y contrato de la API del preload. | — |
| `tests/unit/` | Pruebas unitarias del scaffold, del contrato IPC, de los guards, de los enlaces externos y de la capa de datos (journal, checksum, rutas, logger y modo seguro). | `src/` |
| `tests/integration/` | Arranque y migraciones contra una base SQLite real en `os.tmpdir()`; copia, integridad, preservación y rechazo de bases ajenas. | `src/` |
| `tests/e2e/` | Playwright Electron. Previsto (#70). | `src/` |
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
   cadenas de interfaz en componentes.
5. **Los tokens viven en `src/renderer/styles/`.** Los componentes usan
   utilidades semánticas, nunca la paleta cruda ni variantes `dark:`.
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
- **Tema y datos.** `prefers-color-scheme` es solo un fallback provisional; el
  sistema de diseño con `[data-theme]` llega en #65. La escritura en `userData`,
  SQLite y las migraciones se añadieron en #64 (sección 2.3).

### 2.2 Estado implementado del IPC (#63)

- **Contrato compartido.** `src/shared/contracts/` contiene la allowlist
  `IPC_CHANNELS` (hoy un solo canal, `shell:openExternal`), el resultado
  discriminado `IpcResult` con los códigos `INVALID_INPUT`, `UNKNOWN_CHANNEL`,
  `INTERNAL_ERROR` y `UNTRUSTED_SENDER`, y `createWorldCraftApi({ invoke })`,
  que construye la API congelada del preload. Son módulos puros: no importan
  Electron, Node ni Zod.
- **Preload nominativo.** Publica `appInfo` y `shell.openExternal(url)`. No
  expone `ipcRenderer`, `require` ni un `invoke` genérico; el renderer solo
  puede llamar a las funciones declaradas en el contrato.
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
  la forma de `IpcResult` de manera estructural (`isIpcResult`) y degrada
  cualquier respuesta inesperada a `INTERNAL_ERROR`, para no empaquetar Zod en
  preload ni renderer.
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
- **Build.** `better-sqlite3` y `drizzle-orm` se externalizan; `drizzle/` se
  copia a `out/main/drizzle`. `pnpm verify:build` valida las migraciones
  copiadas y la externalización. #68 debe desempaquetar el módulo nativo del
  asar.

## 3. Flujo de una operación

### 3.1 Arranque (implementado, #64)

```text
app.setName(APP_NAME) → app.getPath('userData')
  → initializePersistence()
    → rutas, carpetas y log de arranque
    → abrir SQLite sin WAL → integrity_check
    → user_version + schema_migrations
    → copia pre-migración si la base existía y hay pendientes
    → WAL + synchronous = NORMAL
    → migraciones en una transacción
    → integrity_check posterior
    → ready: registrar IPC y crear la ventana
    → safe-mode: diálogo nativo (abrir copias, continuar o salir)
```

La ventana no se crea hasta que el arranque termina. Si el usuario elige salir,
no se registra IPC ni se abre ninguna vía de escritura.

### 3.2 IPC

Hoy el único canal real es `shell:openExternal`. Una llamada recorre esta ruta:

```text
Llamada IPC (implementado, #63)
  renderer → window.worldCraft.shell.openExternal(url)
    → preload: función nominativa del contrato → ipcRenderer.invoke('shell:openExternal', { url })
    → main: comprueba remitente → allowlist → Zod (forma) → handler
    → handler: resolveExternalUrl(url) → shell.openExternal(url normalizada)
    → main: IpcResult<{ opened: true }> o error estable
    → preload: comprueba la forma del resultado → renderer
```

Los flujos de dominio siguientes son el **objetivo** una vez existan las tablas
de M1 y las issues de cada módulo; todavía no tienen canales ni consultas.

```text
Lectura
  renderer → window.worldCraft.entities.list({ worldId })
    → preload: función nominativa → ipcRenderer.invoke('entities:list', payload)
    → main: remitente → allowlist → Zod → consulta Drizzle/SQLite → IpcResult
    → renderer: pinta datos o error tipado

Mutación
  renderer → window.worldCraft.entities.create(input)
    → preload → main: Zod → transacción SQLite → activity_log
    → invalida caché de UI y refresca la vista

Asset
  renderer → <img src="wc-asset://asset/<assetId>">
    → main: protocol.handle → valida id y ruta → sirve archivo de userData/assets

Exportación
  renderer → window.worldCraft.backup.exportWorld(worldId)
    → main: consulta → ZIP temporal → dialog.save → IpcResult

Actualización
  main: electron-updater consulta GitHub Releases (opcional)
    → descarga → aviso al usuario → instala al reiniciar
    → userData no se toca
```

Cada canal nuevo se declara en `src/shared/contracts/channels.ts`, añade su
esquema Zod y su handler en `src/main/ipc/` y su función nominativa en el
contrato del preload. Los errores nunca cruzan IPC como excepciones crudas: se
convierten en `{ ok: false, error: { code } }`.

## 4. Persistencia y datos

La persistencia local está implementada desde M0-04 (#64). Los assets (#66) y
las copias automáticas con restauración (M0-07) todavía no existen.

- **SQLite** en `%APPDATA%\World Craft\data\world-craft.sqlite`, con una única
  conexión de escritura en el proceso principal.
- **WAL** para lecturas concurrentes y escrituras rápidas; `foreign_keys=ON`,
  `busy_timeout=5000`, `synchronous=NORMAL`.
- **Drizzle ORM** para el esquema y las consultas tipadas. Drizzle Kit solo
  genera y revisa migraciones; el runner propio las aplica.
- **Migraciones** en `drizzle/`: `0000_init` crea `schema_migrations` y
  `app_settings`. `PRAGMA user_version` guarda el número de migraciones
  aplicadas.
- **Copia previa** en `%APPDATA%\World Craft\backups\pre-migration\<timestamp>\`
  con manifiesto, SHA-256 e integridad. La rotación diaria/semanal/mensual y la
  restauración guiada llegan con M0-07.
- **FTS5** está disponible en el binario; la tabla `search_fts` y sus triggers
  llegan con las tablas de dominio de M1.
- **Assets** en `%APPDATA%\World Craft\assets\worlds\<worldId>\` (previsto,
  #66).
- **Exportación** de mundo en ZIP con `manifest.json`, `data.json` y `assets/`
  (prevista, M1).

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
  inline y loopback para Vite. `img-src` ya reserva `wc-asset:`, aunque el
  protocolo llega con #66.
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
- **Modo seguro.** Implementado (#64): sin conexión de escritura, log JSONL con
  rotación y sin SQL, filas, rutas ni contenido, y diálogo nativo con rutas ya
  resueltas en `main`. La restauración guiada no existe todavía.
- **Instancia única.** Pendiente: no hay `app.requestSingleInstanceLock`. Dos
  instancias podrían competir por migrar y una acabar en modo seguro; SQLite
  serializa y la transacción revierte, así que no hay corrupción. Debe cerrarse
  antes de M1 y preferiblemente antes de #68.
- **Assets y rutas.** Previsto (#66): normalización, comprobación de prefijo y
  rechazo de `..`, rutas absolutas y enlaces simbólicos.
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

- **Pruebas.** `pnpm test` ejecuta 89 pruebas unitarias y 18 de integración:
  scaffold (ventana, navegación, CSP e identidad), contrato IPC, router IPC, API
  del preload, enlaces externos, journal, checksum, rutas, logger y modo seguro,
  más arranque, migraciones, copia, corrupción, versión adelantada, base ajena,
  preservación y rollback de referencia. `pnpm build` y `pnpm verify:build`
  validan los artefactos; `pnpm verify:native` comprueba el módulo nativo en
  Node y Electron. `test:e2e` (Playwright Electron) sigue previsto para #70.
- **CI.** GitHub Actions en `ubuntu-latest`: jobs `lint` (con `format:check`),
  `typecheck`, `test`, `build` (con `db:check` y `verify:build`), `gitleaks` y
  `audit`. Los tres primeros son required; `build` todavía no lo es hasta #69, y
  gitleaks y audit no bloquean. `verify:native` se ejecuta a mano y debe añadirse
  a la CI antes de #68.
- **Instalador.** Previsto (#68): `electron-builder` con NSIS por usuario;
  `pnpm dist` generará el instalador y `pnpm dist:dir` una carpeta desempaquetada
  para pruebas. Hoy no existen esos scripts. #68 también debe desempaquetar
  `better-sqlite3` del asar y empaquetar las dependencias de producción y
  `drizzle/`.
- **Release.** Previsto: tag `vX.Y.Z`, workflow que compila, firma si hay
  certificado y publica en GitHub Releases con `latest.yml`.
- **Actualización.** Previsto (M5): `electron-updater` contra GitHub Releases;
  descarga en segundo plano y reinicio consentido.
- **Datos.** Cuando exista instalador, no tocará `userData`; la app migrará con
  copia previa.

El detalle está en el [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md),
[ADR 0013](adr/0013-ci-releases.md) y
[`docs/calidad/plan-de-pruebas.md`](calidad/plan-de-pruebas.md).

## 7. Evolución por fases

| Fase | Qué añade a la arquitectura |
|---|---|
| **M0** | Baseline, ventana segura, SQLite/Drizzle, IPC, diseño, assets, backups, CI e instalador. |
| **M1** | Mundos, fichas, tipos, etiquetas, relaciones, búsqueda, ajustes y papelera. |
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
- [Continuidad y copias](continuidad.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
- [Cambio a escritorio](cambio-a-escritorio.md)
