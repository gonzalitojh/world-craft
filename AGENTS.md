# Reglas del proyecto

Este archivo contiene las reglas obligatorias que TODO agente de opencode debe
cumplir SIEMPRE, en cualquier tarea, sin excepción. Si una tarea entra en
conflicto con estas reglas, detente y pide confirmación al usuario antes de
continuar.

El proceso operativo (flujo, puertas, estados, esquema de task files, etiquetas,
hitos y publicación local-first) se documenta en
[`docs/proceso-sdd.md`](docs/proceso-sdd.md); el equipo y sus responsabilidades,
en [`docs/agentes.md`](docs/agentes.md). Si hay discrepancia, mandan este
archivo y `docs/proceso-sdd.md`.

## Reglas generales

Las reglas 5–16 desarrollan el plan §4.2. La regla 14 del plan (prohibición de
`overflow-x: hidden` en `body`/`html` como parche) ya está integrada en la
regla 2, punto 4.

### 1. PRs SIEMPRE contra `dev` (nunca contra `main`)

- Todas las Pull Requests se crean contra la rama de integración `dev`.
- Prohibido crear PRs contra `main` (o pushear directamente a `main`) en
  cualquier circunstancia. El único que promueve `dev` a `main` es el usuario,
  cuando considere que la versión es estable.
- El publisher debe aplicar `--base dev` automáticamente al crear cada PR.

### 2. Responsividad obligatoria

La web debe verse correctamente en ordenador, tablet y móvil, en cualquier
ancho de pantalla.

Criterios obligatorios:

1. No debe existir desplazamiento horizontal a nivel de página en ningún
   ancho. El scroll horizontal solo está permitido dentro de contenedores
   concretos diseñados para ello (p. ej. tablas con `overflow-x: auto`).
2. Ningún texto puede salirse de la pantalla: títulos, fechas, nombres de
   autores y sinopsis largas deben ajustarse a su contenedor
   (`overflow-wrap: break-word`, `min-width: 0` en hijos de flex/grid,
   unidades relativas). No truncar contenido esencial con ellipsis en móvil.
3. Usar unidades relativas (%, rem, em, fr, vw/vh, `minmax()`) para anchos,
   columnas y tipografía de cuerpo. Evitar `px` fijos en contenedores de
   ancho completo.
4. Prohibido usar `overflow-x: hidden` en `body`/`html` como parche: enmascara
   el desbordamiento y puede cortar contenido. Siempre corregir la causa raíz.

Verificación obligatoria cuando la tarea toque HTML, CSS o UI:

1. Probar en al menos tres anchos: ~360 px (móvil), ~768 px (tablet) y
   ~1280 px (ordenador), con el modo dispositivo de DevTools.
2. Confirmar que no hay scroll horizontal:
   `document.documentElement.scrollWidth <= window.innerWidth` en consola
   (debe ser true).
3. Probar con contenido largo realista: títulos largos, fechas, URLs o
   palabras sin espacios.

### 3. Manual de usuario siempre actualizado

El manual de usuario es obligatorio en cuanto exista la primera funcionalidad
visible y explica, en lenguaje no técnico y para cualquier usuario, todo lo que
se puede hacer en la web (estados, acciones, ajustes, búsqueda, frecuencias de
actualización, etc.). Su ruta prevista y su mantenimiento se documentan en
[`docs/proceso-sdd.md`](docs/proceso-sdd.md).

- **Cualquier cambio que afecte a lo que el usuario ve o hace** (nuevas
  funciones, cambios de comportamiento, textos, estados, ajustes,
  frecuencias de actualización de datos...) **debe reflejarse en el manual**
  en la misma tarea que lo implementa: añadiendo, corrigiendo o eliminando
  la sección/subsección pertinente.
- Los cambios puramente internos (refactors, optimizaciones, seguridad)
  que no alteren la experiencia del usuario no requieren tocar el manual.
- El manual debe estar siempre al día con el comportamiento real de la web;
  una PR que cambie algo visible para el usuario sin actualizarlo quedará
  incompleta.
- Mientras el manual no exista, el task file debe dejar constancia de cómo se
  cubrirá el manual para ese cambio visible.

### 4. Visualización correcta en los dos modos de tema

La web tiene **dos modos de visualización**: Claro y Oscuro (decisión
D-002 del registro de decisiones). El tema claro usa `--paper` como
superficie y `--ink` como texto; el tema oscuro invierte esos papeles,
con los overrides por elemento agrupados en los estilos globales.

**Cualquier cosa nueva que se añada a la web** (componente, elemento,
pantalla, color, variable CSS...) **debe cumplir siempre la visualización
en ambos modos**:

