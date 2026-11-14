# ADR 0015 — Coste de contexto: caché, prompts bajo demanda y variante fija por subagente

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-14
- **Fecha del documento:** 2026-11-14
- **Issue:** — (tarea local `tasks/task-local-optimizacion-coste-cache.json`)
- **Decisiones del registro:** —
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0014, [`docs/variantes-modelo.md`](../variantes-modelo.md)

## Contexto

Una sesión de `sdd-master` dedicada a la issue #5, con `variant: low`, costó
0,30 $ pese a que la variante ya era la más barata. Esa tarea creó un ADR, un
script, plantillas y documentación: el trabajo real fue mucho mayor que el que
este ADR aborda, pero el gasto por token revela un problema estructural.

Con las tarifas vigentes (Models.dev, consultado el 14/11/2026), DeepSeek cobra
0,15 $/M de entrada procesada, 0,003 $/M de entrada leída de caché y 0,6 $/M de
salida. El prefijo estable de cada sesión (system prompt, `AGENTS.md`,
`opencode.jsonc` y los prompts de agentes) ronda los 10.700 tokens y se reenvía
en cada turno y en cada paso de cada subagente. Procesado, ese prefijo cuesta
~0,0016 $ por llamada; en 120 llamadas son ~0,19 $, la mayor parte de la
factura. Leído de caché, cuesta ~0,000004 $ por llamada.

Además, cada subagente arranca con contexto limpio y heredaba la variante de la
sesión, así que una tarea `low` podía pagar `max` en QA y documentación. Y el
flujo invocaba seis subagentes incluso en tareas puramente documentales.

## Decisión

1. **Caché caliente por configuración.** `opencode.jsonc` activa `warming`
   durante 30 minutos tras la última petición y fija `compaction.keep.tokens`
   en 20.000 con `buffer` de 10 %, de modo que una compactación no golpee el
   prefijo estable.
2. **Proceso bajo demanda.** Se crea la skill `repo-map`, que resume puertas,
   transiciones, esquema de task files, labels y publicación, y se registra
   `.opencode/repo-map.md` en `instructions` como mapa de dónde leer qué.
   `docs/proceso-sdd.md` completo solo se abre si cambia el proceso.
3. **Orquestación proporcional.** Las tareas documentales o de proceso no
   invocan `task-architect`, `ui-ux-designer`, `qa-reviewer`,
   `security-champion` ni `documentation-sync`: el checklist documental y el
   escaneo de secretos se resuelven en la propia tarea y se registran en el
   task file. `ui-ux-designer` se invoca una sola vez por tarea de UI.
4. **Variante fija por subagente.** Cada agente declara
   `model: deepseek/deepseek-flash#<variante>` en el frontmatter:
   `task-architect`, `tdd-ddd-architect`, `ui-ux-designer` y
   `security-champion` en `high`; `qa-reviewer`, `documentation-sync` y
   `publisher` en `low`.
5. **Reglas de coste en la Definition of Done.** No cambiar de modelo ni de
   variante a mitad de sesión, no editar `AGENTS.md` ni los agentes mientras se
   usan, y verificar con `OPENCODE_LOG_LEVEL=DEBUG` que el prefijo no se
   reprocesa en llamadas consecutivas.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Solo activar `warming` | El ahorro es de un 10–15 %: el prefijo sigue siendo grande y los subagentes siguen invocándose de más. |
| Recortar `AGENTS.md` y los agentes a la mitad | Ahorra tokens una vez, pero duplica la especificación en otro sitio o pierde reglas; el proceso sigue cargándose entero. |
| Un plugin que lea el label y cambie la variante de la sesión | Sigue siendo un spike futuro: añade dependencia y no evita que los subagentes hereden la variante (ver `docs/variantes-modelo.md`, sección 5.1). |
| No tocar nada y usar siempre `variant: low` | La variante ya era `low` en la sesión de 0,30 $; no resuelve el problema. |

## Consecuencias

### Positivas

- El coste por sesión deja de escalar con el tamaño de los prompts: el prefijo
  se lee de caché mientras la sesión está activa.
- Las tareas documentales pasan de seis subagentes a cero y se resuelven en un
  único contexto.
- El coste de cada puerta es predecible: QA y documentación no pueden costar
  más que la implementación por heredar `max`.
- La especificación canónica no pierde contenido: se consulta bajo demanda.

### Negativas y riesgos

- Los subagentes ya no siguen la variante que el usuario elija en la sesión. Se
  mitiga con `validation.notes`: si una variante fija falla dos veces, se sube
  un nivel y se documenta.
- El modelo queda escrito en el frontmatter de siete agentes; al cambiar de
  modelo hay que actualizarlos todos.
- `warming` envía peticiones reales: si la ventana de caché nunca se aprovecha,
  el coste de las peticiones de calentamiento es residual (prefijo leído de
  caché) pero no nulo.
- La skill `repo-map` puede desincronizarse de `docs/proceso-sdd.md`. Mitigación:
  el checklist documental compara ambas y `documentation-sync` la revisa.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | No aplica: cambio de proceso y configuración de agentes. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | No aplica. |
| Seguridad y privacidad | Ninguno: no se relajan permisos ni guardrails. La skill no contiene secretos. |
| Coste | Principal objetivo: el prefijo fijo pasa a costar ~50 veces menos cuando la caché acierta. |
| Portabilidad de datos | No aplica. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| La caché no acierta y se paga el prefijo completo | 0,15 $/M por llamada | No cambiar de modelo ni variante a mitad de sesión; `warming` de 30 minutos; verificación en la DoD. | Log del servidor con `OPENCODE_LOG_LEVEL=DEBUG` |
| Una variante fija `low` deja pasar un defecto que `high` habría visto | Calidad de QA, documentación o publicación | Puertas de seguridad y planificación se mantienen en `high`; un FAIL repetido sube la variante. | Task file de cada tarea |
| La skill `repo-map` deriva del proceso canónico | Información desactualizada | Checklist documental y `documentation-sync` comparan estados, labels e hitos. | `docs/proceso-sdd.md`, sección 9 |

No interviene ningún servicio de pago: son ahorros sobre el modelo ya aprobado,
y no se añaden dependencias.

## Plan de revisión

Se revisa al cambiar el catálogo de modelos (precios, variantes o caché), al
adoptar otro proveedor, o si dos tareas seguidas muestran una caché fría en el
log. Reabre la decisión una issue de `area: agents` o `area: architecture`.

## Referencias

- [`docs/variantes-modelo.md`](../variantes-modelo.md), secciones 5 y 6
- [`docs/proceso-sdd.md`](../proceso-sdd.md), secciones 3 y 7
- [`AGENTS.md`](../../AGENTS.md), reglas 16 y Definition of Done
- Tarifas de Models.dev para `deepseek/deepseek-flash`, consultadas el
  14/11/2026: entrada 0,15 $/M, salida 0,6 $/M, lectura de caché 0,003 $/M.
- Documentación de OpenCode sobre caché, calentamiento y variantes,
  consultada el 14/11/2026.
