# World Craft

World Craft es una **aplicación de escritorio para Windows** con la que crear y
mantener mundos de ficción: fichas y entidades, relaciones, mapas, grafo de
conocimiento, manuscritos y juego creativo. Todo el contenido vive en el equipo
de la persona usuaria: no hay cuentas, servidor remoto ni contenido público. El
código se publica bajo licencia MIT.

## Estado

**Pivote a escritorio en curso.** El repositorio ya no contiene la aplicación web
(Next.js, Supabase, Vercel y Cloudflare R2); conserva el proceso SDD, las reglas,
la arquitectura de escritorio y el tooling mínimo de calidad. **Todavía no hay
una versión instalable**: el scaffold de Electron, la base SQLite y las primeras
pantallas llegan en las issues de las fases M0 y M1.

El inventario de lo eliminado y las cuentas externas que hay que cerrar están en
[`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md). El plan aprobado,
en [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md).

## Arquitectura objetivo

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Electron + electron-vite |
| Interfaz | React + TypeScript estricto + Vite |
| Estilos | Tailwind CSS 4 + shadcn/ui + Radix + Lucide + Motion |
| Base de datos | SQLite local con better-sqlite3 + Drizzle ORM |
| Búsqueda | SQLite FTS5 |
| Archivos | Sistema de archivos local bajo `app.getPath('userData')` |
| Editor | Tiptap 3 |
| Mapas y grafo | MapLibre GL JS + Terra Draw; React Flow + ELK.js |
| Instalador | electron-builder + NSIS |
| Actualizaciones | electron-updater + GitHub Releases |

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

Mientras no exista el scaffold de Electron, el repositorio solo ofrece el
tooling de calidad:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Cuando el scaffold esté disponible, `pnpm dev` abrirá la ventana de Electron y
`pnpm build` generará el instalador; los comandos exactos se documentarán en la
issue que los introduzca. No inventes ni ejecutes scripts que aún no existan.

## Privacidad y datos

- Los datos viven en `app.getPath('userData')`, **fuera** de la carpeta de
  instalación. Actualizar, reinstalar o desinstalar no los borra.
- No hay telemetría, analítica ni servicios de terceros.
- La aplicación funciona sin conexión. La red solo se usa para comprobar
  actualizaciones cuando la persona usuaria lo permite.
- Las copias de seguridad son locales, verificables y restaurables desde la
  propia aplicación.
- Los datos se pueden exportar e importar en formatos abiertos (JSON y assets).

El detalle está en [`docs/persistencia.md`](docs/persistencia.md) y
[`docs/continuidad.md`](docs/continuidad.md).

## Estructura del repositorio

```text
src/
  shared/         Código compartido sin Node, Electron ni React
docs/             Plan, proceso, arquitectura, persistencia, diseño y ADRs
  adr/            Decisiones de arquitectura y producto
  base-de-datos/  Esquema SQLite y migraciones
  calidad/        Plan de pruebas
tasks/            Task files del flujo SDD
scripts/          Utilidades de mantenimiento del repositorio
.github/          CI, Dependabot y plantillas de issue y PR
.opencode/        Agentes y configuración de OpenCode
```

Las carpetas `src/main/`, `src/preload/`, `src/renderer/` y `src/modules/` se
crearán con el scaffold de Electron y los primeros módulos de dominio.

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
