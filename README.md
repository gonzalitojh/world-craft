# World Craft

World Craft es una aplicación privada para crear y mantener **mundos de ficción**:
fichas y entidades, relaciones, mapas, grafo de conocimiento, escritura de
manuscritos y juego creativo. Todo el contenido requiere sesión y permisos: no
hay contenido público por defecto. El código se publica bajo licencia MIT; los
datos de los mundos siguen siendo privados.

## Estado

**En construcción, fase M0 (fundaciones y proceso).** Todavía no hay
funcionalidad visible ni aplicación ejecutable. El arranque local (Node, pnpm,
variables de entorno y scripts) llega con las issues #6 (M0-05) y #10 (M0-09).

## Stack previsto

- [Next.js](https://nextjs.org/) App Router + React + TypeScript estricto.
- [Supabase](https://supabase.com/) PostgreSQL y Auth con allowlist.
- [Drizzle ORM](https://orm.drizzle.team/) + [Zod](https://zod.dev/).
- [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) para
  archivos, con bucket privado y URLs firmadas.
- [Vercel](https://vercel.com/) Hobby para el despliegue.

## Estructura del repositorio

- `docs/`: plan, proceso, decisiones y ADRs.
- `tasks/`: task files del flujo SDD.
- `scripts/`: utilidades de mantenimiento del repositorio.
- `.opencode/`: agentes y configuración de OpenCode.

## Ramas

- `main`: versión estable. Solo la promueve el propietario desde `dev`.
- `dev`: rama de integración. Todas las Pull Requests se abren contra `dev`,
  nunca contra `main`.

## Documentación

- [AGENTS.md](AGENTS.md): reglas obligatorias y Definition of Done.
- [docs/proceso-sdd.md](docs/proceso-sdd.md): flujo SDD, puertas y publicación
  local-first.
- [docs/plan-desarrollo.md](docs/plan-desarrollo.md): plan aprobado y alcance.
- [docs/registro-decisiones.md](docs/registro-decisiones.md): registro de
  decisiones.
- [docs/adr/README.md](docs/adr/README.md): índice de ADRs.
- [CONTRIBUTING.md](CONTRIBUTING.md): ramas, commits, PRs y calidad.
- [SECURITY.md](SECURITY.md): cómo reportar una vulnerabilidad.
- [LICENSE](LICENSE): licencia MIT.
