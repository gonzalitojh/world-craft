# Equipo de agentes de World Craft

> **Estado:** vigente desde el 12/11/2026; reescrito el 18/11/2026 para el
> pivote a aplicación de escritorio Windows.
> **Ámbito:** equipo de agentes, responsabilidades e invocación.
> **Jerarquía documental:** [`AGENTS.md`](../AGENTS.md) contiene las reglas
> obligatorias; [`docs/proceso-sdd.md`](proceso-sdd.md) es la fuente canónica
> del proceso; este documento describe el equipo; `.opencode/agents/*.md` es la
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

## 2. Equipo resultante

| Agente | Modo | Responsabilidad |
|---|---|---|
| `sdd-master` | `primary` | Punto de entrada obligatorio. Adopta issues, crea task files, orquesta planificación, implementación, QA, seguridad, documentación y publisher local. Sincroniza labels y estados. |
| `task-architect` | `subagent` | Plan técnico: arquitectura Electron, SQLite, IPC, backups, instalador, riesgos, pruebas y preguntas abiertas. |
| `tdd-ddd-architect` | `subagent` | Implementación con TDD pragmático, principios SOLID y diseño por dominio cuando aporta valor, con seguridad Electron y datos locales. |
| `qa-reviewer` | `subagent` | Revisión de criterios, casos límite, ventana 1024/1280/1600, dos temas, accesibilidad, preservación de datos, pruebas y manual. |
| `security-champion` | `subagent` | Escaneo de secretos y revisión de aislamiento del renderer, IPC, CSP, protocolo de assets, importación, dependencias y rutas. |
| `documentation-sync` | `subagent` | ADRs, manual de usuario, changelog, arquitectura, persistencia y coherencia documental. |
| `publisher` | `subagent` | Rama + commit + diff en local. Push y PR solo con confirmación explícita. |
| `ui-ux-designer` | `subagent` | Sistema de diseño de escritorio, tokens, componentes, dos temas, accesibilidad y revisión visual; sin móvil ni responsive web. |

Los subagentes **no fijan modelo ni variante**. Heredan el modelo y la variante
de la sesión, de modo que el usuario puede usar su suscripción de OpenCode o el
modelo gratuito sin que el frontmatter lo fuerce. La recomendación de variante
sigue existiendo como label de issue y guía de sesión; el detalle está en
[`docs/variantes-modelo.md`](variantes-modelo.md).

## 3. Flujo, etiquetas y publicación

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

## 4. Responsabilidades por agente

### 4.1 `sdd-master`

- Adoptar issues: comprobar tipo, área, estado, prioridad, tamaño, hito y
  variante; crear el task file.
- Decidir qué subagentes necesita la tarea y no invocarlos cuando no aportan.
- Mantener el task file y los labels sincronizados.
- Detenerse ante una decisión pendiente o una contradicción con `AGENTS.md`.

### 4.2 `task-architect`

- Diseñar el plan técnico con Electron, React, SQLite, Drizzle, IPC tipado,
  backups, instalador y funcionamiento offline.
- Identificar riesgos de datos, migraciones, seguridad, rendimiento y
  distribución.
- Proponer pruebas y criterios verificables.
- No implementar ni publicar.

### 4.3 `tdd-ddd-architect`

- Implementar con TDD pragmático: tests primero en dominio, migraciones, IPC,
  búsqueda y lógica crítica; sin sobreingeniería en CRUDs simples.
- Respetar la separación main/preload/renderer, el contrato IPC, la CSP y el
  protocolo de assets.
- No acceder a Node desde el renderer ni saltarse la validación Zod.

### 4.4 `qa-reviewer`

- Comprobar criterios de aceptación y casos límite.
- Verificar la ventana a 1024, 1280 y 1600 px, sin scroll horizontal de página.
- Revisar los dos temas, contraste AA y `prefers-reduced-motion`.
- Revisar teclado, foco, landmarks, `aria-live` y axe sin errores críticos.
- Verificar preservación de datos, migraciones, copias y restauración cuando
  aplique.
