# Assets en cuarentena (#116): contrato de UI

> **Estado:** contrato de UI acordado el 2026-11-27 para la issue #116. No
> describe código implementado: fija los textos, la colocación, los tokens, la
> accesibilidad y las comprobaciones que `tdd-ddd-architect` debe cumplir y
> `qa-reviewer` debe verificar.
>
> **Base normativa:** `AGENTS.md` (reglas 2, 4, 5, 12, 15, 17 y 18);
> `docs/diseno/sistema-de-diseno.md` §4.5, §7, §9, §10.7, §11 y §12; tokens de
> `src/renderer/styles/tokens/`; `src/renderer/messages/es.ts`;
> `trash-page.tsx`, `trash-purge-dialog.tsx`, `trash-empty-dialog.tsx`,
> `data-settings.tsx` y `data-orphans.tsx`; y el plan aprobado en
> `tasks/task-issue-116.json` §7.
>
> **Alcance:** tres cambios visibles, sin pantallas ni componentes nuevos. No
> hay cambios de layout, rail, animaciones ni canales IPC.

## Decisiones cerradas

1. **Sin componentes nuevos.** Se reutilizan los diálogos de la papelera y la
   subsección de imágenes huérfanas de Ajustes. El único estilo nuevo es una
   clase de aviso pasivo; no se crean tokens, colores, sombras ni tipografías.
2. **El error `assets-in-use` vive en el diálogo de purga individual**, no en la
   fila. Es un rechazo de dominio, no un fallo genérico: se muestra con el
   `role="alert"` existente y el diálogo permanece abierto.
3. **El vaciado distingue cuatro resultados**: todo eliminado, parte eliminada,
   nada eliminado por elementos en uso y papelera ya vacía. «Ya estaba vacía» no
   puede aparecer si `skipped > 0`.
4. **El aviso de Ajustes es texto pasivo** en la subsección «Imágenes
   huérfanas», solo cuando `quarantine.references > 0`. No es un error, no es un
   diálogo, no bloquea, no recibe foco y no usa `role="alert"` ni `aria-live`.
5. **El contador del aviso es `quarantine.references` y el texto habla de
   «vínculos», no de imágenes.** Una misma imagen puede estar referenciada en
   varios sitios y `references` cuenta vínculos retirados, no imágenes distintas.
   No se usa `quarantine.assets`, que incluye filas sin referencias visibles.
6. **El aviso no promete una recuperación que la interfaz no ofrece.** Los
   archivos no se borran al actualizar y solo se eliminan con la purga de
   huérfanas, que exige confirmación y copia previa.
7. **Todos los textos viven en `messages/es.ts`.** Los plurales y el formato del
   número se resuelven con `formats.plural` (`Intl`), nunca concatenando cadenas
   en los componentes.

### Correcciones respecto al texto propuesto en el plan

| Caso | Texto del plan | Decisión y motivo |
|---|---|---|
| Purga individual | «No se puede eliminar el mundo porque una de sus imágenes se usa en otro mundo…» | Se abre con «No se ha eliminado nada», que da la misma garantía que el fallo de copia y no sugiere una imposibilidad permanente. Se concreta «portada o imagen de una ficha». |
| Vaciado | «Se conservaron {count} elementos que todavía están en uso.» | Se conserva como mensaje genérico, pero se añade `summaryLeadPartial` para el éxito parcial y `skippedHint` para explicar qué no se puede eliminar todavía. «Ya estaba vacía» se reserva a `purged = 0` y `skipped = 0`. |
| Aviso de Ajustes | «…se desvincularon {count} imágenes… puedes recuperarlos o eliminarlos con copia.» | Se usa «vínculos» porque el contrato cuenta `references`, no imágenes distintas. Se retira «recuperarlos» porque la interfaz de huérfanas no ofrece recuperar una imagen concreta. Se añade «si todavía está/están en el equipo» para que el aviso siga siendo cierto después de una purga de huérfanas. |

## 1. Textos finales y ubicación

### 1.1 Purga individual de un mundo

| Clave | Texto literal | Dónde |
|---|---|---|
| `trash.purgeDialog.assetsInUse` | `No se ha eliminado nada: una de las imágenes de este mundo se usa en otro mundo como portada o como imagen de una ficha. Cambia esa imagen en el mundo que la usa y vuelve a intentarlo.` | `trash-purge-dialog.tsx`, dentro del `<p className="wc-field__error" role="alert">` existente; `trash-page.tsx` mapea el motivo `assets-in-use` a esta clave. |

