# Continuidad y recuperación

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** copias, restauración, modo seguro, recuperación ante corrupción,
> preservación en actualizaciones y desinstalación.
> **Decisiones:** ADR 0012. La estructura de datos está en
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
| Corrupción de la base | `integrity_check` falla | Modo seguro + restaurar copia | Copia elegida |
| Migración fallida | Error en transacción | Rollback + copia pre-migración + modo seguro | Base anterior |
| Actualización de la app | Primera ejecución | Comprobación de esquema + copia + migración | Todos |
| Reinstalación | Instalador | No toca `userData` | Todos |
| Desinstalación | Desinstalador | Conserva `userData` y avisa | Todos |
| Borrado accidental de un mundo | Papelera | Restaurar desde papelera | Mundo y assets |
| Borrado definitivo | Confirmación | Copia recuperable previa | Copia |
| Disco lleno | Error de escritura | Aviso, modo lectura, liberar espacio | Hasta la última escritura |
| Archivo de asset perdido | Al abrir | Aviso y placeholder; se conserva la ficha | Metadatos |
| Base de versión superior | Al arrancar | Se niega a escribir y pide actualizar | Todos |

## 3. Copias

### 3.1 Automáticas

- **Diaria:** al cerrar la app o en el primer arranque del día.
- **Semanal:** se conserva la última diaria de la semana.
- **Mensual:** se conserva la última semanal del mes.
- **Pre-migración:** antes de aplicar migraciones.
- **Pre-restauración:** antes de reemplazar la base.
- **Antes de operaciones destructivas:** borrar un mundo, vaciar la papelera o
  eliminar todos los datos.

Retención por defecto: 7 diarias, 4 semanales y 12 mensuales. Las copias
pre-migración, pre-restauración y manuales no se rotan automáticamente.

### 3.2 Manuales

El usuario puede crear una copia completa (base + assets) desde Ajustes →
Copias. Puede elegir destino, incluida una unidad externa o una carpeta de red
de confianza. La app no sube la copia a Internet.

### 3.3 Verificación

Cada copia incluye un `manifest.json` con:

```json
{
  "format": 1,
  "appVersion": "0.1.0",
  "schemaVersion": 3,
  "createdAt": "2026-11-18T10:00:00.000Z",
  "sqliteSha256": "abc1234",
  "sizeBytes": 0,
  "includesAssets": false
}
```

Antes de dar una copia por válida, la app la abre en solo lectura y ejecuta
`PRAGMA integrity_check`. Si falla, la marca como no válida y no la ofrece para
restaurar.

## 4. Restauración

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

La restauración nunca se ejecuta en segundo plano ni sin confirmación.

## 5. Modo seguro

La app arranca en modo seguro cuando:

- `PRAGMA integrity_check` falla.
- Una migración no puede aplicarse.
- La versión de esquema es superior a la que entiende la app.
- La carpeta de datos no es escribible.

En modo seguro:

- No se escribe en la base ni en los assets.
- Se muestra el diagnóstico y las acciones disponibles.
- Se puede **exportar** lo que se pueda leer.
- Se puede **restaurar** una copia.
- Se puede **abrir la carpeta de datos** y los logs.
- No se ejecutan actualizaciones automáticas.

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

1. `electron-updater` descarga la nueva versión en segundo plano.
2. El usuario decide cuándo reiniciar.
3. Al arrancar, la app compara la versión de esquema.
4. Si hay migraciones, crea copia y las aplica.
5. Si falla, vuelve a la base anterior y arranca en modo seguro.
6. Los assets y las copias no se tocan.

La actualización se puede desactivar en Ajustes. Nunca se instala sin
consentimiento.

### 7.2 Reinstalación

El instalador detecta una instalación previa, actualiza los binarios y
conserva `userData`. Si el usuario elige otra carpeta de instalación, los datos
siguen en la misma ruta de `userData`.

### 7.3 Desinstalación

El desinstalador elimina binarios y accesos directos. **No borra**
`%APPDATA%\World Craft`. Al terminar, muestra la ruta de los datos y recuerda
que puede eliminarlos manualmente si lo desea.

## 8. Pruebas de continuidad

| Prueba | Cuándo | Evidencia |
|---|---|---|
| Instalar → usar → actualizar | Cada release | Datos y assets intactos |
| Instalar → usar → desinstalar | Cada release | `userData` intacto |
| Migración con datos | Cada migración | Copia + preservación |
| Restauración | Cada release | Informe de restauración |
| Corrupción simulada | Hito M5 | Modo seguro + restauración |
| Disco lleno | Hito M5 | Aviso y modo lectura |
| Corte de energía | Hito M5 | WAL recupera la base |

Las pruebas se ejecutan en una máquina virtual o en una carpeta temporal; nunca
sobre los datos reales del desarrollador.

## 9. Diagnóstico y soporte

- Ajustes → Ayuda → «Exportar diagnóstico» genera un ZIP con versión, sistema,
  estado de la base, configuración no sensible y últimas líneas de log.
- El usuario revisa el ZIP antes de compartirlo.
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
