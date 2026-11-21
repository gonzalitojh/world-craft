# ADR 0025 — Dirección visual v2 y sistema de diseño «estudio moderno»

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-21
- **Fecha del documento:** 2026-11-21
- **Issue:** #124 (`M1.5-01`), dentro del epic #123 (`M1.5-00`)
- **Decisiones del registro:** D-048
- **Decisores:** usuario / agentes
- **Relacionados:** ADR 0006, ADR 0009, ADR 0010, ADR 0024
- **Revisa la estética de:** ADR 0006 (sin supersederlo)
- **Implementación:** #125–#133

## Contexto

World Craft ya cubre el ciclo principal de M1: mundos, tipos de entidad, fichas,
etiquetas, relaciones, búsqueda y paleta de comandos. La aplicación funciona,
pero la revisión del usuario y un informe externo de UX/UI coinciden en que la
interfaz se percibe como un gestor de bases de datos y no como una herramienta
creativa.

El diagnóstico recogido en el epic #123 es concreto:

- `components.css` acumula 115 declaraciones de borde y 53 radios; casi todos
  los bloques son cajas.
- La ficha es un formulario permanente en lugar de un documento que se lee y se
  edita en contexto.
- Las tarjetas de mundo muestran cinco botones y la jerarquía depende de
  acciones, no del contenido.
- Inicio es un dashboard de contadores y la navegación mezcla marca, lema,
  versión, búsqueda duplicada y actualizaciones.
- La identidad de «taller de cartógrafo» se aplicó mediante papel cálido, tinta
  parda y bordes en todas las superficies; el resultado es cálido, pero también
  ruidoso y pesado.

El usuario ha aprobado una lectura contemporánea de la identidad editorial:
superficies neutras, verde bosque como acento, tipografía del sistema para la
interfaz, iconos propios y jerarquía por espacio, tamaño, peso y contraste. La
calidez se queda en el acento y en el contenido, no en cada superficie. No se
adopta Fluent/Mica/Acrylic como identidad, no se cambia la búsqueda de #76 y no
se duplica el grafo de #83.

## Decisión

1. **Identidad.** «Estudio moderno con alma de cartógrafo». La aplicación se
   lee como una herramienta de trabajo contemporánea; la referencia al taller
   de cartógrafo queda en el cuidado editorial, la tipografía de contenido y el
   verde bosque, no en una textura de pergamino global.
2. **Superficies.** Claro: neutros cálidos casi blancos. Oscuro: neutros
   profundos, no marrones. El verde bosque es el color de marca y la arena se
   reserva para selección o detalle. Los estados conservan sus familias
   semánticas.
3. **Tipografía.** La interfaz usa la pila del sistema (`Segoe UI Variable`,
   `Segoe UI`, `system-ui`). No se empaqueta ni se redistribuye Segoe. La serif
   se reserva a títulos de contenido y lectura larga; si se conserva, se
   empaqueta una fuente OFL y nunca se carga desde Internet. La monoespaciada
   también sale de la pila del sistema.
4. **Iconos.** Un único set centralizado de trazo 1,6 px, tamaños 16/20/24 y
   `currentColor`. No se mezclan familias ni se añade Fluent Icons como
   dependencia. El icono nunca es el único indicador de estado.
5. **Jerarquía.** Espacio, tamaño, peso y contraste antes que cajas. Los bordes
   quedan para campos, divisores, foco y superficies flotantes; las tarjetas y
   secciones no se dibujan con contorno por defecto.
6. **Acciones.** Una acción primaria por pantalla. Las secundarias van a un
   menú `⋯`, a la barra contextual o a la paleta de comandos. Las tarjetas no
   acumulan botones.
7. **Contenido.** Documento antes que formulario. La ficha se lee como una
   página y se edita en contexto; las propiedades viven en un panel plegable.
   La navegación del mundo es modular.
8. **Plataforma y material.** Superficies opacas y nativas. Mica queda como
   spike opcional de Windows 11 con fallback opaco y desactivado por defecto;
   nunca se usa Acrylic detrás de texto.
9. **Puertas.** Se mantienen sin cambios: dos temas, AA en ambos, ventana
   mínima 1024×700, referencias 1024/1280/1600 sin scroll horizontal de página,
   teclado, foco visible, axe, `prefers-reduced-motion`, i18n y preservación de
   datos.
10. **Pestañas de trabajo.** Fuera de M1.5. Se decidirán en M2/M3 cuando existan
    manuscritos y mapas que abrir. Las pestañas de Ajustes pueden seguir
    existiendo como patrón de formulario.