- Se antepone «No se ha eliminado nada» para dar la misma garantía que el fallo
  de copia existente. Evita «No se puede eliminar el mundo», que suena a
  imposibilidad permanente.
- «portada o imagen de una ficha» cubre las tres referencias externas posibles:
  portada de otro mundo, imagen principal de una ficha y galería de una ficha.
- No se añaden nombres de mundo, identificadores, rutas ni hashes.
- El resto de motivos (`backup-failed`, `type-in-use`, `not-found`,
  `already-purged`) conservan sus textos y su tratamiento.

### 1.2 Vaciado de la papelera

Todas las claves viven en `trash.emptyDialog` y se muestran en
`trash-empty-dialog.tsx`. El aviso global de `trash-page.tsx` reutiliza el
mismo texto breve según el resultado.

| Clave | Texto literal |
|---|---|
| `summaryLead` (existente) | `Se ha eliminado definitivamente el contenido de la papelera.` |
| `summaryLeadPartial` | `Se ha eliminado parte del contenido de la papelera.` |
| `nonePurged` | `No se ha eliminado nada porque todo lo que quedaba sigue en uso.` |
| `skipped.one` | `Se conservó {count} elemento que todavía está en uso.` |
| `skipped.other` | `Se conservaron {count} elementos que todavía están en uso.` |
| `skippedHint` | `Los tipos personalizados con fichas y los mundos con imágenes usadas en otros mundos no se pueden eliminar todavía.` |
| `alreadyEmpty` (existente) | `La papelera ya estaba vacía.` |

Matriz de resultado:

| Purgados | `skipped` | Cuerpo del diálogo | Aviso global |
|---:|---:|---|---|
| 0 | 0 | `alreadyEmpty`, sin recuentos. | `info` con `alreadyEmpty`. |
| 0 | > 0 | `nonePurged`, **sin** recuentos de ceros, `skipped` y `skippedHint`. | `info` con `nonePurged`. |
| > 0 | 0 | `summaryLead`, recuentos. | `success` con `summaryLead`. |
| > 0 | > 0 | `summaryLeadPartial`, recuentos, `skipped` y `skippedHint`. | `success` con `summaryLeadPartial`. |

- El contenedor `.wc-trash-summary` conserva su `role="status"`.
- `skipped` se pinta como párrafo normal (`--fg`); `skippedHint`, como
  `.wc-dialog__note` (`--muted`). No se usa color de peligro: no es un error.
- No se muestran recuentos de cero en el caso `nonePurged`; tampoco se muestra
  `summaryTitle`, que hoy no se renderiza.
- El foco al resultado y al botón «Cerrar» no cambia respecto al comportamiento
  actual.

### 1.3 Aviso de Ajustes → Datos → Imágenes huérfanas

| Clave | Texto literal |
|---|---|
| `settings.data.orphans.quarantineNotice.one` | `Al actualizar World Craft se retiró {count} vínculo a una imagen porque el mundo al que pertenecía ya no existía. El archivo no se borró al actualizar: si todavía está en el equipo, aparece en el análisis de imágenes huérfanas y solo se elimina si lo confirmas con una copia de seguridad previa.` |
| `settings.data.orphans.quarantineNotice.other` | `Al actualizar World Craft se retiraron {count} vínculos a imágenes porque el mundo al que pertenecían ya no existía. Los archivos no se borraron al actualizar: si todavía están en el equipo, aparecen en el análisis de imágenes huérfanas y solo se eliminan si lo confirmas con una copia de seguridad previa.` |

- Se renderiza en `data-orphans.tsx` con `formats.plural(quarantine.references,
  copy.quarantineNotice)`, después de `lead` y `safety`, antes del estado y de
  la acción «Analizar».
- `data-settings.tsx` pasa `quarantine` a `DataOrphans` desde
  `data.summary.status === 'ready' ? data.summary.data.quarantine : null`.
- El aviso aparece aunque el usuario no haya pulsado «Analizar»: es información
  histórica de la actualización, no un resultado del análisis.
- No se muestra si el resumen está cargando, en error o no disponible.
- No usa `role="alert"` ni `aria-live`: es texto persistente. Tampoco recibe
  foco, no añade una parada de tabulación y no se puede cerrar en esta issue.
- «si todavía está/están en el equipo» mantiene el texto verdadero aunque el
  usuario ya haya purgado los archivos huérfanos. La cuarentena es metadato
  histórico y no se limpia en #116.