- Comprobar que el manual se actualiza si el cambio es visible.

### 4.5 `security-champion`

- Escanear secretos, credenciales, correos reales y artefactos no deseados.
- Revisar `contextIsolation`, `sandbox`, `nodeIntegration`, `webSecurity`, CSP,
  allowlist IPC, validación Zod, protocolo `wc-asset://`, path traversal,
  importación de ZIP/JSON, dependencias y logs.
- Bloquear solo hallazgos HIGH y devolver un informe accionable.

### 4.6 `documentation-sync`

- Mantener ADRs, manual de usuario, changelog, arquitectura, persistencia,
  esquema, continuidad y este documento.
- Verificar que todo cambio visible actualiza el manual en la misma tarea.
- No presentar funciones previstas como disponibles.

### 4.7 `publisher`

- Preparar rama, commit y diff locales; mostrar comandos de prueba.
- No hacer push ni abrir PR sin confirmación explícita.
- Aplicar siempre `--base dev` y no incluir keywords de cierre.
- No alterar la administración del repositorio.

### 4.8 `ui-ux-designer`

- Diseñar para ratón y teclado en ventanas de escritorio, con mínimo 1024×700.
- Mantener los tokens, los dos temas y la estética de «taller de cartógrafo».
- Revisar contraste, foco, estados vacíos, errores y movimiento reducido.
- No introducir requisitos móviles, táctiles ni puntos de ruptura web.

## 5. Cómo invocar a los agentes

- **Trabajo normal:** usa `sdd-master` como agente primario. Él decide qué
  subagentes necesita. `opencode.jsonc` lo fija como `default_agent`, así que una
  sesión nueva arranca ya en él sin seleccionarlo a mano.
- **Planificar:** pide `task-architect`.
- **Implementar o corregir:** pide `tdd-ddd-architect`.
- **Revisar calidad:** pide `qa-reviewer`.
- **Revisar seguridad:** pide `security-champion`.
- **Documentar:** pide `documentation-sync`.
- **Preparar publicación local:** pide `publisher`.
- **Diseñar o revisar UI:** pide `ui-ux-designer`.
- **Antes de trabajar una issue:** revisa el label `variant: *` y elige la
  variante recomendada en OpenCode. `sdd-master` la comprueba y te la recuerda.
  No cambies de modelo ni de variante a mitad de una sesión: invalida la caché
  de contexto y multiplica el coste.
- **Proceso sin abrir la especificación:** pide la skill `repo-map`; resume
  puertas, estados, esquema de task files, labels y publicación.
- **Tareas documentales o de proceso:** el flujo no invoca QA, seguridad,
  documentación ni planificación como subagentes; se resuelven con el checklist
  de `docs/proceso-sdd.md`, sección 9.
- **Permisos y autonomía:** consulta la sección 6.

Ejemplos:

```text
Usa sdd-master para resolver la issue #61.
Usa ui-ux-designer para revisar el contraste de la pantalla de fichas en los dos temas.
Usa publisher en modo local para preparar la rama y el commit, sin push.
```

## 6. Permisos y autonomía

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

## 7. Mantenimiento

- Si se añade, elimina o renombra un agente, o cambian sus responsabilidades,
  actualiza este documento y `.opencode/agents/` en la misma tarea.
- Si cambia el flujo, las etiquetas, los estados, los hitos, el esquema de task
  files o la publicación, actualiza `docs/proceso-sdd.md` y, si afecta a reglas
  obligatorias, `AGENTS.md`. No dupliques esos catálogos aquí.
- Revisa que ningún agente referencie rutas, URLs, scripts, workflows o issues
  que no existan en este repositorio.
- `documentation-sync` comprueba la coherencia documental en cada tarea que
  cambie agentes o proceso.
