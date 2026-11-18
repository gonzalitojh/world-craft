# Cambio a aplicación de escritorio

Este documento registra el pivote de World Craft desde una aplicación web
(Next.js + Supabase + Vercel + Cloudflare R2) a una **aplicación de escritorio
Windows con persistencia local**. Su objetivo es que nada quede en el aire: qué
se eliminó, qué se reescribió y qué cuentas o secretos externos hay que cerrar.

- **Fecha del pivote:** 2026-11-18.
- **Rama:** `docs/desktop-pivot`, creada desde `origin/dev`.
- **Alcance:** repositorio, documentación, agentes, etiquetas, hitos e issues.
- **Aplicación web:** solo existía la fase M0 (shell, diseño, i18n, esquema
  PostgreSQL y almacenamiento). No había producto ni datos reales de usuario.

## 1. Decisiones del pivote

| Decisión | Registro |
|---|---|
| Electron + electron-vite + React + TypeScript | ADR [0001](adr/0001-electron-vite-react-typescript.md) |
| SQLite con better-sqlite3 + Drizzle + FTS5 | ADR [0002](adr/0002-sqlite-better-sqlite3-drizzle-fts5.md) |
| Instalador NSIS, actualizaciones y preservación de datos | ADR [0003](adr/0003-nsis-installer-electron-updater-data-preservation.md) |
| Seguridad de Electron e IPC tipado | ADR [0004](adr/0004-electron-security-typed-ipc.md) |
| Assets locales con protocolo propio | ADR [0005](adr/0005-local-assets-custom-protocol.md) |
| Dos temas y sistema de diseño de escritorio | ADR [0006](adr/0006-two-themes-desktop-design-system.md) |
| Tiptap y exportadores | ADR [0007](adr/0007-tiptap-editor-exporters.md) |
| MapLibre + Terra Draw y React Flow + ELK | ADR [0008](adr/0008-maplibre-terra-draw-react-flow-elk.md) |
| Internacionalización centralizada | ADR [0009](adr/0009-centralized-i18n.md) |
| Estrategia de pruebas | ADR [0010](adr/0010-testing-strategy.md) |
| Modelo monousuario local | ADR [0011](adr/0011-single-user-local-model.md) |
| Copias, restauración y recuperación | ADR [0012](adr/0012-backup-restore-recovery.md) |
| CI y releases | ADR [0013](adr/0013-ci-releases.md) |
| Estructura del repositorio y tooling | ADR [0014](adr/0014-repository-structure-tooling.md) |
| Firma de código opcional y SmartScreen | ADR [0015](adr/0015-optional-code-signing-smartscreen.md) |

El registro de decisiones de producto y arquitectura se reinició con las
decisiones D-020–D-039 en [`registro-decisiones.md`](registro-decisiones.md).
El historial web anterior se conserva en el historial de git y no se restaura.

## 2. Archivos eliminados

### 2.1 Aplicación web y UI

| Ruta | Qué contenía |
|---|---|
| `src/app/**` | Rutas del App Router: portada, login, health, design-system, API y layouts. |
| `src/components/**` | Shell web, barra inferior móvil, drawers, tema, i18n y componentes de shadcn/ui. |
| `src/lib/assets/**` | Pipeline de imagen con `sharp`, límites y servicio de assets web. |
| `src/lib/db/**` | Cliente PostgreSQL, esquema Drizzle, sesión, seed y entorno de base de datos. |
| `src/lib/env/**` | Esquemas Zod de variables públicas y de servidor de Next.js/Vercel. |
| `src/lib/i18n/**` | Locale por petición, cookie, Server Action y formatos de servidor. |
| `src/lib/storage/**` | Contrato `StorageAdapter`, adaptadores R2 y local, claves y smoke. |
| `src/lib/health.ts`, `site-url.ts`, `navigation.ts`, `theme*.ts`, `contrast.ts`, `utils.ts` | Utilidades del shell web. |
| `src/messages/**` | Catálogo de mensajes y contrato del renderer web. |
| `src/modules/README.md` | Descripción de módulos con infraestructura Supabase/R2. |
| `src/styles/**` | Tokens, base y movimiento del sistema de diseño web. |

