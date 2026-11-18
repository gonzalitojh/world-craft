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

### 1. PRs SIEMPRE contra `dev` (nunca contra `main`)

- Todas las Pull Requests se crean contra la rama de integración `dev`.
- Prohibido crear PRs contra `main` (o pushear directamente a `main`) en
  cualquier circunstancia. El único que promueve `dev` a `main` es el usuario,
  cuando considere que la versión es estable.
- El publisher debe aplicar `--base dev` automáticamente al crear cada PR.

### 2. Aplicación de escritorio Windows, no web

- World Craft es una **aplicación de escritorio instalable para Windows**. No
  hay versión web, PWA, aplicación móvil ni despliegue en la nube.
- La interfaz se diseña para ratón, teclado y ventanas de escritorio. No se
  añaden requisitos de móvil, tablet, gestos táctiles ni puntos de ruptura web.
- La ventana mínima admitida es **1024×700 px**. A 1024, 1280 y 1600 px de
  ancho no debe haber desplazamiento horizontal a nivel de página; el contenido
  largo debe ajustarse sin truncar información esencial.
- La aplicación debe funcionar sin conexión a Internet. La red solo se usa para
  comprobar actualizaciones cuando el usuario lo permite.

### 3. Los datos del usuario nunca se pierden

- Actualizar, reinstalar o desinstalar la aplicación **no puede borrar** la base
  de datos, los archivos ni las copias de seguridad del usuario.
- Los datos viven en `app.getPath('userData')`, fuera de la carpeta de
  instalación. El instalador y el desinstalador no tocan esa carpeta.
- Cualquier migración de base de datos crea antes una copia de seguridad
  verificable y se ejecuta en una transacción. Si falla, la aplicación arranca
  en modo seguro y ofrece restaurar la copia.
- Las operaciones destructivas (borrar un mundo, vaciar la papelera, eliminar
  todos los datos) exigen confirmación explícita y dejan una copia recuperable.
- Una tarea que pueda afectar a datos existentes incluye una prueba de
  preservación y la evidencia queda en el task file.

### 4. Manual de usuario siempre actualizado

El manual de usuario es obligatorio en cuanto exista la primera funcionalidad
visible y explica, en lenguaje no técnico y para cualquier usuario, todo lo que
se puede hacer en la aplicación (estados, acciones, ajustes, búsqueda, copias de
seguridad, actualizaciones, etc.). Su ruta es
[`docs/manual-de-usuario.md`](docs/manual-de-usuario.md) y su mantenimiento se
documenta en [`docs/proceso-sdd.md`](docs/proceso-sdd.md).

- **Cualquier cambio que afecte a lo que el usuario ve o hace** (nuevas
  funciones, cambios de comportamiento, textos, estados, ajustes, frecuencias de
  actualización...) **debe reflejarse en el manual** en la misma tarea que lo
  implementa.
- Los cambios puramente internos (refactors, optimizaciones, seguridad) que no
  alteren la experiencia del usuario no requieren tocar el manual.
- Mientras una función esté prevista pero no implementada, el manual la marca
  como **prevista** y no la presenta como disponible.

### 5. Visualización correcta en los dos modos de tema

La aplicación tiene **dos modos de visualización**: Claro y Oscuro (decisión
D-007 del registro de decisiones). El tema claro usa `--paper` como superficie y
`--ink` como texto; el tema oscuro invierte esos papeles, con los overrides por
elemento agrupados en los estilos globales.

**Cualquier cosa nueva que se añada** (componente, elemento, pantalla, color,
variable CSS...) **debe cumplir siempre la visualización en ambos modos**:

1. Verificar el elemento nuevo en los **dos modos**, no solo en el que se está
   tocando.
2. Revisar que ninguna superficie o texto quede **invisible ni con contraste
   insuficiente** en ningún modo (mínimo WCAG AA: 4.5:1 para texto normal, 3:1
   para texto grande y componentes gráficos).
3. Si el elemento usa variables de tema, comprobar los **dos papeles que juega
   cada variable** según el tema (fondo o texto) y añadir el override
   correspondiente (`[data-theme="light"]` y `[data-theme="dark"]`) siguiendo el
   patrón de **selectores agrupados** existente, con una sola fuente de verdad
   por regla.
4. Los colores hardcodeados deben ir documentados con un comentario que explique
   por qué no usan variable y comprobarse en ambos temas.

### 6. Publisher local-first

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

### 7. Solo software y servicios gratuitos

- El coste objetivo es **0 €/mes**: herramientas, librerías, fuentes, GitHub y
  cualquier servicio externo deben caber en planes gratuitos o ser de código
  abierto.
- No se añaden dependencias, servicios ni cuentas de pago por conveniencia.
- La única excepción prevista es la **firma de código** de Windows, que es
  opcional, no bloquea el MVP y requiere aprobación explícita del usuario y un
  ADR con coste y ruta de salida. Mientras no se apruebe, el instalador se
  distribuye sin firmar y se documenta el aviso de SmartScreen.
- No se usa telemetría ni analítica de terceros.

### 8. Datos privados, locales y portables

