# Continuidad y recuperación

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 19/11/2026 con M0-07. El modo seguro, la comprobación de integridad y la copia
> pre-migración se implementaron en M0-04 (#64); las copias automáticas con
> retención y la restauración desde el diálogo de modo seguro, en M0-07 (#67).
> La interfaz de copias de Ajustes llega en M1 y el instalador, con #68.
> **Ámbito:** copias, restauración, modo seguro, recuperación ante corrupción,
> preservación en actualizaciones y desinstalación.
> **Decisiones:** ADR 0012 y ADR 0016. La estructura de datos está en
> [`persistencia.md`](persistencia.md).

## 1. Objetivo

World Craft debe poder recuperarse de un fallo sin perder los datos del
usuario. La continuidad es **local**: no depende de la nube, de una cuenta ni
de un servicio externo. Las copias viven en el equipo del usuario y, si este
quiere, en una unidad externa.

## 2. Escenarios y respuesta

| Escenario | Detección | Respuesta | Datos que se conservan |
|---|---|---|---|
| Cierre inesperado | Al arrancar | SQLite recupera el WAL; `integrity_check` | Todos |
| Corrupción de la base | `integrity_check` falla | Modo seguro sin escritura y restauración desde el diálogo (M0-07) | Copia elegida |
| Migración fallida | Error en transacción | Rollback del lote + copia pre-migración + modo seguro y restauración (M0-04/M0-07) | Base anterior |
| Actualización de la app | Primer arranque | Comprobación de esquema + copia previa + migración + copias automáticas (M0-07) | Todos |
| Restauración interrumpida | `.rollback*`, `.restore.tmp*` o `.restore.pending` | Modo seguro sin abrir ni crear la base; se puede repetir la restauración (M0-07) | Base anterior y copia pre-restauración |
| Copia corrupta | Verificación al inventariar u ofrecer | No se ofrece, no cuenta para la retención y no se borra sola (M0-07) | Copias válidas |
| Reinstalación | Instalador | No toca `userData` (previsto, #68) | Todos |
| Desinstalación | Desinstalador | Conserva `userData` y avisa (previsto, #68) | Todos |
| Borrado accidental de un mundo | Papelera | Restaurar desde papelera (previsto, M1) | Mundo y assets |
| Borrado definitivo | Confirmación | Copia recuperable previa (previsto) | Copia |
| Disco lleno | Error de escritura | Aviso, modo lectura, liberar espacio (previsto) | Hasta la última escritura |
| Archivo de asset perdido | Al abrir | El protocolo devuelve 404 y lo registra; aviso y placeholder en M1 (M0-06) | Metadatos |
| Base de versión superior | Al arrancar | Se niega a escribir y pide actualizar (M0-04) | Todos |

## 3. Copias

### 3.1 Automáticas

Completadas en M0-07 (#67), salvo lo que se marca como previsto; la copia
pre-migración funciona desde M0-04 y su poda llegó en M0-07.

- **Pre-migración:** antes de aplicar migraciones a una base existente. Se
  conservan las **5 copias válidas más recientes**; la poda cierra la deuda del
  [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md).
- **Diaria:** en el primer arranque del día local. Retención: **7**.
- **Semanal:** en la primera copia de la semana ISO local. Retención: **4**.
- **Mensual:** en la primera copia del mes local. Retención: **12**.
- **Pre-restauración:** antes de reemplazar la base, con una copia en bruto de
  la base actual y sus `-wal`, `-shm` y `-journal`. **No se poda** y no se ofrece
  para restaurar desde la app: es recuperación manual.
- **Antes de operaciones destructivas:** borrar un mundo, vaciar la papelera o
  eliminar todos los datos (previstas con sus issues).

Las copias automáticas se ejecutan **una vez por arranque**, después de que la
base quede en estado `ready` y antes de crear la ventana. **No se copia al
cerrar.** Cada motivo usa un bucket con la fecha local (día `YYYY-MM-DD`, semana
ISO `YYYY-Www` y mes `YYYY-MM`); si al bucket actual le falta una copia válida se
crea, aunque hayan pasado semanas desde el último arranque. Un fallo se registra
y nunca bloquea la apertura de la aplicación.

Retención: 7 diarias, 4 semanales, 12 mensuales y 5 pre-migración. Las copias
**pre-restauración** y las manuales no se podan automáticamente. Las copias
corruptas no cuentan, no se ofrecen y no se borran solas. Nunca se elimina la
copia válida más reciente ni la última de un motivo, y cada candidata se
reverifica antes de borrarla.

Las copias contienen **solo la base SQLite y su manifiesto**: los assets no se
incluyen ni se sustituyen al restaurar.

### 3.2 Manuales

El usuario podrá crear una copia completa (base + assets) desde Ajustes → Datos
(sección Copias). Podrá elegir destino, incluida una unidad externa o una carpeta
de red de confianza. La app no sube la copia a Internet. Sigue **prevista para
M1**: la interfaz de copias no existe en M0.

### 3.3 Verificación

Las copias nuevas de la base (automáticas, pre-migración y pre-restauración)
usan un `manifest.json` **v2**:

```json
{
  "formatVersion": 2,
  "reason": "daily",
  "createdAt": "2026-11-19T10:00:00.000Z",
  "databaseFile": "world-craft.sqlite",
  "schemaVersion": 2,
  "sizeBytes": 4096,
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "integrity": "ok",
  "assetsIncluded": false
}
```

El lector acepta también los manifiestos **v1** creados en M0-04 (solo
pre-migración) y los normaliza como íntegros y sin assets. Los campos de v2
están en [`persistencia.md`](persistencia.md), sección 6.2.

Antes de dar una copia por válida, la app comprueba el manifiesto (Zod estricto),
el tamaño, el SHA-256, la integridad declarada, `PRAGMA integrity_check` en solo
lectura y `PRAGMA user_version` frente a la versión del manifiesto y a la máxima
que entiende la versión instalada. Una copia corrupta, con manifiesto inválido o
de una versión futura **no se ofrece**, no cuenta para la retención y no se
borra automáticamente. Si la comprobación de la copia pre-migración falla, no se
migra y la app entra en modo seguro.

## 4. Restauración

**Implementada en M0-07 (#67).** En M0 se ofrece desde el **diálogo nativo de
modo seguro**, porque la pantalla Ajustes → Datos llega en M1. El flujo es:

1. El aviso de modo seguro ofrece «Restaurar copia.». El usuario elige la copia
   válida más reciente o una carpeta dentro de `backups/`.
2. La app verifica la copia completa antes de ofrecerla y rechaza una copia
   corrupta, con manifiesto inválido, de versión futura o `pre-restore`.
3. Confirmación explícita con fecha y versión de esquema: «Se guardará una copia
   recuperable de los datos actuales antes de reemplazarlos. Los assets no se
   sustituyen. La aplicación se reiniciará al terminar.» La opción
   predeterminada es Cancelar.
4. Se adquiere `data/.restore.lock` y se escribe `data/.restore.pending`; después
   se crea `backups/pre-restore/<timestamp>/` con la base actual y sus
   `-wal`/`-shm`/`-journal` en bruto, sin abrir SQLite.
5. La copia elegida se copia a `.restore.tmp`, se reverifica y se sustituye la
   base con un renombrado atómico, guardando la anterior en `.rollback*`.
6. Si algo falla, se devuelve la base anterior a su sitio y se vuelve al aviso de
   modo seguro; si el rollback también falla, no se borra nada y el siguiente
   arranque detecta los restos.
7. Si la restauración termina, la app se **relanza** y aplica las migraciones
   pendientes con su copia pre-migración.

La restauración **nunca se ejecuta en segundo plano** ni sin confirmación. No
hay una UI de copias en M0; elegir carpeta, confirmar y reintentar forma parte
del diálogo nativo. Tampoco hay una acción para restaurar con la base sana: el
diálogo solo aparece si el arranque entra en modo seguro. Esa acción llegará con
Ajustes → Datos en M1. Las copias pre-restauración no se ofrecen para restaurar
desde la app: la recuperación es manual y está descrita en
[`persistencia.md`](persistencia.md), sección 7.4.

Los assets existentes quedan intactos porque la copia solo contiene la base; las
referencias huérfanas se gestionarán en M1.

## 5. Modo seguro

Implementado en M0-04 y ampliado en M0-07. La app arranca en modo seguro cuando:

- `PRAGMA integrity_check` falla.
- Una migración no puede aplicarse o el lote no se puede confirmar.
- La versión de esquema es superior a la que entiende la app.
- Una migración aplicada cambió (checksum distinto).
- No se puede crear o verificar la copia previa.
- La carpeta de datos o la base no se pueden abrir.
- Se detectan restos de una restauración interrumpida (`.rollback*`,
  `.restore.tmp*` o `.restore.pending`).

En modo seguro:

- No se conserva ninguna conexión de escritura: no se escribe en la base ni en
  los assets.
- Se muestra un diálogo nativo con el código estable y una explicación sin SQL
  ni rutas.
- Se puede **restaurar una copia** (la más reciente o una carpeta de
  `backups/`), con verificación previa y confirmación explícita.
- Se puede **abrir la carpeta de copias** (o `userData` si aún no existe).
- Se puede **continuar en modo seguro** (sin escritura) o **salir**.
- El arranque y la restauración quedan registrados en `logs/startup.log` (JSONL,
  rotación a 256 KiB, sin SQL, filas, rutas ni contenido).
- No hay exportación ni interfaz de Ajustes: llegan en M1.

Los códigos nuevos de restauración son `DB_RESTORE_INVALID` (la copia no
verifica), `DB_RESTORE_FAILED` (fallo del reemplazo con rollback correcto),
`DB_RESTORE_INTERRUPTED` (restos de una restauración anterior) y
`DB_RESTORE_ROLLBACK_FAILED` (no se pudo devolver la base anterior).

### 5.1 Restauración interrumpida

Si el proceso muere a mitad del reemplazo, el arranque siguiente **no abre ni
crea una base vacía**: detecta los restos y entra en modo seguro. Una nueva
restauración preserva los restos en `backups/pre-restore/<timestamp>-rollback/`
o `…-restore-tmp/` antes de reutilizar los nombres. Si la copia pre-restauración
existe, también se puede recuperar a mano con la app cerrada. La garantía de
durabilidad cubre el cierre del proceso, **no un corte de energía** en el
instante exacto del reemplazo.

### 5.2 Riesgo de instancia única

No hay `app.requestSingleInstanceLock`. Dos instancias podrían inspeccionar,
migrar o restaurar a la vez y una acabar en modo seguro, con copias duplicadas.
SQLite serializa las escrituras y la transacción revierte, así que no hay
corrupción ni pérdida de datos; el lock de restauración reduce el solapamiento,
pero no es una exclusión mutua estricta entre procesos. Un lock obsoleto o
ilegible puede requerir cerrar la app y borrar `data/.restore.lock` a mano. El
bloqueo de instancia debe cerrarse antes de M1 y preferiblemente antes de #68;
queda registrado como riesgo de ciclo de vida.

## 6. Papelera y borrados

- Borrar una entidad, mapa, manuscrito o escena la mueve a papelera
  (`deleted_at`).
- Restaurar la devuelve a su sitio; si su padre ya no existe, se ofrece
  reubicarla.
- Vaciar la papelera exige confirmación, crea una copia y purga los registros y
  assets no referenciados.
- Borrar un mundo mueve su carpeta de assets a cuarentena y conserva una copia
  de la base; la purga definitiva es una acción separada.

## 7. Actualizaciones y desinstalación

### 7.1 Actualización

1. `electron-updater` descargará la nueva versión en segundo plano (previsto,
   M5).
2. El usuario decidirá cuándo reiniciar.
3. Al arrancar, la app compara la versión de esquema (implementado, M0-04).
4. Si hay migraciones y la base ya existía, crea la copia y las aplica en una
   transacción (implementado, M0-04).
5. Si la base queda lista, crea las copias automáticas del periodo en curso
   (implementado, M0-07).
6. Si algo falla, la transacción revierte y la app arranca en modo seguro; desde
   el propio aviso se puede restaurar una copia (implementado, M0-07).
7. Los assets no se tocan y las copias existentes se conservan; solo se añaden
   las del periodo en curso.

La actualización se podrá desactivar en Ajustes. Nunca se instalará sin
consentimiento.

### 7.2 Reinstalación

El instalador detectará una instalación previa, actualizará los binarios y
conservará `userData`. Si el usuario elige otra carpeta de instalación, los
datos siguen en la misma ruta de `userData`. Previsto para #68.

### 7.3 Desinstalación

El desinstalador eliminará binarios y accesos directos. **No borrará**
`%APPDATA%\World Craft`. Al terminar, mostrará la ruta de los datos y recordará
que puede eliminarlos manualmente si lo desea. Previsto para #68.

## 8. Pruebas de continuidad

| Prueba | Cuándo | Evidencia |
|---|---|---|
| Instalar → usar → actualizar | Cada release | Datos y assets intactos |
| Instalar → usar → desinstalar | Cada release | `userData` intacto |
| Migración con datos | Cada migración | Copia + preservación |
| Migración fallida | Cada migración | Rollback, copia y modo seguro (pruebas de integración) |
| Base ajena o versión superior | Cada arranque | Rechazo sin escritura (pruebas de integración) |
| Corrupción simulada | Cada cambio de persistencia | Modo seguro sin escritura (prueba de integración) |
| Copia automática y manifiesto v2 | M0-07 | Creación verificable, lectura de v1 y rechazo de bytes alterados (integración) |
| Rotación y retención | M0-07 | 7/4/12/5, corruptas conservadas y pre-restore sin podar (unitaria e integración) |
| Restauración desde modo seguro | M0-07 | Datos restaurados, assets intactos, rollback y relanzamiento (integración) |
| Restauración interrumpida | M0-07 | Marcador, lock, restos preservados y arranque sin base vacía (integración) |
| Disco lleno | Hito M5 | Aviso y modo lectura |
| Corte de energía | Hito M5 | WAL recupera la base |

Las pruebas se ejecutan en una carpeta temporal; nunca sobre los datos reales
del desarrollador. Las de integración usan `os.tmpdir()`.

## 9. Diagnóstico y soporte

- En M0, el arranque escribe `logs/startup.log` en JSONL: base nueva,
  migraciones aplicadas, versión resultante, copia creada, programación de
  copias (`backup.schedule`), restauración (`backup.restore`) y código de modo
  seguro. No incluye SQL, filas, rutas ni contenido.
- Ajustes → Ayuda → «Exportar diagnóstico» (previsto) generará un ZIP con
  versión, sistema, estado de la base, configuración no sensible y últimas
  líneas de log.
- El usuario revisará el ZIP antes de compartirlo.
- No se envía nada automáticamente.
- Los informes de error usan códigos estables y no incluyen contenido del
  usuario.

## 10. Documentos relacionados

- [Persistencia](persistencia.md)
- [Migraciones](base-de-datos/migraciones.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [Manual de usuario](manual-de-usuario.md)
- [ADR 0003](adr/0003-nsis-installer-electron-updater-data-preservation.md)
- [ADR 0012](adr/0012-backup-restore-recovery.md)
- [ADR 0016](adr/0016-sqlite-migrations-safe-mode.md)