La carpeta `src/` se reconstruye con `src/shared/app-info.ts` como único módulo
compartido; el scaffold de Electron creará `src/main/`, `src/preload/` y
`src/renderer/`.

### 2.2 Persistencia PostgreSQL

| Ruta | Qué contenía |
|---|---|
| `drizzle/**` | Ocho migraciones SQL, journal, snapshots y rollbacks de PostgreSQL. |
| `drizzle.config.ts` | Configuración de Drizzle Kit para PostgreSQL. |
| `src/lib/db/schema/**` | 24 tablas, enums y relaciones del modelo web. |
| `src/lib/db/seed/**` | Catálogo del sistema y seed idempotente. |

El nuevo modelo es SQLite y se documenta en
[`base-de-datos/esquema.md`](base-de-datos/esquema.md) y
[`base-de-datos/migraciones.md`](base-de-datos/migraciones.md).

### 2.3 Entorno, almacenamiento y configuración web

| Ruta | Qué contenía |
|---|---|
| `.env.example` | Contrato de variables de Supabase, R2 y Vercel. |
| `.env.local` | Variables locales del desarrollador (sin versionar). |
| `next.config.ts`, `next-env.d.ts` | Configuración y tipos de Next.js. |
| `postcss.config.mjs`, `components.json` | Pipeline de Tailwind/shadcn del scaffold web. |
| `playwright.config.ts` | Configuración de Playwright contra el servidor web. |
| `vitest.db.config.ts` | Configuración de pruebas de integración PostgreSQL. |
| `vercel.json` | Configuración del despliegue en Vercel. |
| `.github/workflows/backup.yml` | `pg_dump` cifrado de Supabase. |
| `.github/workflows/keepalive.yml` | Keep-alive del healthcheck de Supabase. |

### 2.4 Pruebas y scripts

| Ruta | Qué contenía |
|---|---|
| `tests/**` | Pruebas unitarias, de componentes, RLS, integración, E2E, fixtures y helpers web. |
| `scripts/db/**` | `ping`, `reset`, `seed` y `verify` contra Supabase. |
| `scripts/storage/**` | Smoke real de Cloudflare R2. |
| `scripts/issue-helper.ps1`, `scripts/issues-*.ps1`, `scripts/sync-issues.ps1`, `scripts/issues-created.tsv` | Generación y sincronización de las issues web antiguas. |

Se conservan `scripts/clean.mjs`, `scripts/sync-labels.ps1` y
`scripts/set-branch-protection.ps1`, adaptados al repositorio de escritorio.

### 2.5 Documentación y task files

| Ruta | Qué contenía |
|---|---|
| `docs/adr/0001-nextjs-app-router.md` … `docs/adr/0020-direct-signed-upload-to-r2.md` | Los 20 ADRs de la etapa web. |
| `docs/almacenamiento.md` | R2, CORS, lifecycle y credenciales. |
| `docs/base-de-datos/operacion.md` | Operación de Supabase, migraciones y runbook. |
| `docs/calidad/linea-base-lighthouse.md` | Línea base de Lighthouse web. |
| `docs/diseno/capturas/*.png` | Cuatro capturas del sistema de diseño web. |
| `tasks/task-issue-*.json` y `tasks/task-local-optimizacion-coste-cache.json` | Task files de las issues web. |

Los ADRs nuevos usan la serie 0001–0015 y no reutilizan el contenido anterior.
El detalle completo de cada archivo eliminado está en el diff del commit del
pivote.

## 3. Archivos creados o reescritos

### 3.1 Reglas, proceso y agentes

