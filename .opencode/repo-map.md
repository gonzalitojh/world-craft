# Mapa del repositorio y uso eficiente del contexto

Instrucciones para todos los agentes de World Craft. `AGENTS.md` contiene las
reglas obligatorias; este archivo explica qué documento cargar para cada tarea
y cómo trabajar sin gastar contexto ni dinero de más.

## 1. Qué documento cargar (y cuándo)

| Necesitas | Abre | No abras |
|---|---|---|
| Reglas obligatorias, Ready y Done | `AGENTS.md` (ya está cargado) | `docs/proceso-sdd.md` completo |
| Puertas, estados y transiciones | `.opencode/skills/repo-map/SKILL.md`, sección 3 | `docs/proceso-sdd.md` completo |
| Esquema de task files y labels | `.opencode/skills/repo-map/SKILL.md`, secciones 4–5 | `docs/proceso-sdd.md` completo |
| Publicación local-first | `.opencode/skills/repo-map/SKILL.md`, sección 6 | `docs/proceso-sdd.md` completo |
| Variante de modelo | `docs/variantes-modelo.md`, sección 3 | No |

`docs/proceso-sdd.md` es la especificación canónica, pero su lectura completa
cuesta ~8.600 tokens. Se lee entero solo si cambia el proceso o si la skill no
resuelve la duda; para el día a día basta la skill `repo-map`.

## 2. Cómo no derrochar contexto

1. **Lee una vez.** Un archivo ya leído en la sesión no se vuelve a leer ni se
   vuelca con `git diff | cat` si ya está en el contexto. Usa `grep` y `glob`
   para localizar antes de abrir.
2. **No pases a un subagente lo que ya está en tu contexto.** Los subagentes
   arrancan con contexto limpio: dales solo lo necesario para su trabajo
   (criterios, archivos, hallazgos). Un informe completo del agente maestro
   cuesta lo mismo que generarlo otra vez.
3. **No hagas el mismo trabajo dos veces.** Si una tarea es puramente
   documental, su QA se resuelve con el checklist documental y su informe va al
   task file; no se invocan `qa-reviewer`, `security-champion` ni
   `documentation-sync` para repetir lo que el propio cambio ya demuestra.
4. **Usa la variante más baja que sirva.** `variant: low` para trabajo mecánico
   y documental, `high` para implementación estándar, `max` solo para
   problemas ambiguos, de seguridad o de datos (ver
   `docs/variantes-modelo.md`).
5. **Cierra la conversación con lo que el usuario necesita**: rama, commit,
   diff stat y siguiente paso. Nada que solo repita el task file.

## 3. Qué cuesta el contexto

| Bloque | Tokens aproximados | Coste por lectura sin caché |
|---|---:|---:|
| `AGENTS.md` | ~4.400 | ~0,0007 $ |
| `opencode.jsonc` (reglas de permisos) | ~3.500 | ~0,0005 $ |
| `docs/proceso-sdd.md` completo | ~8.600 | ~0,0013 $ |
| `.opencode/agents/*.md` (los ocho) | ~18.700 | ~0,0028 $ |

Con la caché caliente, esas lecturas cuestan ~50 veces menos. Por eso el
objetivo no es solo leer menos, sino **no invalidar la caché**: no cambiar de
modelo o variante a mitad de sesión, no editar `AGENTS.md` ni los agentes
mientras se trabaja, y mantener el prefijo estable (las instrucciones no cambian
entre turnos).
