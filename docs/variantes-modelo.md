# Variantes de modelo en World Craft

> **Estado:** vigente desde el 18/11/2026, tras el pivote a aplicación de
> escritorio. Sustituye la política anterior de modelo y variante fijos por
> subagente.
> **Ámbito:** recomendación de variante por issue, uso de `default`, `low`,
> `high` y `max`, herencia del modelo de sesión y caché de contexto.
> **Jerarquía documental:** mandan [`AGENTS.md`](../AGENTS.md) y
> [`docs/proceso-sdd.md`](proceso-sdd.md). Este documento desarrolla la
> política sin contradecirlos.

## 1. Qué es una variante

En OpenCode, una variante es una opción con nombre dentro de un modelo. Se
selecciona con `proveedor/modelo#variante`, por ejemplo
`opencode/deepseek-v4.1-flash-free#high`. Las variantes suelen ajustar el
esfuerzo de razonamiento o el presupuesto de tokens; no son modelos distintos.

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
en tareas de seguridad, datos, migraciones o permisos locales solo para ahorrar
tokens.

El usuario paga su suscripción de OpenCode y puede usar cualquier modelo
disponible en su plan, incluido el gratuito. La política de variantes no
obliga a un proveedor ni a un modelo concretos: solo recomienda esfuerzo por
tarea.

## 3. Tabla de decisión

| Variante | Cuándo usarla | Ejemplos en World Craft | Señales para no usarla |
|---|---|---|---|
| `default` | Tareas simples que no requieren razonamiento profundo y no son ambiguas. | Consultar issues, listar labels, revisar un enlace, un cambio de texto puntual. | Hay diseño, IPC, migraciones o varios módulos implicados. |
| `low` | Trabajo mecánico, repetitivo o totalmente especificado. | Aplicar labels, actualizar una checklist, renombrar, formatear, cambiar una plantilla, corregir una errata. | Hay que decidir arquitectura, seguridad o comportamiento. |
| `high` | Implementación estándar, pruebas, QA, documentación con dependencias y revisión de cambios acotados. | CRUD local, componentes de UI, tests, ADRs, documentación de proceso, refactors pequeños. | La decisión es ambigua, transversal o puede afectar a datos/seguridad. |
| `max` | Problemas ambiguos, transversales o con alto coste de error. | Modelo de datos inicial, migraciones, cifrado o backups, editor de mapas, auditoría de seguridad, refactor grande. | El diff correcto es obvio o la tarea es mecánica. |

### Factores de decisión

1. **Ambigüedad:** si hay que descubrir el problema o comparar alternativas,
   sube la variante.
2. **Radio de impacto:** si un error afecta a datos, seguridad, migraciones,
   distribución o varios módulos, sube la variante.
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
5. Al cerrar la tarea, el task file conserva `model_variant` y, si el usuario
   usó otra variante, la decisión queda en `validation.notes`.

La variante recomendada es una guía, no una puerta: no bloquea la adopción ni
la implementación. Lo que sí es obligatorio es que la issue tenga un label
`variant: *` y que la recomendación esté justificada.

## 5. Modelo de los agentes

Los ocho agentes del equipo **no declaran `model:` en su frontmatter**. Esto
tiene tres consecuencias:

1. **Herencia.** Cada subagente usa el modelo y la variante de la sesión. El
   usuario decide con qué modelo trabaja (suscripción de OpenCode, modelo
   gratuito u otro proveedor configurado) sin editar agentes.
2. **Sin modelo forzado.** Ya no se fija `opencode/deepseek-v4.1-flash-free` ni
   ninguna variante por agente. Un cambio de catálogo o de plan no obliga a
   tocar siete archivos.
3. **Sin variante suelta.** OpenCode no admite una variante sin modelo en el
   frontmatter; declarar solo `variant:` no es válido. Por eso la variante se
   elige en la sesión y se recomienda en la issue, no en el agente.

Si en el futuro OpenCode permite fijar solo la variante, se valorará en un ADR.
Mientras tanto, la fuente de verdad del modelo es la configuración del usuario,
no el repositorio.

### Caché de contexto y coste real de una sesión

El coste de una sesión no depende solo de la variante. La mayor parte del gasto
es el prefijo estable (system prompt, `AGENTS.md`, `opencode.jsonc`, agentes)
que se reenvía en cada turno y en cada paso de cada subagente. Con el modelo
gratuito el coste directo es 0, pero la caché sigue afectando a latencia y a
límites de uso. Con un modelo de pago, la diferencia entre procesar y leer de
caché puede ser de decenas de veces. Reglas operativas:

1. No cambiar de modelo ni de variante a mitad de sesión.
2. No editar `AGENTS.md` ni `.opencode/agents/*` mientras se trabaja con ellos.
3. Mantener un prefijo estable: no reordenar las instrucciones entre turnos.
4. `warming` mantiene la caché caliente 30 minutos tras la última petición.
5. Con `OPENCODE_LOG_LEVEL=DEBUG`, el log del servidor muestra `input` y
   `cache.read` por llamada; si el mismo prefijo aparece como `input` en
   llamadas consecutivas, la caché está fallando.

## 6. Medición y revisión

No hay histórico de tokens por tarea en el repositorio. La tabla es una
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
  documento, [`docs/registro-decisiones.md`](registro-decisiones.md),
  [`docs/proceso-sdd.md`](proceso-sdd.md) y [`AGENTS.md`](../AGENTS.md) en la
  misma tarea.
- Si OpenCode cambia la forma de fijar variantes o modelos por agente,
  documentar aquí la nueva mecánica y su precedencia antes de aplicarla.
- Si el usuario cambia de proveedor o de plan, no se toca el repositorio: la
  elección vive en la configuración local de OpenCode.
