# Continuidad y recuperación

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio); actualizado el
> 20/11/2026 con M0-08 y M1-01 a M1-03. El modo seguro, la comprobación de
> integridad y la copia pre-migración se implementaron en M0-04 (#64); las copias
> automáticas con retención y la restauración desde el diálogo de modo seguro,
> en M0-07 (#67); el instalador por usuario, la actualización manual y la
> preservación en instalación, actualización y desinstalación, en M0-08 (#68); el
> borrado lógico de mundos con su actividad, en M1-01 (#72); los tipos de
> entidad con sus plantillas, en M1-02 (#73); y las fichas con autoguardado,
> imágenes, etiquetas y favoritos, en M1-03 (#74). La interfaz de copias de Ajustes, la
> papelera visible y la purga llegan en M1; la release pública con actualización
> real contra GitHub Releases, en M5.
> **Ámbito:** copias, restauración, modo seguro, recuperación ante corrupción,
> preservación en actualizaciones y desinstalación.
> **Decisiones:** ADR 0012, ADR 0016, ADR 0018, ADR 0019, ADR 0020 y ADR 0021.
> La
> estructura de datos está en [`persistencia.md`](persistencia.md).

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
| Actualización de la app | Comprobación manual + reinicio consentido | El instalador sustituye binarios; al arrancar, comprobación de esquema + copia previa + migración + copias automáticas (M0-07/M0-08) | Todos |
| Actualización cancelada o fallida | Estado del actualizador | Se queda la versión actual; no se instala nada y no se toca `userData` (M0-08) | Todos |
| Restauración interrumpida | `.rollback*`, `.restore.tmp*` o `.restore.pending` | Modo seguro sin abrir ni crear la base; se puede repetir la restauración (M0-07) | Base anterior y copia pre-restauración |
| Copia corrupta | Verificación al inventariar u ofrecer | No se ofrece, no cuenta para la retención y no se borra sola (M0-07) | Copias válidas |
| Reinstalación | Instalador | No toca `userData`; conserva base, assets y copias (M0-08) | Todos |
| Desinstalación | Desinstalador | Conserva `userData` y avisa en modo interactivo (M0-08) | Todos |
| Segunda instancia | Lock de instancia única | El proceso nuevo sale y la instancia existente enfoca su ventana (M0-08) | Todos |
| Sin conexión al actualizar | Comprobación manual | Error controlado; la app sigue funcionando con la versión instalada (M0-08) | Todos |
| Borrado accidental de un mundo | Borrado lógico con confirmación | La fila conserva `deleted_at` y desaparece de las vistas; la restauración visible llega con la papelera (M1-01, #72; M1-06, #77) | Mundo y assets |
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

### 5.2 Instancia única (resuelto en #68)

`app.requestSingleInstanceLock()` se adquiere **antes** de `app.whenReady()`, de
abrir la base, de registrar el IPC y de crear la ventana. Si otra instancia ya
tiene el lock, el proceso nuevo no inicializa nada y se cierra; la instancia
existente recibe `second-instance` y enfoca su ventana. El bloqueo está activo
también en desarrollo. Con esto se cierra el riesgo de que dos procesos
inspeccionen, migren o restauren a la vez. Queda como residual que un lock
obsoleto de restauración (`.restore.lock`) o un cierre abrupto pueden requerir
cerrar la app y borrar ese archivo a mano; no es un archivo con datos.

## 6. Papelera y borrados

- Borrar una entidad, mapa, manuscrito o escena la mueve a papelera
  (`deleted_at`).
- Restaurar la devuelve a su sitio; si su padre ya no existe, se ofrece
  reubicarla.
- Vaciar la papelera exige confirmación, crea una copia y purga los registros y
  assets no referenciados.
- Borrar un mundo mueve su carpeta de assets a cuarentena y conserva una copia
  de la base; la purga definitiva es una acción separada.

**Implementado en M1-01 (#72):** borrar un mundo es un borrado lógico con
`deleted_at`; deja de aparecer en Inicio, Mundos y la actividad, y la fila se
conserva. La pantalla de papelera, la restauración y la purga con copia llegan
con M1-06 (#77); hasta entonces, las copias de seguridad son la vía de
recuperación documentada. Archivar es reversible desde la propia lista y no
borra nada.

**Implementado en M1-02 (#73):** los tipos personalizados pertenecen al mundo y
se copian al duplicarlo. Borrar un tipo es un borrado lógico con `deleted_at`:
la fila se conserva, la clave queda reservada y la papelera visible llegará con
#77. El borrado lógico de un mundo no toca sus tipos; la purga definitiva los
eliminará en cascada con el mundo. Los 18 tipos del sistema no se borran ni se
editan: para ajustar una plantilla se duplica el tipo en el mundo. El formato de
transferencia solo incluye los tipos personalizados y se integra en la
exportación completa del mundo en #78.

**Implementado en M1-03 (#74):** las fichas se guardan en `entities` y usan
borrado lógico con `deleted_at`; sus etiquetas y su galería se conservan al
mover la ficha a la papelera y la restauración visible llega con #77. La imagen
principal y la galería referencian filas de `assets` del mismo mundo y nunca
copian archivos. El autoguardado envía una actualización completa tras 700 ms
sin cambios y también se puede forzar; al desmontar la vista se intenta un
último guardado. Un tipo con fichas vivas no se puede borrar, de modo que una
ficha nunca queda apuntando a una plantilla eliminada. La migración
`0004_entities` es aditiva, conserva mundos, tipos, actividad y assets, y su
prueba de preservación migra una base en `0003` con un tipo personalizado.

## 7. Actualizaciones y desinstalación

### 7.1 Actualización (implementada en M0-08)

La comprobación es **manual y opcional**; no hay auto-check al arrancar.

1. El usuario pulsa **Actualizaciones** en la barra superior y después **Buscar
   actualizaciones**. La app consulta GitHub Releases con un timeout de 30 s.
2. Si hay una versión nueva, el usuario decide si la descarga. La descarga se
   puede cancelar de verdad y nunca se instala sin consentimiento.
3. Cuando termina, el botón **Reiniciar e instalar** cierra la app, ejecuta el
   instalador y la vuelve a abrir. La instalación solo se acepta desde el estado
   `downloaded`.
4. Al arrancar, la app compara la versión de esquema (M0-04).
5. Si hay migraciones y la base ya existía, crea la copia y las aplica en una
   transacción (M0-04).
6. Si la base queda lista, crea las copias automáticas del periodo en curso
   (M0-07).
7. Si algo falla, la transacción revierte y la app arranca en modo seguro; desde
   el propio aviso se puede restaurar una copia (M0-07).
8. Los assets no se tocan y las copias existentes se conservan; solo se añaden
   las del periodo en curso.

El instalador por usuario sustituye los binarios en
`%LOCALAPPDATA%\Programs\World Craft` y **nunca toca** `%APPDATA%\World Craft`.
La actualización real contra una release pública de GitHub se probará en M5; en
M0-08 se probó el flujo de instalación y la actualización local de 0.1.0 a 0.1.1
con 194 archivos de `userData` intactos. El interruptor para desactivar la
comprobación llegará con Ajustes (M1); hoy no existe porque tampoco hay
comprobación automática.

### 7.2 Reinstalación (implementada en M0-08)

El instalador detecta una instalación previa, actualiza los binarios y conserva
`userData`. Si el usuario elige otra carpeta de instalación, los datos siguen en
la misma ruta de `userData`. La reinstalación se probó con el mismo artefacto y
con la actualización 0.1.0→0.1.1.

### 7.3 Desinstalación (implementada en M0-08)

El desinstalador elimina binarios y accesos directos del menú Inicio. **No borra**
`%APPDATA%\World Craft`. En modo interactivo muestra un aviso con la ruta de los
datos y recuerda que se pueden eliminar manualmente; en modo silencioso no
bloquea, pero tampoco borra nada. La desinstalación se probó con la app cerrada y
comprobando los hashes de `data`, `assets` y `backups`.

### 7.4 Logs, caché y archivos del actualizador

- `logs/updates.log` (JSONL, rotación a 256 KiB) registra solo eventos tipados:
  composición habilitada o deshabilitada con su motivo, comprobación, descarga e
  instalación con su resultado. **No incluye URLs, rutas, versiones ni
  contenido.**
- La caché de descargas de electron-updater vive fuera de `userData`, en la
  carpeta de caché de la aplicación en `%LOCALAPPDATA%`; no forma parte de las
  copias y se puede borrar con la app cerrada.
- electron-updater puede escribir `.updaterId` en `userData` para el canal de
  staging. No contiene datos del usuario y la cabecera que lo usaría se elimina
  antes de cualquier petición; con GitHub no se envía.
- El fallo de escritura de estos logs nunca interrumpe la comprobación ni el
  arranque.

## 8. Pruebas de continuidad

| Prueba | Cuándo | Evidencia |
|---|---|---|
| Instalar → usar → actualizar | Cada release | Datos y assets intactos; 0.1.0→0.1.1 con 194 archivos conservados (M0-08) |
| Instalar → usar → desinstalar | Cada release | `userData` intacto y aviso al desinstalar (M0-08) |
| Migración con datos | Cada migración | Copia + preservación |
| Migración fallida | Cada migración | Rollback, copia y modo seguro (pruebas de integración) |
| Tipos al duplicar y borrar un mundo | M1-02 | Copia transaccional, aislamiento y conservación tras el borrado lógico (integración) |
| Fichas, etiquetas y galería | M1-03 | CRUD, borrado lógico, aislamiento, referencias, filtros y preservación de la migración `0004` (integración) |
| Base ajena o versión superior | Cada arranque | Rechazo sin escritura (pruebas de integración) |
| Corrupción simulada | Cada cambio de persistencia | Modo seguro sin escritura (prueba de integración) |
| Copia automática y manifiesto v2 | M0-07 | Creación verificable, lectura de v1 y rechazo de bytes alterados (integración) |
| Rotación y retención | M0-07 | 7/4/12/5, corruptas conservadas y pre-restore sin podar (unitaria e integración) |
| Restauración desde modo seguro | M0-07 | Datos restaurados, assets intactos, rollback y relanzamiento (integración) |
| Restauración interrumpida | M0-07 | Marcador, lock, restos preservados y arranque sin base vacía (integración) |
| Preservación entre instalaciones | M0-08 | Integración con SQLite, assets y copias temporales; migración de fixture y reinstalación simulada |
| Instalación, actualización y desinstalación reales | M0-08 y cada release | `scripts/verify-install.ps1` con hashes de `data`, `assets` y `backups`; 194 archivos intactos |
| Actualizador sin auto-check | M0-08 | Comprobación manual, descarga consentida, cancelación real e instalación solo desde `downloaded` (unitarias) |
| Actualización real contra GitHub Releases | M5 | Primera release pública; pendiente |
| Instancia única | M0-08 | Segundo proceso sin inicializar y foco en la ventana existente (unitaria) |
| Disco lleno | Hito M5 | Aviso y modo lectura |
| Corte de energía | Hito M5 | WAL recupera la base |

Residuales aceptados: el instalador y `latest.yml` no tienen firma Authenticode
(ADR 0015); la cancelación de la comprobación no aborta el socket; el modo
interactivo del desinstalador no se prueba de forma automática; y la
actualización real contra GitHub Releases, la firma de manifiestos y la
publicación oficial quedan para M5.

Las pruebas se ejecutan en una carpeta temporal; nunca sobre los datos reales
del desarrollador. Las de integración usan `os.tmpdir()`.

## 9. Diagnóstico y soporte

- En M0, el arranque escribe `logs/startup.log` en JSONL: base nueva,
  migraciones aplicadas, versión resultante, copia creada, programación de
  copias (`backup.schedule`), restauración (`backup.restore`) y código de modo
  seguro. No incluye SQL, filas, rutas ni contenido.
- El actualizador escribe `logs/updates.log` (JSONL, rotación a 256 KiB) con
  eventos `update.composition`, `update.check`, `update.download`,
  `update.install` y `update.command`: solo resultados y códigos estables, sin
  URLs, rutas, versiones ni contenido. Un fallo al escribir no interrumpe la
  comprobación.
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
- [ADR 0018](adr/0018-nsis-packaging-and-update-service.md)