La decisión se desarrolla en
[`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Mantener el sistema v1 y limitarse a pulir componentes | No resuelve el diagnóstico de fondo: sigue habiendo cajas, bordes y formularios permanentes. El coste de mantener dos lecturas de la identidad crece con cada pantalla. |
| Adoptar Fluent UI completo o Mica/Acrylic como identidad | Aumenta la dependencia visual de Windows, complica los dos temas y no aporta la identidad editorial que el usuario quiere conservar. Mica queda solo como extra opcional. |
| Pergamino depurado: papel cálido, tinta parda y textura sutil | Es una variante del sistema v1. La calidez en todas las superficies sigue compitiendo con el contenido y no resuelve la sensación de gestor de base de datos. |
| Dashboard oscuro tipo herramienta profesional, sin tema claro | Rompe la decisión de dos temas y la accesibilidad ya verificada. El usuario quiere una aplicación de escritorio clara y oscura, no un panel único. |
| Kit de componentes de terceros (MUI, Chakra, Mantine) | Menos control de la estética editorial, más peso y más superficie de dependencias. El proyecto ya tiene primitivas nativas y accesibles. |
| Rediseñar solo la ficha y dejar el resto | La ficha es el centro, pero el shell, Inicio y la vista de mundo también construyen la percepción. Un cambio parcial dejaría dos lenguajes conviviendo. |

## Consecuencias

### Positivas

- La interfaz se percibe como herramienta creativa y no como CRUD.
- Menos bordes, radios y sombras: menos ruido y menos deuda visual.
- La tipografía del sistema elimina la dependencia de fuentes no empaquetadas y
  reduce el peso de la aplicación.
- La jerarquía por espacio y contraste es más robusta ante contenido largo.
- Las reglas de una acción primaria y menú `⋯` reducen la densidad de botones.
- La dirección se puede verificar con los mismos tests de tokens, ventana y
  accesibilidad que ya existen.

### Negativas y riesgos

- La migración toca tokens, primitivas, shell y varias pantallas; hay riesgo de
  regresiones visuales y de contraste.
- La serif de contenido queda condicionada a empaquetar una OFL; si no se
  empaqueta, la lectura larga usa una serif del sistema y la identidad editorial
  pierde parte de su carácter.
- La reducción de bordes exige disciplina: sin bordes, la jerarquía depende de
  superficies, espaciado y contraste, y un error se nota más.
- Mica puede comportarse de forma distinta según la versión de Windows y la
  configuración de accesibilidad; por eso es opcional y con fallback.
- Los tokens de color persistidos de tipos de entidad (`moss`, `ochre`,
  `danger`, `prussian`) no se renombran en la base de datos; la UI debe
  resolverlos sin romper datos existentes.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Se mantiene 1024×700 y las referencias 1024/1280/1600. La composición gana espacio y reduce cajas. |
| Temas (Claro/Oscuro) | Núcleo de la decisión: paleta nueva con overrides agrupados y contraste verificado en ambos temas. |
| Accesibilidad | Se mantienen AA, foco visible, teclado, `aria-live`, axe y movimiento reducido; se añade la regla de borde fuerte para componentes interactivos. |
| Seguridad y privacidad | Sin fuentes ni recursos remotos; sin telemetría ni servicios nuevos. |
| Datos y preservación | No se tocan datos ni migraciones. Los tokens persistidos de tipos de entidad conservan su nombre. |
| Coste | 0 €/mes. La pila del sistema no tiene coste ni licencia que redistribuir; una serif OFL solo se empaqueta si se aprueba. |
| Portabilidad de datos | No aplica en esta decisión; la exportación e importación no cambian. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Serif OFL no empaquetada | Licencia y peso | Usar la serif del sistema como respaldo y no presentarla como identidad definitiva | #125 |
| Contraste insuficiente al reducir bordes | AA | Tabla de contraste, tests de tokens y revisión visual | #125, #133 |
| Regresión de layout con contenido largo | Ventana estrecha | `overflow-wrap`, `min-width: 0` y pruebas a 1024/1280/1600 | #133 |
| Mica no disponible o con resultados inconsistentes | Windows 11 | Fallback opaco, desactivado por defecto y sin Acrylic detrás de texto | Spike opcional |
| Deuda de tokens v1 | Convivencia temporal | Tabla de migración y retirada de alias al cerrar #125 | #125 |

## Plan de revisión

- La dirección se aprueba en #124 antes de tocar CSS.
- #125 migra tokens, tipografía y primitivas; actualiza los tests de tokens.
- #126–#131 migran shell, Inicio, mundo, ficha, relaciones y editor.
- #132 persiste las preferencias de interfaz.
- #133 audita contraste, temas, ventana, teclado, axe y ruido visual.
- Si cambia la identidad, la paleta o las reglas de borde, se revisa este ADR y
  el sistema de diseño antes de implementar.

## Relación con ADR 0006

El ADR 0006 sigue aceptado: mantiene los dos temas, los tokens en tres capas, la
ventana mínima y las garantías de accesibilidad. Este ADR no lo supersede;
revisa su lectura estética, la tipografía y las reglas de composición. El
histórico de D-026 se conserva en el registro de decisiones.

## Referencias

- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md)
- [`docs/adr/0006-two-themes-desktop-design-system.md`](0006-two-themes-desktop-design-system.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-026 y D-048
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D13 y §4.5–4.6
- Epic #123 y issues #124–#133
- WCAG 2.2, criterios 1.4.3, 1.4.6, 1.4.11 y 2.3.3, consultados el 21/11/2026.