| Ruta | Cambio |
|---|---|
| `AGENTS.md` | Reglas de escritorio, datos, Electron, ventana, temas, offline y PRs contra `dev`. |
| `docs/proceso-sdd.md` | Flujo, puertas, estados, task files, 46 etiquetas, 7 hitos y publicación. |
| `docs/agentes.md` | Equipo de ocho agentes con responsabilidades de escritorio. |
| `docs/variantes-modelo.md` | Variantes de esfuerzo; subagentes heredan el modelo de sesión, sin `model:` fijo. |
| `.opencode/agents/*.md` | Ocho agentes reescritos; se eliminaron los modelos forzados y las referencias web. |
| `.opencode/skills/repo-map/SKILL.md` | Mapa de contexto y resumen del proceso actualizados. |
| `opencode.jsonc` | Guardrails intactos; comentarios de caché y variantes actualizados. |

### 3.2 Documentación de producto y arquitectura

| Ruta | Cambio |
|---|---|
| `docs/plan-desarrollo.md` | Plan de escritorio, fases M0–M5, migración y riesgos. |
| `docs/arquitectura.md` | Electron, Vite, SQLite, IPC, assets, CI y releases. |
| `docs/persistencia.md` | `userData`, SQLite, assets, migraciones, copias y restauración. |
| `docs/continuidad.md` | Pérdida de datos, copias, modo seguro, papelera y actualizaciones. |
| `docs/base-de-datos/esquema.md` | Diccionario SQLite de 23 tablas, índices, integridad y FTS5. |
| `docs/base-de-datos/migraciones.md` | Drizzle Kit, transacción, copia previa, modo seguro y rollback. |
| `docs/diseno/sistema-de-diseno.md` | Tokens, temas, tipografía, componentes y ventana 1024/1280/1600. |
| `docs/internacionalizacion.md` | Catálogo tipado, locale, `Intl` y adición de idiomas. |
| `docs/calidad/plan-de-pruebas.md` | Pirámide, migraciones, IPC, UI, rendimiento y release. |
| `docs/manual-de-usuario.md` | Manual no técnico; todas las funciones figuran como previstas. |
| `docs/registro-decisiones.md` | Decisiones D-020–D-039 del pivote. |
| `docs/adr/0000-template.md`, `docs/adr/README.md` | Plantilla e índice de la serie de escritorio. |
| `docs/adr/0001-…` … `docs/adr/0015-…` | Quince ADRs nuevos. |
| `docs/cambio-a-escritorio.md` | Este inventario. |

### 3.3 Tooling y repositorio

