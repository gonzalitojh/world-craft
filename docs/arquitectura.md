# Arquitectura de World Craft

> **Estado:** vigente desde el 18/11/2026, tras el pivote a aplicación de
> escritorio. Sustituye por completo la arquitectura web anterior.
> **Ámbito:** procesos, módulos, flujos, datos y límites de confianza.
> **Fuentes:** [`docs/plan-desarrollo.md`](plan-desarrollo.md) §3,
> [`docs/adr/`](adr/README.md) y el código de `src/`.

Este documento explica **cómo está organizada la aplicación** y **por dónde pasa
una operación**. No sustituye al plan ni a los ADRs: el plan define el alcance y
los ADRs el porqué de cada decisión. Si hay discrepancia, mandan ellos.

En la fase actual el repositorio contiene el **baseline de tooling y la
documentación del pivote**. Todavía no hay ventana Electron ni base de datos
ejecutable: eso llega con las primeras issues de M0. Las secciones distinguen lo
previsto de lo implementado.

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
| Electron + Vite + React + TypeScript | Previsto (M0) | [ADR 0001](adr/0001-electron-vite-react-typescript.md) |
| SQLite + better-sqlite3 + Drizzle + FTS5 | Previsto (M0) | [ADR 0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md) |
| Instalador NSIS, actualizaciones y preservación de datos | Previsto (M0/M5) | [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md) |
| Seguridad Electron e IPC tipado | Previsto (M0) | [ADR 0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales y protocolo propio | Previsto (M0) | [ADR 0005](adr/0005-local-assets-custom-protocol.md) |
| Dos temas y sistema de diseño | Previsto (M0) | [ADR 0006](adr/0006-two-themes-desktop-design-system.md) |
| Tiptap y exportadores | Previsto (M3) | [ADR 0007](adr/0007-tiptap-editor-exporters.md) |
| MapLibre/Terra Draw y React Flow/ELK | Previsto (M2) | [ADR 0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| i18n centralizada | Previsto (M0) | [ADR 0009](adr/0009-centralized-i18n.md) |
| Pruebas y calidad | Previsto (M0/M5) | [ADR 0010](adr/0010-testing-strategy.md) |
| Modelo local de un solo usuario | Vigente | [ADR 0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | Previsto (M0/M5) | [ADR 0012](adr/0012-backup-restore-recovery.md) |
| CI y releases | Previsto (M0/M5) | [ADR 0013](adr/0013-ci-releases.md) |
| Estructura y tooling | Vigente | [ADR 0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional | Diferida | [ADR 0015](adr/0015-optional-code-signing-smartscreen.md) |

## 2. Procesos y directorios

Electron separa tres procesos con permisos distintos:

| Proceso | Responsabilidad | Puede acceder a |
|---|---|---|
| **Main** | Ventana, ciclo de vida, SQLite, sistema de archivos, backups, updates, protocolo de assets y handlers IPC. | Node, Electron, disco. |
| **Preload** | Puente mínimo y tipado entre renderer y main. | API de Electron limitada. |
| **Renderer** | Interfaz React, estado de UI, editor, mapa y grafo. | DOM, API expuesta por preload. Nunca Node ni SQLite. |

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/main/` | Composición del proceso principal, ventana, base de datos, assets, backups, updates e IPC. | `src/shared/`, Node, Electron |
| `src/preload/` | `contextBridge` y API tipada; sin lógica de negocio. | `src/shared/`, Electron |
| `src/renderer/` | UI React, módulos de dominio de presentación y estado. | `src/shared/`, API de `window.worldCraft` |
| `src/renderer/components/` | `ui/` base, `shell/`, `editors/`, `maps/`, `graph/`. | Módulos del renderer, shared |
| `src/renderer/modules/` | Casos de uso de UI por dominio: worlds, entities, relations, maps, graph, writing, game, search. | API tipada, shared |
| `src/renderer/messages/` | Catálogo tipado y proveedor de i18n. | — |
| `src/renderer/styles/` | Tokens, base y movimiento. | — |
| `src/shared/` | Tipos, contratos IPC, esquemas Zod y utilidades puras sin Node ni React. | — |
| `tests/` | `unit/`, `integration/` y `e2e/`. | `src/` |
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

## 3. Flujo de una operación

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

El contrato de IPC se define en `src/shared/` y se implementa en
`src/main/ipc/`. Cada canal tiene un esquema Zod de entrada y un tipo de salida.
Los errores nunca cruzan IPC como excepciones crudas: se convierten en
`{ ok: false, error: { code, message } }`.

## 4. Persistencia y datos

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

- **Renderer no confiable.** `contextIsolation`, `sandbox`, `nodeIntegration:
  false`, `webSecurity: true`.
- **Preload mínimo.** Solo funciones concretas; nunca `ipcRenderer` ni
  `require`.
- **IPC allowlisted.** Validación Zod, canales explícitos y errores tipados.
- **CSP estricta.** Sin contenido remoto, sin `unsafe-eval`, assets solo desde
  `wc-asset:`.
- **Navegación bloqueada.** `will-navigate` y `setWindowOpenHandler` deniegan
  ventanas nuevas; los enlaces externos se abren con `shell.openExternal` solo
  para HTTPS.
- **Assets y rutas.** Normalización, comprobación de prefijo y rechazo de `..`,
  rutas absolutas y enlaces simbólicos.
- **Importación.** ZIP/JSON validados con Zod, límites de tamaño y de número de
  archivos, transacción y carpeta temporal.
- **Contenido rico.** JSON de ProseMirror; HTML saneado solo al exportar.
- **Secretos.** No hay claves de servicios en la app. Los certificados de firma,
  si existen, viven fuera del repositorio.
- **Privacidad.** Sin telemetría, cuentas ni subida de datos.

El detalle está en el [ADR 0004](adr/0004-electron-security-typed-ipc.md) y en
[`SECURITY.md`](../SECURITY.md).

## 6. Calidad, CI y distribución

- **Pruebas.** `pnpm test` (Vitest unitario), `pnpm test:integration` (SQLite
  temporal, migraciones, backups) y `pnpm test:e2e` (Playwright Electron).
- **CI.** GitHub Actions en `windows-latest`: lint, format, typecheck, test,
  integration y build. gitleaks y audit no bloquean.
- **Instalador.** `electron-builder` con NSIS por usuario; `pnpm dist` genera el
  instalador y `pnpm dist:dir` una carpeta desempaquetada para pruebas.
- **Release.** Tag `vX.Y.Z`, workflow que compila, firma si hay certificado y
  publica en GitHub Releases con `latest.yml`.
- **Actualización.** `electron-updater` contra GitHub Releases; descarga en
  segundo plano y reinicio consentido.
- **Datos.** El instalador no toca `userData`; la app migra con copia previa.

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
