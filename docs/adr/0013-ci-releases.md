# ADR 0013 — CI, releases y distribución

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-032
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0016 de la etapa web
- **Relacionados:** ADR 0003, ADR 0010, ADR 0015

## Contexto

El repositorio es público y usa GitHub Free. La aplicación se distribuye como
instalador NSIS y se actualiza desde GitHub Releases. La CI debe verificar cada
PR sin credenciales ni datos de usuario y sin consumir minutos de pago.

## Decisión

1. **CI en GitHub Actions** en cada PR y push a `dev`/`main`.
2. Jobs **bloqueantes actuales**: `lint` (con `format:check`), `typecheck` y
   `test`. El job `build` se añade con el scaffold de Electron y entonces pasa
   a bloqueante.
3. Jobs **no bloqueantes**: `gitleaks`, `audit` y `e2e` (Playwright Electron).
4. Permisos `contents: read`, `concurrency` para cancelar ejecuciones antiguas y
   una acción compuesta de setup.
5. **Dependabot** semanal para npm y GitHub Actions, agrupado por minor y patch,
   contra `dev`.
6. **Releases** con `electron-builder` y GitHub Releases: instalador NSIS,
   `latest.yml` y checksums.
7. **Canales:** `latest` estable y pre-releases para beta.
8. Sin secretos de servicios web; solo el `GITHUB_TOKEN` de la release.
9. La release se crea desde `main` cuando el usuario promueve `dev`.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Vercel/Netlify | No aplica a una app de escritorio. |
| Azure Pipelines/CircleCI | Fuera de GitHub y con planes gratuitos más limitados. |
| Release manual | Propensa a errores y sin trazabilidad. |
| Auto-update con servidor propio | Coste y mantenimiento; GitHub Releases es gratuito. |
| Publicar en Microsoft Store | Requiere cuenta y firma; fuera del MVP. |

## Consecuencias

### Positivas

- Cada PR se verifica sin credenciales.
- La release es reproducible y trazable.
- Coste 0 €/mes con repo público.
- Dependabot mantiene el tooling al día.

### Negativas y riesgos

- Los minutos de Actions son limitados (aunque gratuitos en repo público).
- Los E2E de Electron en Windows son más lentos.
- GitHub Releases tiene límites de tamaño y retención.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Build y E2E en Windows. |
| Temas (Claro/Oscuro) | Pruebas de tokens; capturas opcionales. |
| Accesibilidad | axe en E2E y pruebas de componentes. |
| Seguridad y privacidad | Sin secretos; gitleaks y auditoría. |
| Datos y preservación | Pruebas de migración y backup en CI. |
| Coste | 0 €/mes. |
| Portabilidad de datos | No aplica a la CI. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Minutos de Actions | Gratis en repo público | Jobs acotados y caché | CI |
| Tamaño de release | Límite de GitHub | Un instalador por versión; sin binarios duplicados | M5 |
| Dependencias vulnerables | Auditoría | Dependabot y `pnpm audit` | Cada PR |

## Plan de revisión

Se revisa si GitHub cambia las condiciones de Actions o Releases, si el tiempo
de CI crece o si se adopta firma de código. La release de M5 es la primera
prueba completa.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.8 y §3.9
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-032
- Documentación de GitHub Actions y electron-builder consultada el 18/11/2026.
