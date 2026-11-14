# ADR 0005 — Vercel Hobby y subdominio de Vercel

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-006
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0013

## Contexto

La aplicación es Next.js y necesita despliegues de vista previa por PR, HTTPS,
funciones serverless y un dominio accesible sin coste. El uso es personal y no
comercial, lo que encaja con un plan gratuito. También hay que decidir si el MVP
usa dominio propio.

## Decisión

1. **Hosting:** Vercel Hobby para producción y previews por PR.
2. **Dominio:** subdominio gratuito `*.vercel.app` durante el MVP. Un dominio
   propio (10–15 €/año) queda fuera del MVP y requeriría aprobación explícita y
   un ADR nuevo por romper el objetivo de coste cero.
3. **Límites asumidos:** 100 despliegues/día, 45 min de build, funciones de
   hasta 300 s, 2 GB / 1 vCPU y 100 cron jobs.
4. **Operación:** agrupar despliegues, vigilar banda e invocaciones y evitar
   procesos largos en funciones.
5. **Ruta de salida:** Cloudflare Workers/Pages con OpenNext o un VPS si cambian
   las condiciones o se necesita más control.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Cloudflare Pages/Workers | Buena opción de coste, pero menor soporte nativo de Next.js y más fricción con RSC. |
| Netlify Free | Menos integración con Next.js y límites de funciones menos holgados para este uso. |
| Render Free | Arranque en frío y menos despliegues de preview; peor experiencia para el flujo local-first. |
| VPS propio | Coste mensual y mantenimiento; contradice el objetivo de 0 €/mes y la simplicidad operativa. |

## Consecuencias

### Positivas

- La vía con menos fricción para Next.js: previews por PR y despliegue continuo.
- Dominio gratuito y HTTPS sin configuración.
- Los límites son suficientes para un uso personal no comercial.
- Existe una ruta de salida documentada.

### Negativas y riesgos

- Dependencia de las condiciones de Vercel Hobby.
- 100 despliegues/día pueden agotarse con muchas PRs pequeñas.
- El uso comercial requeriría un plan de pago.
- Un dominio propio no entra en el MVP.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Sin impacto directo; el despliegue sirve las mismas pantallas. |
| Temas (Claro/Oscuro) | Sin impacto directo. |
| Accesibilidad | Sin impacto directo; Lighthouse CI se ejecuta contra el despliegue. |
| Seguridad y privacidad | HTTPS, variables de entorno del servidor y previews aisladas. |
| Coste | 0 €/mes en Hobby; el dominio propio queda fuera del MVP. |
| Portabilidad de datos | Alta: el código y la base son portables; el hosting es reemplazable. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Despliegues | 100/día | Agrupar cambios y evitar previews innecesarias | M0-05 (#6) |
| Build | 45 min | Build incremental y revisión de dependencias | M0-06 (#7) |
| Funciones | 300 s y 2 GB / 1 vCPU | Exportaciones acotadas, trabajos en cliente cuando sea posible | M3-03 (#23) |
| Banda e invocaciones | Límites de Hobby | Caché, imágenes optimizadas y monitorización | ADR 0013; M5-07 (#34) |
| Uso no comercial | Condiciones de Hobby | Proyecto personal; si cambia, evaluar plan o salida | ADR 0013 |

## Plan de revisión

Se revisa si Vercel cambia las condiciones de Hobby, si se agota el límite de
despliegues de forma recurrente o si se decide usar un dominio propio. Cualquier
cambio de hosting o de dominio exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D7, §3.7 y §7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-006
- Documentación oficial de Vercel Hobby, consultada el 12/11/2026.
