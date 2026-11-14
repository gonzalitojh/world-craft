# Variantes de modelo en World Craft

> **Estado:** vigente desde el 14/11/2026 (issue
> [#48](https://github.com/gonzalitojh/world-craft/issues/48), M0-13).
> **Ámbito:** recomendación de variante por issue, uso de `default`, `low`,
> `high` y `max`, y automatización futura.
> **Jerarquía documental:** mandan [`AGENTS.md`](../AGENTS.md) y
> [`docs/proceso-sdd.md`](proceso-sdd.md). Este documento desarrolla la
> política sin contradecirlos.

## 1. Qué es una variante

En OpenCode, una variante es una opción con nombre dentro de un modelo. Se
selecciona con `proveedor/modelo#variante`, por ejemplo
`opencode/deepseek-v4.1-flash-free#high`. Las variantes suelen ajustar el
esfuerzo de razonamiento o el presupuesto de tokens; no son modelos distintos.

El modelo gratuito de DeepSeek en OpenCode expone las variantes `low`, `high` y
`max`. La etiqueta `default` no fija ninguna variante: usa el comportamiento por
defecto del modelo.

| Variante | Etiqueta de issue | Uso general |
|---|---|---|
| `default` | `variant: default` | Sin variante explícita: comportamiento por defecto del modelo. |
| `low` | `variant: low` | Esfuerzo bajo para trabajo mecánico y bien especificado. |
| `high` | `variant: high` | Esfuerzo alto para implementación y revisión estándar. |
| `max` | `variant: max` | Esfuerzo máximo para problemas ambiguos o de alto riesgo. |

La disponibilidad y el significado exacto de cada variante dependen del
catálogo del modelo. Si el catálogo cambia, se revisa esta tabla y se actualiza
la recomendación de las issues afectadas.

## 2. Principio de coste

La variante más alta no garantiza un mejor resultado. Un esfuerzo mayor puede
aumentar los tokens de razonamiento, la latencia y el coste, y no aporta nada
en una tarea cuyo diff correcto ya está claro. La regla es:

> Usar la variante más baja que complete la tarea con calidad y escalar solo
> cuando la tarea lo justifique o cuando una variante inferior falle de forma
> repetida.

No se usa `max` por costumbre ni como valor por defecto. Tampoco se usa `low`
en tareas de seguridad, datos o permisos solo para ahorrar tokens.

## 3. Tabla de decisión

| Variante | Cuándo usarla | Ejemplos en World Craft | Señales para no usarla |
|---|---|---|---|
| `default` | Tareas simples que no requieren razonamiento profundo y no son ambiguas. | Consultar issues, listar labels, revisar un enlace, un cambio de texto puntual. | Hay diseño, permisos, migraciones o varios módulos implicados. |
| `low` | Trabajo mecánico, repetitivo o totalmente especificado. | Aplicar labels, actualizar una checklist, renombrar, formatear, cambiar una plantilla, corregir una errata. | Hay que decidir arquitectura, permisos o comportamiento. |
| `high` | Implementación estándar, pruebas, QA, documentación con dependencias y revisión de cambios acotados. | CRUD, componentes de UI, tests, ADRs, documentación de proceso, refactors pequeños. | La decisión es ambigua, transversal o puede afectar a seguridad/datos. |
| `max` | Problemas ambiguos, transversales o con alto coste de error. | Modelo de datos inicial, RLS, auth, permisos por mundo, editor de mapas, migraciones, auditoría de seguridad, refactor grande. | El diff correcto es obvio o la tarea es mecánica. |

### Factores de decisión

1. **Ambigüedad:** si hay que descubrir el problema o comparar alternativas,
   sube la variante.
2. **Radio de impacto:** si un error afecta a datos, seguridad, permisos,
   publicación o varios módulos, sube la variante.
3. **Novedad:** si el patrón ya existe en el repositorio, baja la variante; si
   hay que diseñarlo desde cero, súbela.
4. **Verificabilidad:** si la tarea se comprueba con un test o una checklist
   clara, baja la variante; si depende de juicio experto, súbela.
5. **Volumen:** si es mecánico y repetitivo, baja la variante.

### Escalado

- Si una variante inferior produce un resultado incompleto o falla QA dos
  veces, se sube un nivel y se anota en el task file.
- Si `max` no aporta una mejora clara frente a `high`, se vuelve a `high` en
  tareas equivalentes.
- El usuario puede elegir otra variante distinta de la recomendada. La
  decisión se anota en `validation.notes` y no se cambia el label sin motivo.

## 4. Cómo se aplica

1. Al crear o adoptar una issue, se elige **exactamente un** label
   `variant: default`, `variant: low`, `variant: high` o `variant: max`.
2. La issue incluye una sección «Variante recomendada» con una justificación
   breve. La plantilla de issue ya la incorpora.
3. El task file copia la recomendación en el campo `model_variant`.
4. `sdd-master` comprueba el label al adoptar la issue y recuerda al usuario la
   variante que debe seleccionar en OpenCode.
5. Los subagentes heredan la variante de la sesión. Si en el futuro se fija
   una variante por agente, se documenta el modelo completo en el frontmatter
   del agente y se revisa al cambiar de modelo.
6. Al cerrar la tarea, el task file conserva `model_variant` y, si el usuario
   usó otra variante, la decisión queda en `validation.notes`.

La variante recomendada es una guía, no una puerta: no bloquea la adopción ni
la implementación. Lo que sí es obligatorio es que la issue tenga un label
`variant: *` y que la recomendación esté justificada.

## 5. Automatización

### Lo que OpenCode permite hoy

- La configuración raíz (`model`) conserva proveedor y modelo, pero no la
  variante.
- Los agentes y comandos pueden fijar `model: proveedor/modelo#variante`.
- La API `POST /api/session/{sessionID}/model` acepta un `variant` y cambia el
  modelo de los turnos siguientes.
- Un plugin puede escuchar eventos o la admisión de un prompt y llamar a
  `session.switchModel` con la variante leída de un label.

### Por qué no se implementa ahora

Un plugin que lea el label y cambie la variante de la sesión es técnicamente
posible, pero:

- necesitaría resolver el número de issue y consultar sus labels (por ejemplo,
  con `gh` o la API de GitHub);
- sobrescribiría la variante que el usuario haya seleccionado manualmente;
- añadiría una dependencia y un punto de fallo al arranque de cada sesión;
- mezclaría una decisión de proceso con una automatización que aún no se ha
  medido.

Por eso esta issue deja la automatización como **spike futuro**. Si el paso
manual sigue costando, se abrirá una issue específica con una prueba de
concepto desactivable por configuración y con una regla clara de precedencia:
la selección explícita del usuario debe poder ganar.

### Alternativa nativa

Si se decide fijar variantes por agente, el frontmatter admite:

```yaml
model: opencode/deepseek-v4.1-flash-free#high
```

Eso fija también el modelo, no solo la variante. Solo se hará si el usuario
acepta que ese agente deje de heredar el modelo de la sesión. No es el valor
por defecto de esta política.

## 6. Medición y revisión

No hay histórico de tokens por tarea en el repositorio. La primera tabla es una
heurística y se revisará con datos reales:

1. Durante las próximas 10 tareas, anotar en el task file la variante usada y,
   si está disponible, los tokens y la latencia de la sesión.
2. Comparar tareas similares con `high` y `max`.
3. Si `max` no mejora la calidad ni reduce las iteraciones, bajar la
   recomendación.
4. Si `low` o `default` fallan en tareas que parecían simples, subir la
   recomendación y anotar el caso.
5. Revisar la tabla al cambiar el catálogo de modelos o al adoptar un modelo
   distinto.

La API de sesiones expone estadísticas en
`GET /api/experimental/session/stats`; el TUI también muestra el uso de la
sesión. La medición es opcional: la política no depende de que exista una
herramienta concreta.

## 7. Mantenimiento

- Si cambian los labels, la tabla o el campo `model_variant`, actualizar este
  documento, [`docs/proceso-sdd.md`](proceso-sdd.md) y
  [`AGENTS.md`](../AGENTS.md) en la misma tarea.
- Si se implementa el plugin de automatización, documentar aquí su precedencia,
  su configuración y cómo desactivarlo.
- Si el modelo gratuito deja de estar disponible, revisar las variantes y las
  recomendaciones antes de cambiar de modelo.