1. Verificar el elemento nuevo en los **dos modos** (no solo en el que
   se está tocando), incluso si el cambio parece aislado a uno.
2. Revisar que ninguna superficie o texto quede **invisible ni con
   contraste insuficiente** en ningún modo (mínimo WCAG AA: 4.5:1 para
   texto normal, 3:1 para texto grande y componentes gráficos).
3. Si el elemento usa variables de tema (`--ink`, `--paper`,
   `--ink-raised`, `--paper-dim`, `--white`, alfas, estados), comprobar
   los **dos papeles que juega cada variable** según el tema (fondo o
   texto) y añadir el override correspondiente
   (`[data-theme="light"]` y `[data-theme="dark"]`) siguiendo el patrón
   de **selectores agrupados** existente, con una sola fuente de verdad
   por regla.
4. Los colores hardcodeados deben ir documentados con un comentario que
   explique por qué no usan variable y comprobarse en ambos temas.

Una PR que añada algo nuevo sin comprobar (o sin corregir) los dos modos
quedará incompleta.

### 5. Publisher local-first

- El modo por defecto del publisher es **local**: crea o reutiliza una rama,
  hace el commit y muestra el diff, los comandos de prueba y el resultado. **No
  hace push ni abre una PR** sin confirmación explícita del usuario.
- Publicar exige una petición explícita de publicación («publica», «sube»,
  «abre la PR» o equivalente). Un «ok» o un «adelante» genérico no bastan: hay
  que preguntar antes de publicar.
- Las PRs se crean siempre contra `dev` y sin keywords de cierre (`Closes #N`,
  `Fixes #N`). La issue se cierra al fusionar la PR, no al crearla.
- Nunca se hace push directo a `main` ni se abre una PR contra `main`; solo el
  usuario promueve `dev` a `main`.
- Los detalles de los modos, precondiciones y comandos están en
  [`docs/proceso-sdd.md`](docs/proceso-sdd.md).

### 6. Solo servicios gratuitos

- El coste objetivo es **0 €/mes**: hosting, base de datos, almacenamiento,
  autenticación, correo, analítica, fuentes y cualquier otro servicio deben
  caber en planes gratuitos.
- Cualquier excepción requiere aprobación explícita del usuario y un ADR que
  documente coste, límites, alternativas y ruta de salida.
- No se añaden dependencias ni servicios de pago por conveniencia ni para
  evitar trabajo de implementación.

### 7. Datos privados y portables

- No hay contenido público por defecto. Todo dato requiere sesión y permisos.
- RLS activo en todas las tablas de contenido. Las Server Actions vuelven a
  comprobar el permiso: RLS es la última línea, no la única.
- Los datos deben poder exportarse e importarse en formatos abiertos (JSON y
  assets para un mundo completo) y la cuenta debe poder exportarse y eliminarse.
- El bucket de archivos es privado; el servidor comprueba la membresía y firma
  URLs de corta duración. Las claves solo viven en el servidor.
- No se usa telemetría invasiva ni se recogen datos personales innecesarios.
- Las migraciones y el modelo de datos evitan dependencias propietarias que
  impidan migrar de proveedor.

### 8. Issue-first

- Toda funcionalidad nueva nace de una issue con contexto, alcance, criterios de
  aceptación, dependencias, labels y una variante de modelo recomendada
  (`variant: *`).
- Una issue, un task file: `tasks/task-issue-<N>.json`. Las tareas internas
  pequeñas pueden usar un task file local sin issue.
- Si falta una decisión, la issue se marca `needs-decision` y el trabajo se
  detiene hasta que el usuario la resuelva.

### 9. Definition of Done

- Ninguna tarea se considera terminada si no cumple la Definition of Done de
  este archivo y deja evidencia en su task file.
- «Funciona en mi máquina» no es evidencia. La evidencia es la checklist
  cumplida, las pruebas ejecutadas y la documentación actualizada.
- La variante documental de la Definition of Done se aplica a tareas que solo
  tocan documentación, agentes o configuración de proceso.

### 10. Dependencias justificadas

- Toda dependencia debe justificar su tamaño, licencia, mantenimiento,
  seguridad y alternativa gratuita.
- Se evita duplicar funcionalidad ya disponible en el stack y añadir librerías
  propietarias o con licencias incompatibles.
- El lockfile se versiona y las auditorías de dependencias forman parte de la
  calidad.

### 11. Español en la interfaz e identificadores en inglés

- La interfaz y los textos de usuario van en **español** durante el MVP.
- Los identificadores de código, base de datos, ramas y labels van en
  **inglés**; los comentarios y la documentación, en español.
