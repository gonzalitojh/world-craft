# Arquitectura de World Craft

> **Estado:** vigente desde el 16/11/2026 (issue
> [#10](https://github.com/gonzalitojh/world-craft/issues/10), M0-09).
> **Ámbito:** mapa de módulos, capas y flujos principales del repositorio.
> **Fuentes:** [`docs/plan-desarrollo.md`](plan-desarrollo.md) §3,
> [`docs/adr/`](adr/README.md) y el código de `src/`.

Este documento explica **cómo está organizada la aplicación** y **por dónde pasa
una petición**. No sustituye al plan ni a los ADRs: el plan define el alcance y
los ADRs el porqué de cada decisión. Si hay discrepancia, mandan ellos.

En la fase actual (M0) el repositorio tiene el esqueleto técnico, el sistema de
diseño y el modelo de datos; **todavía no hay producto**: no existe autenticación
ni pantallas que usen la base de datos. Las secciones marcan qué está
implementado y qué llega en fases posteriores.

## 1. Vista general

```text
Navegador
  Next.js App Router (React 19 + TypeScript)
  Componentes de servidor por defecto; cliente solo donde hay estado
        │ HTTPS
        ▼
Vercel Hobby
  Server Components · Server Actions · Route Handlers
  Validación de entorno (Zod) · Exportadores · URLs firmadas
        │                          │
        ▼                          ▼
Supabase (PostgreSQL + RLS)   Cloudflare R2 (implementado, M0-10)
  Drizzle ORM · migraciones     assets privados tras StorageAdapter
```

| Pieza | Estado | Dónde se decide |
|---|---|---|
| Next.js 16 App Router, React 19 y TypeScript estricto | Implementado (M0-06) | [ADR 0001](adr/0001-nextjs-app-router.md) |
| Supabase Postgres, Drizzle y Zod | Esquema implementado (M0-08); sin proyecto real en uso | [ADR 0002](adr/0002-supabase-postgres-drizzle-zod.md), [ADR 0019](adr/0019-database-schema-migrations-and-rls.md) |
| Supabase Auth, allowlist e invitaciones | Previsto (M1-01) | [ADR 0003](adr/0003-supabase-auth-allowlist-invitations.md) |
| Cloudflare R2 tras `StorageAdapter` | Implementado (M0-10): adaptadores R2 y local, pipeline sharp y guarda 0007; bucket pendiente de crear | [ADR 0004](adr/0004-cloudflare-r2-storage-adapter.md), [ADR 0020](adr/0020-direct-signed-upload-to-r2.md) |
| Vercel Hobby | Configurado | [ADR 0005](adr/0005-vercel-hobby.md) |
| Tailwind 4 CSS-first, dos temas y shell | Implementado (M0-07) | [ADR 0010](adr/0010-two-themes-design-system.md), [ADR 0018](adr/0018-design-system-tokens-and-shell.md) |
| Textos centralizados en español | Implementado el mecanismo; i18n completa prevista (M0-12) | [ADR 0012](adr/0012-i18n-centralized-roadmap.md) |

## 2. Capas y directorios

El código se organiza por **responsabilidad**, no por pantalla. La regla es que
la presentación no contiene reglas de negocio: los componentes pintan y delegan.

| Ruta | Responsabilidad | Puede importar |
|---|---|---|
| `src/app/` | Rutas del App Router, layouts, metadatos y route handlers. | Todo lo demás |
| `src/components/` | Presentación reutilizable: `ui/` base, `shell/` navegación, `theme/` y `design-system/`. | `lib/`, `messages/`, otros componentes |
| `src/modules/` | Lógica de dominio por área (fichas, mapas, manuscritos, juego…). Hoy solo el README: se llena en M1–M4. | `lib/`, tipos de dominio |
| `src/lib/` | Utilidades puras y acceso a infraestructura: `db/`, `env/`, `storage/`, helpers. | Nada de React |
| `src/messages/` | Textos de interfaz centralizados y tipados (`es.ts`). | — |
| `src/styles/` | Tokens de diseño: `palette.css` (única fuente de colores), `scales.css` y `semantic.css`. | — |
| `tests/` | `unit/` (Vitest + Testing Library), `db/` (integración y RLS) y `e2e/` (Playwright + axe). | Código de `src/` |
| `scripts/` | Utilidades de mantenimiento: `clean.mjs` y `db/` (ping, seed, reset, verify). | Código de `src/lib/db` |
| `drizzle/` | Migraciones, journal, snapshots y rollbacks documentados. | — |

Reglas de dependencia:

1. **`src/app` compone; `src/modules` decide; `src/lib` resuelve.** Un
   componente nunca valida reglas de dominio ni habla con la base de datos.
2. **`src/lib/db` solo se importa desde servidor, scripts y tests.** Las claves
   privilegiadas nunca llegan al cliente.
3. **Los textos visibles viven en `src/messages/`.** No se escriben cadenas de
   interfaz en componentes (regla 16 de `AGENTS.md`).
4. **Los tokens viven en `src/styles/tokens/`.** Los componentes usan utilidades
   semánticas, nunca la paleta cruda ni variantes `dark:`.

## 3. Flujo de una petición

El flujo previsto cuando exista producto (M1 en adelante) es:

```text
Petición
  → sesión de Supabase refrescada en middleware (M1-01)
  → Server Component: valida membresía del mundo y consulta con Drizzle
  → respuesta HTML ya filtrada por RLS y por la comprobación de permisos
Mutación
  → Server Action: Zod → permiso de membresía/rol → escritura → revalidatePath
Vista pesada (mapa, grafo, editor)
  → componente cliente cargado con dynamic(..., { ssr: false })
  → guarda por route handler con control de versión
```

Hoy solo existe la parte de infraestructura:

- **Validación de entorno.** `src/lib/env/` separa el esquema público
  (`NEXT_PUBLIC_*`) del de servidor. `src/lib/env/server.ts` está marcado con
  `server-only`: importarlo desde un componente cliente rompe la compilación.
  `src/lib/db/env.ts` valida `DATABASE_URL` y `DIRECT_URL` de forma perezosa y
  estricta.
- **Acceso a datos.** `src/lib/db/` contiene el esquema Drizzle por dominio, la
  conexión privilegiada y la sesión de usuario. Las políticas RLS viven en las
  migraciones de `drizzle/`, no en el código de la aplicación.
- **Almacenamiento.** `src/lib/storage/` define el contrato `StorageAdapter`, el
  driver por entorno, los adaptadores R2 y local, la validación de claves y la
  miniatura UUIDv5. `src/lib/assets/` contiene límites, política de rol, pipeline
  sharp y el servicio `requestUpload`/`finalizeUpload`/`getDownloadUrl`/
  `deleteAsset`/`listAssets`. La subida directa firmada a `tmp/` y la
  finalización en servidor están en el [ADR 0020](adr/0020-direct-signed-upload-to-r2.md);
  el detalle operativo, en [`docs/almacenamiento.md`](almacenamiento.md).
- **Presentación.** El shell (`topbar`, rail, barra inferior, migajas) y los
  componentes base están en `src/components/`; `/design-system` los documenta en
  vivo.

## 4. Rutas actuales

| Ruta | Tipo | Qué hace hoy |
|---|---|---|
| `/` | Server Component | Portada con el estado de la fase y los pilares del producto. |
| `/design-system` | Server + cliente | Página viva del sistema de diseño: tokens, componentes, accesibilidad y capturas. |
| `/login` | Server Component | Placeholder de acceso: aviso y botón deshabilitado, sin formulario (M1-01). |
| `/health` | Server Component | Estado del despliegue: commit, hora y endpoint. |
| `/api/health` | Route Handler | JSON `{ "status": "ok", "timestamp": "…" }` sin caché. |
| `/api/storage/local/[...key]` | Route Handler | Adaptador local firmado con HMAC; solo desarrollo y pruebas, 404 en producción. |
| `/api/storage/self-check` | Route Handler | Diagnóstico de almacenamiento con token; existe en desarrollo y preview, 404 en producción real. |

No hay `middleware.ts` todavía: la protección de rutas y el refresco de sesión
llegan con la autenticación (M1-01). Mientras tanto, ninguna ruta expone datos
privados porque no hay datos ni sesión. Las dos rutas de almacenamiento no se
enlazan desde ninguna pantalla: son infraestructura para M1-03.

## 5. Seguridad y límites de confianza

- **Aislamiento en la base de datos.** RLS activa en las 24 tablas, sin
  privilegios para `anon` y con permisos por tabla y columna: una tabla nueva
  nace cerrada. El detalle está en
  [`docs/base-de-datos/esquema.md`](base-de-datos/esquema.md).
- **Doble comprobación.** RLS es la última línea: las Server Actions vuelven a
  comprobar la membresía y el rol cuando existan (M1).
- **Service role solo en servidor.** La clave privilegiada no se expone al
  cliente ni se registra. `src/lib/env/` impide que las variables de servidor
  acaben en el bundle público.
- **Bucket privado.** Las URLs de R2 son firmadas y de corta duración; las
  claves viven solo en el servidor. Producción exige R2 y nunca cae al
  almacenamiento local ([ADR 0004](adr/0004-cloudflare-r2-storage-adapter.md)).
- **Secretos.** `.env.example` está versionado sin valores reales; `.env*` queda
  fuera de git y la CI ejecuta `gitleaks`.
- **Dependencias.** Coste objetivo 0 €/mes y auditoría en la CI
  ([ADR 0013](adr/0013-free-tier-continuity.md)).

## 6. Calidad y despliegue

- **Pruebas.** `pnpm test` (unidad y componentes), `pnpm test:db` (RLS e
  integración contra el Supabase de desarrollo) y `pnpm test:e2e` (rutas,
  responsive, temas y axe). `pnpm db:check` valida las migraciones sin
  credenciales y `pnpm storage:smoke` comprueba R2 cuando hay credenciales.
- **CI.** GitHub Actions ejecuta `lint`, `typecheck`, `test` y `build` como
  required checks; `e2e`, `gitleaks` y `audit` se ejecutan sin bloquear
  ([ADR 0017](adr/0017-nextjs-scaffold-and-env-contract.md)).
- **Despliegue.** Vercel Hobby con framework Next.js fijado en `vercel.json`.
  Cada rama y PR genera una preview; `dev` integra y `main` solo recibe
  versiones estables que promueve el propietario.

## 7. Evolución por fases

| Fase | Qué añade a la arquitectura |
|---|---|
| **M0** | Proceso, entorno, CI, scaffold, diseño, modelo de datos y documentación base. |
| **M1** | Auth y allowlist, mundos, fichas, relaciones, búsqueda, ajustes y miembros. |
| **M2** | Mapas vectoriales (MapLibre + Terra Draw) y grafo (React Flow + ELK). |
| **M3** | Editor de manuscritos (Tiptap), exportadores y versiones. |
| **M4** | Dados, tablas de inspiración y packs de contenido ampliables. |
| **M5** | PWA, rendimiento, auditoría responsive y a11y, seguridad, backups y producción. |

Cada fase puede añadir módulos en `src/modules/` y rutas en `src/app/`, pero no
cambia las reglas de dependencia de la sección 2.

## 8. Cómo se mantiene

Este documento se actualiza cuando cambian **módulos, dependencias o flujos**
(regla 3 de `AGENTS.md` y `docs/proceso-sdd.md`). Si el cambio fija una decisión
arquitectónica, se crea o supersede un ADR y se enlaza desde la tabla de la
sección 1. El registro histórico de decisiones está en
[`docs/registro-decisiones.md`](registro-decisiones.md).

## 9. Enlaces

- [Plan de desarrollo](plan-desarrollo.md)
- [Registro de decisiones](registro-decisiones.md)
- [Índice de ADRs](adr/README.md)
- [Proceso SDD](proceso-sdd.md)
- [Modelo de datos](base-de-datos/esquema.md)
- [Operación de la base de datos](base-de-datos/operacion.md)
- [Almacenamiento](almacenamiento.md)
- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
