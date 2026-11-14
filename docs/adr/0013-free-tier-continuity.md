# ADR 0013 — Continuidad de free tiers: R2, keep-alive y backups

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-001
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0005, ADR 0009

## Contexto

El objetivo es **0 €/mes**. Supabase Free pausa el proyecto tras una semana de
baja actividad, no ofrece backups automáticos y limita la base a 500 MB. R2,
Vercel y GitHub también tienen cuotas. Sin una estrategia de continuidad, el
coste cero se convierte en riesgo de pérdida de datos o en una migración de
emergencia.

Este ADR decide cómo se sostienen los servicios gratuitos. Los mecanismos de
pruebas, PWA y formato de backup se deciden en el ADR 0009.

## Decisión

1. **Coste objetivo:** 0 €/mes. Cualquier excepción requiere aprobación explícita
   del usuario y un ADR que documente coste, límites, alternativas y salida.
2. **Almacenamiento:** todos los assets en Cloudflare R2 Free (ADR 0004), no en
   Supabase Storage.
3. **Keep-alive:** endpoint ligero `/api/health` que hace una consulta real a
   Supabase; monitorizado con UptimeRobot Free cada 30–60 minutos o un workflow
   equivalente.
4. **Backups:** `pg_dump` semanal cifrado con GitHub Actions, artefacto de 90
   días y copia opcional en R2. La exportación de mundo (JSON + assets) es la
   copia principal del usuario.
5. **Recuperación:** procedimiento de reactivación documentado; los proyectos
   pausados conservan los datos y Supabase ofrece una ventana de restauración de
   un año. La restauración se prueba antes del lanzamiento.
6. **Revisión de cuotas:** revisión mensual de Supabase, R2, Vercel y GitHub;
   aviso al superar el 70 % de una cuota relevante.
7. **Ruta de migración:** si la pausa o los límites se vuelven un problema,
   migrar a **Neon Free + R2**. La capa de datos y el almacenamiento están
   abstraídos para facilitarlo.
8. **Proveedores:** repo público sin secretos para Actions ilimitado; Vercel
   Hobby para uso personal no comercial; dominio propio fuera del MVP.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Planes de pago | Rompen el objetivo de 0 €/mes y no son necesarios para uso personal. |
| Supabase Storage | Solo 1 GB; R2 ofrece 10 GB y egreso gratis. |
| Neon Free desde el inicio | Evita la pausa, pero exige montar Auth y RLS por separado; se mantiene como ruta. |
| Aceptar la pausa sin keep-alive | Riesgo alto de interrupción y de pérdida si se confía solo en el proveedor. |
| Autohospedaje | Coste mensual, mantenimiento y parches; contradice la simplicidad operativa. |
| Backups de pago | Innecesarios cuando `pg_dump` + GitHub Actions cubre el uso personal. |

## Consecuencias

### Positivas

- El coste se mantiene en 0 €/mes con una estrategia explícita.
- La pausa de Supabase se mitiga con actividad real y monitorización.
- Existe una copia independiente del proveedor y una restauración probada.
- La migración a Neon + R2 está preparada y no exige reescribir el dominio.

### Negativas y riesgos

- El keep-alive y los backups añaden operación y minutos de CI.
- El backup semanal deja una ventana de hasta siete días.
- Las cuotas gratuitas pueden cambiar sin aviso.
- La ruta de migración requiere trabajo aunque sea incremental.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Sin impacto directo. |
| Temas (Claro/Oscuro) | Sin impacto directo. |
| Accesibilidad | Sin impacto directo. |
| Seguridad y privacidad | Backups cifrados, secretos solo en servidor y repo público sin credenciales. |
| Coste | Es la decisión central: 0 €/mes y revisión mensual. |
| Portabilidad de datos | Exportación de mundo y `pg_dump` permiten migrar o restaurar. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Pausa de Supabase | Tras una semana de baja actividad | `/api/health` con consulta real y UptimeRobot cada 30–60 min | M0-11 (#41) |
| Pérdida de datos | Sin backups automáticos en Free | `pg_dump` semanal cifrado, artefactos de 90 días y exportación | M5-06 (#33) |
| Base de datos | 500 MB | Assets en R2, purga y revisión mensual | ADR 0002 |
| R2 | 10 GB, 1M Class A, 10M Class B | Compresión, ciclo de vida y revisión mensual | ADR 0004 |
| Vercel | 100 despliegues/día, 300 s, 2 GB / 1 vCPU | Agrupar despliegues y vigilar banda | ADR 0005 |
| GitHub Actions | 2.000 min/mes en privado | Repo público sin secretos y E2E acotado | ADR 0009 |
| Cambio de condiciones | Sin coste inmediato | Ruta a Neon + R2 y revisión trimestral | M5-07 (#34) |

## Plan de revisión

Se revisa mensualmente el uso de cuotas y en cada lanzamiento de fase. Si una
cuota supera el 70 %, se documenta y se decide entre optimizar o migrar. Un
cambio de proveedor o un gasto recurrente exige un ADR nuevo y aprobación del
usuario.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.7, §3.2 D14 y §6
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-001
- Documentación oficial de Supabase, Cloudflare R2, Vercel y UptimeRobot,
  consultada el 12/11/2026.