- Todos los textos visibles están centralizados y tipados. No se escriben
  cadenas de interfaz dispersas en componentes.
- Fechas, números, plurales y formatos usan `Intl` y el `locale` del perfil.

### 12. Sin secretos en el repositorio

- Prohibido incluir claves, tokens, contraseñas, correos reales, URLs privadas
  o credenciales en código, documentación, task files, capturas, logs o
  ejemplos.
- Los archivos `.env*` quedan fuera de git y las claves solo viven en las
  variables de entorno del servidor.
- Los ejemplos usan valores ficticios y evidentes (`abc1234`, `#0`, rutas de
  ejemplo).
- Ante una fuga: detente, no commitees, avisa al usuario, rota la credencial y
  documenta el incidente.
- Cuando exista CI (M0-05), gitleaks revisará secretos en el repositorio y en
  las PRs.

### 13. Migraciones reversibles

- Las migraciones están versionadas, se revisan y documentan su reversión o
  rollback.
- Nunca se edita una migración ya aplicada: se crea una nueva que corrija o
  amplíe.
- Los cambios de RLS, permisos o datos sensibles incluyen pruebas y, si son
  destructivos, backup previo y plan de recuperación.

### 14. Accesibilidad AA y movimiento reducido

- Toda pantalla y componente cumple WCAG AA: 4.5:1 para texto normal y 3:1 para
  texto grande y componentes gráficos.
- Navegación completa por teclado, foco visible, HTML semántico, etiquetas y
  errores asociados en formularios, y `aria-live` para estados relevantes.
- Se respeta `prefers-reduced-motion`: ninguna animación esencial o molesta
  cuando el usuario pide movimiento reducido.
- axe no debe reportar errores críticos en las pantallas y componentes
  principales.

### 15. Acceso y roles por mundo

- La allowlist concede acceso a la **aplicación**; no concede acceso a los
  mundos de otras personas.
- La pertenencia a un mundo concede acceso a ese mundo con rol `owner`,
  `editor` o `viewer`.
- Cualquier usuario autorizado puede crear sus propios mundos y es su
  propietario.
- El `owner` gestiona miembros y roles; no puede perderse ni eliminarse a sí
  mismo sin transferir antes la propiedad.
- Las invitaciones son de un solo uso, ligadas al correo y con caducidad.
- El service role de Supabase solo se usa en el servidor y nunca se expone al
  cliente.

### 16. Internacionalización centralizada y tipada

- Todos los textos de interfaz viven en mensajes centralizados con claves
  tipadas; los componentes no contienen cadenas visibles hardcodeadas.
- El MVP está en español, con la estructura preparada para añadir inglés e
  italiano sin refactorizar componentes.
- Se evitan concatenaciones frágiles para construir frases visibles; los
  plurales y formatos se resuelven con las utilidades de i18n.

## Definition of Ready

Una tarea solo puede empezar cuando se cumple esta checklist y la evidencia
queda registrada en la issue o en el task file:

- [ ] La issue está abierta y tiene contexto, alcance y criterios de aceptación
      verificables.
- [ ] Las dependencias están identificadas y resueltas o planificadas.
- [ ] Tiene exactamente un `type:`, un `status:`, un `priority:` y un `size:`,
      al menos un `area:` y un hito.
- [ ] Tiene exactamente un label `variant: default`, `variant: low`,
      `variant: high` o `variant: max`, con la recomendación justificada.
- [ ] No tiene `needs-decision`, o la decisión ya está tomada y registrada.
- [ ] La decisión técnica está tomada o existe un ADR cuando corresponde.
- [ ] Existe `tasks/task-issue-<N>.json` con el esquema canónico y estado
      `created` o `planned`.
- [ ] El plan está aprobado antes de implementar.
- [ ] Para tareas documentales: están identificados los documentos afectados,
      las rutas que se crearán y las fuentes que no deben contradecirse.

## Definition of Done

Ninguna tarea se cierra sin cumplir esta checklist. La evidencia se anota en el
task file y en el informe final:

- [ ] Criterios de aceptación cumplidos.
- [ ] Typecheck, lint, tests unitarios y build en verde (cuando existan).
- [ ] E2E del flujo crítico ejecutado (si aplica).
- [ ] Responsive comprobado a ~360, ~768 y ~1280 px, sin scroll horizontal de
      página y con contenido largo realista.
- [ ] Los dos temas (Claro y Oscuro) comprobados, con contraste AA y sin
      elementos invisibles.
- [ ] Accesibilidad revisada: teclado, foco visible, axe sin errores críticos y
      `prefers-reduced-motion`.
