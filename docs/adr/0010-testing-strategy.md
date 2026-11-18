# ADR 0010 — Estrategia de pruebas

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-030
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0009 de la etapa web
- **Relacionados:** ADR 0002, ADR 0012, ADR 0013

## Contexto

La aplicación maneja datos locales que el usuario no puede perder. Las pruebas
deben cubrir migraciones, copias, importación y seguridad, no solo componentes.
El entorno es Windows, Electron y SQLite; la CI no tiene credenciales ni datos
reales.

## Decisión

1. **Vitest** para dominio, validaciones, utilidades, i18n, tokens y lógica de
   exportación.
2. **Testing Library** para componentes del renderer.
3. **SQLite temporal** para integración de esquema, migraciones, consultas,
   FTS5, backups e importación.
4. **Playwright Electron** para E2E de arranque, ventana, flujos críticos,
   temas y accesibilidad.
5. **axe-core** para accesibilidad.
6. **gitleaks** y `pnpm audit` en CI.
7. **Pruebas de preservación** en cada migración y en el instalador.
8. La cobertura se exige alta en migraciones, backups, importación e IPC; no se
   persigue un porcentaje global.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Solo tests unitarios | No detectan migraciones ni preservación de datos. |
| Solo E2E | Lentos, frágiles y no localizan el fallo. |
| Mocks de SQLite | No prueban el esquema real ni FTS5. |
| Jest | Vitest comparte configuración con Vite y es más rápido. |
| Cypress | Playwright Electron encaja mejor con la ventana y el proceso main. |

## Consecuencias

### Positivas

- Los fallos de datos se detectan antes de publicar.
- La CI es reproducible sin credenciales.
- Los E2E cubren la ventana real.
- La accesibilidad se prueba con axe.

### Negativas y riesgos

- Los E2E de Electron son más lentos y sensibles al entorno.
- Las pruebas de instalador requieren una máquina o un entorno temporal.
- Mantener fixtures y bases de prueba lleva tiempo.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | E2E con ventana real a varios tamaños. |
| Temas (Claro/Oscuro) | Pruebas de tokens y capturas en ambos temas. |
| Accesibilidad | axe, teclado y foco en las pantallas principales. |
| Seguridad y privacidad | Pruebas de IPC, rutas y secretos. |
| Datos y preservación | Pruebas de migración, copia y restauración. |
| Coste | 0 €/mes; todo corre en local y GitHub Actions. |
| Portabilidad de datos | Pruebas de exportación/importación. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Minutos de Actions | Repo público gratuito | Jobs acotados, caché y E2E no bloqueante | CI |
| Entorno Windows en CI | Runner estándar | Un solo job E2E, sin matriz | CI |
| Pruebas frágiles | Mantenimiento | Fixtures estables y pocos E2E | Cada issue |

## Plan de revisión

Se revisa si los E2E de Electron dejan de ser estables o si el tiempo de CI
crece demasiado. La estrategia se ajusta en M5 con datos reales de duración.

## Referencias

- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D11
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-030
- Documentación de Vitest, Testing Library y Playwright consultada el 18/11/2026.
