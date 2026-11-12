# Registro de decisiones de World Craft

Registro append-only de las decisiones de producto y arquitectura tomadas durante la planificación y el desarrollo. Cada entrada indica la fecha, el contexto, la decisión, sus consecuencias y las issues afectadas. Cuando una decisión sea arquitectónica, se reflejará también en un ADR (issue M0-03); este registro conserva el histórico de la conversación y del plan.

## 2026-11-12 — Cierre de las 8 decisiones del plan (issue #1)

**Contexto.** El 11/11/2026 se creó el plan `docs/plan-desarrollo.md` y las issues #2–#39. Quedaron ocho decisiones pendientes de validación del usuario. El 12/11/2026 el usuario las revisó y cerró todas.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-001 | Stack y free tiers | Mantener **Supabase Free + Vercel Hobby**, pero mover los archivos a **Cloudflare R2 Free**. Añadir keep-alive y backups para la pausa de Supabase. | Supabase sigue siendo la base de datos, Auth y RLS; R2 evita el límite de 1 GB de Storage y el egreso. Se añaden M0-10 (R2) y M0-11 (continuidad). |
| D-002 | Temas | Usar **dos temas**: Claro y Oscuro. Se descartan Blanco puro y Negro puro. | Se simplifican tokens, pruebas, capturas y reglas de `AGENTS.md`. Se actualizan M0-07, M5-02 y todas las issues que contenían referencias a cuatro temas. |
| D-003 | Mapas | Incluir **imagen raster de fondo opcional y georreferenciada** para calcar o completar mapas dibujados a mano. El mapa sigue siendo vectorial por defecto. | Se mantiene en el alcance de M2-01 y se explicita en M2-02. |
| D-004 | Acceso | La allowlist concede acceso a la **aplicación**; la pertenencia a un mundo concede acceso a ese mundo. Roles por mundo: `owner`, `editor` y `viewer`. Cualquier usuario autorizado puede **crear sus propios mundos**. | Se separa acceso a la app de membresía de mundos. Se añade M1-07 para gestionar miembros, roles e invitaciones; M1-01 y M1-02 se ajustan. |
| D-005 | Idioma | Español en el MVP, con **todos los textos centralizados** y estructura preparada para inglés e italiano. | Se añade M0-12 (fundaciones de i18n). B-05 queda para la traducción completa y `next-intl` cuando se decida. |
| D-006 | Dominio | Usar el **subdominio de Vercel** (`*.vercel.app`) en el MVP. El dominio propio queda como opción futura. | Se actualiza M5-07 y se elimina la decisión pendiente sobre dominio. |
| D-007 | Publicación | Revisar el plan en local primero. Cuando el usuario lo apruebe, publicarlo mediante **PR a `dev`**, nunca directamente a `main`. | El plan se revisó en local y se publica mediante PR a `dev`. El publisher mantiene el modo local-first para futuras tareas. |
| D-008 | Contenido de juego | Mantener la recomendación inicial (fantasía, ciencia ficción, terror y contemporáneo; 40–60 entradas por categoría) y permitir **ampliar el contenido desde la app, sin modificar código**. | Se añade M4-04 (packs de contenido y edición de tablas). M4-02 y M4-03 se ajustan para que el contenido sea ampliable. |

### Decisiones derivadas

- **Almacenamiento principal:** Cloudflare R2 Free (10 GB, 1M operaciones Class A, 10M Class B, egreso gratis), con bucket privado y URLs firmadas. Supabase Storage no se usa en producción.
- **Continuidad de Supabase:** healthcheck y monitor keep-alive (UptimeRobot Free o equivalente) para generar actividad; backup semanal con `pg_dump`; procedimiento de reactivación documentado. Los proyectos pausados conservan los datos y se pueden restaurar desde el panel (ventana de un año).
- **Matriz de temas:** dos modos, `light` y `dark`, con contraste WCAG AA.
- **Internacionalización:** mensajes centralizados y claves tipadas desde el inicio; `locale` en el perfil; fechas y números con `Intl`.
- **Acceso:** `allowed_emails` controla quién puede entrar; `world_members` controla qué puede hacer en cada mundo; el propietario de un mundo es su `owner`.
- **Contenido de juego:** el seed inicial es solo el punto de partida; las tablas personalizadas y los packs permiten ampliarlo desde la interfaz.

### Issues nuevas

- **M0-10** ([#40](https://github.com/gonzalitojh/world-craft/issues/40)) — Configurar Cloudflare R2 y el adaptador de almacenamiento.
- **M0-11** ([#41](https://github.com/gonzalitojh/world-craft/issues/41)) — Keep-alive y continuidad de Supabase.
- **M0-12** ([#42](https://github.com/gonzalitojh/world-craft/issues/42)) — Fundaciones de internacionalización.
- **M1-07** ([#43](https://github.com/gonzalitojh/world-craft/issues/43)) — Miembros, roles e invitaciones por mundo.
- **M4-04** ([#44](https://github.com/gonzalitojh/world-craft/issues/44)) — Packs de contenido y ampliación del juego desde la app.

Con estas cinco issues, el plan pasa de **38 a 43 issues**. Las issues #2–#39 se actualizaron con los textos nuevos y la issue #1 recibió un comentario con el resumen de las decisiones y perdió la etiqueta `needs-decision`.

### Publicación

El usuario revisó y aprobó el plan. El trabajo se publica mediante la **PR [#45](https://github.com/gonzalitojh/world-craft/pull/45) contra `dev`**; nunca se hace push directo a `main`. La rama `main` queda reservada para las versiones estables que promueva el usuario.

## 2026-11-12 — Aprobación del plan y publicación en `dev`

El usuario revisó el plan y lo aprobó. Se publica el trabajo mediante la PR [#45](https://github.com/gonzalitojh/world-craft/pull/45), con base en la rama de integración `dev`. A partir de este momento, `dev` es la rama de integración y `main` queda reservada para versiones estables.
