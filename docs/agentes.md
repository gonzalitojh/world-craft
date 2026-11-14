# Equipo de agentes de World Craft

> **Estado:** vigente desde el 12/11/2026. Revisado en M0-02 (issue
> [#3](https://github.com/gonzalitojh/world-craft/issues/3)) y actualizado en
> M0-13 (issue [#48](https://github.com/gonzalitojh/world-craft/issues/48)) y
> con la variante fija por subagente (ADR 0015, tarea local
> `optimizacion-coste-cache`).
> **Ámbito:** equipo de agentes, responsabilidades e invocación.
> **Jerarquía documental:** [`AGENTS.md`](../AGENTS.md) contiene las reglas
> obligatorias; [`docs/proceso-sdd.md`](proceso-sdd.md) es la fuente canónica del
> proceso; este documento describe el equipo; `.opencode/agents/*.md` es la
> implementación operativa. Si hay discrepancia, mandan `AGENTS.md` y
> `docs/proceso-sdd.md`.

## 1. Resumen

World Craft usa un equipo de agentes especializados coordinados por un agente
maestro. El flujo es **issue-first** y **local-first**: toda funcionalidad nace
de una issue, el trabajo se organiza con un task file, se valida antes de
darse por terminado y termina por defecto en una rama y un commit locales.

No hay modo autónomo de CI ni publicación automática. El flujo completo, las
puertas, los estados, las etiquetas, los hitos y la publicación local-first
están en [`docs/proceso-sdd.md`](proceso-sdd.md). Este documento no los
duplica.

## 2. Auditoría de los agentes iniciales

Esta sección es un **registro histórico no normativo** de la auditoría hecha en
M0-01. No define el flujo vigente; para eso se consultan `AGENTS.md` y
`docs/proceso-sdd.md`.

| Agente | Decisión | Cambios aplicados |
|---|---|---|
| `sdd-master` | **Mantener y reescribir** | Flujo adaptado a World Craft: labels, hitos, task files y estados reales. Eliminado el modo autónomo de CI. Termina en revisión local por defecto. Ya no usa scripts, workflows ni números de issue ajenos a este repositorio. |
| `publisher` | **Mantener como local-first** | Por defecto crea rama y commit en local, muestra el diff y los comandos, y no hace push ni PR. Solo publica con confirmación explícita. Las PRs van contra `dev` y no llevan keywords de cierre. |
| `task-architect` | **Mantener y adaptar** | Añadidas las restricciones de World Craft: free tiers, Supabase/R2, dos temas, responsive, accesibilidad, datos portables, i18n y ADRs. |
| `tdd-ddd-architect` | **Mantener y adaptar** | TDD pragmático: tests primero en dominio y lógica crítica; sin forzar DDD en CRUDs simples. Alineado con Next.js, Drizzle, Zod, RLS y las pruebas del plan. |
| `qa-reviewer` | **Mantener y adaptar** | Checklist de criterios de aceptación, responsive 360/768/1280, dos temas, contraste AA, axe, Playwright, manual actualizado y Definition of Done. |
| `security-champion` | **Mantener y adaptar** | Añadidos RLS, roles por mundo, R2 privado y URLs firmadas, Supabase Auth, CSP, subidas, dependencias, secretos y free tiers. |
| `documentation-sync` | **Mantener y adaptar** | ADRs en `docs/adr/`, manual de usuario, changelog, arquitectura y este documento. Verifica que todo cambio visible actualice el manual. |
| `ui-ux-designer` | **Crear** | Nuevo agente para tokens, componentes, temas, responsive, accesibilidad y revisión visual. Cubre el hueco de diseño del equipo inicial. |
| `content-curator` | **No crear todavía** | Se cubrirá con un skill cuando empiece M4-02. Ver la justificación en la sección 5. |

### Referencias eliminadas

Se quitaron de todos los agentes:

- URLs, scripts y workflows que no existen en este repositorio.
- Números de issue y ADRs ajenos a este repositorio.
- El modo autónomo de CI y las sesiones sin usuario interactivo.
- La obligación de hacer push y abrir PR automáticamente.
- Las instrucciones que asumían `main` como rama de cierre: las PRs van a
  `dev` y el cierre se gestiona al fusionar.

## 3. Equipo resultante

| Agente | Modo | Variante fija | Responsabilidad |
|---|---|---|---|
| `sdd-master` | `primary` | la de la sesión | Punto de entrada obligatorio. Adopta issues, crea task files, orquesta planificación, implementación, QA, seguridad, documentación y publisher local. Sincroniza labels y estados. |
| `task-architect` | `subagent` | `high` | Plan técnico: arquitectura, pasos, riesgos, pruebas, estimación y preguntas abiertas. |
| `tdd-ddd-architect` | `subagent` | `high` | Implementación con TDD pragmático, principios SOLID y diseño por dominio cuando aporta valor. |
| `qa-reviewer` | `subagent` | `low` | Revisión de criterios de aceptación, casos límite, responsive, temas, accesibilidad, pruebas y manual. |
| `security-champion` | `subagent` | `high` | Escaneo de secretos, credenciales y datos sensibles; revisión de RLS, R2, auth, CSP y subidas. |
| `documentation-sync` | `subagent` | `low` | ADRs, manual de usuario, changelog, arquitectura y coherencia documental. |
| `publisher` | `subagent` | `low` | Rama + commit + diff en local. Push y PR solo con confirmación explícita. |
| `ui-ux-designer` | `subagent` | `high` | Sistema de diseño, tokens, componentes, dos temas, responsive, accesibilidad y revisión visual. |

Las variantes fijas se declaran en el frontmatter de cada agente y no heredan la
de la sesión (ADR 0015; motivo de cada una en
[`docs/variantes-modelo.md`](variantes-modelo.md), sección 5). `sdd-master` sigue
la variante que el usuario seleccione para la sesión, según el label
`variant: *` de la issue.

## 4. Flujo, etiquetas y publicación

El proceso no se redefine aquí. Resumen:

```text
issue → adopción (variante incluida) y task file → plan → implementación → QA → seguridad
  → documentación → publisher local → revisión del usuario → publicación
  explícita → PR a dev → merge → issue done
```

| Si necesitas... | Consulta |
|---|---|
| Flujo, puertas, camino bloqueado y reanudación | [`docs/proceso-sdd.md`](proceso-sdd.md), sección 3 |
| Esquema y nombres de task files | [`docs/proceso-sdd.md`](proceso-sdd.md), sección 4, y [`tasks/task-example.json`](../tasks/task-example.json) |
| Etiquetas, estados, prioridad, tamaño e hitos | [`docs/proceso-sdd.md`](proceso-sdd.md), sección 5 |
| Definition of Ready y Definition of Done | [`AGENTS.md`](../AGENTS.md) |
| Publicación local-first y prohibiciones | [`docs/proceso-sdd.md`](proceso-sdd.md), sección 7 |
| Reglas obligatorias del proyecto | [`AGENTS.md`](../AGENTS.md) |

## 5. Decisión sobre `content-curator`

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

## 6. Cómo invocar a los agentes

- **Trabajo normal:** usa `sdd-master` como agente primario. Él decide qué
  subagentes necesita.
- **Planificar:** pide `task-architect`.
- **Implementar o corregir:** pide `tdd-ddd-architect`.
- **Revisar calidad:** pide `qa-reviewer`.
- **Revisar seguridad:** pide `security-champion`.
- **Documentar:** pide `documentation-sync`.
- **Preparar publicación local:** pide `publisher`.
- **Diseñar o revisar UI:** pide `ui-ux-designer`.
- **Antes de trabajar una issue:** revisa el label `variant: *` y selecciona la
  variante recomendada en OpenCode. `sdd-master` la comprueba y te la recuerda.
  No cambies de modelo ni de variante a mitad de una sesión: invalida la caché
  de contexto y multiplica el coste (ADR 0015).
- **Proceso sin abrir la especificación:** pide la skill `repo-map`; resume
  puertas, estados, esquema de task files, labels y publicación.
- **Tareas documentales o de proceso:** el flujo no invoca QA, seguridad,
  documentación ni planificación como subagentes; se resuelven con el
  checklist de `docs/proceso-sdd.md`, sección 9.
- **Permisos y autonomía:** consulta la sección 7.

Ejemplos:

```text
Usa sdd-master para resolver la issue #12.
Usa ui-ux-designer para revisar el contraste de la pantalla de fichas en los dos temas.
Usa publisher en modo local para preparar la rama y el commit, sin push.
```

## 7. Permisos y autonomía

Los permisos se definen en dos niveles y se combinan por orden; la última regla
que coincide gana:

- `opencode.jsonc`: guardrails comunes para todos los agentes.
- `.opencode/agents/*.md`: restricciones adicionales de cada agente.

Guardrails comunes:

- `git push`, `gh pr create`, `gh pr merge` y `gh api` requieren confirmación
  explícita.
- Las operaciones destructivas (`git reset --hard`, `git clean`, `git restore`,
  `git checkout --force`, `git switch --force`, `rm`, `Remove-Item`,
  `git stash drop`) requieren confirmación.
- `git add .`, `git add -A`, `git add --all` y equivalentes están denegados;
  cualquier otro `git add` o `git stage` pide confirmación. Las formas amplias
  de `git stage` también están denegadas.
- La herramienta de lectura pide confirmación para `.env`, `.envrc`, claves,
  certificados, credenciales habituales, `.git/config` y claves SSH, también en
  rutas anidadas, y permite `.env.example`. Los comandos de shell que nombran
  `.env` también piden confirmación. Cualquier ruta externa al proyecto pide
  confirmación antes de leerse o editarse. `.env*`, claves y credenciales están
  en `.gitignore`; un `.env` trackeado se marca HIGH sin abrirlo.
- `git -C` y `git -c` requieren confirmación. Los comandos git de solo lectura
  habituales no preguntan, salvo las excepciones de esta lista.
- Las opciones git que ejecutan comandos externos o escriben archivos
  (`--output`, `--ext-diff`, `--textconv`, `--open-files-in-pager`,
  `--no-index`, `grep -O`) piden confirmación.

Reglas por agente:

- `security-champion` solo puede leer y ejecutar comandos git de inspección de
  solo lectura. No edita, no publica, no navega, no usa Code Mode ni lanza
  subagentes; su shell está denegado por defecto, no puede acceder a rutas
  externas al proyecto y no puede leer `.env`, claves, credenciales,
  `.git/config` ni claves SSH con `read`, `grep`, `glob` ni lectores de shell.
  Si un `.env` aparece trackeado, lo marca HIGH sin abrirlo.
- Los agentes que no declaran permisos heredan los guardrails comunes y la
  política por defecto de OpenCode.

Uso de «Allow always»:

- Al responder a un prompt, «Allow always» guarda una aprobación persistente
  por proyecto. Las reglas `deny` configuradas siempre prevalecen sobre esas
  aprobaciones; entre reglas configuradas, gana la última que coincide.
- Se usa para comandos de solo lectura que se repiten; no para publicación,
  borrados ni secretos.
- Si un agente necesita un comando nuevo, se añade a la allowlist en la misma
  tarea y se documenta. No se concede `allow` global a publicación, borrados o
  lectura de secretos.

## 8. Mantenimiento

- M0-02 (issue #3) revisó este documento para eliminar duplicidades con
  `AGENTS.md` y `docs/proceso-sdd.md`. La auditoría de la sección 2 se conserva
  como registro histórico no normativo.
- M0-13 (issue #48) añadió la política de variantes y la sección de permisos.
  Al cambiar `opencode.jsonc` o los agentes, revisa ambas secciones.
- ADR 0015 (tarea local `optimizacion-coste-cache`) fijó una variante por
  subagente y añadió la skill `repo-map`. Si cambias la variante de un agente,
  actualiza la tabla de la sección 3 y `docs/variantes-modelo.md`, sección 5.
- Si se añade, elimina o renombra un agente, o cambian sus responsabilidades,
  actualiza este documento y `.opencode/agents/` en la misma tarea.
- Si cambia el flujo, las etiquetas, los estados, los hitos, el esquema de task
  files o la publicación, actualiza `docs/proceso-sdd.md` y, si afecta a reglas
  obligatorias, `AGENTS.md`. No dupliques esos catálogos aquí.
- Revisa que ningún agente referencie rutas, URLs, scripts, workflows o issues
  que no existan en este repositorio.
- `documentation-sync` comprueba la coherencia documental en cada tarea que
  cambie agentes o proceso.
