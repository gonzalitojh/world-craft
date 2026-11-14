# ADR 0012 — Internacionalización centralizada y ruta a inglés e italiano

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-005
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0010

## Contexto

El MVP se escribe en español, pero los textos no deben quedar dispersos en
componentes ni construir frases frágiles. El usuario tiene perfil con `locale` y
quiere poder añadir inglés e italiano más adelante sin refactorizar pantallas.
El coste de un servicio de traducción debe ser cero.

## Decisión

1. **Idioma del MVP:** español.
2. **Mensajes centralizados:** todos los textos visibles viven en
   `src/messages/es.ts`, con claves tipadas.
3. **Acceso:** `getMessages` y `LocaleProvider`; los componentes no contienen
   cadenas visibles hardcodeadas.
4. **Formatos:** fechas, números y plurales se resuelven con `Intl` y el
   `locale` del perfil; no se concatenan frases visibles.
5. **Estructura preparada:** añadir `en.ts` e `it.ts` no debe requerir cambios
   en componentes.
6. **Evolución:** `next-intl` (MIT) se incorporará cuando se aborde la
   internacionalización completa (backlog B-05), sin refactorizar componentes.
7. **Idioma del código:** identificadores de código y base de datos en inglés;
   comentarios y documentación en español.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Textos hardcodeados | Dificulta traducir, cambia textos en muchos sitios y rompe la regla 16 de `AGENTS.md`. |
| Internacionalización completa desde el MVP | Añade trabajo y superficie de error antes de tener contenido que traducir. |
| Servicio TMS de pago | Rompe el objetivo de coste cero y no aporta valor con dos idiomas futuros. |
| Traducción automática en el navegador | Calidad impredecible y dependencia externa. |

## Consecuencias

### Positivas

- Un único lugar para revisar y cambiar textos.
- Las claves tipadas detectan mensajes ausentes en compilación.
- Añadir idiomas es incremental y no toca componentes.
- Los formatos respetan la configuración regional del usuario.

### Negativas y riesgos

- Obliga a mantener disciplina y a no escribir cadenas sueltas.
- Añade un nivel de indirección en los componentes.
- Los mensajes largos pueden crecer y afectar al layout; hay que probarlos.
- `next-intl` añadirá una dependencia cuando llegue B-05.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Los textos largos deben envolver y no desbordar a 360 px. |
| Temas (Claro/Oscuro) | Sin impacto directo; los mensajes usan los tokens del ADR 0010. |
| Accesibilidad | Etiquetas y errores traducidos y asociados al campo. |
| Seguridad y privacidad | Sin impacto directo. |
| Coste | 0 €/mes; mensajes en el repositorio y sin TMS. |
| Portabilidad de datos | El `locale` del perfil se exporta con la cuenta. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Servicio de traducción | No se contrata | Mensajes versionados en el repositorio y `next-intl` MIT | B-05 (#39) |
| Deriva de textos | Sin coste económico | Claves tipadas y revisión en QA | M0-12 (#42) |
| Cadenas hardcodeadas | Sin coste económico | Búsqueda en revisión y regla 16 de `AGENTS.md` | M5-02 (#29) |
| Textos largos en móvil | Sin coste económico | Pruebas a 360 px con contenido realista | M5-02 (#29) |

## Plan de revisión

Se revisa al abordar B-05, si el producto necesita un tercer idioma o si aparece
un servicio de traducción que merezca la pena. Un cambio de estrategia de i18n
exige un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D16
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-005
- [`AGENTS.md`](../../AGENTS.md), reglas 11 y 16