- No se muestran nombres de mundo, identificadores, rutas ni hashes.

## 2. Estados y comportamiento

### 2.1 Diálogo de purga individual

| Estado | Qué se ve | Foco y ARIA |
|---|---|---|
| Inicial | Cuerpo y notas existentes; «Cancelar» con `data-autofocus`. | Foco en «Cancelar». |
| Pending | Botón de confirmar con `loading`, texto «Creando la copia de seguridad y eliminando…» y diálogo no descartable. | `role="status"` existente. |
| Éxito | Diálogo cerrado, fila retirada, aviso de éxito y foco en la siguiente fila o en el vacío. | Comportamiento actual. |
| Fallo `assets-in-use` | El diálogo sigue abierto; `pending` termina; aparece el texto `assetsInUse` con `role="alert"`. La fila y el mundo no cambian. | El foco no sale del diálogo. Si el estado `pending` hizo perder el foco al deshabilitar el botón, se devuelve a un control del diálogo («Cancelar» es la opción segura; el botón de confirmar ya habilitado también vale). No se enfoca el párrafo de error. |
| Otros fallos | Sin cambios. | Sin cambios. |

- Al cerrar, el `Dialog` existente devuelve el foco al disparador de la fila.
- No se recarga la lista tras `assets-in-use`: nada ha cambiado.
- No se añade `aria-live` al error; `role="alert"` ya es asertivo.

### 2.2 Diálogo de vaciado

- La casilla obligatoria, la copia previa y el bloqueo durante `pending` no
  cambian.
- Al recibir el resultado, se aplica la matriz de §1.2. El botón «Cerrar» recibe
  el foco como hoy.
- No se añade otra región viva: el resumen ya es `role="status"` y el toast
  global ya anuncia el resultado breve.

### 2.3 Aviso de imágenes huérfanas

- Es un `<p>` con la clase nueva `.wc-settings__notice`; no es un `Alert` de
  peligro ni un `Dialog`.
- La sección conserva su orden: título, lead, seguridad, aviso, estado/análisis.
- El aviso no añade botones ni enlaces: las acciones existentes («Analizar»,
  «Purgar…» y el reintento) no cambian.

## 3. Tokens, estilos y temas

### 3.1 Estilos reutilizados

| Pieza | Clase existente | Tokens |
|---|---|---|
| Error `assets-in-use` | `.wc-field__error` | `--danger`, `--text-sm`. |
| Lead del vaciado | `.wc-dialog__lead` | `--fg`. |
| Recuentos y `skipped` | párrafo normal dentro de `.wc-trash-summary` | `--fg`. |
| `skippedHint` | `.wc-dialog__note` | `--muted`, `--text-sm`. |
| Contenedor del resultado | `.wc-trash-summary` | `--fg`, `role="status"`. |

### 3.2 Única clase nueva

```css
/* Aviso pasivo de imágenes desvinculadas al actualizar. No es un error:
 * usa la familia de aviso, nunca `--danger` ni `--danger-surface`. */
.wc-settings__notice {
  min-width: 0;
  max-inline-size: 68ch;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--warning);
  border-radius: var(--radius-md);
  background-color: var(--warning-surface);
  color: var(--fg);
  overflow-wrap: anywhere;
}
```

No se reutiliza `.wc-settings__unavailable` porque su nombre describe el modo
seguro y no un aviso histórico; el par visual es el mismo, pero la clase nueva
evita acoplar dos significados. No se usa `.wc-alert` porque su color es de
peligro y este aviso no es destructivo.

### 3.3 Matriz de temas y contraste

| Elemento | Claro | Oscuro | Ratio mínimo |
|---|---|---|---|
| Error `assets-in-use` | `--danger` sobre `--surface-raised` | Igual | 6,68:1 / 7,51:1 |
| Texto del resumen y `skipped` | `--fg` sobre `--surface-raised` | Igual | 15,19:1 / 13,82:1 |
| `skippedHint` | `--muted` sobre `--surface-raised` | Igual | 5,34:1 / 7,15:1 |
| Aviso de Ajustes | `--fg` sobre `--warning-surface` | Igual | 12,77:1 / 11,72:1 |
| Borde del aviso | `--warning` sobre la superficie de la página | Igual | 5,37:1 / 9,80:1 sobre `--bg` y 5,90:1 / 8,24:1 sobre `--surface-raised`; ≥ 3:1 |
| Foco | `--focus` sobre `--surface-raised` | Igual | ≥ 6,74:1; ≥ 3:1 |

