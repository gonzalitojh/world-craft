# ADR 0031 — Descripción enriquecida del mundo y formato portable v2

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-26
- **Fecha del documento:** 2026-11-26
- **Issue:** #114
- **Decisiones del registro:** D-054
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0007, ADR 0009, ADR 0012, ADR 0016, ADR 0026,
  ADR 0029, ADR 0030
- **QA y seguridad:** PASS de `qa-reviewer` (2026-11-26) y PASS de
  `security-champion` con 0 HIGH y 2 LOW informativos (falta de límite explícito
  de profundidad en el esquema recursivo, heredado de las fichas, y ausencia
  deliberada de `CHECK` JSON en `worlds`)

## Contexto

La descripción del mundo era **texto plano** desde `0002_worlds` (#72): un
`TEXT` sin formato que se pintaba con `white-space: pre-line`. Las fichas ya
usaban desde #74 un documento de ProseMirror validado, con barra mínima,
menciones `@` / `[[ ]]` y enlaces internos `wc-entity://` (ADR 0021 y 0026). Esa
asimetría impedía dar al mundo la misma capacidad editorial y obligaba a
mantener un segundo camino de lectura y otro de exportación.

La issue #114 pedía migrar la descripción del mundo al editor compartido sin
perder los textos existentes, sin romper la búsqueda ni el formato portable de
#78 (ADR 0029), y sin duplicar el editor ni el sistema de menciones. El usuario
aprobó el plan de `task-architect` el 2026-11-26 y confirmó un **límite de
4.000 caracteres de texto plano**, en lugar de los 50.000 de las fichas. La issue
pasó de `size: s` a `size: m` y no se partió: la migración y la UI debían entrar
juntas para que la aplicación nunca leyera JSON con la vista antigua ni texto
plano con el servicio nuevo.

Restricciones que condicionan la decisión:

1. **Los datos no se pierden.** La migración crea una copia previa verificable y
   conserva todos los párrafos del texto existente.
2. **El renderer no accede a SQLite.** El documento se valida y el texto plano se
   deriva en el proceso principal; el renderer solo consume la API tipada.
3. **La búsqueda no puede indexar JSON.** El índice FTS5 ya existente
   (`search_world_documents`, ADR 0002 y 0023) debe seguir leyendo texto legible.
4. **El formato portable no puede romperse.** Los paquetes v1 de #78 siguen
   teniendo que importarse.
5. **Aplicación offline, de coste cero y sin dependencias nuevas.**

## Decisión

1. **La descripción del mundo es un documento ProseMirror validado, con el mismo
   esquema cerrado que las fichas.** `worlds.description` conserva el nombre y
   guarda JSON; el contrato público la expone como
   `WorldDetail.description: WorldRichTextDocument | null`, un alias estructural
   de `EntityRichTextDocument` con solo importación de tipos. Se reutiliza
   `src/shared/entities/description.ts` para la lista cerrada de nodos y marcas
   (párrafos, títulos 1–3, listas, cita, texto, salto y enlaces
   `wc-entity://<uuidv7>`), la extracción de texto plano y el rechazo de HTML.
   `WorldSummary` no cambia.

2. **Texto plano derivado en `worlds.description_text`.** Nueva columna `TEXT`
   que el proceso principal calcula en cada escritura y nunca acepta del
   renderer. La vista `search_world_documents` se redefine sobre
   `description_text`, de modo que la búsqueda global indexa el texto visible y
   no el JSON. `description_text` no se exporta: se recalcula al importar.

3. **Límites: 4.000 caracteres de texto plano y 200.000 de JSON.** Se añaden
   `WORLD_DESCRIPTION_TEXT_MAX_LENGTH = 4_000` y
   `WORLD_DESCRIPTION_JSON_MAX_LENGTH = 200_000`. El contador, el error de
   exceso y el bloqueo del guardado se calculan sobre el texto extraído, no sobre
   el JSON. Se retira el `maxLength` nativo del `textarea` y la constante antigua
   de descripción plana. El nuevo módulo `src/shared/worlds/description.ts`
   envuelve la validación de fichas y aplica los dos límites del mundo; también
   lee el JSON guardado con tolerancia: si es ilegible o no encaja en el
   esquema, el servicio reconstruye el documento desde `description_text` en vez
   de exponer contenido inválido.

4. **El editor es el mismo de #131, sin bifurcación.** `RichTextEditor` se
   amplía con `entityLinks` (`enabled`/`disabled`/`off`), `navigateLinks`,
   `labelledBy`, `describedBy`, `invalid` y `hintId`. En **creación** no hay
   fichas: la barra tiene tres controles (Negrita, Cursiva, Formato) y no se
   montan Enlace ni Mención; cualquier enlace enviado se rechaza. En **edición**
   se cargan las fichas del mundo y la barra tiene cinco controles; Enlace y
   Mención quedan deshabilitados mientras cargan o si falla la carga, con estado
   visible y reintento que no bloquea el guardado. En **lectura** los enlaces
   navegan con clic y `Enter`, pero el diálogo modal **no navega**. El detalle
   visual y de accesibilidad está en
   [`docs/diseno/mundo-descripcion-issue-114.md`](../diseno/mundo-descripcion-issue-114.md).

5. **Los enlaces internos solo apuntan a fichas vivas del mismo mundo.** El
   servicio principal valida cada `wc-entity://` contra las fichas no borradas
   del mundo; un enlace a otro mundo, a una ficha en papelera o a un UUID
   inexistente invalida la escritura. En creación se rechaza cualquier enlace
   porque todavía no existe mundo donde resolverlo. La interfaz valida antes solo
   cuando la lista de candidatas está completa; el proceso principal es siempre
   la autoridad.

6. **Duplicar un mundo degrada los enlaces a texto.** Las fichas no se copian, y
   un enlace interno apuntaría al mundo original. Al duplicar se conserva el
   texto visible y el resto de marcas, se quita solo la marca de enlace y se
   recalcula `description_text`; la descripción nunca queda `null` por esta vía.
   La portada tampoco se copia.

7. **Migración `0008_world_description`, con copia previa y rollback.** El
   runner crea la copia pre-migración verificable antes de aplicarla. La
   migración añade `description_text`, convierte cada línea no vacía en un
   párrafo conservando el orden, con `json_object`/`json_group_array` y
   `group_concat(..., ORDER BY ordinal)`, normaliza CRLF/CR y tabuladores,
   descarta líneas vacías o de solo espacios y deja `NULL` lo que no tenía texto
   visible. Recrea `search_world_documents`, repuebla `search_documents` y
   ejecuta `rebuild` de FTS5. El rollback de referencia degrada el documento a
   texto plano, elimina la columna, restaura la vista y los triggers de `0006` y
   deja `user_version` en 8; pierde formato y enlaces, nunca el texto visible.

8. **Sin `CHECK` JSON nuevo en `worlds`.** Añadir un `CHECK` a `worlds` obligaría
   a reconstruir la tabla raíz, referenciada por `assets`, `activity_log`,
   `entity_types`, `entities`, `tags`, `relations`, `search_documents` y sus
   triggers. El coste y el riesgo de una reconstrucción superan el beneficio
   frente a las capas que ya validan la forma: Zod estricto en el IPC, validación
   de dominio, esquema cerrado del editor y lectura tolerante. Es un riesgo LOW
   aceptado y documentado, no un olvido.

9. **Formato portable `world-craft-world` v2, con lectura de v1.**
   `TRANSFER_FORMAT_VERSION` pasa a 2. `world.json` guarda
   `world.description` como documento ProseMirror o `null`; el manifiesto
   acepta `formatVersion` 1 y 2 y escribe siempre 2. Un paquete v1 se lee con su
   esquema propio y su `description` de texto plano se convierte a documento
   párrafo a párrafo antes de validarse. Un `formatVersion` mayor que 2 se
   rechaza con `TRANSFER_FORMAT_UNSUPPORTED` antes del parse estricto. Al
   exportar e importar, los enlaces del mundo se remapean con el resto de IDs y
   los que no se pueden resolver se quitan conservando el texto y se cuentan
   como `broken-entity-link`. `schemaVersion` viaja como `user_version` (hoy 9).
   El formato de la **biblioteca total** `world-craft-library` v1 sigue
   consumiendo el paquete de mundo v2 sin cambiar su propio `formatVersion`; sus
   paquetes internos se escriben en v2 y la validación del manifiesto de cada
   paquete acepta v1 y v2.

10. **Sin canales IPC nuevos, sin dependencias y sin migración del formato de
    biblioteca.** Los ocho canales de `worlds` ya transportan `WorldDetail`; solo
    cambia el tipo de `description`. La búsqueda usa `search:query` y los
    triggers existentes. Todo funciona sin red y sin servicios de pago.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Mantener texto plano y añadir formato con Markdown | No reutiliza el editor de #131, exige un segundo parser y no valida enlaces internos contra fichas vivas del mismo mundo. |
| Reutilizar el límite de 50.000 caracteres de las fichas | La descripción del mundo es un resumen editorial, no un documento; el usuario fijó 4.000 caracteres de texto plano para mantener la página legible. |
| Crear una tabla `world_descriptions` aparte | Duplicaría la relación con `worlds`, complicaría los triggers de búsqueda y no aporta nada frente a dos columnas en la tabla raíz. |
| Añadir `CHECK (json_valid(description))` en `worlds` | SQLite exigiría reconstruir la tabla raíz y todas las FK y triggers que la referencian; el beneficio no compensa el riesgo de una migración destructiva. |
| Guardar el JSON y buscar sobre él | El índice FTS5 mostraría claves y marcas; la búsqueda debe leer texto legible y estable. |
| Copiar las fichas al duplicar el mundo | La issue no lo pide, multiplicaría assets y relaciones, y cambiaría el significado de «duplicar»; se prefiere degradar los enlaces a texto. |
| Mantener `formatVersion: 1` y cambiar el significado de `world.description` | Rompería la compatibilidad declarada de #78 y haría ambiguos los paquetes ya exportados; un cambio de forma exige una versión nueva. |
| Convertir la descripción plana a un único párrafo con saltos | Perdería la estructura de párrafos que el usuario ya veía con `white-space: pre-line`; la conversión es párrafo a párrafo. |
| Aceptar enlaces a fichas de otro mundo | La página del mundo solo abre fichas de su propio mundo; un enlace externo quedaría roto y confundiría la navegación. |

## Consecuencias

### Positivas

- La descripción del mundo deja de ser una función prevista: se edita con el
  mismo editor, la misma barra, el mismo menú Formato y las mismas menciones que
  una ficha, sin un segundo sistema que mantener.
- La búsqueda global sigue leyendo texto legible y encuentra el contenido del
  mundo por lo que dice, no por su JSON.
- Los textos existentes se convierten párrafo a párrafo, sin perder contenido, y
  la copia pre-migración permite volver atrás.
- Un paquete v1 de #78 se sigue importando: el formato v2 es una evolución
  compatible, no una ruptura.
- Duplicar un mundo no deja enlaces que apunten al original ni descripciones
  vacías.
- La descripción no se exporta como texto duplicado: `description_text` se
  recalcula, de modo que el paquete no lleva dos fuentes de verdad.

### Negativas y riesgos

- **La migración toca datos existentes.** Aunque conserva el texto, un fallo de
  disco durante la copia previa impide migrar; el modo seguro y la restauración
  siguen siendo la vía de recuperación.
- **El rollback pierde formato y enlaces.** Es deliberado: solo puede volver a
  texto plano. El formato vive en el paquete v2 y en la copia previa.
- **El límite de 4.000 caracteres es menor que el de las fichas.** Un texto
  heredado que lo supere no se puede volver a guardar sin acortarlo; la lectura
  tolerante lo muestra y el contador lo señala antes de guardar.
- **Sin `CHECK` JSON en `worlds`,** una escritura fuera del servicio podría
  guardar un JSON inválido. Se compensa con Zod, validación de dominio y lectura
  tolerante; el riesgo es local y de un solo usuario.
- **El esquema recursivo no fija profundidad.** Un documento muy anidado dentro
  de los 200.000 caracteres podría consumir CPU al renderizarse; es el mismo
  patrón que las fichas y queda como endurecimiento opcional.
- **El formato de biblioteca no sube de versión.** Sigue siendo
  `world-craft-library` v1, pero sus paquetes internos pasan a v2; el lector de
  la biblioteca debe aceptar ambos.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | El diálogo mantiene 44 rem y el cuerpo con scroll; el editor mide 10–20 rem con scroll interno. La página usa 68ch y no trunca. Comprobado a 1024, 1280 y 1600 px sin scroll horizontal. |
| Temas (Claro/Oscuro) | Sin colores nuevos. El borde del editor en el formulario sube a `--border-strong` para cumplir 3:1; contador, vacío, metadatos, error y deshabilitado usan tokens semánticos y se verifican en ambos temas. |
| Accesibilidad | La barra conserva `role="toolbar"`; el editor es `combobox` con listbox cuando hay candidatas y `textbox` mientras carga o falla; en lectura no hay atributos de formulario. Contador y recuento no son regiones vivas; los errores usan `role="alert"` y foco asociado. `Dialog` ignora Escape con `defaultPrevented` y reconoce el listbox, para no cerrar el modal al cerrar un popover. |
| Seguridad y privacidad | Zod estricto sobre el documento; sin HTML crudo; enlaces solo `wc-entity://` y validados; sin canales IPC nuevos; sin rutas ni contenido en logs; migración transaccional con copia previa. |
| Datos y preservación | Copia pre-migración verificable, conversión sin pérdida de texto, rollback documentado y pruebas de migración, preservación y rollback. `description_text` se recalcula y no se exporta. `user_version` pasa a 9. |
| Coste | 0 €/mes: sin servicios, dependencias nuevas ni telemetría. |
| Portabilidad de datos | El paquete v2 es un ZIP abierto con el documento en JSON legible; la importación acepta v1 y v2 y remapea los enlaces con avisos. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Pérdida de texto al migrar | Sin coste | Copia pre-migración verificable; conversión párrafo a párrafo; prueba sobre base 0007 realista | `docs/base-de-datos/migraciones.md` |
| JSON inválido guardado fuera del servicio | Sin coste | Zod en IPC, validación de dominio, esquema cerrado y lectura tolerante desde `description_text` | Revisión de #116 si cambia el modelo |
| Documento muy anidado | Sin coste | Límite de 200.000 caracteres de JSON y de 4.000 de texto; endurecimiento de profundidad opcional | Seguridad de #114 (LOW) |
| Paquete v1 ilegible tras el cambio | Sin coste | Esquema v1 propio, conversión antes de validar y prueba de round-trip con paquetes v1 | `docs/formato-de-exportacion.md` |
| Enlaces rotos al exportar o importar | Sin coste | Remapeo con el mapa de IDs; los irresolubles se quitan y se cuentan como `broken-entity-link` | Plan de pruebas |
| Biblioteca total con paquetes v2 | Sin coste | El manifiesto de biblioteca no cambia; el lector acepta v1 y v2 en cada paquete | ADR 0030 |

No aplica ningún servicio de pago: el editor, el almacenamiento, la búsqueda y la
transferencia son locales y usan el stack existente.

> **Implementación (M1-11, #116, 27/11/2026).** La reconstrucción de `assets` no
> cambia la tabla raíz `worlds` ni obliga a añadir el `CHECK` JSON que este ADR
> descartó. El formato portable sigue en `world-craft-world` v2 con lectura de
> v1; solo sube el `schemaVersion` del manifiesto a 10. Las filas en cuarentena
> no se exportan. El detalle está en el
> [ADR 0032](0032-assets-world-fk-quarantine.md).

## Plan de revisión

- **#115:** al añadir la portada del mundo, revisar la composición de la cabecera
  y del formulario para que la descripción rica y la portada no compitan.
- **#116:** revisado. La reconstrucción de `assets` no cambia `worlds` ni exige
  un `CHECK` conjunto; el formato v2 se mantiene y el manifiesto usa
  `schemaVersion` 10.
- **M3 (manuscritos y escenas):** si el editor compartido se usa en documentos
  largos, revisar el límite de 4.000 del mundo frente al de las fichas y el
  rendimiento de documentos anidados.
- **Cualquier cambio de forma de `world.description`:** exige subir
  `formatVersion`, actualizar el ADR 0029 y
  [`docs/formato-de-exportacion.md`](../formato-de-exportacion.md), y mantener la
  lectura de v2.
- **Si se aprueba un límite de profundidad del esquema:** crear la issue
  correspondiente y aplicarlo a fichas y mundos a la vez, no solo al mundo.

## Referencias

- Issue: #114
- Issues relacionadas: #72 (mundos), #74 (fichas y editor), #77 (versiones),
  #78 (exportación e importación), #79 (Ajustes y biblioteca), #115 (portada del
  mundo), #116 (FK de assets), #131 (editor mínimo y menciones)
- [`docs/diseno/mundo-descripcion-issue-114.md`](../diseno/mundo-descripcion-issue-114.md),
  contrato de interfaz aprobado
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md),
  secciones 10.3 y 10.6
- [`docs/base-de-datos/migraciones.md`](../base-de-datos/migraciones.md),
  `0008_world_description`
- [`docs/base-de-datos/esquema.md`](../base-de-datos/esquema.md), sección 4.1
- [`docs/formato-de-exportacion.md`](../formato-de-exportacion.md), secciones 3,
  4, 7, 8 y 10
- [ADR 0032](0032-assets-world-fk-quarantine.md), integridad de assets y
  `schemaVersion` 10
- [`docs/persistencia.md`](../persistencia.md), sección 5
- [`docs/arquitectura.md`](../arquitectura.md), secciones 2.8 y 2.10
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-054
- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), sección 4
