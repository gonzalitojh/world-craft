# ADR 0024 — Invocación obligatoria de los subagentes especializados

- **Estado:** aceptado e implementado (tarea local `subagent-routing`)
- **Fecha de la decisión:** 2026-11-21
- **Fecha del documento:** 2026-11-21
- **Issue:** — (tarea local `tasks/task-local-subagent-routing.json`)
- **Decisiones del registro:** D-047
- **Decisores:** usuario / agentes
- **Supersede:** — (sustituye en la práctica la parte de orquestación del
  antiguo ADR 0015 de la etapa web, retirado en el pivote)
- **Relacionados:** ADR 0006, ADR 0010, [`docs/agentes.md`](../agentes.md),
  [`docs/proceso-sdd.md`](../proceso-sdd.md), [`docs/variantes-modelo.md`](../variantes-modelo.md)

## Contexto

La optimización de coste del 14/11/2026 hizo proporcional la orquestación y
dejó en segundo plano tres agentes: `task-architect`, `tdd-ddd-architect` y
`ui-ux-designer`. La regla permitía usar un «Plan de implementación» de la
issue sin `task-architect`, invocar `ui-ux-designer` solo «cuando hubiera que
decidir el diseño» y aplicar la eficiencia a cualquier tarea de código.

El resultado observable es que las tareas #67 y #68 registran planificación de
`task-architect` e implementación de `tdd-ddd-architect`, mientras que las
tareas posteriores #69 y #76 no dejan constancia de esos agentes. La issue #76
tampoco traía un plan detallado, así que la excepción prevista no explicaba su
omisión. La puerta de QA y la de seguridad sí se invocaron, lo que confirma que
el problema no era la disponibilidad de subagentes.

Además, el pivote a escritorio renumeró los ADR y la referencia de `AGENTS.md`
a la decisión de orquestación acabó apuntando al ADR 0009 (i18n), sin un ADR
vigente que describiera el routing.

## Decisión

1. **Implementación siempre delegada.** Todo cambio de código de producto pasa
   por `tdd-ddd-architect`. `sdd-master` no implementa por su cuenta y las
   correcciones que pidan QA o seguridad vuelven al implementador.
2. **Planificación obligatoria salvo tarea mecánica.** `task-architect`
   planifica features, refactors, bugfixes no triviales, integraciones,
   migraciones, IPC, seguridad, cambios de varios módulos y planes incompletos. Un plan escrito en la issue
   es contexto de entrada, no un sustituto. Solo se omite en tarea mecánica
   `variant: low` con pasos cerrados y sin decisiones abiertas.
3. **Diseño de UI obligatorio.** `ui-ux-designer` interviene siempre que la
   tarea cree o modifique UI, tokens, temas, layout, accesibilidad o estados
   visibles. `qa-reviewer` comprueba el resultado, no sustituye el diseño.
4. **Proporcionalidad acotada.** El ahorro de contexto solo exime a las tareas
   documentales o de proceso y a las revisiones opcionales. Nunca autoriza a
   saltarse las tres puertas anteriores.
5. **Registro verificable.** El task file incorpora el bloque `agents` con el
   subagente usado en cada puerta o `no aplica` con su motivo. Una puerta de
   código sin registro se considera no superada.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Mantener la invocación opcional y confiar en el criterio del maestro | Es lo que produjo la omisión observada: sin una regla explícita, el ahorro de contexto gana a la calidad. |
| Invocar siempre a los ocho agentes en toda tarea | Castiga tareas documentales y revisiones sin valor añadido; el coste crece sin mejorar el resultado. |
| Imponer el routing solo en `docs/proceso-sdd.md` | El maestro opera con su prompt y la skill `repo-map`; un cambio en un documento lejano no corrige el comportamiento diario. |
| Resolverlo con permisos de OpenCode | Los permisos controlan herramientas, no la decisión de delegar; no pueden obligar a invocar un subagente concreto. |

## Consecuencias

### Positivas

- La planificación técnica, la implementación y el diseño de UI vuelven a tener
  un responsable explícito y verificable.
- El task file muestra qué agente pasó cada puerta y por qué se omitió alguna.
- Disminuye el riesgo de que el maestro implemente, planifique y revise a la vez
  sin contraste.
- La documentación recupera una referencia válida para la orquestación.

### Negativas y riesgos

- Cada tarea de código vuelve a pagar el arranque de contexto de hasta tres
  subagentes. Se mitiga no repitiendo consultas y reservando la proporcionalidad
  para tareas documentales.
- Una regla demasiado rígida podría invocar `task-architect` en cambios
  triviales. La excepción mecánica `variant: low` y el registro del motivo
  acotan ese caso.
- El bloque `agents` añade mantenimiento al task file. Los archivos anteriores
  no se reescriben: su historial queda en `validation.notes`.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | No aplica: cambio de proceso. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | `ui-ux-designer` vuelve a ser obligatorio en toda tarea con UI. |
| Seguridad y privacidad | No cambia el modelo local; refuerza que la seguridad tenga puerta propia. |
| Datos y preservación | No aplica: no se tocan datos ni migraciones. |
| Coste | Aumenta el número de subagentes en tareas de código y se mantiene en cero para tareas documentales. |
| Portabilidad de datos | No aplica. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Más subagentes por tarea | 0 €/mes: los agentes usan el modelo y la variante de la sesión | No repetir consultas; excepción mecánica y tareas documentales sin subagentes | Revisar en las próximas 10 tareas si el routing mejora la calidad sin disparar el coste |

No hay servicios de pago ni telemetría.

## Plan de revisión

Se revisa si el routing produce invocaciones innecesarias en tareas pequeñas o
si el bloque `agents` se vuelve burocrático. En ese caso se ajusta la excepción
mecánica con un ADR nuevo; no se vuelve a hacer opcional la implementación
delegada.

## Referencias

- Tarea local `tasks/task-local-subagent-routing.json`.
- [`AGENTS.md`](../../AGENTS.md), resumen del flujo y Definition of Done.
- [`docs/proceso-sdd.md`](../proceso-sdd.md), sección 3.2 y esquema del task file.
- [`docs/agentes.md`](../agentes.md), responsabilidades e invocación.
- [`docs/variantes-modelo.md`](../variantes-modelo.md), sección 5.
- Historial de git: `9292842` (optimización de coste del 14/11/2026) y
  `b79bb41` (pivote a escritorio).