- Cero colores literales, `opacity` o tokens nuevos.
- Ningún estado se comunica solo por color: el error y el aviso tienen texto
  explícito.

## 4. Ventana de escritorio

Referencias: 1024×700, 1280×800 y 1600×900. Sin diseño móvil.

| Ancho | Papelera | Ajustes |
|---|---|---|
| **1024** | El diálogo mide `min(36rem, 100vw − 48px)`. El error ocupa 3–4 líneas y el resumen del vaciado hace scroll vertical si hace falta; el pie sigue visible. | La página mide como máximo 60 rem; el aviso se limita a 68ch y envuelve en 4–5 líneas. |
| **1280** | El diálogo no crece; el texto gana aire. | El aviso no se estira más allá de 68ch. |
| **1600** | Igual; el diálogo se centra. | La página se centra con máximo 60 rem; el aviso conserva su medida de lectura. |

- A los tres anchos debe cumplirse
  `document.documentElement.scrollWidth <= window.innerWidth`.
- El único scroll horizontal admitido sigue siendo el de tablas, código y lienzo
  del mapa; estas pantallas no lo necesitan.
- No se usa `overflow-x: hidden` en `body`/`html`.
- Los textos no se truncan con ellipsis. Los contadores grandes se formatean con
  `Intl` (por ejemplo, `1.234.567`) y envuelven.
- Comprobar también con tamaño de texto «Grande» y densidad «Compacta» a 1024 px.

## 5. Accesibilidad

- **Error `assets-in-use`:** `role="alert"` en el párrafo, sin `aria-live`
  duplicado. El foco permanece dentro del diálogo; no se mueve al error. Escape
  y el botón de cerrar siguen funcionando cuando `pending` ha terminado. Al
  cerrar, el foco vuelve al disparador de la fila.
- **Vaciado:** el resumen es `role="status"`; el foco va al botón «Cerrar» como
  hoy. El texto de `skipped` no depende del color. No se añade otra región viva.
- **Aviso de Ajustes:** texto estático en orden de lectura, sin rol de alerta,
  sin `aria-live`, sin foco y sin parada de tabulación. No es necesario un icono:
  el texto explica el hecho y la acción posible.
- **Movimiento:** no se añade ninguna animación ni transición. El spinner del
  botón durante `pending` y el pulso de esqueletos existentes se detienen con la
  regla global de `prefers-reduced-motion`.
- **axe:** sin errores críticos en los diálogos de purga y vaciado, en el aviso y
  en la subsección de huérfanas, en Claro y Oscuro.

## 6. Comprobaciones para `tdd-ddd-architect`

1. Añadir `assets-in-use` a `TrashPurgeFailure` y a
   `isTrashPurgeResult`; mapear el motivo en `trash-page.tsx` a
   `messages.trash.purgeDialog.assetsInUse`.
2. Añadir las claves de §1 a `messages/es.ts`; no escribir cadenas en
   componentes. Usar `formats.plural` para `skipped` y `quarantineNotice`.
3. Implementar la matriz de §1.2 en `trash-empty-dialog.tsx` y la selección de
   texto del toast en `trash-page.tsx`. No mostrar «ya estaba vacía» con
   `skipped > 0`; no mostrar recuentos de cero en `nonePurged`.
4. Extender `DataCounts` con `quarantine: { assets, references }` y su guarda
   estricta. Pasar `quarantine` de `data-settings.tsx` a `DataOrphans` y renderizar
   el aviso solo con `references > 0`.
5. Añadir `.wc-settings__notice` a `settings.css` con los tokens de §3.2. No
   crear tokens ni usar colores literales.
6. Actualizar fixtures de `DataCounts` y pruebas de contratos de papelera/datos.
7. Añadir las pruebas de §7 a los tests de componentes y E2E existentes.

## 7. Comprobaciones para `qa-reviewer`

### 7.1 Papelera

- [ ] `purge` devuelve `assets-in-use`: el diálogo sigue abierto, aparece el
      texto exacto, no aparece el error genérico y la fila/mundo no cambian.
- [ ] Tras el fallo, `document.activeElement` está dentro del diálogo (no en
      `body`); Escape cierra y el foco vuelve al disparador de la fila.
- [ ] `role="alert"` se anuncia sin duplicar `aria-live`; Tab y Enter siguen
      funcionando.