- No hay contenido público ni cuentas: todo vive en el equipo del usuario.
- La base de datos y los archivos están fuera de la carpeta de instalación y
  nunca se suben a un servicio externo.
- Los datos deben poder exportarse e importarse en formatos abiertos (JSON y
  assets para un mundo completo) y la aplicación debe permitir eliminar todos
  los datos con confirmación.
- Las copias de seguridad son locales, verificables y restaurables desde la
  propia aplicación.
- No se recogen datos personales innecesarios ni se envía información de uso.

### 9. Issue-first

- Toda funcionalidad nueva nace de una issue con contexto, alcance, criterios de
  aceptación, dependencias, labels y una variante de modelo recomendada
  (`variant: *`).
- Una issue, un task file: `tasks/task-issue-<N>.json`. Las tareas internas
  pequeñas pueden usar un task file local sin issue.
- Si falta una decisión, la issue se marca `needs-decision` y el trabajo se
  detiene hasta que el usuario la resuelva.

### 10. Definition of Done

- Ninguna tarea se considera terminada si no cumple la Definition of Done de
  este archivo y deja evidencia en su task file.
- «Funciona en mi máquina» no es evidencia. La evidencia es la checklist
  cumplida, las pruebas ejecutadas y la documentación actualizada.
- La variante documental de la Definition of Done se aplica a tareas que solo
  tocan documentación, agentes o configuración de proceso.

### 11. Dependencias justificadas

- Toda dependencia debe justificar su tamaño, licencia, mantenimiento,
  seguridad y alternativa gratuita.
- Se evita duplicar funcionalidad ya disponible en el stack y añadir librerías
  propietarias o con licencias incompatibles.
- El lockfile se versiona y las auditorías de dependencias forman parte de la
  calidad.

### 12. Español en la interfaz e identificadores en inglés

- La interfaz y los textos de usuario van en **español** durante el MVP.
- Los identificadores de código, base de datos, ramas y labels van en
  **inglés**; los comentarios y la documentación, en español.
- Todos los textos visibles están centralizados y tipados. No se escriben
  cadenas de interfaz dispersas en componentes.
- Fechas, números, plurales y formatos usan `Intl` y el `locale` del perfil.

### 13. Sin secretos en el repositorio

- Prohibido incluir claves, tokens, contraseñas, correos reales, URLs privadas
  o credenciales en código, documentación, task files, capturas, logs o
  ejemplos.
- Los archivos `.env*` quedan fuera de git y las claves solo viven en el
  entorno local del desarrollador.
- Los ejemplos usan valores ficticios y evidentes (`abc1234`, `#0`, rutas de
  ejemplo).
- Ante una fuga: detente, no commitees, avisa al usuario, rota la credencial y
  documenta el incidente.
- La CI ejecuta `gitleaks` en el repositorio y en las PRs.

### 14. Migraciones reversibles

- Las migraciones están versionadas, se revisan y documentan su reversión o
  rollback.
- Nunca se edita una migración ya aplicada: se crea una nueva que corrija o
  amplíe.
- Toda migración que pueda afectar a datos existentes crea una copia de
  seguridad previa, se prueba sobre una base temporal y se documenta.
- Los cambios de esquema incluyen pruebas y, si son destructivos, plan de
  recuperación.

### 15. Accesibilidad AA y movimiento reducido

- Toda pantalla y componente cumple WCAG AA: 4.5:1 para texto normal y 3:1 para
  texto grande y componentes gráficos.
- Navegación completa por teclado, foco visible, HTML semántico, etiquetas y
  errores asociados en formularios, y `aria-live` para estados relevantes.
- Se respeta `prefers-reduced-motion`: ninguna animación esencial o molesta
  cuando el usuario pide movimiento reducido.
- axe no debe reportar errores críticos en las pantallas y componentes
  principales.

