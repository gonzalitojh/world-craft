# Continuidad y recuperación

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio). El modo seguro,
> la comprobación de integridad y la copia pre-migración están implementados en
> M0-04 (#64); la restauración guiada, las copias automáticas y su retención
> llegan con M0-07; el instalador, con #68.
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
| Corrupción de la base | `integrity_check` falla | Modo seguro sin escritura (M0-04); restauración guiada en M0-07 | Copia elegida |
| Migración fallida | Error en transacción | Rollback del lote + copia pre-migración + modo seguro (M0-04) | Base anterior |
| Actualización de la app | Primer arranque | Comprobación de esquema + copia previa + migración (M0-04) | Todos |
| Reinstalación | Instalador | No toca `userData` (previsto, #68) | Todos |
| Desinstalación | Desinstalador | Conserva `userData` y avisa (previsto, #68) | Todos |
| Borrado accidental de un mundo | Papelera | Restaurar desde papelera (previsto, M1) | Mundo y assets |
| Borrado definitivo | Confirmación | Copia recuperable previa (previsto) | Copia |
| Disco lleno | Error de escritura | Aviso, modo lectura, liberar espacio (previsto) | Hasta la última escritura |
| Archivo de asset perdido | Al abrir | El protocolo devuelve 404 y lo registra; aviso y placeholder en M1 (M0-06) | Metadatos |
| Base de versión superior | Al arrancar | Se niega a escribir y pide actualizar (M0-04) | Todos |

## 3. Copias

### 3.1 Automáticas

- **Pre-migración:** antes de aplicar migraciones a una base existente
  (implementada, M0-04).
- **Diaria:** al cerrar la app o en el primer arranque del día (prevista,
  M0-07).
- **Semanal:** se conserva la última diaria de la semana (prevista, M0-07).
- **Mensual:** se conserva la última semanal del mes (prevista, M0-07).
- **Pre-restauración:** antes de reemplazar la base (prevista, M0-07).
- **Antes de operaciones destructivas:** borrar un mundo, vaciar la papelera o
  eliminar todos los datos (previstas).

Retención prevista: 7 diarias, 4 semanales y 12 mensuales. Las copias
pre-migración, pre-restauración y manuales no se rotarán automáticamente. La
poda de copias pre-migración todavía no existe.

### 3.2 Manuales

El usuario podrá crear una copia completa (base + assets) desde Ajustes →
Copias. Podrá elegir destino, incluida una unidad externa o una carpeta de red
de confianza. La app no sube la copia a Internet. Previsto para M0-07.

### 3.3 Verificación

La copia pre-migración implementada incluye un `manifest.json` con:

```json
{
  "formatVersion": 1,
  "reason": "pre-migration",
  "createdAt": "2026-11-18T10:00:00.000Z",
  "databaseFile": "world-craft.sqlite",
  "schemaVersion": 1,
  "sizeBytes": 0,
  "sha256": "abc1234"
}
```

Antes de dar la copia por válida, la app comprueba el manifiesto, el tamaño y el
SHA-256, la abre en solo lectura y ejecuta `PRAGMA integrity_check`; además
contrasta `PRAGMA user_version` con la versión declarada. Si algo falla, no se
migra y la app entra en modo seguro. Las copias manuales y automáticas de M0-07
tendrán su propio manifiesto y verificación.

## 4. Restauración

**Prevista para M0-07.** Todavía no hay interfaz de copias ni restauración
guiada. El flujo previsto es:

1. Ajustes → Copias → elegir copia.
2. La app muestra fecha, versión de esquema y si incluye assets.
3. Confirmación explícita: «Se reemplazará la base actual. Se guardará una copia
   de seguridad antes de continuar.»
4. Se crea `backups/pre-restore/`.
5. Se cierra la conexión y se sustituye la base de forma atómica.
6. Se reabre, se comprueba integridad y se aplican migraciones pendientes.
7. Si algo falla, se restaura la base anterior y se muestra un error con código
   estable.
8. Se muestra un informe: versión restaurada, migraciones aplicadas, assets
   ausentes y referencias huérfanas.

La restauración nunca se ejecutará en segundo plano ni sin confirmación. En
M0-04, el modo seguro permite abrir la carpeta de copias; la copia pre-migración
ya está creada y verificada. Las pruebas de integración restauran una copia
manualmente con la app cerrada y comprueban que la migración vuelve a aplicarse
sin perder datos.

## 5. Modo seguro

Implementado en M0-04. La app arranca en modo seguro cuando:

- `PRAGMA integrity_check` falla.
- Una migración no puede aplicarse o el lote no se puede confirmar.
- La versión de esquema es superior a la que entiende la app.
- Una migración aplicada cambió (checksum distinto).
- No se puede crear o verificar la copia previa.
- La carpeta de datos o la base no se pueden abrir.

En modo seguro:

- No se conserva ninguna conexión de escritura: no se escribe en la base ni en
  los assets.
- Se muestra un diálogo nativo con el código estable y una explicación sin SQL
  ni rutas.
- Se puede **abrir la carpeta de copias** (o `userData` si aún no existe).
- Se puede **continuar en modo seguro** (sin escritura) o **salir**.
- El arranque queda registrado en `logs/startup.log` (JSONL, rotación a 256 KiB,
  sin SQL, filas, rutas ni contenido).
- Todavía no se puede exportar ni restaurar desde la app: la restauración guiada
  y la exportación llegan en M0-07 y M1.

### 5.1 Riesgo de instancia única

No hay `app.requestSingleInstanceLock`. Dos instancias podrían inspeccionar o
migrar a la vez y una acabar en modo seguro, con copias duplicadas. SQLite
serializa las escrituras y la transacción revierte, así que no hay corrupción ni
pérdida de datos, y todavía no existen escrituras de contenido. El bloqueo debe
cerrarse antes de M1 y preferiblemente antes de #68; queda registrado como riesgo
de ciclo de vida.

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
5. Si falla, la transacción revierte y la app arranca en modo seguro; la
   restauración guiada de la copia llega con M0-07.
6. Los assets y las copias no se tocan.

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
| Restauración manual | M0-04 | Copia restaurada y migración reaplicada (integración) |
| Restauración guiada | M0-07 | Informe de restauración |
| Disco lleno | Hito M5 | Aviso y modo lectura |
| Corte de energía | Hito M5 | WAL recupera la base |

Las pruebas se ejecutan en una carpeta temporal; nunca sobre los datos reales
del desarrollador. Las de integración usan `os.tmpdir()`.

## 9. Diagnóstico y soporte

- En M0-04, el arranque escribe `logs/startup.log` en JSONL: base nueva,
  migraciones aplicadas, versión resultante, copia creada y código de modo
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
