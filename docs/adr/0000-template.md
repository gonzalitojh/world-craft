# ADR 0000 — Plantilla de ADR

<!--
Plantilla de World Craft. No es un ADR real: no cuenta en la numeración ni se
enlaza desde el índice. Para crear un ADR, copia este archivo como
docs/adr/NNNN-slug-en-kebab-case.md con el siguiente número libre, completa
todas las secciones y añade la fila al índice (docs/adr/README.md). Escribe en
español; el nombre del archivo y los identificadores técnicos, en inglés. No
inventes cifras: cita la fuente y la fecha de consulta.
-->

- **Estado:** propuesto | aceptado | supersedido por ADR NNNN
- **Fecha de la decisión:** YYYY-MM-DD
- **Fecha del documento:** YYYY-MM-DD
- **Issue:** #N
- **Decisiones del registro:** D-00N (o «—»)
- **Decisores:** usuario / agentes
- **Supersede:** — | ADR NNNN
- **Relacionados:** ADR NNNN, ADR NNNN

## Contexto

Qué problema, restricción o duda motivó la decisión. Una o dos frases de
situación y el porqué de decidir ahora.

## Decisión

Qué se decide, en presente y sin ambigüedad. Si el ADR agrupa varias
subdecisiones, numéralas y mantén cada una verificable.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Opción descartada | Razón concreta y, si existe, dato del plan que la respalda. |

Incluye al menos una alternativa real evaluada en el plan y el motivo del
descarte.

## Consecuencias

### Positivas

- Consecuencia positiva verificable.

### Negativas y riesgos

- Coste, complejidad o riesgo asumido.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | ... |
| Temas (Claro/Oscuro) | ... |
| Accesibilidad | ... |
| Seguridad y privacidad | ... |
| Coste | ... |
| Portabilidad de datos | ... |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Riesgo concreto | Dato del plan o «No aplica» | Medida prevista | Issue o ADR |

Si la decisión no toca un servicio de pago, escribe «No aplica» y explica por
qué. No omitas la sección.

## Plan de revisión

Cuándo se revisa la decisión (cambio de plan, de precios, de límites o de
proveedor) y qué issue la reabre.

## Referencias

- Issue: #N
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), sección ...
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-00N
- Documentación oficial consultada, con fecha.
