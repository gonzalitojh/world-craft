# ADR 0030 — Ajustes, datos y borrado total

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-25
- **Fecha del documento:** 2026-11-26
- **Issue:** #79 (`M1-08`), dentro del hito M1
- **Decisiones del registro:** D-053
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0006, ADR 0012, ADR 0016, ADR 0017, ADR 0018, ADR 0025,
  ADR 0027, ADR 0028, ADR 0029
- **Consumidores previstos:** cuarentena de assets y FK `assets.world_id`
  (#116), importación de una biblioteca completa, restauración guiada desde
  Ajustes, interruptor de actualizaciones (M5-05) e idiomas adicionales
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-26) y PASS de
  `security-champion` sin hallazgos HIGH; los dos MEDIUM —validación del
  manifiesto de assets y exportación con una transferencia activa— se
  corrigieron antes de documentar

## Contexto

La issue M1-08 (#79) pedía una pantalla de **Ajustes** real y, sobre todo,
**control sobre los datos**: abrir las carpetas, saber cuánto ocupan, exportar
todo, gestionar imágenes huérfanas y eliminar todos los datos con garantías. La
API de preferencias de #132 ya existía, pero su restablecimiento solo se podía
invocar por código, y el tema, la densidad y el tamaño de texto no tenían una
pantalla donde explicarse.

El contexto impone varias restricciones:

1. **Los datos del usuario nunca se pierden.** Borrar todo es una operación
   destructiva: sin una copia previa verificable no se puede ejecutar nada.
2. **La exportación de #78 exporta un mundo, no una biblioteca.** Las copias
   automáticas solo contienen SQLite y no incluyen assets, así que ninguna de
   las dos vías servía para llevarse **todo** el contenido ni para recuperar una
   biblioteca completa.
3. **El renderer no puede recibir rutas.** Abrir carpetas, exportar y borrar
   deben resolverse en el proceso principal con enums y resultados tipados.
4. **Solo una operación mutua a la vez.** Exportar y borrar compiten por la base
   y por el disco; una transferencia de mundo en curso también debe bloquearlas.
5. **La aplicación es offline y de coste cero.** No hay servicios, telemetría ni
   dependencias nuevas previstas.

El usuario aprobó el plan de `task-architect` (2026-11-25) con las decisiones
D1–D6 y la opción **D2-B**: la exportación total incluye, además de un paquete
#78 por mundo, una **copia completa y verificada de SQLite**. La issue pasó de
`size: m` a `size: l`, sin dividirse, porque la instantánea de base queda
contenida en la fase S4.

## Decisión

1. **Ajustes consume la API de preferencias de #132, sin almacenamiento
   paralelo.** La pantalla es una página editorial de una columna con el orden
   Apariencia → Idioma → Atajos → Actualizaciones → Datos → Restablecer
   preferencias. Se abre desde el **pie del rail**, encima del botón de plegar,
   con `aria-current="page"`, desde el comando **Abrir Ajustes** de la paleta
   `Ctrl+K` y por el hash estable `#/settings`. `settings` entra en `AppView`,
   `AppNavView` y `PERSISTED_APP_VIEWS`; la aplicación **sigue abriendo en
   Inicio** y `lastView` es solo metadato. **Idioma** es informativo —solo
   español, sin selector—, los **atajos** son de consulta y no se reasignan, y
   **Actualizaciones** muestra versión, última comprobación y estado, y abre el
   diálogo existente sin interruptor de auto-comprobación.

2. **Apariencia con presets, no zoom.** Se añaden `ui.density`
   (`comfortable`/`compact`) y `ui.font-scale` (`small`/`normal`/`large`). La
   densidad redefine solo los pasos de espaciado `--space-3` a `--space-9` y
   mantiene mínimos de control, iconos, radios y foco; el tamaño de texto
   redefine los tokens `--text-*`, nunca `html { font-size }`, `zoom` ni
   `transform`. El tema sigue siendo solo Claro/Oscuro. Los tres atributos
   (`data-theme`, `data-density` y `data-font-scale`) se aplican **antes de
   `createRoot`** y en cada cambio. «Restablecer apariencia» usa
   `update({ theme: 'light', density: 'comfortable', fontScale: 'normal' })` y
   **no** `reset()`, para no tocar el resto de preferencias.

3. **Servicio de datos en el proceso principal, con siete canales y solo
   enums.** `src/main/data/` contiene el dominio puro —resumen, uso, carpetas,
   huérfanos, biblioteca, copia verificada, borrado, composición y sustitución
   en modo seguro— y `src/shared/contracts/data.ts` los tipos, enums, tokens,
   formatos y guardas. Los canales son `data:getSummary`, `data:getUsage`,
   `data:openFolder`, `data:exportAll`, `data:deleteAll`, `data:planOrphans` y
   `data:purgeOrphans`, con Zod estricto, guardas en el preload y API
   `window.worldCraft.data` congelada. **Ningún resultado incluye rutas, hashes
   ni nombres internos.** Las lecturas no bloquean; solo una operación mutua
   puede estar activa y la segunda recibe `DATA_BUSY`.

4. **Apertura de carpetas por enum cerrado.** El renderer envía `data`,
   `assets`, `backups`, `logs`, `imports` o `exports` y recibe
   `{ opened: true }`. El main crea la carpeta si falta, comprueba que cada
   componente existente bajo `userData` sea un directorio real y no un enlace,
   y repite la validación con `realpath` antes de llamar a `shell.openPath`. La
   interfaz muestra el nombre y la ruta relativa dentro de `userData` (`data`,
   `assets`, `backups`, `logs` y el grupo de temporales), **nunca la ruta
   completa del equipo**.

5. **Uso de disco acotado y honesto.** La medición recorre las categorías
   `database`, `assets`, `backups`, `logs` y `temporary` sin seguir enlaces, con
   un presupuesto de 100 000 entradas y 4 segundos. Si se agota o una categoría
   falla, el resultado se marca **parcial** y el resto sigue disponible.
   «Temporales» mide exactamente `imports/.tmp`, `exports/.tmp` y `assets/.tmp`,
   los mismos directorios que borra el borrado total; `assets/.tmp` no se cuenta
   como imagen. La interfaz no promete espacio que no se vaya a liberar.

6. **Huérfanas con el plan y la purga de #66.** El resumen agrega recuentos y
   bytes recuperables; la purga exige el token `purge-orphans`, crea una copia
   verificable en `backups/orphans/` y **nunca toca un archivo referenciado por
   una ficha**. Los enlaces, entradas desconocidas y archivos ausentes se
   informan, no se siguen.

7. **Biblioteca total `world-craft-library` v1 (D2-B).** «Exportar todos los
   datos» genera un ZIP abierto con `manifest.json`, `settings.json`,
   `database/world-craft.sqlite` y un paquete estándar #78 por mundo vivo
   (`worlds/<slug>.zip`). La copia de SQLite se obtiene con `sqlite.backup`, se
   verifica con `integrity_check` y `user_version`, y es **completa**: incluye
   papelera, actividad y preferencias, también `lastView` y `recentLocation`. Los
   paquetes de mundo, en cambio, son exportaciones de #78 y **excluyen** papelera,
   actividad y preferencias. `settings.json` guarda solo tema, densidad, tamaño,
   rail y memoria de la vista de ficha; no guarda `lastView` ni
   `recentLocation`. La exportación es todo-o-nada: si un mundo falla, no se
   publica nada; se escribe un `.partial` junto al destino, se comprueba el
   espacio libre, se relee el ZIP y se publica con `rename`. El resultado
   muestra nombre, tamaño y número de mundos, nunca la ruta elegida. **No se
   incluyen** copias automáticas ni imágenes huérfanas. La importación sigue
   siendo **mundo a mundo** con `transfer:importWorld`; no se importa la
   biblioteca completa.

8. **Borrado total con copia previa, confirmación tipada y reinicio.** Borrar
   todo exige la frase exacta **ELIMINAR TODO** en el diálogo y el token
   `delete-all-data` fijado en el preload; la casilla «Conservar también las
   copias» está **desmarcada por defecto**. Antes de borrar se crea
   `backups/pre-delete/<timestamp>/` con la base en manifiesto v2
   (`reason: 'pre-delete'`), el árbol de `assets/` copiado y verificado con
   `assets-manifest.json` y un `recovery.json` con instrucciones, tamaños y
   SHA-256. Sin copia válida **no se borra nada**. Después se cierra la
   persistencia y se eliminan, por orden, temporales, base, assets, logs y las
   copias antiguas; la copia `pre-delete` se conserva siempre. Se validan las
   raíces antes y después de copiar: un enlace, junction o escape de `userData`
   aborta. `userData`, sus entradas desconocidas, `.updaterId` y la instalación
   **no se tocan**. La verificación final produce `deleted` o `partial`; como la
   base ya está cerrada, cualquier resultado exige reiniciar. La composición
   programa `app.relaunch()` y `app.exit(0)` a los 750 ms para que la respuesta
   IPC llegue antes. La copia `pre-delete` **no se ofrece** en la restauración
   guiada del modo seguro, porque esa restauración solo sustituye la base y
   dejaría los assets desalineados; su recuperación es manual y está documentada
   en el manual.

9. **Transferencia activa y operaciones concurrentes.** Exportar y borrar
   comparten el bloqueo de mutación. Además, la exportación comprueba el
   coordinador de transferencias **después** de cerrar el diálogo nativo, y el
   borrado lo comprueba antes de copiar y antes de cerrar la persistencia: una
   transferencia de mundo en curso devuelve `DATA_BUSY` sin dejar restos.

10. **Sin migración, sin dependencias y sin servicios.** `user_version` sigue en
    8; no se toca `drizzle/`. La biblioteca reutiliza `yauzl`/`yazl` y el
    escritor de #78; la copia de assets usa `node:fs/promises`. Todo funciona
    sin red. El contrato de log `data.operation` solo admite operación,
    resultado y código: nunca rutas, IDs, nombres, tamaños ni contenido. En esta
    entrega no se conecta un sumidero de log nuevo para datos.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Exportar solo los paquetes de mundo, sin copia de SQLite | Perdería papelera, actividad y preferencias, y no permitiría recuperar la biblioteca completa. El usuario eligió D2-B. |
| Importar la biblioteca completa desde el ZIP | Exigiría reglas de conflicto, restauración destructiva y validación de una base ajena; la importación de #78 ya resuelve mundo a mundo sin tocar lo existente. Queda como evolución. |
| Restauración guiada de la copia `pre-delete` desde Ajustes | La restauración existente solo sustituye SQLite; los assets quedarían desalineados y podría sobrescribir datos sin un flujo probado. Se documenta la recuperación manual y se deja la guiada para una issue futura. |
| Borrar sin copia previa y confiar en las copias automáticas | Las copias automáticas no incluyen assets y pueden no ser del mismo instante; incumple la regla de datos del proyecto. |
| Borrar sin reiniciar | La conexión ya está cerrada y la interfaz conserva estado de una base que puede haber desaparecido; reiniciar deja un estado limpio y verificable. |
| Medir el disco sin límites | Un árbol enorme bloquearía la ventana; el resultado acotado y marcado parcial es más honesto y suficiente para Ajustes. |
| Pasar rutas al renderer y abrirlas allí | El renderer no accede a Node ni al sistema de archivos; expondría rutas y ampliaría la superficie de ataque. |
| Atajos reasignables | El MVP solo tiene atajos de consulta; un editor de atajos añade conflictos, persistencia y pruebas que no pide la issue. |
| Interruptor de autoactualización | No existe comprobación automática hasta M5-05; un interruptor sin efecto sería engañoso. |
| Guardar las preferencias en un `settings.json` aparte | Duplicaría el almacenamiento de #132 y rompería la fuente única en `app_settings`. |
| Borrar también la instalación y `.updaterId` | La instalación y el identificador de actualizaciones no son datos del usuario; el borrado no debe desinstalar ni romper el actualizador. |

## Consecuencias

### Positivas

- Ajustes deja de ser una función prevista: tema, densidad, tamaño, idioma
  informativo, atajos, actualizaciones y datos tienen una pantalla real y
  accesible por teclado.
- La apariencia se guarda en el mismo lugar que el resto de preferencias y se
  aplica antes del primer pintado, sin destellos ni cambios de layout.
- La biblioteca total da una vía de recuperación y portabilidad que ninguna
  copia automática ofrecía: la base completa, las preferencias y cada mundo con
  sus imágenes.
- El borrado total no puede ejecutarse sin una copia verificada, y conserva la
  instalación y el identificador de actualizaciones.
- Las carpetas se abren sin exponer rutas y la medición de disco no promete
  espacio que no se libere.
- La gestión de huérfanas reutiliza el plan y la copia de #66: no se borra nada
  referenciado.
- Sin migración, sin dependencias nuevas y sin red.

### Negativas y riesgos

- **El borrado no es atómico.** Se ejecuta por categorías después de cerrar la
  base; un fallo de disco o un bloqueo de Windows puede dejar un resultado
  `partial`. La copia previa y el reinicio permiten reintentar o recuperar.
- **La copia `pre-delete` ocupa tanto como la base y los assets.** En un disco
  casi lleno la operación falla sin borrar nada; el diálogo lo explica.
- **La exportación total puede ser grande y no se cancela.** Se ejecuta en el
  proceso principal reutilizando el escritor de #78 y no expone un botón de
  cancelación; el diálogo bloquea el cierre mientras dura.
- **La copia de SQLite incluye datos que los paquetes de mundo no incluyen.**
  Es deliberado, pero exige explicarlo bien: papelera, actividad y preferencias
  solo están en `database/`, no en `worlds/*.zip`.
- **La restauración de `pre-delete` es manual.** Un usuario que copie solo la
  base y no los assets verá imágenes rotas; `recovery.json` y el manual lo
  advierten.
- **El log de datos no tiene sumidero en esta entrega.** El contrato existe y no
  admite datos sensibles; conectarlo a `logs/` queda para una issue de
  diagnóstico.
- **Un `userData` con enlaces o junctions** se rechaza en lugar de seguirlo; en
  configuraciones exóticas el borrado se detiene con `DATA_DELETE_ROOT_INVALID`.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Página de Ajustes de una columna y 60 rem como máximo, tablas con `table-layout: fixed` y contenido que envuelve. Comprobada a 1024, 1280 y 1600 px con densidad Compacta y texto Grande. El rail gana un destino en el pie sin cambiar sus 240/64 px. |
| Temas (Claro/Oscuro) | La zona de peligro usa `--danger-surface` con texto `--fg` (nunca `--muted`), y las tablas, avisos y resultados usan tokens semánticos. Cero colores literales; contraste AA verificado en ambos temas. |
| Accesibilidad | `fieldset`/`legend` para tema, densidad y tamaño; tablas con `caption` y `scope`; una sola región viva por página; errores con `role="alert"`; diálogos destructivos no descartables con foco inicial en Cancelar, foco al estado y al resultado, y retorno al disparador; `prefers-reduced-motion` detiene esqueletos y transiciones. |
| Seguridad y privacidad | Enums y tokens en la entrada, validación Zod, guardas en el preload, sin `invoke` genérico, sin rutas al renderer, raíces validadas con `lstat`/`realpath`, sin seguir enlaces, y logs sin datos sensibles. Sin red ni telemetría. |
| Datos y preservación | Exportación todo-o-nada y borrado con copia `pre-delete` verificada. La app no borra `userData` al desinstalar y el borrado total conserva la instalación, `.updaterId` y la copia previa. `user_version` sigue en 8. |
| Coste | 0 €/mes: no hay servicios, dependencias nuevas ni telemetría. |
| Portabilidad de datos | La biblioteca es un ZIP abierto con JSON, SQLite y paquetes de mundo importables; la base completa se puede abrir con cualquier herramienta SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Disco lleno al copiar o exportar | Sin coste | Comprobación de espacio antes de publicar; si la copia `pre-delete` falla, no se borra nada; el error se traduce y se ofrece reintentar | `docs/persistencia.md` §8.4 |
| Bloqueos de archivos en Windows | Sin coste | Cierre de la persistencia antes de borrar, `rm` con reintentos y verificación final sobre disco; un resto se informa como `partial` | Pruebas de integración con fallos inyectados |
| Biblioteca muy grande | Sin coste | Un paquete por mundo reutiliza los límites de #78; el staging vive en `exports/.tmp` y se limpia; el resultado se verifica antes de publicar | M5, con datos reales |
| Copia `pre-delete` obsoleta | Sin coste | Se conserva siempre y `recovery.json` lleva fecha, versión de esquema y hashes; el manual explica cómo comprobarla | Revisión de `docs/continuidad.md` |
| Restauración manual incorrecta | Sin coste | Instrucciones en `recovery.json` y en el manual; se copia la base y la carpeta `assets`, y se comprueba el manifiesto antes de abrir | Manual §12.7 |
| Fuga de rutas o datos en logs | Sin coste | El contrato de log solo admite operación, resultado y código; los resultados IPC no llevan rutas; no se conecta un sumidero nuevo | Seguridad de #79 |
| Crecimiento del alcance con una importación total | Sin coste | Se mantiene la importación mundo a mundo de #78; la biblioteca completa queda como evolución con su propia issue y ADR | Plan de revisión |

No aplica ningún servicio de pago: la pantalla, la copia, la exportación y el
borrado son locales y usan el stack existente.

> **Implementación (M1-11, #116, 27/11/2026).** El resumen de datos añade
> `quarantine: { assets, references }` y Ajustes → Datos → Imágenes huérfanas
> muestra un aviso pasivo cuando `references > 0`. El aviso explica que la
> actualización retiró vínculos a imágenes cuyo mundo ya no existía, que los
> archivos no se borraron y que solo se eliminan con la purga de huérfanas, que
> exige confirmación y copia previa. `planOrphanCleanup` no cambia: los archivos
> de filas en cuarentena aparecen como no referenciados y siguen el flujo
> recuperable de este ADR. El borrado total elimina la base y `assets/`, con la
> cuarentena incluida en la copia `pre-delete`. El detalle está en el
> [ADR 0032](0032-assets-world-fk-quarantine.md).

## Plan de revisión

- **#116:** atendido. La FK `assets.world_id` y la cuarentena añaden el recuento
  y el aviso sin cambiar la purga de huérfanas, la copia `pre-delete` ni el
  borrado total; los archivos referenciados siguen sin tocarse.
- **M2 (mapas) y M3 (manuscritos y escenas):** la biblioteca debe incluir sus
  datos en la copia de SQLite y decidir si los paquetes de mundo los exportan;
  cualquier cambio de formato exige subir `formatVersion` y actualizar este ADR
  y [`formato-de-exportacion.md`](../formato-de-exportacion.md).
- **M5-05:** si se aprueba la comprobación automática de actualizaciones, añadir
  el interruptor y la frecuencia en Ajustes y revisar la nota de D5.
- **Importación total y restauración guiada desde Ajustes:** si se abordan,
  crear una issue y un ADR que definan conflictos, validación de una base ajena
  y recuperación de assets; no se añaden a este ADR por la puerta de atrás.
- **Diagnóstico:** si se conecta `logs/data.log`, documentar los eventos
  `data.operation` y comprobar que no incluyen rutas, nombres, IDs ni tamaños.
- **Idiomas adicionales:** cuando existan, Ajustes necesitará un selector real;
  hoy el idioma es informativo y no se promete ninguno más.

## Referencias

- Issue: #79
- Issues relacionadas: #66 (assets y purga de huérfanos), #67 (copias y
  restauración), #77 (papelera y copia `pre-purge`), #78 (exportación e
  importación de mundos), #116 (FK de assets y cuarentena), #132 (preferencias
  de interfaz) y #133 (auditoría visual)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), M1-08
- [`docs/persistencia.md`](../persistencia.md), secciones 2, 6, 8.4 y 10
- [`docs/formato-de-exportacion.md`](../formato-de-exportacion.md), sección 12
- [`docs/arquitectura.md`](../arquitectura.md), secciones 2.18 y 3.6
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md),
  secciones 10.7 y 10.8
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), secciones 12 y 13
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-053
- [`docs/adr/0032-assets-world-fk-quarantine.md`](0032-assets-world-fk-quarantine.md),
  cuarentena y aviso de imágenes desvinculadas
