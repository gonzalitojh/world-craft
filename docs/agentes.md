# Equipo de agentes de World Craft

> **Estado:** vigente desde el 12/11/2026 (issue [#2](https://github.com/gonzalitojh/world-craft/issues/2), M0-01).
> **Ámbito:** agentes de OpenCode, flujo SDD, etiquetas, estados, task files y publicación.
> **Fuente de verdad:** este documento y los archivos de `.opencode/agents/`. Si cambia un agente, cambian los dos.

## 1. Resumen

World Craft usa un equipo de agentes especializados coordinados por un agente
maestro. El flujo es **issue-first** y **local-first**:

- Toda funcionalidad nace de una issue con criterios de aceptación.
- El agente maestro adopta la issue, crea un task file y coordina el trabajo.
- La implementación se valida (QA), se revisa (seguridad) y se documenta antes
  de darse por terminada.
- El publisher prepara la rama y el commit **en local**. No hace push ni abre
  una PR salvo confirmación explícita del usuario.
- Las PRs van siempre contra `dev`. `main` queda reservada para las versiones
  estables que promueva el usuario.

No hay modo autónomo de CI ni publicación automática. El usuario revisa en
local antes de publicar.

## 2. Auditoría de los agentes heredados

Los agentes iniciales venían de otro proyecto. Se auditó cada uno y se decidió
su continuidad:

| Agente | Decisión | Cambios aplicados |
|---|---|---|
| `sdd-master` | **Mantener y reescribir** | Flujo adaptado a World Craft: labels, hitos, task files y estados reales. Eliminado el modo autónomo de CI. Termina en revisión local por defecto. Ya no usa scripts, workflows ni números de issue de otro proyecto. |
| `publisher` | **Mantener como local-first** | Por defecto crea rama y commit en local, muestra el diff y los comandos, y no hace push ni PR. Solo publica con confirmación explícita. Las PRs van contra `dev` y no llevan keywords de cierre. |
| `task-architect` | **Mantener y adaptar** | Añadidas las restricciones de World Craft: free tiers, Supabase/R2, dos temas, responsive, accesibilidad, datos portables, i18n y ADRs. |
| `tdd-ddd-architect` | **Mantener y adaptar** | TDD pragmático: tests primero en dominio y lógica crítica; sin forzar DDD en CRUDs simples. Alineado con Next.js, Drizzle, Zod, RLS y las pruebas del plan. |
| `qa-reviewer` | **Mantener y adaptar** | Checklist de criterios de aceptación, responsive 360/768/1280, dos temas, contraste AA, axe, Playwright, manual actualizado y Definition of Done. |
| `security-champion` | **Mantener y adaptar** | Añadidos RLS, roles por mundo, R2 privado y URLs firmadas, Supabase Auth, CSP, subidas, dependencias, secretos y free tiers. |
| `documentation-sync` | **Mantener y adaptar** | ADRs en `docs/adr/`, manual de usuario, changelog, arquitectura y este documento. Verifica que todo cambio visible actualice el manual. |
| `ui-ux-designer` | **Crear** | Nuevo agente para tokens, componentes, temas, responsive, accesibilidad y revisión visual. Cubre el hueco de diseño del equipo anterior. |
| `content-curator` | **No crear todavía** | Se cubrirá con un skill cuando empiece M4-02. Ver la justificación en la sección 9. |

### Referencias eliminadas

Se quitaron de todos los agentes:

- Referencias a otro repositorio y a su URL.
- Scripts y workflows que no existen en este proyecto.
- Números de issue y ADRs ajenos.
- El modo autónomo de CI y las sesiones sin usuario interactivo.
- La obligación de hacer push y abrir PR automáticamente.
- Cualquier instrucción que asuma que la rama por defecto es `main` para cerrar
  issues: las PRs van a `dev` y el cierre se gestiona al fusionar.

## 3. Equipo resultante

| Agente | Modo | Responsabilidad |
|---|---|---|
| `sdd-master` | `primary` | Punto de entrada obligatorio. Adopta issues, crea task files, orquesta planificación, implementación, QA, seguridad, documentación y publisher local. Sincroniza labels y estados. |
| `task-architect` | `subagent` | Plan técnico: arquitectura, pasos, riesgos, pruebas, estimación y preguntas abiertas. |
| `tdd-ddd-architect` | `subagent` | Implementación con TDD pragmático, principios SOLID y diseño por dominio cuando aporta valor. |
| `qa-reviewer` | `subagent` | Revisión de criterios de aceptación, casos límite, responsive, temas, accesibilidad, pruebas y manual. |
| `security-champion` | `subagent` | Escaneo de secretos, credenciales y datos sensibles; revisión de RLS, R2, auth, CSP y subidas. |
| `documentation-sync` | `subagent` | ADRs, manual de usuario, changelog, arquitectura y coherencia documental. |
| `publisher` | `subagent` | Rama + commit + diff en local. Push y PR solo con confirmación explícita. |
| `ui-ux-designer` | `subagent` | Sistema de diseño, tokens, componentes, dos temas, responsive, accesibilidad y revisión visual. |

## 4. Flujo SDD

```text
Issue abierta con label "ai" y "status: todo"
  → adopción: comprobar labels, crear tasks/task-issue-N.json
  → planificación (task-architect)
  → implementación (tdd-ddd-architect; ui-ux-designer si hay UI)
  → QA (qa-reviewer); si falla, vuelve a implementación
  → seguridad (security-champion); si hay HIGH, vuelve a implementación
  → documentación (documentation-sync): ADR, manual, changelog
  → publisher en modo local: rama + commit + diff, SIN push
  → el usuario prueba en local
  → publicación explícita: push + PR a dev (sin keyword de cierre)
  → merge a dev → issue cerrada y status: done
  → el usuario promueve dev a main cuando la versión es estable
```

### Reglas del flujo

1. **Issue-first:** sin issue no se implementa una funcionalidad nueva. Las
   tareas internas pequeñas pueden usar un task file local sin issue.
2. **Una issue, un task file:** `tasks/task-issue-<N>.json`.
3. **No se salta QA, seguridad ni documentación.**
4. **El publisher no publica solo:** el modo por defecto es local.
5. **La issue no se cierra al crear la PR:** se cierra al fusionarla en `dev`.
6. **No se usan keywords de cierre** (`Closes #N`, `Fixes #N`) en las PRs,
   porque el merge va a `dev`, no a la rama por defecto.
7. **Si falta una decisión**, la issue se marca `needs-decision` y se detiene
   el trabajo hasta que el usuario la resuelva.

## 5. Etiquetas, hitos y estados

### Tipos

`type: feature`, `type: bug`, `type: chore`, `type: docs`, `type: design`,
`type: testing`, `type: refactor`, `type: content`.

Cada issue debe tener exactamente un label de tipo. Si falta o está mal
clasificado, el agente maestro lo corrige cuando la clasificación sea evidente;
si hay duda, pregunta.

### Áreas

`area: agents`, `area: architecture`, `area: infra`, `area: data`,
`area: auth`, `area: worlds`, `area: entities`, `area: graph`, `area: maps`,
`area: writing`, `area: game`, `area: search`, `area: ui`, `area: docs`,
`area: security`, `area: qa`.

### Estado

| Estado local del task file | Label de la issue | Cuándo |
|---|---|---|
| `created`, `planned` | `status: todo` | Adoptada pero aún no implementada. |
| `implemented`, `validated`, `security-cleared`, `documented` | `status: in-progress` | Trabajo activo. |
| `review` | `status: needs-review` | Cambio local listo para revisión del usuario. |
| `published` | `status: needs-review` | PR creada y pendiente de merge. |
| `blocked` | `status: blocked` | Falta una decisión o hay fallos repetidos. |
| — | `status: done` | PR fusionada en `dev` e issue cerrada. |

### Prioridad y tamaño

`priority: p0` (bloqueante), `priority: p1` (alta), `priority: p2` (media),
`priority: p3` (baja). Tamaño: `size: s`, `size: m`, `size: l`, `size: xl`.

### Otros labels

- `ai`: lista para ser trabajada por agentes.
- `needs-decision`: requiere una decisión del usuario antes de continuar.
- `future`: backlog, fuera del MVP.

### Hitos

`M0 · Proceso y fundaciones`, `M1 · Núcleo de datos y acceso`,
`M2 · Mapas y grafo`, `M3 · Escritura`, `M4 · Juego creativo`,
`M5 · Calidad y lanzamiento`, `Backlog`.

## 6. Task files

Cada issue adoptada crea un archivo `tasks/task-issue-<N>.json`. Es la fuente
de verdad local del estado del trabajo y se versiona en el repositorio.

```json
{
  "title": "Título de la tarea",
  "description": "Descripción y contexto",
  "status": "planned",
  "issue": {
    "number": 0,
    "url": "https://github.com/gonzalitojh/world-craft/issues/0",
    "title": "Título de la issue"
  },
  "acceptance_criteria": [
    "Criterio 1",
    "Criterio 2"
  ],
  "definition_of_done": [
    "Typecheck, lint, tests y build en verde",
    "Responsive 360/768/1280 sin scroll horizontal",
    "Dos temas comprobados y contraste AA",
    "Manual actualizado si el cambio es visible",
    "ADR si hay decisión arquitectónica"
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

El bloque `pr` se añade **solo** cuando la PR se publica:

```json
{
  "pr": {
    "number": 0,
    "url": "https://github.com/gonzalitojh/world-craft/pull/0",
    "title": "Título de la PR",
    "branch": "chore/issue-0-slug",
    "commit": "abc1234"
  }
}
```

### Estados del task file

```text
created → planned → implemented → validated → security-cleared
  → documented → review → published
                    ↓
                 blocked
```

- `created`: task file recién creado.
- `planned`: plan aprobado.
- `implemented`: código o documentación escritos.
- `validated`: QA superado.
- `security-cleared`: sin hallazgos HIGH.
- `documented`: ADR/manual/changelog actualizados.
- `review`: rama y commit locales listos; pendiente de revisión del usuario.
- `published`: PR creada; pendiente de merge. Cuando la PR se fusiona en `dev`,
  la issue pasa a `status: done` y el task file se conserva en `published`.
- `blocked`: falta una decisión o hay un fallo repetido.

## 7. Publicación local-first

El publisher tiene dos modos.

### Modo `preparar` (por defecto)

1. Identifica la issue y el task file.
2. Crea o reutiliza una rama `<tipo>/issue-<N>-<slug>` desde `dev`.
3. Revisa el diff y descarta cambios ajenos o ruido de fin de línea.
4. Añade solo los archivos de la tarea (nunca `git add .`).
5. Actualiza el task file a `review` antes de commitear.
6. Hace un commit con mensaje convencional.
7. **No hace push ni crea PR.**
8. Informa de la rama, el commit, el diff y los comandos exactos para probar
   y, si el usuario lo pide, publicar.

### Modo `publicar` (solo con confirmación explícita)

Se activa únicamente si el usuario dice algo equivalente a «publica», «sube»,
«abre la PR» o «puedes publicar».

1. Verifica que la rama y el commit existen y que QA, seguridad y
   documentación están completos.
2. Hace `git push -u origin <rama>`.
3. Crea la PR contra `dev` con resumen, issue relacionada, cambios, pruebas y
   ADR. Sin keywords de cierre.
4. Añade el bloque `pr` al task file, lo actualiza a `published` y lo sube en
   un segundo commit a la misma rama.
5. Actualiza la issue a `status: needs-review`, retirando antes los demás
   labels `status: *`.
6. Devuelve la URL de la PR.

### Prohibiciones

- Nunca push directo a `main` ni PR contra `main`.
- Nunca PR sin confirmación explícita.
- Nunca keywords de cierre en el body.
- Nunca `git add .`; usa rutas explícitas.
- Nunca publicar con secretos, credenciales o hallazgos HIGH sin resolver.

## 8. Reglas del proyecto para todos los agentes

Todos los agentes deben cumplir el `AGENTS.md` de la raíz. En resumen:

1. **PRs siempre contra `dev`**, nunca contra `main`.
2. **Responsive obligatorio** a ~360, ~768 y ~1280 px, sin scroll horizontal
   de página. Prohibido `overflow-x: hidden` en `body`/`html` como parche.
3. **Manual de usuario actualizado** en `docs/manual-de-usuario.md` para
   cualquier cambio visible.
4. **Dos temas** (Claro y Oscuro) comprobados, con contraste WCAG AA y
   overrides agrupados.
5. **Accesibilidad AA:** teclado, foco visible, ARIA, `prefers-reduced-motion`.
6. **Solo servicios gratuitos.** Cualquier excepción requiere aprobación y ADR.
7. **Datos privados y portables.** RLS, roles por mundo, exportación/borrado.
8. **Español en la interfaz**, identificadores en inglés y textos centralizados.
9. **Sin secretos en el repo.** `.env*` fuera de git; claves solo en servidor.
10. **Dependencias justificadas** por tamaño, licencia, mantenimiento y
    alternativa gratuita.
11. **Migraciones reversibles y revisadas**; no se edita una migración aplicada.
12. **Issue-first y Definition of Done** del plan.
13. **Sin referencias al proyecto anterior** en agentes, scripts o docs.

## 9. Decisión sobre `content-curator`

No se crea un agente de contenido en M0-01. La curaduría de tablas del juego,
plantillas de entidades y textos de ejemplo es una tarea acotada que empieza
en M4-02. Un **skill** es suficiente por ahora:

- Se carga solo cuando se necesita y no ocupa un agente permanente.
- No requiere orquestación de sesión ni un flujo propio.
- Permite reutilizar el mismo conocimiento desde cualquier agente.
- Si en M4 el volumen crece y aparece un flujo repetitivo con varias fases,
  se puede promover a agente sin romper nada.

Mientras tanto, el contenido se revisa con `documentation-sync` y
`qa-reviewer`, y las decisiones de tono/licencia se registran en un ADR.

## 10. Cómo invocar a los agentes

- **Trabajo normal:** usa `sdd-master` como agente primario. Él decide qué
  subagentes necesita.
- **Planificar:** pide `task-architect`.
- **Implementar o corregir:** pide `tdd-ddd-architect`.
- **Revisar calidad:** pide `qa-reviewer`.
- **Revisar seguridad:** pide `security-champion`.
- **Documentar:** pide `documentation-sync`.
- **Preparar publicación local:** pide `publisher`.
- **Diseñar o revisar UI:** pide `ui-ux-designer`.

Ejemplos:

```text
Usa sdd-master para resolver la issue #12.
Usa ui-ux-designer para revisar el contraste de la pantalla de fichas en los dos temas.
Usa publisher en modo local para preparar la rama y el commit, sin push.
```

## 11. Mantenimiento

- Si se añade, elimina o renombra un agente, actualiza este documento y
  `.opencode/agents/` en la misma tarea.
- Si cambia el flujo, las etiquetas o los estados, actualiza las secciones 4-7.
- Revisa que ningún agente referencie rutas, URLs, workflows o issues que no
  existan en este repositorio.
- Este documento se revisa en M0-02 junto con `AGENTS.md` y el flujo SDD.