### 16. Seguridad de Electron

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` y
  `webSecurity: true` en todas las ventanas.
- El renderer no accede a Node, al sistema de archivos ni a la base de datos.
  Solo usa la API tipada expuesta por el preload.
- Todo canal IPC está en una allowlist, valida la entrada con Zod y devuelve un
  resultado tipado; nunca se expone un `invoke` genérico.
- No se carga contenido remoto en la ventana de la aplicación. Los enlaces
  externos se abren en el navegador con `shell.openExternal` y solo con
  protocolos y dominios permitidos.
- La CSP es estricta en producción y no se habilitan DevTools en la versión
  instalada.
- Los assets se sirven con un protocolo propio que valida la ruta y no permite
  escapar de la carpeta de datos.
- El contenido rico se sanitiza; nunca se inyecta HTML sin control.

### 17. Internacionalización centralizada y tipada

- Todos los textos de interfaz viven en mensajes centralizados con claves
  tipadas; los componentes no contienen cadenas visibles hardcodeadas.
- El MVP está en español, con la estructura preparada para añadir inglés e
  italiano sin refactorizar componentes.
- Se evitan concatenaciones frágiles para construir frases visibles; los
  plurales y formatos se resuelven con las utilidades de i18n.

### 18. Ventana de escritorio y contenido largo

- La ventana se puede redimensionar y recordar su tamaño y posición.
- A 1024, 1280 y 1600 px de ancho no hay desplazamiento horizontal de página.
- El desplazamiento horizontal solo se permite dentro de contenedores concretos
  diseñados para ello (tablas, código o el lienzo del mapa).
- Ningún texto se sale de su contenedor: títulos, fechas, nombres de autores,
  sinopsis, rutas y palabras sin espacios usan `overflow-wrap: break-word` y
  `min-width: 0` en hijos de flex/grid.
- No se usa `overflow-x: hidden` en `body`/`html` como parche.

### 19. Funcionamiento offline y sin dependencia de la nube

- La aplicación arranca, lee y escribe sin conexión.
- No hay servidor propio, base de datos remota, autenticación en la nube ni
  almacenamiento remoto.
- Las actualizaciones y la comprobación de versión son la única función que
  puede requerir red, y siempre son opcionales y cancelables.
- Si un servicio externo desaparece, los datos y la aplicación siguen
  funcionando.

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
- [ ] Ventana comprobada a 1024, 1280 y 1600 px, sin scroll horizontal de
      página y con contenido largo realista.
- [ ] Los dos temas (Claro y Oscuro) comprobados, con contraste AA y sin
      elementos invisibles.
- [ ] Accesibilidad revisada: teclado, foco visible, axe sin errores críticos y
      `prefers-reduced-motion`.
- [ ] Seguridad Electron revisada: contexto aislado, IPC validado, CSP, sin
      contenido remoto y sin acceso del renderer a Node.
- [ ] Preservación de datos verificada: actualización, reinicio y migración no
      borran ni corrompen datos; copia y restauración probadas si aplica.
- [ ] Funcionamiento offline comprobado si el cambio toca arranque, datos o
      actualizaciones.
- [ ] Manual de usuario actualizado si el cambio es visible (o constancia en el
      task file de cómo se cubrirá mientras el manual no exista).
- [ ] ADR creado si hay una decisión arquitectónica o de producto relevante.
- [ ] Seguridad revisada: secretos, dependencias, IPC, rutas de archivos y
      contenido no confiable.
- [ ] Datos exportables e importables si se añade o cambia un modelo de datos.
- [ ] Sin servicios de pago ni dependencias injustificadas.
- [ ] La variante recomendada y la usada están registradas en el task file.
- [ ] Task file actualizado con estados, QA, seguridad y documentación.
- [ ] Coste de contexto revisado: no se cambió de modelo ni de variante a mitad
      de sesión ni se editaron `AGENTS.md` o los agentes mientras se usaban
      (ADR 0009).
- [ ] Cambio en `review` para la revisión local del usuario, o PR fusionada en
      `dev` si ya se publicó.

### Variante documental

Para tareas que solo tocan documentación, agentes o configuración de proceso:

- [ ] Todos los JSON modificados son válidos (`ConvertFrom-Json` en PowerShell).
- [ ] Los enlaces Markdown locales resuelven a rutas existentes; las rutas
      previstas se mencionan como código, no como enlaces.
- [ ] No se presentan como existentes rutas, scripts, workflows, labels, hitos o
      estados que no existan en este repositorio.
- [ ] Los estados, labels y hitos coinciden literalmente con
      `docs/proceso-sdd.md` y con los agentes operativos que los referencien.
- [ ] Los bloques de código Markdown están cerrados y `git diff --check` no
      reporta errores.
- [ ] El task file refleja los campos `documentation.adr`,
      `documentation.manual`, `documentation.changelog` y
      `documentation.agents`.
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

La orquestación es **proporcional al coste** (ADR 0009): las tareas documentales
o de proceso resuelven QA, seguridad y documentación con el checklist
documental, sin invocar subagentes; el detalle está en la sección 3.2 de
[`docs/proceso-sdd.md`](docs/proceso-sdd.md).

## Documentos de referencia

- [`docs/proceso-sdd.md`](docs/proceso-sdd.md): flujo canónico, task files,
  etiquetas, estados, hitos y publicación local-first.
- [`docs/variantes-modelo.md`](docs/variantes-modelo.md): política de variantes
  de modelo y caché de contexto.
- [`docs/agentes.md`](docs/agentes.md): equipo de agentes y responsabilidades.
- [`docs/plan-desarrollo.md`](docs/plan-desarrollo.md): plan aprobado y alcance.
- [`docs/registro-decisiones.md`](docs/registro-decisiones.md): decisiones de
  producto y arquitectura.
- [`docs/adr/README.md`](docs/adr/README.md): índice de ADRs con contexto,
  decisión, alternativas, consecuencias y riesgos.
- [`docs/persistencia.md`](docs/persistencia.md): SQLite, migraciones, assets,
  copias y recuperación.
- [`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md): qué se eliminó
  del proyecto web y qué cuentas externas hay que cerrar.
- [`tasks/task-example.json`](tasks/task-example.json): ejemplo válido del
  esquema de task files.
- `opencode.jsonc` y `.opencode/agents/*.md`: permisos, guardrails y autonomía
  de los agentes.
