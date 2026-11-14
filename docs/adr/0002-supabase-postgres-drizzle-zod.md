# ADR 0002 — Supabase Postgres, Drizzle y Zod

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-001
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0003, ADR 0004, ADR 0013

## Contexto

El modelo es relacional y multi-mundo: todas las tablas de contenido cuelgan de
un mundo para aplicar RLS, exportar y borrar de forma coherente. Se necesita una
base PostgreSQL gestionada, con autenticación y RLS integradas, que quepa en un
plan gratuito y permita migrar de proveedor sin reescribir el dominio.

## Decisión

1. **Base de datos:** Supabase Free con PostgreSQL 15+.
2. **ORM:** Drizzle ORM con el driver `postgres`, esquema tipado por módulo y
   migraciones versionadas con Drizzle Kit. Nunca se edita una migración ya
   aplicada.
3. **Validación:** Zod es la única fuente de validación en cliente, Server
   Actions y contratos de route handlers.
4. **Modelo:** JSONB para contenido rico y atributos variables, con índices GIN
   donde se consulta; texto plano duplicado (`description_text`,
   `content_text`) para búsqueda y exportación; `tsvector` generado con
   configuración `spanish` y `pg_trgm` para búsqueda difusa.
5. **Rendimiento:** índices en `world_id`, `type_id`, `updated_at`,
   `search_vector` y nombres; paginación por cursor en listas y búsqueda.
6. **Fechas:** `timestamptz` en UTC; la interfaz aplica la zona local.
7. **Borrado:** lógico con `deleted_at` en entidades, mapas y escenas, con purga
   programada.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Neon Free | Más almacenamiento y sin pausa, pero requiere montar Auth y RLS por separado; se mantiene como ruta de migración. |
| Turso / Cloudflare D1 | SQLite distribuido; pierde RLS y funciones PostgreSQL que el modelo necesita. |
| PocketBase | Autohospedaje y modelo limitado; no encaja con Vercel serverless ni con RLS. |
| Firebase | No relacional; complica relaciones, exportación y consultas del grafo. |
| Prisma en lugar de Drizzle | Más maduro, pero su motor y shadow database añaden peso y fricción en serverless. |

## Consecuencias

### Positivas

- RLS, Auth y PostgreSQL en un mismo panel gratuito.
- Drizzle genera tipos precisos y SQL revisable; Zod comparte contratos.
- El modelo JSONB + texto plano cubre fichas variables y búsqueda sin migrar
  por cada tipo.
- La exportación de un mundo se puede construir con SQL estándar y JSON.

### Negativas y riesgos

- 500 MB de base de datos y pausa tras una semana de baja actividad.
- Sin backups automáticos en Free; se compensa con el ADR 0013.
- Drizzle es menos maduro que Prisma y exige disciplina en migraciones.
- JSONB puede degradar consultas si se abusa de él sin índices.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Sin impacto directo. |
| Temas (Claro/Oscuro) | Sin impacto directo. |
| Accesibilidad | Sin impacto directo; los textos de error de Zod se muestran asociados al campo. |
| Seguridad y privacidad | RLS en todas las tablas de contenido y validación de servidor obligatoria. |
| Coste | 0 €/mes en Supabase Free; los assets no viven aquí. |
| Portabilidad de datos | Alta: PostgreSQL estándar, migraciones en el repo y exportación JSON. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Tamaño de base de datos | 500 MB | Assets en R2, texto y metadatos solamente, purga de papelera y revisión mensual | ADR 0004 y ADR 0013 |
| Pausa del proyecto | Tras una semana de baja actividad | Keep-alive con consulta real y monitor UptimeRobot | ADR 0013; M0-11 (#41) |
| Pérdida de datos | Sin backups automáticos en Free | `pg_dump` semanal cifrado y exportación de mundo | ADR 0013; M5-06 (#33) |
| Límite de proveedor | 5 GB de egreso y 2 proyectos | Uso personal, caché y migración a Neon Free + R2 si se supera | ADR 0013 |

## Plan de revisión

Se revisa si se supera el 70 % de la cuota, si la pausa se vuelve recurrente o
si una función del MVP exige extensiones no disponibles. La migración a Neon
Free + R2 requiere un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D3–D4, §3.3, §3.5 y §3.7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-001
- Documentación oficial de Supabase, Drizzle ORM y Zod, consultada el 12/11/2026.
