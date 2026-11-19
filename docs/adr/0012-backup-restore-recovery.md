# ADR 0012 — Copias, restauración y recuperación

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-19
- **Issue:** pivote a escritorio (catálogo nuevo); implementación M0-07 en #67
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
>
> **Precisión de implementación (M0-07, #67, 19/11/2026).** Se implementan las
> copias automáticas, la retención, la verificación y la restauración desde el
> diálogo de modo seguro. La interfaz de Ajustes sigue prevista para M1.
>
> - **Manifiesto v2** compatible con la lectura de v1: `formatVersion`, `reason`
>   (`daily`, `weekly`, `monthly`, `pre-migration`, `pre-restore`), `createdAt`,
>   `databaseFile`, `schemaVersion`, `sizeBytes`, `sha256`, `integrity` y
>   `assetsIncluded: false`. La copia contiene **solo SQLite y el manifiesto**;
>   los assets no se incluyen ni se sustituyen al restaurar.
> - **Programación al arrancar:** una pasada tras `ready` y antes de crear la
>   ventana, con buckets de fecha local (día `YYYY-MM-DD`, semana ISO `YYYY-Www`
>   y mes `YYYY-MM`). Se crea el bucket actual que falte aunque hayan pasado
>   semanas; no se copia al cerrar; un fallo se registra y nunca bloquea el
>   arranque.
> - **Retención:** 7 diarias, 4 semanales, 12 mensuales y **5 pre-migración**
>   (cierra la deuda del ADR 0016). `pre-restore` no se poda. Las copias corruptas
>   no cuentan, no se ofrecen y no se borran; nunca se elimina la copia válida más
>   reciente ni la última de un motivo, y cada candidata se reverifica antes de
>   borrarse.
> - **Verificación:** manifiesto Zod estricto, tamaño, SHA-256,
>   `PRAGMA integrity_check` y `PRAGMA user_version`, con rechazo de copias de
>   versión futura antes de abrirlas.
> - **Restauración:** en M0 se ofrece desde el diálogo nativo de modo seguro
>   (Ajustes → Datos llega en M1), con la copia válida más reciente o una carpeta
>   dentro de `backups/`; confirmación con fecha y versión; copia
>   pre-restauración **en bruto** de la base actual y sus WAL/SHM/journal; lock
>   `.restore.lock`, marcador durable `.restore.pending`, reemplazo con
>   `.restore.tmp` y `.rollback*`, y relanzamiento. Si algo falla se devuelve la
>   base anterior; si el rollback falla se conserva todo y el arranque entra en
>   modo seguro. Nunca se restaura en segundo plano.
> - **Pre-restauración manual:** las copias `pre-restore` no se ofrecen desde la
>   app y no se podan; su recuperación es manual con la aplicación cerrada.
> - **Assets intactos:** al restaurar solo la base, los assets existentes no se
>   sustituyen; las referencias huérfanas se gestionan en M1.
> - **Residuales documentados:** sin `requestSingleInstanceLock` el lock no es
>   una exclusión mutua estricta; un lock obsoleto o ilegible y la reutilización
>   de PID pueden requerir borrar `data/.restore.lock` a mano; una base de 0
>   bytes se considera nueva; una base válida con restos `.rollback*` o con el
>   marcador obliga a modo seguro; la limpieza fallida de `.rollback*` puede
>   repetir el modo seguro; la rotación se difiere si no se crea copia ni hay
>   pre-migración; un arranque con migraciones puede ejecutar hasta tres
>   `integrity_check` (base viva antes de migrar, copia pre-migración y base viva
>   después); el inventario y la rotación listan carpetas sin `realpath` ni
>   contención, a endurecer antes de M1/#68; y la durabilidad del marcador y de la
>   copia protege frente a un cierre del proceso, no frente a un corte de
>   energía. El detalle está en [`docs/persistencia.md`](../persistencia.md) y en
>   el [ADR 0016](0016-sqlite-migrations-safe-mode.md).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Copia solo manual | El usuario olvida hacerla; no protege de un fallo. |
| Copia en la nube | Requiere cuenta, red y confianza; contradice la privacidad local. |
| Copia solo de SQLite | Pierde assets y dificulta restaurar un mundo completo. Se descartó para la copia completa y la exportación; las copias automáticas de M0-07 respaldan solo la base porque los assets quedan intactos en disco. |
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
| Ventana y escritorio | Ajustes → Datos (sección Copias); restauración con diálogo y progreso. |
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

- Issue de implementación: #67 — Copias de seguridad, restauración y modo seguro.
- [`docs/continuidad.md`](../continuidad.md)
- [`docs/persistencia.md`](../persistencia.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D12
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-031
- Documentación de backup de SQLite consultada el 18/11/2026.
