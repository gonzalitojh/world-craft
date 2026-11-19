# World Craft

World Craft es una **aplicación de escritorio para Windows** con la que crear y
mantener mundos de ficción: fichas y entidades, relaciones, mapas, grafo de
conocimiento, manuscritos y juego creativo. Todo el contenido vive en el equipo
de la persona usuaria: no hay cuentas, servidor remoto ni contenido público. El
código se publica bajo licencia MIT.

## Estado

**Fundaciones de escritorio con persistencia local.** El repositorio contiene la
base técnica de Electron con electron-vite, React y TypeScript estricto, el IPC
tipado, una base SQLite con migraciones, comprobación de integridad y modo
seguro, y el sistema de diseño con su shell de escritorio. `pnpm dev` abre una
ventana segura con la barra lateral, el tema Claro/Oscuro conmutable y una página
de inicio con estado vacío; `pnpm build` compila los tres procesos en `out/`.
**Todavía no hay una versión instalable**: no existe empaquetado NSIS ni
funciones de producto, y las de mundo, fichas, mapas y escritura llegan con M1 en
adelante.

El inventario de lo eliminado y las cuentas externas que hay que cerrar están en
[`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md). El plan aprobado,
en [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md).

## Stack de escritorio

| Capa | Tecnología | Estado |
|---|---|---|
| Shell de escritorio | Electron + electron-vite | Implementado (scaffold) |
| Interfaz | React + TypeScript estricto + Vite | Implementado (scaffold) |
| Estilos | CSS propio con tokens en tres capas (paleta, semántica y escalas), sin Tailwind ni shadcn | Implementado (#65) |
| Base de datos | SQLite local con better-sqlite3 + Drizzle ORM | Implementado (#64) |
| Migraciones | Runner propio sobre el journal de Drizzle y copia previa | Implementado (#64) |
| Búsqueda | SQLite FTS5 | Disponible en el binario; esquema previsto (M1) |
| Archivos | Sistema de archivos local bajo `app.getPath('userData')` con protocolo `wc-asset://` | Implementado (#66); UI en M1 |
| Editor | Tiptap 3 | Previsto (M3) |
| Mapas y grafo | MapLibre GL JS + Terra Draw; React Flow + ELK.js | Previsto (M2) |
| Instalador | electron-builder + NSIS | Previsto (#68) |
| Actualizaciones | electron-updater + GitHub Releases | Previsto (M5) |

El renderer no accede a Node, al sistema de archivos ni a SQLite: usa una API
tipada expuesta por el preload. Los detalles están en
[`docs/arquitectura.md`](docs/arquitectura.md) y en los
[ADRs](docs/adr/README.md).

## Requisitos

- **Windows 10/11** para ejecutar la aplicación (el desarrollo también funciona
  en otras plataformas, pero el objetivo y las pruebas de ventana son Windows).
- **Node.js 22 LTS** (`engines.node` limita a `>=22.22.2 <23`; `.nvmrc` fija la
  línea 22).
- **pnpm vía Corepack:**

  ```bash
  corepack enable
  ```

  La versión exacta está fijada en `packageManager`.
- Git.

En Windows, si la política de ejecución bloquea `pnpm.ps1`, usa `pnpm.cmd`
(por ejemplo `pnpm.cmd typecheck`) o `corepack pnpm typecheck`.

## Arranque local

Instala las dependencias una vez y usa los scripts del `package.json`:

```bash
pnpm install
pnpm dev              # abre la ventana de Electron en desarrollo
pnpm build            # compila main, preload y renderer en out/
pnpm start            # previsualiza el build de producción
pnpm verify:build     # valida artefactos, CSP, migraciones y externalización
pnpm verify:native    # comprueba better-sqlite3 en Node y Electron
pnpm clean            # borra out/ y otros artefactos locales
```

Los checks de calidad y de datos son:

```bash
pnpm lint
pnpm typecheck
pnpm test             # unitarias + integración
pnpm test:unit
pnpm test:integration
pnpm db:generate      # genera una migración con Drizzle Kit
pnpm db:check         # valida el journal y las instantáneas
pnpm format           # corrige el formato
pnpm format:check     # comprueba el formato
```

`pnpm build` **no genera un instalador**: produce `out/main/index.cjs`,
`out/preload/index.cjs` y `out/renderer/index.html`, y copia `drizzle/` a
`out/main/drizzle`. El instalador NSIS llega con la issue del empaquetado (#68) y
la carpeta `out/` no se versiona.

## Seguridad del scaffold

- El renderer no accede a Node, al sistema de archivos ni a Electron. El preload
  congela y expone solo `window.worldCraft` (`appInfo` y `shell.openExternal`);
  todo canal IPC está en una allowlist y valida la entrada con Zod.
- `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity: true` y
  `webviewTag: false`; DevTools están deshabilitadas en la versión empaquetada.
- CSP estricta de producción inyectada antes de los scripts y CSP de desarrollo
  limitada a loopback para Vite y su recarga en caliente.
- Navegación, redirecciones, ventanas nuevas, webviews y descargas bloqueadas;
  permisos denegados y peticiones remotas canceladas. `pnpm verify:build` lo
  comprueba sobre los artefactos.
- La base SQLite vive solo en `userData`, el renderer no la ve y `src/main/db/`
  no importa Electron. Un fallo de integridad, copia o migración deja la app en
  modo seguro sin conexión de escritura.

## Privacidad y datos

- Los datos viven en `app.getPath('userData')`, **fuera** de la carpeta de
  instalación. Actualizar, reinstalar o desinstalar no los borra.
- No hay telemetría, analítica ni servicios de terceros.
- La aplicación funciona sin conexión. La red solo se usa para comprobar
  actualizaciones cuando la persona usuaria lo permite.
- Antes de una migración se crea una copia local verificable. Las copias
  automáticas diarias, semanales y mensuales, la retención y la restauración
  desde el aviso de modo seguro ya funcionan; la interfaz de Ajustes llega en M1.
- Los datos se podrán exportar e importar en formatos abiertos (JSON y assets) en
  las fases siguientes.

El detalle está en [`docs/persistencia.md`](docs/persistencia.md) y
[`docs/continuidad.md`](docs/continuidad.md).

## Estructura del repositorio

```text
src/
  main/           Proceso principal: ventana, ciclo de vida, IPC y persistencia
    assets/       Servicio de imágenes, protocolo wc-asset:// y purga recuperable
    backup/       Copias, manifiesto, rotación, programación y restauración
    db/           Rutas, conexión SQLite, esquema, migraciones, copia e integridad
    ipc/          Router tipado con allowlist y Zod
    messages/     Textos de los diálogos nativos
    security/     CSP, navegación, sesión y guards de red
  preload/        Puente congelado que solo expone window.worldCraft
  renderer/       React, mensajes, tema, shell, páginas y tokens de estilo
  shared/         Identidad y contratos sin Node, Electron ni React
drizzle/          Migraciones versionadas, journal y rollback de referencia
tests/unit/       Pruebas unitarias del scaffold, IPC, seguridad, datos y diseño
tests/integration/ Pruebas con bases SQLite temporales
docs/             Plan, proceso, arquitectura, persistencia, diseño y ADRs
  adr/            Decisiones de arquitectura y producto
  base-de-datos/  Esquema SQLite y migraciones
  calidad/        Plan de pruebas
tasks/            Task files del flujo SDD
scripts/          check-build, check-native, clean y utilidades
.github/          CI, Dependabot y plantillas de issue y PR
.opencode/        Agentes y configuración de OpenCode
```

Las pantallas y los módulos de producto se añadirán dentro de `src/renderer/` y
`src/main/` con sus issues; todavía no existen `src/renderer/modules/`. Los
servicios de assets y de copias ya viven en `src/main/assets/` y
`src/main/backup/`.

## Ramas

- `main`: versión estable. Solo la promueve el propietario desde `dev`.
- `dev`: rama de integración. Todas las Pull Requests se abren contra `dev`,
  nunca contra `main`.
- `local`: rama de pruebas del propietario cuando haga falta; no es una rama de
  integración.

## Documentación

- [`AGENTS.md`](AGENTS.md): reglas obligatorias y Definition of Done.
- [`docs/proceso-sdd.md`](docs/proceso-sdd.md): flujo SDD, puertas y publicación
  local-first.
- [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md): plan aprobado y alcance.
- [`docs/arquitectura.md`](docs/arquitectura.md): procesos de Electron, IPC,
  datos y empaquetado.
- [`docs/persistencia.md`](docs/persistencia.md): SQLite, `userData`, assets,
  copias y restauración.
- [`docs/base-de-datos/esquema.md`](docs/base-de-datos/esquema.md) y
  [`docs/base-de-datos/migraciones.md`](docs/base-de-datos/migraciones.md):
  modelo y migraciones.
- [`docs/continuidad.md`](docs/continuidad.md): escenarios de pérdida y
  recuperación.
- [`docs/diseno/sistema-de-diseno.md`](docs/diseno/sistema-de-diseno.md): tokens,
  temas y componentes de escritorio.
- [`docs/internacionalizacion.md`](docs/internacionalizacion.md): catálogo
  tipado y formatos.
- [`docs/calidad/plan-de-pruebas.md`](docs/calidad/plan-de-pruebas.md): pruebas,
  datos, IPC, UI y rendimiento.
- [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md): manual en
  construcción; las funciones aún no implementadas figuran como previstas.
- [`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md): inventario del
  pivote y cuentas a cerrar.
- [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md) y
  [`CHANGELOG.md`](CHANGELOG.md).
- [`LICENSE`](LICENSE): licencia MIT.
