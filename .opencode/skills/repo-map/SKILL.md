---
name: Repo Map
description: Consulta rápida del proceso SDD de World Craft (puertas, estados, esquema de task files, labels, hitos y publicación local-first) sin abrir docs/proceso-sdd.md completo. Úsala antes de adoptar una issue, cambiar un estado, crear o actualizar un task file, tocar labels o preparar una publicación.
---

# Proceso SDD de World Craft (consulta rápida)

Fuente canónica: `docs/proceso-sdd.md` y `AGENTS.md`. Esta skill resume lo que
se usa a diario; si hay discrepancia, mandan los documentos canónicos.

## 1. Flujo

```text
Issue (ai + status: todo + variant: *)
  → adopción y task file → plan aprobado → implementación → QA
  → seguridad → documentación → publisher local (review, sin PR)
  → revisión del usuario → publicación explícita → PR a dev → merge → done
```

No se saltan puertas. `review` = commit local sin PR. `published` = PR
creada. No existe `done` local.

## 2. Puertas y responsable

| Transición | Responsable |
|---|---|
| Issue → adopción | `sdd-master` (labels + task file `created`) |
| `created` → `planned` | `task-architect` (obligatorio salvo tarea mecánica `variant: low`; un plan en la issue no lo sustituye) |
| `planned` → `implemented` | `tdd-ddd-architect` (siempre) + `ui-ux-designer` (siempre que haya UI) |
| `implemented` → `validated` | `qa-reviewer` (o checklist documental) |
| `validated` → `security-cleared` | `security-champion` (o checklist de secretos) |
| `security-cleared` → `documented` | `documentation-sync` (o edición directa) |
| `documented` → `review` | `publisher` en modo `preparar` |
| `review` → `published` | `publisher` en modo `publicar`, con confirmación |

Reglas no negociables en tareas de código:

- `tdd-ddd-architect` implementa **todo** el código; `sdd-master` no implementa.
- `task-architect` planifica toda feature, refactor, bugfix no trivial,
  integración, migración, IPC, seguridad o cambio transversal. Solo se omite en
  tarea mecánica `variant: low` con pasos cerrados y el motivo queda en
  `agents.planning`.
- `ui-ux-designer` se invoca siempre que haya UI nueva o modificada; QA revisa
  el resultado, no sustituye el diseño.
- La proporcionalidad al coste solo exime a las tareas documentales y a las
  revisiones opcionales, nunca a estas tres puertas.

**Tareas documentales o de proceso** (solo `.md`, `.json` de `tasks/`,
`opencode.jsonc`, `.opencode/`): sin subagentes; QA, seguridad y documentación
se resuelven con la sección 8 de esta skill y el informe se registra en el task
file.

## 3. Estados y labels

| Estado del task file | Label de la issue |
|---|---|
| `created`, `planned` | `status: todo` |
| `implemented`, `validated`, `security-cleared`, `documented` | `status: in-progress` |
| `review`, `published` | `status: needs-review` |
| `blocked` | `status: blocked` |
| — | `status: done` (solo tras merge) |

Exactamente un `status: *`, un `type: *`, un `priority: *`, un `size: *` y un
`variant: *`; al menos un `area: *`; un hito. Labels de tipo: `feature`, `bug`,
`chore`, `docs`, `design`, `testing`, `refactor`, `content`. Prioridad `p0`–`p3`;
tamaño `s`/`m`/`l`/`xl`. Hitos: `M0`, `M1`, `M1.5`, `M2`–`M5` y
`Backlog`. Bandera `needs-decision`: no es estado; bloquea la adopción.

## 4. Esquema del task file

`tasks/task-issue-<N>.json` o `tasks/task-local-<slug>.json`. Campos:
`title`, `description`, `status`, `model_variant`, `issue` (`number`, `url`,
`title`), `acceptance_criteria[]`, `definition_of_done[]`, `plan`,
`validation` (`result`, `date`, `notes`), `agents` (`planning`,
`implementation`, `ui`, `qa`, `security`, `documentation`, `publisher`,
`notes`), `qa` (`result`, `notes`), `security` (`result`, `findings[]`,
`notes`), `documentation` (`adr`, `manual`, `changelog`, `agents`). Bloque
`pr` (`number`, `url`, `title`, `branch`, `commit`) **solo tras publicar**. No
se eliminan campos desconocidos ni historial. `documentation.manual` = ruta,
`pendiente` o `no aplica`. En `agents`, cada puerta lleva el agente usado,
`pendiente` o `no aplica` con el motivo en `notes`.

## 5. Variantes

`variant: default` (simple), `low` (mecánico o totalmente especificado),
`high` (implementación y revisión estándar), `max` (ambiguo, seguridad o datos).
Se copia en `model_variant`. Los subagentes heredan el modelo y la variante de
la sesión; no llevan `model:` fijado en el frontmatter (`docs/variantes-modelo.md`,
sección 5).

## 6. Publicación local-first

- **Preparar**: rama `<tipo>/issue-<N>-<slug>` desde `origin/dev`, task file a
  `review`, `git add` con rutas explícitas (nunca `git add .`), commit
  convencional, reporte de diff y comandos. Sin push ni PR.
- **Publicar**: solo con «publica», «sube» o «abre la PR» explícito. Push de la
  rama, `gh pr create --base dev`, sin keywords de cierre, bloque `pr`,
  estado `published`.
- Prohibido: PR o push a `main`, force push a `dev`/`main`, secretos,
  `git add .`.

## 7. Task file en `review`: qué registrar

- `status: review`, `validation`, `agents`, `qa`, `security` y `documentation`.
- `agents.*`: agente invocado en cada puerta; `no aplica` solo con motivo.
- `qa.notes`: qué se comprobó y con qué resultado, con las rutas revisadas.
- `security.notes`: escaneo de secretos (patrones HIGH) y resultado.
- `documentation.*`: qué documento se actualizó y por qué.

## 8. Checklist documental

1. `Get-ChildItem tasks/task-*.json | % { Get-Content -Raw $_.FullName | ConvertFrom-Json | Out-Null }`
2. Enlaces Markdown locales resueltos (`docs/...`, `.opencode/...`).
3. Fences impares y `git diff --check`.
4. Estados, labels, hitos y rutas citadas literalmente coherentes entre
   `AGENTS.md`, `docs/proceso-sdd.md` y `.opencode/`.
5. Sin secretos ni correos reales en el diff.
6. Si el cambio es solo documental, `documentation.manual: "no aplica"` con
   justificación en `validation.notes`.
