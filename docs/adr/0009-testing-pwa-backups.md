# ADR 0009 — Testing, PWA y backups

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** —
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0004, ADR 0013

## Contexto

World Craft debe ser fiable sin equipo de QA dedicado: hay pérdida de datos,
permisos por mundo y funciones interactivas que fallan de formas difíciles de
detectar a mano. También debe funcionar en móvil, instalarse como PWA y ofrecer
copias de seguridad recuperables sin coste. Este ADR decide los mecanismos; el
ADR 0013 decide cómo se sostienen en free tiers.

## Decisión

### 9.1 Pruebas y calidad

- **Vitest** para dominio, utilidades y componentes.
- **Testing Library** para componentes.
- **Playwright** para E2E, responsive (360/768/1280) y capturas por tema.
- **axe-core** para accesibilidad.
- **MSW** para aislar la red en tests.
- **Lighthouse CI** con presupuestos de rendimiento.
- **gitleaks** y `pnpm audit` para secretos y dependencias.
- Tests de RLS con dos usuarios que verifican aislamiento y roles.

### 9.2 PWA y offline

- **Serwist** para service worker, manifest e instalación.
- **Dexie/IndexedDB** para borradores del editor, cambios pendientes y caché de
  fichas recientes.
- Sincronización **last-write-wins** con detección de conflicto por versión; no
  hay colaboración en tiempo real.
- En móvil, mapa y grafo se consultan en modo lectura; la edición completa se
  prioriza en escritorio.

### 9.3 Backups y recuperación

- **Copia principal:** exportación de un mundo completo (JSON + assets) desde la
  aplicación.
- **Copia de infraestructura:** `pg_dump` semanal cifrado con GitHub Actions,
  guardado como artefacto de 90 días y, opcionalmente, en R2.
- **Assets:** copia o reconstrucción desde la exportación del mundo.
- **Restauración:** procedimiento documentado y probado al menos una vez antes
  del lanzamiento.
- **Migraciones y seed:** versionados en el repositorio.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Jest | Vitest comparte configuración con Vite/Next y es más rápido en este stack. |
| Cypress | Playwright cubre E2E, responsive y capturas con mejor soporte multi-navegador y de dispositivos. |
| `next-pwa` | Serwist es su sucesor mantenido y encaja con Next.js App Router. |
| `localStorage` | Límite pequeño, síncrono y sin consultas; IndexedDB es necesario para borradores y caché. |
| Backups del proveedor | Supabase Free no ofrece backups automáticos. |

## Consecuencias

### Positivas

- La calidad se comprueba en cada puerta y no solo al final.
- Los borradores sobreviven a fallos de red y recargas.
- La exportación de mundo da al usuario una copia independiente del proveedor.
- La restauración se prueba antes de depender de ella.

### Negativas y riesgos

- Mantener tests E2E y capturas por tema consume tiempo y minutos de CI.
- IndexedDB puede llenarse o quedar obsoleto; requiere limpieza.
- La sincronización last-write-wins puede perder un cambio si hay conflicto.
- `pg_dump` semanal no cubre cambios del último día.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Playwright valida 360/768/1280 y capturas por tema. |
| Temas (Claro/Oscuro) | Capturas y contraste se comprueban en ambos modos. |
| Accesibilidad | axe-core y pruebas de teclado forman parte de la puerta de QA. |
| Seguridad y privacidad | Tests de RLS, gitleaks y backups cifrados. |
| Coste | 0 €/mes dentro de los límites de GitHub Actions y Sentry Free opcional. |
| Portabilidad de datos | La exportación JSON + assets es la copia principal y es reimportable. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Minutos de GitHub Actions | Ilimitados en repo público; 2.000/mes en privado | Mantener el repo público sin secretos y acotar E2E | ADR 0013 |
| Retención de artefactos | 90 días | Copia adicional en R2 y exportación del usuario | ADR 0013 |
| Cuota de IndexedDB | Límite del navegador | Avisos, limpieza y no almacenar assets pesados | M5-04 (#31) |
| Errores monitorizados | 5.000/mes en Sentry Free | Muestreo y solo errores accionables | M5-07 (#34) |
| Pérdida entre backups | Ventana de una semana | Autosave, snapshots y exportación manual | M5-06 (#33) |

## Plan de revisión

Se revisa si los minutos de CI se agotan, si la restauración falla o si se
añade colaboración en tiempo real. Un cambio de estrategia de backups o de
sincronización exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D12–D14, §3.7 y §4.7
- Documentación oficial de Vitest, Playwright, Serwist, Dexie y GitHub Actions,
  consultada el 12/11/2026.
