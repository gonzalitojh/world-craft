# ADR 0012 — Copias, restauración y recuperación

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-031
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0009 y ADR 0013 de la etapa web
- **Relacionados:** ADR 0002, ADR 0003, ADR 0005, ADR 0016

## Contexto

Los datos viven en un único equipo y el usuario no tiene un servicio en la nube
que los respalde. Un fallo de disco, una migración mal aplicada o un borrado
accidental pueden destruir años de trabajo. La aplicación debe ofrecer copias
verificables y una restauración comprensible, sin depender de herramientas
externas.

## Decisión

1. **Copias automáticas** diarias, semanales y mensuales con rotación (7/4/12).
2. **Copia pre-migración** antes de aplicar cualquier migración.
3. **Copia pre-restauración** antes de reemplazar la base.
4. **Copia previa** a operaciones destructivas (borrar mundo, vaciar papelera,
   eliminar todos los datos).
5. **Manifiesto** con versión, fecha, tamaño, SHA-256 e indicador de assets.
6. **Verificación** con `PRAGMA integrity_check` antes de ofrecer restaurar.
7. **Restauración guiada** con confirmación, copia de la base actual y
   aplicación de migraciones pendientes.
8. **Modo seguro** si la integridad falla o una migración no se puede aplicar.
9. **Exportación de mundo** en ZIP (JSON + assets) como copia de usuario.
10. **Desinstalación** que conserva `userData` y muestra su ruta.

> **Precisión de implementación (M0-04, #64, 18/11/2026).** La copia
> pre-migración se crea en una base **existente** antes de aplicar migraciones;
> una base nueva no necesita copia porque no hay datos que preservar. La copia
> usa la API online de SQLite, incluye manifiesto con SHA-256 e integridad y se
> verifica antes de migrar. El modo seguro ya está implementado; la restauración
> guiada, la retención y la interfaz de copias llegan con M0-07. El detalle está
> en el [ADR 0016](0016-sqlite-migrations-safe-mode.md).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Copia solo manual | El usuario olvida hacerla; no protege de un fallo. |
| Copia en la nube | Requiere cuenta, red y confianza; contradice la privacidad local. |
| Copia solo de SQLite | Pierde assets y dificulta restaurar un mundo completo. |
| Confiar en el WAL | Protege de un cierre, no de corrupción o borrado. |
| Restauración automática sin confirmación | Puede empeorar el estado y sorprender al usuario. |

## Consecuencias

### Positivas

- Siempre hay una copia reciente y verificable.
- La restauración es comprensible y reversible.
- El usuario puede llevarse sus datos a otro equipo.
- La desinstalación no destruye la biblioteca.

### Negativas y riesgos

- Las copias ocupan espacio en disco.
- La restauración requiere cerrar la app y confirmar.
- El usuario puede borrar las copias a mano desde el explorador.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Ajustes → Copias; restauración con diálogo y progreso. |
| Temas (Claro/Oscuro) | Avisos y estados con tokens. |
| Accesibilidad | Confirmaciones claras y anuncios `aria-live`. |
| Seguridad y privacidad | Copias locales; sin subida automática. |
| Datos y preservación | Núcleo de la decisión. |
| Coste | 0 €/mes; disco del usuario. |
| Portabilidad de datos | ZIP/JSON y copia del archivo SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Disco lleno | Espacio del usuario | Rotación, aviso y límite configurable | M5 |
| Copia corrupta | Fallo de disco | Verificación y varias generaciones | M5 |
| Usuario borra copias | Acción manual | Aviso y copia externa opcional | Manual |

## Plan de revisión

Se revisa si se añade cifrado de copias, copia incremental o una ubicación
externa automática. Cualquier cambio de formato exige versión de manifiesto y
prueba de restauración.

## Referencias

- [`docs/continuidad.md`](../continuidad.md)
- [`docs/persistencia.md`](../persistencia.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D12
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-031
- Documentación de backup de SQLite consultada el 18/11/2026.
