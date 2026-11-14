# ADR 0007 — React Flow y ELK.js para el grafo

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** —
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0006, ADR 0010

## Contexto

Las fichas se relacionan entre sí y el usuario necesita una vista de grafo
interactiva, legible y coherente con la estética de la aplicación. Los nodos
deben mostrar tipo, color, avatar y acciones, y el layout debe reorganizarse sin
edición manual. El uso previsto es personal, con cientos de nodos, no con miles.

## Decisión

1. **Librería:** React Flow 12 (`@xyflow/react`) con ELK.js para layout
   automático.
2. **Nodos:** componentes React con tipo, color accesible, avatar y acciones
   rápidas; aristas tipadas por relación.
3. **Layout:** ELK en Web Worker para no bloquear la interfaz; posiciones
   manuales guardadas por usuario.
4. **Rendimiento:** filtros por tipo y relación, expansión de vecinos y límite
   de nodos visibles; carga bajo demanda.
5. **Exportación:** PNG y SVG del grafo visible.
6. **Escala:** a partir de ~1.000 nodos se evalúa Sigma.js como visor de solo
   lectura y se añaden agrupaciones.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Cytoscape.js | Muy potente, pero peor integración con React y nodos personalizados. |
| Sigma.js | Excelente rendimiento a gran escala, pero menos flexible para nodos-componente y acciones. |
| D3 | Máximo control, pero mucho más código propio para interacción y accesibilidad. |

## Consecuencias

### Positivas

- Nodos-componente coherentes con el resto de la interfaz y con los dos temas.
- ELK aporta layout automático sin servicio externo.
- La integración React reduce el código de pegamento.
- La ruta a Sigma.js queda acotada a un caso de escala.

### Negativas y riesgos

- React Flow rinde peor que Cytoscape o Sigma con miles de nodos.
- ELK.js usa licencia EPL-2.0; hay que revisar compatibilidad y atribución.
- El layout en Web Worker añade complejidad de empaquetado.
- La accesibilidad de un canvas de nodos requiere una vista alternativa.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Pan/zoom táctil, botones de encuadre y panel de filtros en drawer; modo lectura en móvil. |
| Temas (Claro/Oscuro) | Colores de nodos y aristas con tokens accesibles en ambos temas. |
| Accesibilidad | Navegación por teclado, foco visible, etiquetas y vista de lista alternativa. |
| Seguridad y privacidad | Solo datos del mundo autorizado; sin servicio externo de layout. |
| Coste | 0 €/mes; sin servicio de grafos. |
| Portabilidad de datos | Nodos y aristas se derivan de relaciones exportables en JSON. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Rendimiento con muchos nodos | Límites del navegador | Filtros, expansión de vecinos, límite visible y Sigma.js como escape | M2-04 (#20) |
| Licencia de ELK.js | EPL-2.0 | Revisión de licencia y uso como dependencia no modificada | M0-05 (#6) |
| Complejidad del layout | Sin coste económico | Layout en Web Worker y opción de posiciones manuales | M2-04 (#20) |
| Accesibilidad del canvas | Sin coste económico | Vista de lista y controles de teclado equivalentes | M5-02 (#29) |

## Plan de revisión

Se revisa si el grafo supera de forma habitual los ~1.000 nodos, si ELK deja de
mantenerse o si cambia su licencia. Un cambio de librería de grafo exige un ADR
nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D9 y §3.5
- Documentación oficial de React Flow y ELK.js, consultada el 12/11/2026.
