# Proceso SDD de World Craft

> **Estado:** vigente desde el 12/11/2026 (issue [#3](https://github.com/gonzalitojh/world-craft/issues/3), M0-02).
> **Ámbito:** flujo de trabajo, puertas, task files, etiquetas, estados, hitos,
> publicación local-first y mantenimiento documental.
> **Origen:** consolida el plan [`plan-desarrollo.md`](plan-desarrollo.md)
> §4.3–4.6 y §4.8 y las decisiones D-001–D-008 del
> [`registro-decisiones.md`](registro-decisiones.md).

## 1. Autoridad documental y regla de conflicto

World Craft separa las reglas obligatorias, el proceso canónico, el equipo y la
implementación operativa:

| Nivel | Documento | Contenido |
|---|---|---|
| 1 | [`AGENTS.md`](../AGENTS.md) | Reglas obligatorias, Definition of Ready y Definition of Done. |
| 2 | `docs/proceso-sdd.md` | Este documento: flujo, puertas, task files, etiquetas, estados, hitos y publicación. |
| 3 | [`docs/agentes.md`](agentes.md) | Equipo de agentes, responsabilidades e invocación. |
| 4 | `.opencode/agents/*.md` | Implementación operativa de cada agente. |

**Regla de conflicto:**

1. Si una instrucción contradice `AGENTS.md`, mandan las reglas de `AGENTS.md`.
   El agente se detiene y pide confirmación al usuario.
2. Si un agente operativo contradice este documento, manda este documento y se
   corrige el agente en la misma tarea.
3. El plan y el registro de decisiones son la referencia de origen. Si una
   decisión posterior del registro modifica el plan, prevalece la entrada más
   reciente del registro; este documento y los agentes se actualizan para
   reflejarla.
4. Este documento no redefine el alcance del producto: eso corresponde al plan
   aprobado y al registro de decisiones.

## 2. Principios

1. **Issue-first.** Toda funcionalidad nace de una issue con contexto, alcance,
   criterios de aceptación, dependencias y labels. Las tareas internas pequeñas
   pueden usar un task file local sin issue.
2. **Local-first.** El trabajo termina por defecto en una rama y un commit
   locales. No hay push ni PR sin confirmación explícita del usuario.
3. **Una issue, un task file.** Cada tarea tiene un único task file que refleja
   su estado real.
4. **No se saltan puertas.** Planificación, implementación, QA, seguridad,
   documentación y revisión local son obligatorias.
5. **Trazabilidad.** La issue, el task file, la rama, el commit y la PR cuentan
   la misma historia.
6. **La documentación es parte del trabajo.** No es una fase opcional ni un
   arreglo posterior.
7. **Coste cero, privacidad y portabilidad.** Todo servicio cabe en un plan
   gratuito; los datos son privados, exportables y recuperables.
8. **Sin referencias muertas.** No se presentan como existentes rutas, scripts,
   workflows, labels, hitos o estados que no existan en este repositorio. Las
   rutas previstas se citan como código y con la issue que las creará.

## 3. Flujo y puertas

### 3.1 Flujo completo

```text
Issue abierta (label ai + status: todo)
  → adopción: comprobar labels y crear tasks/task-issue-<N>.json
  → planificación (task-architect)
  → implementación (tdd-ddd-architect; ui-ux-designer si hay UI)
  → QA (qa-reviewer); si falla, vuelve a implementación
  → seguridad (security-champion); si hay HIGH, vuelve a implementación
  → documentación (documentation-sync): ADR, manual, changelog, agentes
  → publisher en modo preparar: rama + commit + diff, SIN push
  → revisión del usuario en local
  → publicación explícita: push + PR contra dev, sin keywords de cierre
  → merge en dev → issue cerrada con status: done
  → el usuario promueve dev a main cuando la versión es estable
```

No existe un modo autónomo de CI ni publicación automática. El usuario revisa
en local antes de publicar.

### 3.2 Puertas

| Transición | Responsable | Evidencia |
|---|---|---|
| Issue → adopción | `sdd-master` | Issue abierta con `ai`; labels corregidos; `tasks/task-issue-<N>.json` creado con estado `created`. |
| `created` → `planned` | `sdd-master` + `task-architect` | Plan escrito en el campo `plan`; alcance, riesgos, pruebas e impacto documental; aprobación del usuario registrada en `validation`. |
| `planned` → `implemented` | `tdd-ddd-architect` (+ `ui-ux-designer`) | Diff implementado; pruebas y comprobaciones locales ejecutadas; task file actualizado. |
| `implemented` → `validated` | `qa-reviewer` | Informe de QA con criterios, responsive, temas, accesibilidad y manual; `qa.result` = `PASS`. |
| `validated` → `security-cleared` | `security-champion` | Informe de seguridad; sin hallazgos HIGH; `security.result` = `PASS` y `findings` actualizados. |
| `security-cleared` → `documented` | `documentation-sync` | ADR, manual, changelog, `AGENTS.md`, `docs/proceso-sdd.md`, `docs/agentes.md` o `docs/arquitectura.md` actualizados según aplique; campos `documentation.*` completos. |
| `documented` → `review` | `publisher` en modo `preparar` | Rama local, commit y diff; comandos de prueba; sin push ni PR. |
| `review` → `published` | `publisher` en modo `publicar` | Confirmación explícita del usuario; PR contra `dev`; bloque `pr` añadido; issue en `status: needs-review`. |
| `published` → issue cerrada | Usuario (merge) + `sdd-master` | PR fusionada en `dev`; issue cerrada con `status: done`; task file conservado en `published`. |
| Cualquier estado → `blocked` | `sdd-master` | Motivo escrito en el task file; label `status: blocked`; `needs-decision` si falta una decisión. |
| `blocked` → estado anterior | `sdd-master` | Decisión del usuario registrada o fallo resuelto; se retira `status: blocked` y se reanuda desde la última puerta superada. |

### 3.3 Camino bloqueado y reanudación

- `blocked` no es un estado final. Se usa cuando falta una decisión del usuario
  o cuando un fallo se repite y no se puede avanzar.
- Si falta una decisión, se añade `needs-decision` además del estado
  `status: blocked`. La decisión se registra en el task file (`validation.notes`)
  y, si es arquitectónica, en un ADR.
- Al reanudar, se retira `status: blocked` y se vuelve al último estado
  superado. No se reinicia el trabajo desde cero ni se borra el historial.
- Si el bloqueo afecta a una regla de `AGENTS.md`, el agente se detiene y pide
  confirmación antes de continuar.

### 3.4 Significado de `review` y `published`

- **`review`**: existe una rama y un commit locales, pero **no hay PR**. El
  usuario puede probar el cambio en su máquina. Es el estado por defecto al
  terminar una tarea.
- **`published`**: la rama se ha subido y existe una PR contra `dev`. La issue
  sigue abierta hasta el merge.
- **No existe un estado local `done`.** Cuando la PR se fusiona en `dev`, la
  issue pasa a `status: done` y se cierra; el task file se conserva en
  `published` como registro histórico.

## 4. Task files

### 4.1 Nombres

| Archivo | Uso |
|---|---|
| `tasks/task-issue-<N>.json` | Tarea asociada a una issue de GitHub. `<N>` es el número de la issue. |
| `tasks/task-local-<slug>.json` | Tarea interna pequeña sin issue. `<slug>` es un identificador en kebab-case. |
| `tasks/task-example.json` | Ejemplo ficticio y válido del esquema. No corresponde a ninguna tarea real. |

El ejemplo canónico es
[`tasks/task-example.json`](../tasks/task-example.json). Cualquier tarea nueva
debe ser coherente con él y con este apartado.

### 4.2 Esquema

Plantilla de creación (`status: created`, sin bloque `pr`):

```json
{
  "title": "Título de la tarea",
  "description": "Contexto, alcance y referencia a la issue",
  "status": "created",
  "issue": {
    "number": 0,
    "url": "https://github.com/gonzalitojh/world-craft/issues/0",
    "title": "Título de la issue"
  },
  "acceptance_criteria": [
    "Criterio verificable"
  ],
  "definition_of_done": [
    "Elemento de la Definition of Done"
  ],
  "plan": "Resumen del plan aprobado",
  "validation": {
    "result": "pendiente",
    "date": null,
    "notes": ""
  },
  "qa": {
    "result": "pendiente",
    "notes": ""
  },
  "security": {
    "result": "pendiente",
    "findings": [],
    "notes": ""
  },
  "documentation": {
    "adr": null,
    "manual": "no aplica",
    "changelog": null,
    "agents": null
  }
}
```

Esta plantilla es la de creación: `status: created` y **sin** bloque `pr`. El
bloque `pr` se añade solo cuando la PR ya existe.

#### Bloque `pr` (solo tras publicar)

```json
{
  "pr": {
    "number": 0,
    "url": "https://github.com/gonzalitojh/world-craft/pull/0",
    "title": "Título de la PR",
    "branch": "docs/issue-0-slug",
    "commit": "abc1234"
  }
}
```

El ejemplo publicado completo, con `status: published` y el bloque `pr`, está
en [`tasks/task-example.json`](../tasks/task-example.json).

### 4.3 Campos, tipos y valores permitidos

| Campo | Tipo | Obligatorio | Valores permitidos |
|---|---|---|---|
| `title` | string | Sí | Título breve de la tarea. |
| `description` | string | Sí | Contexto, alcance y relación con la issue. |
| `status` | string | Sí | `created`, `planned`, `implemented`, `validated`, `security-cleared`, `documented`, `review`, `published`, `blocked`. |
| `issue` | object | Sí en `task-issue-<N>`; omitido en `task-local-<slug>` | `number` (entero), `url` (URL de GitHub), `title` (string). |
| `acceptance_criteria` | string[] | Sí | Al menos un criterio verificable. |
| `definition_of_done` | string[] | Sí | Al menos un elemento comprobable. |
| `plan` | string | Sí | Puede estar vacío solo en `created`. |
| `validation.result` | string | Sí | `pendiente`, `user-approved`, `user-validated`. Se recomienda `user-approved` en archivos nuevos; `user-validated` se conserva por compatibilidad con tareas anteriores. |
| `validation.date` | string o null | Sí | `YYYY-MM-DD` o `null` si está pendiente. |
| `validation.notes` | string | Sí | Decisión o comentario del usuario; vacío si está pendiente. |
| `qa.result` | string | Sí | `pendiente`, `PASS`, `FAIL`. |
| `qa.notes` | string | Sí | Resumen del informe de QA. |
| `security.result` | string | Sí | `pendiente`, `PASS`, `FAIL`. |
| `security.findings` | string[] | Sí | Hallazgos con severidad y estado; vacío si no hay. |
| `security.notes` | string | Sí | Resumen del escaneo. |
| `documentation.adr` | string o null | Sí | Ruta del ADR o `null` si no aplica. |
| `documentation.manual` | string | Sí | Ruta del manual, `pendiente` o `no aplica`. |
| `documentation.changelog` | string o null | Sí | Ruta o entrada del changelog; `null` si no aplica o no existe. |
| `documentation.agents` | string o null | Sí | Ruta del documento de agentes actualizado; `null` si no aplica. |
| `pr.number` | integer | Solo tras publicar | Número de la PR. |
| `pr.url` | string | Solo tras publicar | URL de la PR. |
| `pr.title` | string | Solo tras publicar | Título de la PR. |
| `pr.branch` | string | Solo tras publicar | Rama publicada. |
| `pr.commit` | string | Solo tras publicar | SHA corto del commit publicado. |

No se inventan campos nuevos sin actualizar este documento. Los campos
desconocidos de un task file existente se conservan al actualizarlo.

### 4.4 Reglas de actualización

1. El task file se crea al adoptar la tarea, con `status: created`.
2. Se actualiza en cada transición de estado, en la misma tarea que la provoca.
   No se deja desactualizado ni se avanza una puerta sin reflejarla.
3. `pr` se añade **solo** después de crear la PR. Nunca antes.
4. No se elimina historial ni se reescriben resultados anteriores. Los informes
   de QA y seguridad se resumen, no se borran.
5. `blocked` se documenta con el motivo en `notes`; al reanudar se vuelve al
   último estado superado.
6. Tras el merge, el task file se conserva en `published` como registro. La
   issue se cierra con `status: done`; no se inventa un estado local `done`.
7. Los task files de tareas cerradas no se reescriben salvo para corregir un
   error tipográfico evidente, y nunca para cambiar la historia de la tarea.

## 5. Etiquetas, estados e hitos

La taxonomía es **cerrada**. No se crean labels, estados ni hitos nuevos sin
actualizar este documento y el repositorio, con aprobación del usuario.

### 5.1 Tipos

`type: feature`, `type: bug`, `type: chore`, `type: docs`, `type: design`,
`type: testing`, `type: refactor`, `type: content`.

Cada issue tiene **exactamente un** label de tipo. Si falta o está claramente
mal clasificado, `sdd-master` lo corrige; si hay duda, pregunta.

### 5.2 Áreas

`area: agents`, `area: architecture`, `area: infra`, `area: data`,
`area: auth`, `area: worlds`, `area: entities`, `area: graph`, `area: maps`,
`area: writing`, `area: game`, `area: search`, `area: ui`, `area: docs`,
`area: security`, `area: qa`.

Cada issue tiene **al menos un** área.

### 5.3 Estados

| Estado local del task file | Label de la issue | Cuándo |
|---|---|---|
| `created`, `planned` | `status: todo` | Adoptada, aún no implementada. |
| `implemented`, `validated`, `security-cleared`, `documented` | `status: in-progress` | Trabajo activo. |
| `review` | `status: needs-review` | Commit local listo, sin PR. |
| `published` | `status: needs-review` | PR creada, pendiente de merge. |
| `blocked` | `status: blocked` | Falta una decisión o hay un fallo repetido. |
| — | `status: done` | PR fusionada en `dev` e issue cerrada. |

Cada issue tiene **exactamente un** label de estado. Antes de añadir uno, se
retiran los demás `status: *`. `status: done` no se usa hasta el merge.

### 5.4 Prioridad y tamaño

- Prioridad: `priority: p0` (bloqueante), `priority: p1` (alta),
  `priority: p2` (media), `priority: p3` (baja).
- Tamaño: `size: s`, `size: m`, `size: l`, `size: xl`.

Cada issue tiene **exactamente una** prioridad y **exactamente un** tamaño.

### 5.5 Otros labels

- `ai`: la issue está lista para ser trabajada por agentes.
- `needs-decision`: requiere una decisión del usuario antes de continuar. Es
  una **bandera**, no un estado: no sustituye a `status: *`.
- `future`: backlog, fuera del MVP.

### 5.6 Hitos

- `M0 · Proceso y fundaciones`
- `M1 · Núcleo de datos y acceso`
- `M2 · Mapas y grafo`
- `M3 · Escritura`
- `M4 · Juego creativo`
- `M5 · Calidad y lanzamiento`
- `Backlog`

Cada issue tiene **exactamente un** hito. `Backlog` es el hito de las tareas
fuera del MVP.

### 5.7 Sincronización task file → label

1. Al crear el task file, la issue pasa a `status: todo`.
2. Al empezar la implementación, a `status: in-progress`.
3. Al terminar el commit local, a `status: needs-review`.
4. Al crear la PR, sigue en `status: needs-review`.
5. Al bloquearse, a `status: blocked`.
6. Al fusionar la PR en `dev`, a `status: done` y se cierra la issue.

Si la operación de labels falla por red o rate limit, se anota y se continúa:
el task file sigue siendo la fuente de verdad local.

## 6. Definition of Ready y Definition of Done

Las checklists completas están en [`AGENTS.md`](../AGENTS.md). Este documento
fija la **evidencia** que debe quedar registrada.

### 6.1 Definition of Ready

- Issue abierta, con contexto, alcance, criterios de aceptación, dependencias y
  labels completos.
- Sin `needs-decision`, o con la decisión ya tomada y registrada.
- Task file creado con el esquema de este documento.
- Plan aprobado antes de implementar.
- Para tareas documentales: documentos afectados, rutas previstas y fuentes
  identificadas.

La evidencia de Ready es la propia issue más el task file en `created` o
`planned`, con `validation.result` distinto de `pendiente` cuando ya hay
decisión.

### 6.2 Definition of Done

La evidencia esperada por puerta es:

| Puerta | Evidencia |
|---|---|
| Implementación | Diff revisado; typecheck, lint, tests y build en verde cuando existan. |
| QA | `qa.result` = `PASS`; informe con responsive, temas, accesibilidad y manual. |
| Seguridad | `security.result` = `PASS`; sin HIGH; `findings` actualizados. |
| Documentación | `documentation.*` completo; manual actualizado si el cambio es visible. |
| Revisión local | Rama, commit y comandos de prueba; sin push ni PR. |
| Publicación | PR contra `dev`, bloque `pr` y issue en `status: needs-review`. |
| Merge | Issue cerrada con `status: done`; task file conservado en `published`. |

La estrategia de pruebas del plan §4.7 (Vitest, Testing Library, Playwright,
axe, Lighthouse y gitleaks) se aplica en las puertas de implementación y QA, y
en la de seguridad para el escaneo de secretos.

### 6.3 Variante documental

Además de la checklist de `AGENTS.md`, una tarea documental debe demostrar:

- JSON válido en todos los archivos modificados.
- Enlaces Markdown locales resueltos; las rutas previstas se citan como código,
  no como enlaces.
- No se presentan como existentes rutas, scripts, workflows, labels, hitos o
  estados inexistentes, ni se referencian aplicaciones o automatizaciones
  ajenas. Las rutas previstas se citan como código y con la issue que las
  creará.
- Coherencia literal de estados, labels y hitos entre `AGENTS.md`, este
  documento y los agentes operativos que los referencien. `docs/agentes.md` se
  revisa solo para equipo, responsabilidades e invocación.
- Fences Markdown pares y `git diff --check` limpio.
- Task file con los campos `documentation.*` actualizados.

## 7. Publicación local-first

### 7.1 Modos

| Modo | Cuándo | Qué hace |
|---|---|---|
| `preparar` | Por defecto, tras QA, seguridad y documentación | Rama + commit + diff locales. Sin push ni PR. |
| `publicar` | Solo con confirmación explícita del usuario | Push de la rama, PR contra `dev` y task file en `published`. |

Si no está claro qué modo quiere el usuario, se usa `preparar` y se pregunta
antes de publicar.

### 7.2 Precondiciones

Antes de preparar o publicar:

- QA superado y sin hallazgos HIGH de seguridad.
- Documentación actualizada y registrada en el task file.
- Task file completo y coherente con la issue.
- Diff revisado, sin cambios ajenos ni ruido de fin de línea.
- Sin secretos, credenciales, correos reales ni artefactos de build.
- La rama no es `main` ni `dev`.

### 7.3 Modo `preparar`

1. Comprobar repositorio, rama, estado y últimos commits:
   ```bash
   git status --short
   git branch --show-current
   git log --oneline -5
   ```
2. Reutilizar la rama de la tarea o crearla desde `dev`:
   ```bash
   git fetch origin --prune
   git checkout -b <tipo>/issue-<N>-<slug> origin/dev
   ```
   Si `origin/dev` no existe, detenerse y reportar el error.
3. Revisar el diff y descartar cambios ajenos:
   ```bash
   git diff
   git diff --cached
   git status --short
   ```
4. Actualizar el task file a `review`, completar `qa`, `security` y
   `documentation`, y **no** añadir `pr`.
5. Añadir solo los archivos de la tarea, con rutas explícitas:
   ```bash
   git add <archivo1> <archivo2> ...
   ```
   Nunca `git add .`.
6. Hacer el commit con mensaje convencional:
   ```bash
   git commit -m "docs: descripción breve de la tarea"
   ```
7. **No hacer push ni crear PR.**
8. Informar de la rama, el SHA corto, el diff stat, los comandos de prueba, los
   comandos exactos para publicar y la confirmación de que no se ha subido nada.

### 7.4 Modo `publicar`

1. **Confirmación explícita.** La petición debe estar en el mensaje actual del
   usuario y referirse a publicar. Un «ok», «adelante» o «está bien» genérico
   obliga a preguntar: «¿Quieres que haga push y abra la PR contra `dev`?».
2. Verificar que la rama y el commit existen, que QA, seguridad y documentación
   están completos y que no hay secretos.
3. Subir la rama:
   ```bash
   git push -u origin <rama>
   ```
4. Crear la PR contra `dev`:
   ```bash
   gh pr create --base dev --title "<título>" --body-file <archivo-body>
   ```
   El body incluye resumen, tarea relacionada, cambios, pruebas y ADR. **No**
   incluye keywords de cierre (`Closes #N`, `Fixes #N`).
5. Añadir el bloque `pr`, cambiar el estado a `published`, hacer commit del task
   file y subirlo a la misma rama.
6. Actualizar la issue a `status: needs-review`, retirando los demás labels de
   estado.
7. Devolver la URL de la PR y recordar que la issue se cierra al fusionar.

### 7.5 Post-merge

- La PR se fusiona en `dev`.
- La issue se cierra y pasa a `status: done`.
- El task file se conserva en `published`; no se cambia a un estado local
  `done`.
- Solo el usuario promueve `dev` a `main` cuando considera que la versión es
  estable.

### 7.6 Prohibiciones

- Nunca push directo a `main` ni PR contra `main`.
- Nunca publicar sin confirmación explícita.
- Nunca keywords de cierre en la PR.
- Nunca `git add .`; siempre rutas explícitas.
- Nunca publicar con secretos, credenciales o hallazgos HIGH sin resolver.
- Nunca hacer force push a `dev` o `main`.
- Nunca commitear `.env`, claves, tokens, `node_modules/`, `.next/` ni
  artefactos de build.

## 8. Documentación y mantenimiento

### 8.1 Mapa de documentos

| Documento | Estado | Uso |
|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | Vigente | Reglas obligatorias, Definition of Ready y Definition of Done. |
| `docs/proceso-sdd.md` | Vigente | Proceso canónico, task files, etiquetas, estados, hitos y publicación. |
| [`docs/plan-desarrollo.md`](plan-desarrollo.md) | Vigente | Plan aprobado y alcance. No se reescribe por cada tarea. |
| [`docs/registro-decisiones.md`](registro-decisiones.md) | Vigente | Registro append-only de decisiones de producto y arquitectura. |
| [`docs/agentes.md`](agentes.md) | Vigente | Equipo de agentes y responsabilidades. |
| [`tasks/task-example.json`](../tasks/task-example.json) | Vigente | Ejemplo válido del esquema de task files. |
| `.opencode/agents/*.md` | Vigente | Implementación operativa de cada agente. |
| `docs/adr/` | Previsto | ADRs; los crea M0-03 (issue #4). |
| `docs/manual-de-usuario.md` | Previsto | Manual funcional. Su creación formal corresponde a M5-01 (issue #28), pero cualquier funcionalidad visible anterior debe actualizarlo y dejar constancia en el task file. |
| `docs/arquitectura.md` | Previsto | Mapa de módulos y flujos; documentación base M0-09 (issue #10). |
| `README.md` | Previsto | Arranque local, variables de entorno, scripts y despliegue; documentación base M0-09 (issue #10). |
| `CONTRIBUTING.md` | Previsto | Flujo, ramas, commits y calidad; documentación base M0-09 (issue #10). |
| `CHANGELOG.md` | Previsto | Cambios por versión; se crea con la primera versión o cuando el usuario lo pida. No tiene issue asignada. |

Los documentos previstos se citan como código, no como enlaces, hasta que
existan.

### 8.2 Cuándo actualizar cada documento

- **`AGENTS.md`:** al cambiar reglas obligatorias, Definition of Ready/Done o el
  resumen del flujo.
- **`docs/proceso-sdd.md`:** al cambiar puertas, estados, labels, hitos,
  esquema de task files, modos de publicación o verificación documental.
- **`docs/agentes.md`:** al añadir, eliminar, renombrar o cambiar las
  responsabilidades de un agente, o al cambiar la forma de invocarlos.
- **`.opencode/agents/*.md`:** junto con `AGENTS.md`, `docs/proceso-sdd.md` o
  `docs/agentes.md` según el cambio, para que la implementación operativa no
  derive de la especificación.
- **Manual de usuario (ruta prevista `docs/manual-de-usuario.md`):** en la misma
  tarea que cambia algo visible para el usuario. Su creación formal corresponde
  a M5-01, pero si antes aparece una funcionalidad visible, la tarea que la
  implemente debe crear o actualizar la sección correspondiente y dejar
  constancia en el task file.
- **`docs/adr/`:** ante una decisión de framework, librería, servicio, modelo de
  datos, permisos, almacenamiento, despliegue, temas, i18n, mapas o juego con
  consecuencias técnicas. Un ADR aceptado no se edita para cambiar la decisión:
  se crea otro que lo superseda.
- **`CHANGELOG.md`:** cuando exista y el cambio sea relevante para el usuario o
  el despliegue.
- **`docs/arquitectura.md`:** cuando cambian módulos, dependencias, flujos o
  responsabilidades.
- **`README.md` y `CONTRIBUTING.md`:** cuando cambian el arranque local, las
  variables de entorno, los scripts, el despliegue, las ramas, los commits o la
  calidad.
- **`docs/plan-desarrollo.md`:** solo si cambia el alcance aprobado.
- **`docs/registro-decisiones.md`:** append-only; cada decisión nueva se añade
  sin reescribir las anteriores.

### 8.3 Protocolo de cambio documental

1. Antes de implementar, identificar los documentos afectados y las rutas que se
   crearán.
2. Actualizar la documentación en la misma tarea que el cambio.
3. Verificar enlaces, JSON, fences, referencias antiguas y coherencia de
   estados/labels/hitos.
4. Registrar el resultado en el task file (`documentation.adr`,
   `documentation.manual`, `documentation.changelog`, `documentation.agents`).
5. Si se detecta documentación obsoleta no relacionada con la tarea, anotarla y
   proponer una issue; no corregirla de tapadillo.

## 9. Verificación de tareas documentales

Toda tarea que toque documentación, agentes o proceso debe ejecutar estas
comprobaciones (PowerShell 5.1; Node.js no es un requisito):

```powershell
# 1. JSON válido de todos los task files
Get-ChildItem tasks/task-*.json | ForEach-Object {
  Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null
}

# 2. Enlaces Markdown locales resueltos (documentos canónicos y agentes)
$docs = 'AGENTS.md', 'docs/proceso-sdd.md', 'docs/agentes.md'
$files = @($docs) + @(Get-ChildItem .opencode/agents/*.md | ForEach-Object { $_.FullName })
foreach ($file in $files) {
  $base = Split-Path $file -Parent
  if (-not $base) { $base = '.' }
  $text = Get-Content -Raw $file
  foreach ($m in [regex]::Matches($text, '\]\(([^)]+)\)')) {
    $target = $m.Groups[1].Value
    if ($target -match '^(https?:|#|mailto:)') { continue }
    $path = Join-Path $base (($target -split '#')[0])
    if (-not (Test-Path $path)) { Write-Output "ROTO: $file -> $target" }
  }
}

# 3. Rutas docs/... y tasks/... mencionadas en AGENTS.md
$text = Get-Content -Raw AGENTS.md
foreach ($m in [regex]::Matches($text, '(docs|tasks)/[A-Za-z0-9._/<>-]+')) {
  $path = $m.Value.TrimEnd('.', ',', ';', ':')
  if ($path -match '<|\*') { continue }
  if (-not (Test-Path $path)) { Write-Output "RUTA INEXISTENTE: $path" }
}

# 4. Referencias antiguas en documentos canónicos y agentes
Select-String -Path $files `
  -Pattern 'gh-issue[.]sh|issues-done-on-de[v]|ADR-0(29|64|66)|ocio/ocio[.]css|proyecto anterio[r]|otr[o] proyecto'

# 5. Fences Markdown pares, incluidos los indentados
foreach ($file in $files) {
  $count = (Get-Content $file | Where-Object { $_ -match '^\s*```' }).Count
  if ($count % 2 -ne 0) { Write-Output "FENCES IMPARES: $file ($count)" }
}

# 6. Espacios y conflictos de git, incluidos los archivos nuevos
# Sustituir <archivos nuevos> por las rutas sin trackear de la tarea.
git add -N <archivos nuevos>          # intent-to-add: no stagea contenido
git diff --check
git reset -- <archivos nuevos>        # limpia solo el intent-to-add
```

En el paso 6, si no hay archivos nuevos se ejecuta solo `git diff --check`. Si
ya había contenido stageado antes de la comprobación, `git reset -- <archivos
nuevos>` no lo altera porque limita el reset a esas rutas.

Además, se revisa manualmente que los estados, labels y hitos coincidan
literalmente entre `AGENTS.md`, este documento y todos los agentes operativos
que los referencien (`.opencode/agents/*.md`); `docs/agentes.md` se revisa solo
para equipo, responsabilidades e invocación.

## 10. Historial de cambios

| Fecha | Issue | Cambio |
|---|---|---|
| 2026-11-12 | #3 (M0-02) | Versión inicial. Consolida el plan §4.3–4.6 y §4.8, las decisiones D-001–D-008 y la revisión de `AGENTS.md` y del flujo SDD. |
