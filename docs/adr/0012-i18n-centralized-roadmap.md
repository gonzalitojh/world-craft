# ADR 0012 — Internacionalización centralizada y ruta a inglés e italiano

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-17
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

## Implementación M0-12 (2026-11-17)

La base de i18n se implementó en la issue
[#42](https://github.com/gonzalitojh/world-craft/issues/42). Lo que cambia
respecto al enunciado original de la decisión:

1. **Catálogo y contrato separados.** `src/messages/translator.ts` define
   `Messages`, `MessageKey` y `createTranslator` sin importar ningún catálogo;
   `src/messages/index.ts` registra los catálogos y expone `getMessages`,
   `t` y `availableLocales`. Un componente cliente puede importar el contrato
   (solo tipos) sin arrastrar el español al bundle.
2. **Locale por petición.** `src/lib/i18n/locale.ts` resuelve el idioma con la
   precedencia `profiles.locale` (M1-06) > cookie `wc-locale` >
   `Accept-Language` > `es`. `getLocale` y `getI18n` se memoizan con `cache()` de
   React. Las rutas pasan a ser dinámicas; se acepta como coste del idioma por
   petición.
3. **Cookie solo de servidor.** `setLocale` es una Server Action con Zod que
   escribe `wc-locale` (`HttpOnly`, `SameSite=Lax`, `Path=/`, un año, `Secure`
   en producción) y revalida el layout. El cliente nunca escribe la cookie.
4. **Proveedor único.** `LocaleProvider` recibe únicamente datos serializables
   (`locale`, `messages`, `availableLocales`) y expone `useI18n`; no hay estado
   local del idioma que pueda divergir entre SSR y cliente.
5. **Formatos con `Intl`.** `src/lib/i18n/format.ts` centraliza fechas, números,
   listas y plurales, con UTC por defecto. `/health` publica `<time dateTime>`
   con el ISO del endpoint y texto localizado; `formatContrastRatio` acepta el
   locale.
6. **Catálogos completos.** No hay stubs: `LOCALES` incluye `en` e `it` porque
   son parte del modelo de datos, pero `availableLocales` solo ofrece idiomas con
   catálogo registrado (hoy `es`). Un idioma sin catálogo no se sirve ni se
   ofrece.
7. **Auditoría estática.** `tests/unit/i18n-hardcoded.test.ts` analiza el AST de
   `src/` con la API de TypeScript: detecta texto JSX y atributos visibles fuera
   del catálogo, e imports de `@/messages` (o módulos de servidor) desde
   componentes `'use client'`. Las excepciones viven en una allowlist con motivo
   y sin entradas muertas.

La guía operativa, la precedencia y los pasos para añadir un idioma están en
[`docs/internacionalizacion.md`](../internacionalizacion.md).

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
- **Rutas dinámicas.** Leer cookies y `Accept-Language` con `cache()` obliga a
  renderizar cada ruta por petición: se pierde el render estático mientras el
  idioma dependa de la petición. Se acepta a cambio de no parchear el idioma en
  el cliente.
- **Catálogo serializado.** El `LocaleProvider` envía el catálogo completo al
  cliente para que `useI18n` no depender de una petición extra. Es aceptable con
  un idioma y textos de interfaz, pero crecerá con cada catálogo; B-05 puede
  cargarlo por segmento.
- **Cookie de idioma.** `wc-locale` añade una cookie más y `setLocale` puede
  revalidar el layout sin sesión. No autoriza nada y hoy todas las rutas son
  dinámicas, pero M1-06 debe acotar la invalidación cuando el locale viaje
  también a `profiles.locale`.
- **Sin `en` ni `it` todavía.** `LOCALES` incluye los tres idiomas del modelo de
  datos, pero `availableLocales` solo ofrece `es`; la detección del navegador no
  cambia la interfaz hasta que exista un catálogo completo.
- **Auditoría estática incompleta por diseño.** No detecta plantillas con
  interpolación, literales en minúsculas sin acentos ni textos que llegan como
  dato; complementa la revisión, no la sustituye.
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
| Rutas dinámicas en Vercel Hobby | Dentro del plan gratuito; cada visita ejecuta el servidor | Se acepta mientras el idioma dependa de la petición; revisar con B-05 | B-05 (#39) |
| Cadenas hardcodeadas | Sin coste económico | Búsqueda en revisión y regla 16 de `AGENTS.md` | M5-02 (#29) |
| Textos largos en móvil | Sin coste económico | Pruebas a 360 px con contenido realista | M5-02 (#29) |

## Plan de revisión

Se revisa al abordar B-05, si el producto necesita un tercer idioma o si aparece
un servicio de traducción que merezca la pena. Un cambio de estrategia de i18n
exige un ADR nuevo.

## Referencias

- Issue original: #4
- Implementación: #42 y [`docs/internacionalizacion.md`](../internacionalizacion.md)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D16
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-005
- [`AGENTS.md`](../../AGENTS.md), reglas 11 y 16