- [ ] `empty` con `purged = 0` y `skipped > 0`: no muestra «La papelera ya
      estaba vacía», muestra `nonePurged`, `skipped` y `skippedHint`; no muestra
      recuentos de cero; el toast es informativo.
- [ ] `empty` con `purged > 0` y `skipped > 0`: muestra `summaryLeadPartial`,
      recuentos, `skipped` y `skippedHint`; el toast usa el texto parcial.
- [ ] `empty` con `purged > 0` y `skipped = 0`: conserva el resumen completo y no
      muestra `skipped`.
- [ ] `empty` sin nada: conserva «La papelera ya estaba vacía».
- [ ] El resumen es `role="status"`; el botón «Cerrar» recibe el foco.
- [ ] Conteos grandes (`1.234.567`) se formatean y envuelven sin truncar.

### 7.2 Ajustes

- [ ] Con `quarantine.references = 2`, el aviso aparece una sola vez en
      «Imágenes huérfanas», después de `safety`, con el plural correcto.
- [ ] Con `references = 1`, usa la forma singular.
- [ ] Con `references = 0` y `assets > 0`, el aviso no aparece.
- [ ] Con el resumen cargando, en error o no disponible, el aviso no aparece.
- [ ] El aviso no es `role="alert"`, no tiene `aria-live`, no recibe foco y no
      añade botones ni enlaces.
- [ ] No muestra nombres, IDs, rutas ni hashes; solo el contador.
- [ ] La acción «Analizar» sigue disponible y el aviso no depende de su estado.

### 7.3 Temas, ventana y movimiento

- [ ] Claro y Oscuro: error legible, `skipped`/`skippedHint` legibles y aviso de
      Ajustes legible; sin superficies ni textos invisibles.
- [ ] 1024×700, 1280×800 y 1600×900: sin scroll horizontal de página, diálogos
      dentro de la ventana, pie visible, textos sin ellipsis.
- [ ] Tamaño de texto «Grande» y densidad «Compacta» a 1024 px sin desbordes.
- [ ] `prefers-reduced-motion: reduce`: sin animaciones nuevas; spinner y
      esqueletos detenidos.
- [ ] axe sin errores críticos en ambos temas.
- [ ] `grep` sin colores literales en las reglas nuevas; todas las cadenas salen
      de `messages/es.ts`.

## 8. Riesgos y decisiones abiertas

| Riesgo | Severidad | Mitigación |
|---|---|---|
| El aviso de Ajustes persiste aunque el usuario ya haya purgado los archivos huérfanos, porque la cuarentena es metadato histórico. | Media | El texto dice «si todavía está/están en el equipo»; no promete que los archivos sigan ahí. No se añade cierre ni limpieza de filas en #116. |
| `quarantine.references` cuenta vínculos, no imágenes distintas. | Baja | El texto habla de «vínculos». Si el producto exige «imágenes», se debe exponer un `referencedAssets` distinto; no se recomienda en esta issue. |
| El usuario descubre el bloqueo `assets-in-use` solo después de confirmar. | Baja | El mensaje explica el motivo y la acción. Una comprobación previa exigiría otro contrato y otra consulta; fuera de alcance. |
| El aviso de Ajustes se repite en cada visita mientras `references > 0`. | Baja | Es informativo y no bloquea. Un cierre persistente requiere una decisión de producto y una issue posterior. |
| El toast y el `role="status"` del diálogo pueden anunciar el mismo resultado. | Baja | Comportamiento existente; no se añade una tercera región viva ni se duplica el recuento de `skipped` en el toast. |
| La interfaz de huérfanas no ofrece recuperar una imagen concreta. | Media | El texto no promete recuperación: solo dice que el archivo no se borró y que se elimina con confirmación y copia. La recuperación sería una función nueva. |

## 9. Documentación y fuera de alcance

- `documentation-sync` debe actualizar el manual con: el aviso de imágenes
  desvinculadas, que los archivos no se borran, el rechazo de purga por imagen
  usada en otro mundo y el vaciado parcial con elementos conservados.
- El sistema de diseño no cambia tokens; si se documenta la clase nueva, debe
  hacerse en §9/§10.7 sin presentarla como un componente nuevo.
- Fuera de alcance: pantallas nuevas, cierre del aviso, recuperación de imágenes
  concretas, comprobación previa a la purga, nuevos recuentos de cuarentena,
  animaciones y cualquier cambio en `src/main`, `src/preload`, IPC o datos.