| Ruta | Cambio |
|---|---|
| `package.json` | Tooling mínimo: lint, typecheck, test y formato; sin Next.js, Supabase ni R2. |
| `tsconfig.json` | TypeScript estricto sin plugin de Next.js; incluye `src` y `tests`. |
| `eslint.config.mjs` | ESLint 10 + TypeScript + Prettier, sin plugin de Next.js. |
| `vitest.config.ts` | Vitest en Node con alias `@/*`. |
| `scripts/clean.mjs` | Limpia `out`, `dist`, `release`, `coverage` y artefactos de pruebas. |
| `.gitignore` | Artefactos de escritorio y bases locales; secretos siguen fuera. |
| `.prettierignore` | Rutas de escritorio y migraciones SQLite. |
| `pnpm-workspace.yaml` | Autorización de `esbuild`; sin overrides web. |
| `src/shared/app-info.ts` y `tests/unit/app-info.test.ts` | Identidad y ventana mínima con una prueba real. |
| `.github/workflows/ci.yml` | Lint, typecheck, test, gitleaks y audit; sin build web ni `test:db`. |
| `.github/pull_request_template.md` | Checklist de ventana, datos y seguridad Electron. |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` | Reescritos para escritorio. |
| `tasks/task-example.json` | Ejemplo del esquema canónico actualizado. |
| `tasks/task-local-desktop-pivot.json` | Evidencia local del pivote. |

## 4. Issues eliminadas

Se eliminan las 45 issues de la etapa web. Los números **no se reutilizan**: el
siguiente catálogo empieza en la issue #61.

| Número | Título |
|---|---|
| #1 | Planificación de aplicación |
| #2 | Auditar y adaptar los agentes de IA al proyecto |
| #3 | Revisar AGENTS.md y el flujo SDD |
| #4 | Crear los ADRs fundacionales |
| #5 | Configurar repositorio, ramas, etiquetas y plantillas |
| #6 | Configurar entorno de desarrollo y CI base |
| #7 | Scaffold de Next.js, TypeScript y Tailwind |
| #8 | Sistema de diseño, temas y shell responsive |
| #9 | Configurar Supabase y el modelo de datos inicial |
| #10 | Documentación base del proyecto |
| #11 | Autenticación, allowlist y acceso a la app |
| #12 | CRUD de mundos propios y dashboard |
| #13 | Entidades, fichas, plantillas y mundo de ejemplo |
| #14 | Relaciones tipadas y backlinks |
| #15 | Búsqueda global y paleta de comandos |
| #16 | Ajustes de cuenta, preferencias y datos |
| #17 | Spike: validar MapLibre GL + Terra Draw y la exportación SVG |
| #18 | Editor de mapas vectorial |
| #19 | Marcadores y vínculos mapa-entidad |
| #20 | Vista de grafo interactiva |
| #21 | Editor de manuscritos y autoguardado |
| #22 | Herramientas de escritura y diálogos |
| #23 | Exportación e importación de manuscritos |
| #24 | Historial de versiones y papelera |
| #25 | Motor de dados y tablas de inspiración |
| #26 | Contenido inicial: contenedores, subgéneros, detonantes y tópicos |
| #27 | Tablas personalizadas y sesiones de inspiración |
| #28 | Manual de usuario y ayuda in-app |
| #29 | Auditoría responsive y de accesibilidad |
| #30 | Rendimiento y optimización |
| #31 | PWA y experiencia móvil |
| #32 | Revisión de seguridad y privacidad |
| #33 | Backups, exportación/importación y recuperación |
| #34 | Despliegue a producción, beta privada y lanzamiento |
| #35 | Colaboración en tiempo real |
| #36 | Wiki pública y enlaces de lectura compartidos |
| #37 | Aplicación de escritorio con Tauri |
| #38 | Inspiración asistida por IA (opcional y con coste) |
| #39 | Internacionalización de la interfaz |
| #40 | Configurar Cloudflare R2 y el adaptador de almacenamiento |
| #41 | Keep-alive y continuidad de Supabase |
| #42 | Fundaciones de internacionalización |
| #43 | Miembros, roles e invitaciones por mundo |
| #44 | Packs de contenido y ampliación del juego desde la app |
| #48 | Política de variantes de modelo y autonomía de permisos de los agentes |

## 5. Etiquetas e hitos

### 5.1 Etiquetas

- **Eliminada:** `area: auth` (ya no hay cuentas ni autenticación remota).
- **Añadidas:** `area: desktop`, `area: persistence`, `area: packaging`.
- **Conservadas:** tipos, estados, prioridades, tamaños, variantes, `ai`,
  `needs-decision`, `future` y las áreas de dominio restantes.

El catálogo completo (46 etiquetas) está en
[`proceso-sdd.md`](proceso-sdd.md#5-etiquetas-estados-e-hitos).

### 5.2 Hitos

Se eliminan los hitos antiguos:

| Número | Título |
|---|---|
| 2 | M0 · Proceso y fundaciones |
| 3 | M1 · Núcleo de datos y acceso |
| 4 | M2 · Mapas y grafo |
| 5 | M3 · Escritura |
| 6 | M4 · Juego creativo |
| 7 | M5 · Calidad y lanzamiento |
| 8 | Backlog |

Se crean estos hitos, que reciben los números 9–15:

| Número | Título |
|---|---|
| 9 | M0 · Fundaciones de escritorio |
| 10 | M1 · Núcleo local |
| 11 | M2 · Mapas y grafo |
| 12 | M3 · Escritura |
| 13 | M4 · Juego creativo |
| 14 | M5 · Calidad y distribución |
| 15 | Backlog |

### 5.3 Issues creadas

El catálogo nuevo tiene 41 issues, numeradas #61–#101. La issue #61 es el
propio pivote y queda en `status: needs-review`; el resto empieza en
`status: todo`. Las cuatro del hito Backlog llevan `future`; #99 y #101 llevan
además `needs-decision`.

| Número | Código | Título | Hito |
|---|---|---|---|
| #61 | M0-01 | Pivote a escritorio: documentación, agentes y limpieza del repositorio web | M0 · Fundaciones de escritorio |
| #62 | M0-02 | Scaffold de Electron, Vite, React y TypeScript | M0 · Fundaciones de escritorio |
| #63 | M0-03 | Ventana segura, preload e IPC tipado con Zod | M0 · Fundaciones de escritorio |
| #64 | M0-04 | SQLite local con better-sqlite3, Drizzle y migraciones | M0 · Fundaciones de escritorio |
| #65 | M0-05 | Sistema de diseño, tokens y shell de escritorio | M0 · Fundaciones de escritorio |
| #66 | M0-06 | Assets locales con protocolo wc-asset:// | M0 · Fundaciones de escritorio |
| #67 | M0-07 | Copias de seguridad, restauración y modo seguro | M0 · Fundaciones de escritorio |
| #68 | M0-08 | Instalador NSIS, actualizaciones y preservación de datos | M0 · Fundaciones de escritorio |
| #69 | M0-09 | CI de escritorio: checks, secretos y dependencias | M0 · Fundaciones de escritorio |
| #70 | M0-10 | Arranque de pruebas: Vitest, Testing Library, Playwright Electron y axe | M0 · Fundaciones de escritorio |
| #71 | M0-11 | Internacionalización centralizada y catálogo tipado | M0 · Fundaciones de escritorio |
| #72 | M1-01 | Mundos: CRUD, dashboard y estados | M1 · Núcleo local |
| #73 | M1-02 | Tipos de entidad del sistema y campos personalizados | M1 · Núcleo local |
| #74 | M1-03 | Fichas: CRUD, imágenes, etiquetas y favoritos | M1 · Núcleo local |
| #75 | M1-04 | Relaciones tipadas y backlinks | M1 · Núcleo local |
| #76 | M1-05 | Búsqueda global FTS5 y paleta de comandos | M1 · Núcleo local |
| #77 | M1-06 | Papelera y versiones de contenido | M1 · Núcleo local |
| #78 | M1-07 | Exportación e importación de mundos | M1 · Núcleo local |
| #79 | M1-08 | Ajustes de datos, carpetas y borrado completo | M1 · Núcleo local |
| #80 | M2-01 | Spike: MapLibre GL, Terra Draw y exportación SVG | M2 · Mapas y grafo |
| #81 | M2-02 | Editor de mapas vectorial | M2 · Mapas y grafo |
| #82 | M2-03 | Marcadores y vínculos mapa-ficha | M2 · Mapas y grafo |
| #83 | M2-04 | Vista de grafo interactiva | M2 · Mapas y grafo |
| #84 | M3-01 | Biblioteca de obras y estructura de manuscrito | M3 · Escritura |
| #85 | M3-02 | Editor de manuscritos con autoguardado y recuperación | M3 · Escritura |
| #86 | M3-03 | Herramientas de escritura: diálogo, concentración y objetivos | M3 · Escritura |
| #87 | M3-04 | Historial de versiones de escena | M3 · Escritura |
| #88 | M3-05 | Exportación e importación de manuscritos | M3 · Escritura |
| #89 | M4-01 | Motor de dados y tablas de inspiración | M4 · Juego creativo |
| #90 | M4-02 | Contenido inicial de inspiración | M4 · Juego creativo |
| #91 | M4-03 | Tablas personalizadas y sesiones de inspiración | M4 · Juego creativo |
| #92 | M4-04 | Packs de contenido ampliables | M4 · Juego creativo |
| #93 | M5-01 | Auditoría de accesibilidad, temas y ventana | M5 · Calidad y distribución |
| #94 | M5-02 | Rendimiento y carga diferida | M5 · Calidad y distribución |
| #95 | M5-03 | Auditoría de seguridad y privacidad | M5 · Calidad y distribución |
| #96 | M5-04 | Manual de usuario, ayuda in-app y onboarding | M5 · Calidad y distribución |
| #97 | M5-05 | Release 1.0, actualizaciones y beta | M5 · Calidad y distribución |
| #98 | B-01 | Calendarios fantásticos y líneas temporales | Backlog |
| #99 | B-02 | Inspiración asistida por IA (opcional y con coste) | Backlog |
| #100 | B-03 | Soporte para macOS y Linux | Backlog |
| #101 | B-04 | Firma de código y aviso de SmartScreen | Backlog |

Cada issue conserva su `Código de plan`, sus dependencias y su variante
recomendada en el cuerpo. Las dependencias apuntan a los números definitivos,
no a los códigos sueltos.

### 5.4 Operaciones ejecutadas en GitHub

El 2026-11-18 se completaron estas operaciones sobre
`gonzalitojh/world-craft`:

1. Se eliminaron las 45 issues web (#1–#44 y #48); el repositorio quedó con 0
   issues antes de crear el catálogo nuevo.
2. Se eliminaron los hitos antiguos #2–#8.
3. Se sincronizaron las 46 etiquetas con `scripts/sync-labels.ps1` y se borró
   `area: auth`.
4. Se crearon los hitos #9–#15 y las 41 issues #61–#101.
5. Se verificó que las 41 issues están abiertas, tienen exactamente un `type:`,
   un `status:`, un `priority:`, un `size:` y un `variant:`, al menos un
   `area:`, un hito existente y solo etiquetas del catálogo.
6. Se actualizaron los rulesets `protect-dev` y `protect-main` con
   `scripts/set-branch-protection.ps1`: exigen `lint`, `typecheck` y `test`,
   mantienen el bypass del propietario solo en `main` y ya no exigen `build`.

La issue #61 queda en `status: needs-review` porque este mismo pivote es su
trabajo. El resto queda en `status: todo`; #98–#101 llevan `future` y #99/#101
llevan `needs-decision`. Los números de las issues eliminadas no se reutilizan.

## 6. Cuentas y servicios externos a cerrar

La aplicación ya no usa ningún servicio en la nube. El propietario debe cerrar
manualmente lo que se creó para la etapa web. Antes de borrar, conviene
exportar cualquier dato de prueba que se quiera conservar.

| Servicio | Qué cerrar | Notas |
|---|---|---|
| **Supabase** | Proyecto de desarrollo | Exportar o descargar la base si se quiere conservar; después pausar y eliminar el proyecto. |
| **Vercel** | Proyecto `world-craft` | Eliminar el proyecto, sus deployments y cualquier dominio asignado. |
| **Cloudflare R2** | Bucket de assets y tokens API | Vaciar el bucket, borrar el bucket y revocar los tokens S3 usados por el adaptador. |
| **UptimeRobot** | Monitor del healthcheck | Pausar y eliminar el monitor si llegó a crearse. |
| **GitHub Actions** | Secretos `SUPABASE_DB_URL` y `BACKUP_PASSPHRASE`; variable `HEALTHCHECK_URL` | Eliminar en Settings → Secrets and variables → Actions. |
| **GitHub** | Workflows `backup.yml` y `keepalive.yml` | Ya se eliminaron del repositorio; no hace falta desactivarlos en el panel. |
| **Entorno local** | `.env.local` y credenciales copiadas | Ya se eliminó `.env.local` del árbol de trabajo; rotar las claves de Supabase y R2 antes de borrar los proyectos. |

No se usaron Sentry, Resend ni otros servicios de analítica o correo. Si en el
futuro se crea alguno, se documentará aquí y en el registro de decisiones.

## 7. Qué no cambia

- El repositorio sigue siendo **GitHub** con licencia MIT y las ramas `main`,
  `dev`, las ramas por issue y `local`.
- Las PRs siguen yendo **siempre contra `dev`** y no llevan keywords de cierre.
- El flujo SDD, la publicación local-first y los guardrails de OpenCode se
  mantienen.
- La interfaz sigue en español y los identificadores en inglés.
- El coste objetivo sigue siendo **0 €/mes** y la aplicación sigue siendo
  offline y local.
