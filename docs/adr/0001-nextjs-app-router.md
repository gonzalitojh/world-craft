# ADR 0001 — Next.js App Router, React y TypeScript

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** —
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0005, ADR 0010, ADR 0012

## Contexto

World Craft es una aplicación personal, privada y de coste cero que combina
enciclopedia, mapas vectoriales, grafo de relaciones, editor de manuscritos y
juego de inspiración. Necesita un framework full-stack con un ecosistema React
maduro para Tiptap, React Flow, MapLibre, dnd-kit y shadcn/ui, y un despliegue
gratuito sin mantener servidores propios.

La decisión se toma antes de crear el scaffold (M0-06) para que el resto de
ADRs y el sistema de diseño partan de una base estable.

## Decisión

Se adopta **Next.js con App Router**, **React 19** y **TypeScript estricto**:

1. Los **Server Components** se usan para lectura y las **Server Actions** para
   mutaciones; los route handlers cubren autosave, subidas firmadas,
   exportaciones y descargas.
2. Las vistas pesadas (editor, mapa y grafo) se cargan solo en cliente con
   `dynamic(..., { ssr: false })`.
3. El proyecto es una **aplicación única**, no un monorepo, organizada por
   dominios bajo `src/modules/`.
4. Se usan APIs estándar y SQL portable para reducir el acoplamiento a Vercel.
5. La interfaz se escribe en español y los identificadores de código y base de
   datos en inglés.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| SvelteKit | Mejor rendimiento base, pero ecosistema menor para editor, grafo y mapas React; puntuación 19 frente a 23 en el plan. |
| Remix / React Router | Buen modelo full-stack, pero menos integración con RSC y Server Actions para este caso; 18 puntos. |
| Astro | Excelente para contenido estático, insuficiente para una app interactiva con editor, mapa y grafo; 15 puntos. |
| Nuxt / Vue | Ecosistema Vue menos maduro para Tiptap, React Flow y MapLibre; 17 puntos. |

## Consecuencias

### Positivas

- Un solo lenguaje y un solo runtime para interfaz, servidor y validación.
- Server Components reducen el JavaScript de las pantallas de lectura.
- Server Actions simplifican las mutaciones y el flujo con Drizzle y Zod.
- El ecosistema React cubre todas las funciones interactivas del plan.

### Negativas y riesgos

- Complejidad de RSC y Server Actions para un equipo pequeño.
- Acoplamiento al runtime de Vercel, mitigado con APIs estándar y una ruta de
  salida documentada.
- Riesgo de bundles grandes si no se vigila la carga diferida y el presupuesto
  de JavaScript por ruta.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Sin impacto directo; el layout se decide en el ADR 0010 y en M0-07. |
| Temas (Claro/Oscuro) | Sin impacto directo; los tokens se definen en el ADR 0010. |
| Accesibilidad | Facilita HTML semántico y streaming; la accesibilidad se verifica por pantalla. |
| Seguridad y privacidad | Las mutaciones pasan por servidor; nunca se confía solo en el cliente. |
| Coste | Sostenible en Vercel Hobby según el ADR 0005. |
| Portabilidad de datos | Alta: SQL estándar, exportación JSON y almacenamiento abstraído. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Build y funciones fuera de límite | 45 min de build y 300 s por función en Vercel Hobby | Render estático cuando sea posible, carga diferida y build incremental | ADR 0005; M0-05 y M0-06 |
| Ancho de banda o invocaciones | Límites de Vercel Hobby | Presupuesto de bundle, caché y monitorización | ADR 0005 y ADR 0013 |
| Acoplamiento al proveedor | Cambio de condiciones de Vercel | APIs estándar, SQL portable y ruta a Cloudflare Workers/Pages o VPS | ADR 0005 |

## Plan de revisión

Se revisa si una limitación de RSC bloquea una función del MVP, si Vercel cambia
las condiciones de Hobby o si el coste deja de ser cero. Cualquier cambio de
framework exige un ADR nuevo que superseda este.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.1, §3.2 D1, §3.5 y §3.7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-001 y D-007
- Documentación oficial de Next.js App Router y React 19, consultada el
  12/11/2026.
