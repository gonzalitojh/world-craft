# Arquitectura de World Craft

> **Estado:** vigente desde el 18/11/2026, tras el pivote a aplicación de
> escritorio. Sustituye por completo la arquitectura web anterior.
> **Ámbito:** procesos, módulos, flujos, datos y límites de confianza.
> **Fuentes:** [`docs/plan-desarrollo.md`](plan-desarrollo.md) §3,
> [`docs/adr/`](adr/README.md) y el código de `src/`.

Este documento explica **cómo está organizada la aplicación** y **por dónde pasa
una operación**. No sustituye al plan ni a los ADRs: el plan define el alcance y
los ADRs el porqué de cada decisión. Si hay discrepancia, mandan ellos.

En la fase actual el repositorio contiene el **scaffold de escritorio** de la
issue M0-02 (#62): ventana Electron segura, preload mínimo y renderer React con
una pantalla provisional. Todavía no hay IPC, base de datos ni sistema de diseño:
eso llega con #63, #64 y #65. Las secciones distinguen lo implementado de lo
previsto.

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
| SQLite + better-sqlite3 + Drizzle + FTS5 | Previsto (#64) | [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md) |
| Instalador NSIS, actualizaciones y preservación de datos | Previsto (M0/M5, #68) | [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md) |
| Seguridad Electron e IPC tipado | Parcial: ventana segura (#62); IPC previsto (#63) | [ADR 0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales y protocolo propio | Previsto (#66) | [ADR 0005](adr/0005-local-assets-custom-protocol.md) |
| Dos temas y sistema de diseño | Parcial: pantalla provisional (#62); sistema previsto (#65) | [ADR 0006](adr/0006-two-themes-desktop-design-system.md) |
| Tiptap y exportadores | Previsto (M3) | [ADR 0007](adr/0007-tiptap-editor-exporters.md) |
| MapLibre/Terra Draw y React Flow/ELK | Previsto (M2) | [ADR 0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| i18n centralizada | Parcial: mensajes tipados del scaffold (#62) | [ADR 0009](adr/0009-centralized-i18n.md) |
| Pruebas y calidad | Parcial: unitarios del scaffold (#62); integración y E2E previstos (#70) | [ADR 0010](adr/0010-testing-strategy.md) |
| Modelo local de un solo usuario | Vigente | [ADR 0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | Previsto (M0/M5) | [ADR 0012](adr/0012-backup-restore-recovery.md) |
| CI y releases | Parcial: lint, typecheck, test y build (#62); releases previstos | [ADR 0013](adr/0013-ci-releases.md) |
| Estructura y tooling | Vigente | [ADR 0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional | Diferida | [ADR 0015](adr/0015-optional-code-signing-smartscreen.md) |

## 2. Procesos y directorios

Electron separa tres procesos con permisos distintos:

| Proceso | Responsabilidad | Puede acceder a |
|---|---|---|
| **Main** | Ventana, ciclo de vida y guards de seguridad; SQLite, sistema de archivos, backups, updates, protocolo de assets y handlers IPC llegarán con sus issues. | Node, Electron, disco. |
| **Preload** | Puente mínimo y tipado entre renderer y main. | API de Electron limitada. |
| **Renderer** | Interfaz React, estado de UI, editor, mapa y grafo. | DOM, API expuesta por preload. Nunca Node ni SQLite. |

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/main/` | Composición del proceso principal, ventana y guards de seguridad (`security/`); base de datos, assets, backups, updates e IPC llegarán con sus issues. | `src/shared/`, Node, Electron |
| `src/preload/` | `contextBridge` congelado que publica solo `window.worldCraft`; sin lógica de negocio ni `ipcRenderer`. | `src/shared/`, Electron |
| `src/renderer/` | UI React, mensajes tipados y estilos provisionales; las pantallas y módulos de dominio se añadirán con sus issues. | `src/shared/`, API de `window.worldCraft` |
| `src/renderer/components/` | `ui/` base, `shell/`, `editors/`, `maps/`, `graph/`. Prevista. | Módulos del renderer, shared |
| `src/renderer/modules/` | Casos de uso de UI por dominio: worlds, entities, relations, maps, graph, writing, game, search. Prevista. | API tipada, shared |
| `src/renderer/messages/` | Catálogo tipado del renderer (hoy `es.ts`). | — |
| `src/renderer/styles/` | Base provisional; tokens definitivos y movimiento en #65. | — |
| `src/shared/` | Identidad, contratos y utilidades puras sin Node ni React. | — |
| `tests/unit/` | Pruebas unitarias del scaffold y de la configuración de seguridad. | `src/` |
| `tests/integration/`, `tests/e2e/` | Integración con SQLite y Playwright Electron. Previstos (#64, #70). | `src/` |
| `docs/` | Plan, arquitectura, ADRs, persistencia, calidad y manual. | — |

Reglas de dependencia:

1. **Main decide y persiste; renderer presenta y compone.** El renderer no
   importa `src/main/` ni módulos de Node.
2. **Shared no depende de nadie.** Contiene contratos y esquemas que ambos lados
   pueden importar.
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
  versión). No expone `ipcRenderer`, `require` ni un `invoke` genérico.
- **CSP.** La política de producción se inyecta como `<meta>` antes de los
  scripts; la de desarrollo solo añade inline y loopback para Vite y su HMR.
- **Guards.** Se bloquean navegación, redirecciones, navegación de subframes,
  `window.open`, webviews y descargas. Los permisos del navegador se deniegan y
  las peticiones HTTP(S)/WS remotas se cancelan. `ELECTRON_RENDERER_URL` se
  ignora en la versión empaquetada y las DevTools se deshabilitan en ella.
- **Verificación.** `pnpm verify:build` comprueba que existen los tres artefactos,
  que la CSP está antes de los scripts, que no hay `unsafe-*` ni URLs remotas.
- **Tema y datos.** `prefers-color-scheme` es solo un fallback provisional; el
  sistema de diseño con `[data-theme]` llega en #65. No se escribe en
  `userData`, no hay SQLite ni migraciones (#64).

## 3. Flujo de una operación

Los flujos siguientes son el **objetivo** una vez existan IPC y SQLite. Hoy el
único cruce real por el puente es `window.worldCraft.appInfo`; todavía no hay
canales IPC ni consultas.

```text
Lectura
  renderer → window.worldCraft.entities.list({ worldId })
    → preload: ipcRenderer.invoke('entities:list', payload)
    → main: Zod → consulta Drizzle/SQLite → Result<T>
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
    → main: consulta → ZIP temporal → dialog.save → Result

Actualización
  main: electron-updater consulta GitHub Releases (opcional)
    → descarga → aviso al usuario → instala al reiniciar
    → userData no se toca
```

Cuando exista IPC, el contrato se definirá en `src/shared/` y se implementará en
`src/main/ipc/`. Cada canal tendrá un esquema Zod de entrada y un tipo de salida.
Los errores nunca cruzarán IPC como excepciones crudas: se convertirán en
`{ ok: false, error: { code, message } }`.

## 4. Persistencia y datos

Nada de esta sección está implementado todavía: la base SQLite llega con #64 y
los assets con #66. El scaffold no escribe en `userData` ni crea migraciones.

- **SQLite** en `%APPDATA%\World Craft\data\world-craft.sqlite`.
- **WAL** para lecturas concurrentes y escrituras rápidas; `foreign_keys=ON`,
  `busy_timeout=5000`, `synchronous=NORMAL`.
- **Drizzle ORM** para esquema, consultas y migraciones versionadas.
- **FTS5** para búsqueda global, sincronizada con `search_documents` y triggers.
- **Assets** en `%APPDATA%\World Craft\assets\worlds\<worldId>\`.
- **Copias** en `%APPDATA%\World Craft\backups\` con rotación diaria/semanal/
  mensual y copia previa a migraciones.
- **Exportación** de mundo en ZIP con `manifest.json`, `data.json` y `assets/`.

El detalle está en [`docs/persistencia.md`](persistencia.md),
[`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md) y
[`docs/base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

## 5. Seguridad y límites de confianza

- **Renderer no confiable.** Implementado: `contextIsolation`, `sandbox`,
  `nodeIntegration: false`, `webSecurity: true` y `webviewTag: false`; además
  `app.enableSandbox()` antes de crear ventanas.
- **Preload mínimo.** Implementado: publica un objeto congelado con `appInfo`;
  nunca `ipcRenderer`, `require` ni rutas del sistema.
- **CSP estricta.** Implementada: producción sin `unsafe-eval`, `unsafe-inline`
  ni orígenes remotos, inyectada antes de los scripts; desarrollo solo permite
  inline y loopback para Vite. `img-src` ya reserva `wc-asset:`, aunque el
  protocolo llega con #66.
- **Navegación y ventanas.** Implementado: `will-navigate`, `will-redirect`,
  `will-frame-navigate`, `setWindowOpenHandler` y `will-attach-webview` deniegan
  cualquier salto o ventana nueva. Los enlaces externos con `shell.openExternal`
  llegarán en una issue posterior.
- **Red y permisos.** Implementado: todos los permisos se deniegan, las descargas
  se cancelan y `webRequest` cancela HTTP(S) y WebSocket remotos; en desarrollo
  solo deja pasar loopback. `ELECTRON_RENDERER_URL` se ignora empaquetado.
- **DevTools.** Implementado: deshabilitadas en la versión empaquetada.
- **IPC allowlisted.** Previsto (#63): validación Zod, canales explícitos y
  errores tipados.
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

- **Pruebas.** `pnpm test` ejecuta 25 pruebas unitarias del scaffold (ventana,
  navegación, CSP, API del preload e identidad). `pnpm build` y
  `pnpm verify:build` validan los artefactos. `test:integration` (SQLite) y
  `test:e2e` (Playwright Electron) están previstos con #64 y #70.
- **CI.** GitHub Actions en `ubuntu-latest`: jobs `lint` (con `format:check`),
  `typecheck`, `test`, `build` (con `verify:build`), `gitleaks` y `audit`. Los
  tres primeros son required; `build` todavía no lo es hasta #69, y gitleaks y
  audit no bloquean.
- **Instalador.** Previsto (#68): `electron-builder` con NSIS por usuario;
  `pnpm dist` generará el instalador y `pnpm dist:dir` una carpeta desempaquetada
  para pruebas. Hoy no existen esos scripts.
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
- [Continuidad y copias](continuidad.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
- [Cambio a escritorio](cambio-a-escritorio.md)
