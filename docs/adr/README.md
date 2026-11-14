# ADRs de World Craft

> **Estado:** vigente desde el 14/11/2026 (issue
> [#4](https://github.com/gonzalitojh/world-craft/issues/4), M0-03).
> **Ámbito:** decisiones de arquitectura, tecnología y producto con
> consecuencias técnicas.
> **Origen:** [`docs/plan-desarrollo.md`](../plan-desarrollo.md) §3.2 (D1–D17) y
> [`docs/registro-decisiones.md`](../registro-decisiones.md) (D-001–D-014).

Este directorio conserva el **porqué** de las decisiones que sostienen World
Craft. El plan define el alcance; el registro de decisiones conserva el
histórico de la conversación; los ADRs son el registro durable que evita
revertir una decisión sin contexto.

## Cómo se usa este índice

- **Un ADR, una decisión o un grupo coherente de subdecisiones.** Si una decisión
  cambia, no se reescribe el ADR aceptado: se crea otro que lo superseda.
- **Estados permitidos:** `propuesto`, `aceptado` y `supersedido por ADR NNNN`.
  Los 13 ADRs fundacionales están `aceptados` porque el usuario cerró las
  decisiones el 12/11/2026. Los ADRs 0014, 0015 y 0016 también están
  `aceptados`: recogen las decisiones del 14/11/2026 sobre visibilidad y
  protección de ramas, coste de contexto y entorno/CI.
- **Numeración:** cuatro dígitos y slug en inglés kebab-case
  (`NNNN-slug-en-kebab-case.md`). `0000` es la
  [`plantilla`](0000-template.md) y no cuenta como ADR.
- **Equivalencia con la issue:** `ADR-001` = `0001`, `ADR-002` = `0002`, etc.
- **Idioma:** el nombre del archivo y los identificadores van en inglés; el
  cuerpo y la documentación, en español.

## Índice de ADRs

| ADR | Título | Decisión en una línea | Estado | Fecha | Issue |
|---|---|---|---|---|---|
| [0001](0001-nextjs-app-router.md) | Next.js, React y TypeScript | App Router + RSC/Server Actions sobre React 19 y TypeScript estricto | aceptado | 2026-11-12 | #4 |
| [0002](0002-supabase-postgres-drizzle-zod.md) | Supabase Postgres, Drizzle y Zod | PostgreSQL gestionado, Drizzle SQL-first y Zod como validación única | aceptado | 2026-11-12 | #4 |
| [0003](0003-supabase-auth-allowlist-invitations.md) | Supabase Auth, allowlist e invitaciones | Auth con registro cerrado, sesiones SSR e invitaciones de un solo uso | aceptado | 2026-11-12 | #4 |
| [0004](0004-cloudflare-r2-storage-adapter.md) | Cloudflare R2 y StorageAdapter | R2 privado como almacenamiento principal tras una interfaz abstraída | aceptado | 2026-11-12 | #4 |
| [0005](0005-vercel-hobby.md) | Vercel Hobby y dominio | Hosting Hobby y subdominio de Vercel; dominio propio fuera del MVP | aceptado | 2026-11-12 | #4 |
| [0006](0006-maplibre-terra-draw-geojson.md) | MapLibre, Terra Draw y GeoJSON | Mapas vectoriales en GeoJSON con raster opcional y exportación propia | aceptado | 2026-11-12 | #4 |
| [0007](0007-react-flow-elk.md) | React Flow y ELK.js | Grafo con nodos React y layout automático en Web Worker | aceptado | 2026-11-12 | #4 |
| [0008](0008-tiptap-exporters.md) | Tiptap y exportadores | Editor MIT con extensiones propias y exportación a DOCX/PDF/EPUB/Markdown | aceptado | 2026-11-12 | #4 |
| [0009](0009-testing-pwa-backups.md) | Testing, PWA y backups | Calidad verificable, offline con IndexedDB y backups recuperables | aceptado | 2026-11-12 | #4 |
| [0010](0010-two-themes-design-system.md) | Dos temas y sistema de diseño | Solo Claro y Oscuro, tokens accesibles y estética de cartógrafo | aceptado | 2026-11-12 | #4 |
| [0011](0011-allowlist-world-roles-own-worlds.md) | Allowlist, roles y mundos propios | Allowlist para la app; membresía y roles por mundo; mundos propios | aceptado | 2026-11-12 | #4 |
| [0012](0012-i18n-centralized-roadmap.md) | Internacionalización | Español en el MVP con mensajes tipados y ruta a inglés e italiano | aceptado | 2026-11-12 | #4 |
| [0013](0013-free-tier-continuity.md) | Continuidad de free tiers | R2, keep-alive, backups y revisión de cuotas para sostener 0 €/mes | aceptado | 2026-11-12 | #4 |
| [0014](0014-public-repo-mit-and-branch-protection.md) | Repositorio público, MIT y protección de ramas | Repo público con MIT y rulesets en `dev`/`main`, con bypass del owner solo en `main` | aceptado | 2026-11-14 | #5 |
| [0015](0015-coste-contexto-cache-variante-fija.md) | Coste de contexto: caché, prompts bajo demanda y variante fija | `warming`, skill `repo-map`, orquestación proporcional y variante fija por subagente | aceptado | 2026-11-14 | — (tarea local) |
| [0016](0016-entorno-tooling-ci.md) | Entorno de desarrollo, tooling y CI base | Node 22, pnpm/Corepack, TS estricto, ESLint/Prettier, Vitest/Playwright y CI con cuatro required checks | aceptado | 2026-11-14 | #6 |

## Trazabilidad con el plan y el registro

| Decisión cerrada | ADR | Plan | Registro |
|---|---|---|---|
| Stack y free tiers | 0001, 0002, 0004, 0005, 0013 | §3.2 D1–D7, §3.7 | D-001 |
| Temas | 0010 | §3.2 D2 y D15 | D-002 |
| Mapas | 0006 | §3.2 D8 | D-003 |
| Acceso y roles | 0003, 0011 | §3.2 D5, §3.4 | D-004 |
| Idioma | 0012 | §3.2 D16 | D-005 |
| Dominio | 0005 | §3.2 D7, §7 | D-006 |
| Visibilidad, licencia y protección de ramas | 0014 | §3.7, §4.4 | D-009, D-010 |
| Coste de contexto y variante por subagente | 0015 | §4.3, §4.9 | — |
| Entorno, tooling y CI base | 0016 | §3.7, §4.7, §5.2 | D-013, D-014 |

### Decisiones sin ADR propio

- **D-007 del registro (publicación local-first):** ya está normada en
  [`docs/proceso-sdd.md`](../proceso-sdd.md) §7 y en
  [`AGENTS.md`](../../AGENTS.md) regla 5. No es una decisión de arquitectura
  pendiente.
- **D-008 del registro (contenido de juego ampliable):** se concreta en M4-04
  (issue [#44](https://github.com/gonzalitojh/world-craft/issues/44)). No hay aún
  una elección técnica que registrar.
- **D11 del plan (estado, formularios y contratos):** se aplica en la
  implementación con React Hook Form, Zustand y TanStack Query cuando haga
  falta; no fija un proveedor ni una arquitectura nueva.
- **D17 del plan (estructura del repositorio):** se documentará en
  `docs/arquitectura.md` (M0-09, issue
  [#10](https://github.com/gonzalitojh/world-craft/issues/10)) junto con los
  módulos reales.

## Historial de supersesiones

| Fecha | ADR nuevo | Sustituye a | Motivo |
|---|---|---|---|
| — | — | — | — |

## Cómo crear o cambiar un ADR

1. Copia [`0000-template.md`](0000-template.md) como
   `docs/adr/NNNN-slug-en-kebab-case.md`, usando el siguiente número libre.
2. Completa todas las secciones, incluida la de riesgos de free tier. Si la
   decisión no toca un servicio, escribe «No aplica» y justifícalo.
3. Añade la fila al índice y, si procede, a la tabla de trazabilidad.
4. Enlaza la issue y la entrada del registro de decisiones.
5. Para cambiar una decisión aceptada: crea un ADR nuevo, marca el antiguo como
   `supersedido por ADR NNNN` y añade la fila al historial de supersesiones. No
   reescribas el histórico.
6. Verifica enlaces, fences, numeración y coherencia con el plan y el registro.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md)
- [`docs/proceso-sdd.md`](../proceso-sdd.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`0000-template.md`](0000-template.md)