- [ ] Manual de usuario actualizado si el cambio es visible (o constancia en el
      task file de cómo se cubrirá mientras el manual no exista).
- [ ] ADR creado si hay una decisión arquitectónica o de producto relevante.
- [ ] Seguridad revisada: secretos, RLS, permisos, subidas y dependencias.
- [ ] Datos exportables e importables si se añade o cambia un modelo de datos.
- [ ] Sin servicios de pago ni dependencias injustificadas.
- [ ] La variante recomendada y la usada están registradas en el task file.
- [ ] Task file actualizado con estados, QA, seguridad y documentación.
- [ ] Coste de contexto revisado: no se cambió de modelo ni de variante a mitad
      de sesión ni se editaron `AGENTS.md` o los agentes mientras se usaban
      (ADR 0015).
- [ ] Cambio en `review` para la revisión local del usuario, o PR fusionada en
      `dev` si ya se publicó.

### Variante documental

Para tareas que solo tocan documentación, agentes o configuración de proceso:

- [ ] Todos los JSON modificados son válidos (`ConvertFrom-Json` en PowerShell).
- [ ] Los enlaces Markdown locales resuelven a rutas existentes; las rutas
      previstas se mencionan como código, no como enlaces.
- [ ] No se presentan como existentes rutas, scripts, workflows, labels,
      hitos o estados que no existan en este repositorio, ni se referencian
      aplicaciones o automatizaciones ajenas. Las rutas previstas se citan como
      código y con la issue que las creará.
- [ ] Los estados, labels y hitos coinciden literalmente con
      `docs/proceso-sdd.md` y con los agentes operativos que los referencien;
      `docs/agentes.md` se revisa solo para equipo, responsabilidades e
      invocación.
- [ ] Los bloques de código Markdown están cerrados y `git diff --check` no
      reporta errores.
- [ ] El task file refleja los campos `documentation.adr`,
      `documentation.manual`, `documentation.changelog` y `documentation.agents`.
- [ ] Si el cambio no es visible para el usuario, el task file indica
      `"manual": "no aplica"` con justificación.

## Flujo SDD (resumen)

El flujo completo, las puertas y su evidencia están en
[`docs/proceso-sdd.md`](docs/proceso-sdd.md). En resumen:

```text
Issue (label ai + status: todo + variant: *)
  → adopción y task file en tasks/task-issue-<N>.json
  → plan aprobado
  → implementación
  → QA (si falla, vuelve a implementación)
  → seguridad (si hay HIGH, vuelve a implementación)
  → documentación (ADR, manual, changelog, agentes)
  → publisher local: rama + commit + diff, SIN push
  → revisión del usuario en local
  → publicación explícita: push + PR contra dev, sin keywords de cierre
  → merge en dev → issue cerrada con status: done
  → el usuario promueve dev a main cuando la versión es estable
```

Principio **local-first:** el trabajo termina por defecto en una rama y un
commit locales. El estado `review` significa «commit local listo, sin PR»; el
estado `published` significa «PR creada». No existe un estado local `done`: el
cierre se refleja en la issue y el task file se conserva en `published`.

No se saltan puertas. Si QA, seguridad o documentación fallan, se vuelve a la
fase correspondiente. Si falta una decisión, se marca `needs-decision` o
`status: blocked` y se detiene el trabajo.

La orquestación es **proporcional al coste** (ADR 0015): las tareas
documentales o de proceso resuelven QA, seguridad y documentación con el
checklist documental, sin invocar subagentes; el detalle está en la sección 3.2
de [`docs/proceso-sdd.md`](docs/proceso-sdd.md).

## Documentos de referencia

- [`docs/proceso-sdd.md`](docs/proceso-sdd.md): flujo canónico, task files,
  etiquetas, estados, hitos y publicación local-first.
- [`docs/variantes-modelo.md`](docs/variantes-modelo.md): política de variantes
  de modelo por issue, variante fija por subagente, caché de contexto y
  automatización futura.
- [`docs/agentes.md`](docs/agentes.md): equipo de agentes y responsabilidades.
- [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md): plan aprobado y alcance.
- [`docs/registro-decisiones.md`](docs/registro-decisiones.md): decisiones de
  producto y arquitectura.
- [`docs/adr/README.md`](docs/adr/README.md): índice de ADRs con contexto,
  decisión, alternativas, consecuencias y riesgos de free tier.
- [`tasks/task-example.json`](tasks/task-example.json): ejemplo válido del
  esquema de task files.
- `opencode.jsonc` y `.opencode/agents/*.md`: permisos, guardrails y autonomía
  de los agentes.
