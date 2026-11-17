# Internacionalización

Guía de la base de i18n de World Craft (M0-12, issue
[#42](https://github.com/gonzalitojh/world-craft/issues/42)). El MVP se sirve en
español, pero la estructura ya resuelve el idioma por petición y permite añadir
inglés e italiano sin tocar componentes.

La decisión de producto y su hoja de ruta están en el
[ADR 0012](adr/0012-i18n-centralized-roadmap.md). La sustitución por `next-intl`
cuando llegue la internacionalización completa es B-05 (issue #39).

## 1. Piezas

| Pieza | Ruta | Responsabilidad |
|---|---|---|
| Catálogo | `src/messages/es.ts` | Todos los textos visibles del MVP, con claves tipadas. |
| Contrato | `src/messages/translator.ts` | `Messages`, `MessageKey`, `createTranslator` y utilidades de auditoría (`collectLeaves`, `diffCatalogs`). No importa ningún catálogo. |
| Registro | `src/messages/index.ts` | Catálogos registrados por idioma, `availableLocales`, `getMessages` y `t` de servidor. Marcado con `server-only`. |
| Idiomas y negociación | `src/lib/i18n/locale.ts` | `LOCALES`, `isLocale`, `negotiateLocale` y `resolveLocale`. Funciones puras. |
| Cookie | `src/lib/i18n/cookie.ts` | Nombre `wc-locale` y opciones seguras. |
| Formatos | `src/lib/i18n/format.ts` | Fechas, números, listas y plurales con `Intl`, memoizados. |
| Servidor | `src/lib/i18n/server.ts` | `getLocale` y `getI18n`, memoizados con `cache()` por petición. |
| Acción | `src/lib/i18n/actions.ts` | Server Action `setLocale` con validación Zod. |
| Cliente | `src/components/i18n/locale-provider.tsx` | `LocaleProvider`, `useI18n`, `useMessages` y `useLocale`. |

## 2. Namespaces del catálogo

`src/messages/es.ts` agrupa los textos por el nombre de la superficie que los
usa. Los namespaces actuales son:

| Namespace | Contenido |
|---|---|
| `meta` | Título, descripción y nombre de la aplicación para la Metadata API. |
| `common` | Acciones genéricas (`Cerrar`, `Cancelar`, `Confirmar`). |
| `a11y` | Etiquetas accesibles: enlaces de salto, navegación, cierre de overlays y atajos. |
| `toast`, `command`, `empty` | Avisos, paleta de comandos y estados vacíos de los componentes base. |
| `nav`, `shell`, `theme`, `footer` | Navegación, chrome del espacio de trabajo, selector de tema y pie legal. |
| `home`, `login`, `health` | Pantallas públicas. |
| `error`, `loading`, `notFound` | Estados de error, carga y página no encontrada. |
| `design` | Página viva del sistema de diseño. |

Los namespaces de las superficies futuras —acceso, mundos, fichas, mapas,
manuscritos, juego y ajustes, según los módulos previstos— están **reservados**:
se añaden cuando exista su pantalla y su texto, no antes. No se crean objetos
vacíos ni claves provisionales porque una hoja vacía hace fallar
`tests/unit/messages.test.ts` y `diffCatalogs` la trataría como texto faltante.
El namespace se nombra igual en todos los idiomas; lo que cambia es el contenido,
no la estructura.

## 3. Precedencia del idioma

```text
profiles.locale (M1-06) > cookie wc-locale > Accept-Language > es
```

- Cada fuente se valida contra los catálogos **disponibles**: un valor
  desconocido o un idioma sin catálogo se ignora, no rompe la página.
- `LOCALES` (`es`, `en`, `it`) coincide con el CHECK de `profiles.locale`.
- `availableLocales` solo incluye idiomas con catálogo registrado. Hoy: `es`.
- **Qué está implementado ya:** cookie `wc-locale` y `Accept-Language`, con
  caída a `es`.
- **Qué llega en M1-06 (issue #16):** leer `profiles.locale` con la sesión y
  pasarlo como `profileLocale` a `resolveLocale`. Hoy `getLocale` no consulta la
  base de datos: la fuente del perfil existe en `resolveLocale` y en las pruebas,
  pero todavía no se rellena.

La resolución vive en `resolveLocale` y se prueba en
`tests/unit/i18n-locale.test.ts`. `getLocale` deja la lectura memoizada por
petición, así que las rutas pasan a ser dinámicas; es una consecuencia aceptada
en el plan de M0-12.

## 4. Cookie `wc-locale`

- La escribe **solo** la Server Action `setLocale`; nunca el cliente.
- `HttpOnly`, `SameSite=Lax`, `Path=/`, un año y `Secure` en producción.
- Valor limitado a `LOCALES` y, después, a los catálogos disponibles.
- Sin datos personales: únicamente la etiqueta del idioma.
- **No usa el prefijo `__Host-`** porque ese prefijo exige `Secure` también en
  desarrollo, donde Next se sirve por `http://localhost`; el navegador
  descartaría la cookie y no se podría probar el cambio de idioma. La cookie no
  autoriza nada (no hay sesión detrás), así que el endurecimiento extra no
  aporta y el nombre `wc-locale` no colisiona con otras cookies.

No hay selector visible porque solo existe un idioma. El selector de
preferencias llegará con el perfil en M1-06 y reutilizará `useI18n().setLocale`.

## 5. Servidor y cliente

**Server Components y Server Actions**

```ts
const { t, format, locale, messages } = await getI18n();
```

**Componentes cliente**

```tsx
const { t, format, locale, setLocale, isPending } = useI18n();
```

Reglas:

1. Los componentes cliente **no importan valores** de `@/messages` ni de
   `@/messages/es`: recibirían el catálogo en el bundle. Solo `import type` de
   `@/messages/translator`.
2. `LocaleProvider` se monta una vez en el layout raíz, como proveedor más
   externo.
3. Los textos con contenido dinámico (nombres, recuentos) se componen con el
   catálogo y `format`, no concatenando frases.
4. Si en tiempo de ejecución falta una clave, `createTranslator` devuelve la
   propia clave: falla visible, no en blanco.

## 6. Formatos

`createFormatters(locale)` expone `date`, `dateTime`, `number`, `decimal`,
`relativeTime`, `list` y `plural`. Las instancias de `Intl` se memoizan por
locale y opciones.

- Las fechas se interpretan y se muestran en **UTC** salvo que se pida otra
  zona. La página `/health` usa `<time dateTime={ISO}>` con el instante del
  endpoint y presenta el texto con `Intl`.
- No se combinan `dateStyle`/`timeStyle` con campos sueltos: `Intl` lo prohíbe y
  el helper resuelve el conflicto quitando el estilo por defecto.
- `formatContrastRatio` acepta el locale para que la página del sistema de
  diseño muestre `4,8:1` o `4.8:1` según el idioma.

## 7. Cómo añadir un idioma

1. Copia `src/messages/es.ts` a `src/messages/<locale>.ts` y traduce **todas**
   las hojas. No se admiten stubs ni fallback por clave.
2. Tipa el nuevo catálogo como `Messages` y regístralo en `catalogs` de
   `src/messages/index.ts`.
3. Ejecuta las pruebas. `diffCatalogs` debe devolver `[]` frente al español y la
   auditoría de catálogos debe confirmar que no hay hojas vacías.
4. Verifica que el idioma aparece en `availableLocales`: el registro lo deriva
   automáticamente de `catalogs`, no se edita a mano.
5. Revisa el layout a 360/768/1280 px con los textos más largos del idioma nuevo
   y el formato de fechas y números.
6. Actualiza el manual de usuario, el CHANGELOG y el README si cambia lo que se
   ofrece.

`getMessages` cae al catálogo español si un idioma no está registrado, pero es
solo una red de seguridad: `resolveLocale` y `setLocale` nunca sirven ni guardan
un idioma sin catálogo, así que no existe un fallback por clave que oculte una
traducción incompleta. Una hoja vacía o una clave ausente falla en las pruebas y,
en ejecución, `createTranslator` devuelve la propia clave.

## 8. Pruebas

| Prueba | Qué cubre |
|---|---|
| `tests/unit/i18n-locale.test.ts` | Precedencia, negociación, valores manipulados y límites de `Accept-Language`. |
| `tests/unit/i18n-format.test.ts` | Fechas en UTC, separadores, listas y plurales. |
| `tests/unit/i18n-provider.test.tsx` | Contrato de `useI18n`, pseudo-catálogo y cambio de idioma. |
| `tests/unit/i18n-actions.test.ts` | Validación, idioma sin catálogo, cookie y revalidación. |
| `tests/unit/i18n-hardcoded.test.ts` | Auditoría estática con la API de TypeScript: textos visibles fuera del catálogo e imports prohibidos en cliente. |
| `tests/unit/messages.test.ts` | Claves vacías, catálogos incompletos (fixture) y pseudo-catálogo. |
| `tests/e2e/i18n.spec.ts` | `lang`, preferencias no soportadas y `<time>` localizado en `/health`. |

## 9. Auditoría estática y allowlist

`tests/unit/i18n-hardcoded.test.ts` recorre `src/` con la API de TypeScript y
bloquea dos fallos:

1. **Texto visible fuera del catálogo:** nodos de texto JSX, atributos de
   `VISIBLE_ATTRIBUTES` (`alt`, `aria-label`, `aria-description`,
   `aria-placeholder`, `label`, `note`, `placeholder`, `title`) y cadenas que
   parecen prosa dentro de expresiones JSX.
2. **Import del catálogo desde cliente:** en un archivo `'use client'`, prohíbe
   importar `@/messages`, `@/messages/index`, cualquier módulo de
   `src/messages/` salvo `translator`, y `src/lib/i18n/server`. También cubre
   rutas relativas, `export … from` e `import()` dinámico. `import type` y el
   contrato de `translator.ts` están permitidos porque desaparecen al compilar.

Las excepciones viven en `tests/fixtures/i18n/allowlist.ts`, con archivo, valor
exacto y motivo. La prueba falla si una entrada deja de usarse o si le falta el
motivo, de modo que la lista no crece sin control. Hoy tiene cinco literales:
`Aa`, `rem`, `text-base · font-sans`, `font-mono` y
`text-eyebrow · tracking-eyebrow`, todos técnicos del sistema de diseño.

Limitaciones aceptadas (documentadas en el propio test):

- Solo se revisan los atributos de `VISIBLE_ATTRIBUTES`; una prop visible nueva
  debe añadirse a esa lista.
- En expresiones JSX solo se marcan cadenas que parecen prosa (mayúscula
  inicial, acentos o puntuación); un literal en minúsculas y sin acentos puede
  pasar.
- No se analizan plantillas con interpolación (`${...}`).
- Los textos que llegan como dato (constantes, props o resultados de funciones)
  no son literales JSX y quedan fuera.
- La auditoría complementa la revisión, no la sustituye: un `t()` con una clave
  válida puede seguir mostrando el texto equivocado.

## 10. Relación con `next-intl` y B-05

Esta base no incorpora `next-intl`. El ADR 0012 lo deja para B-05 (issue #39),
cuando haya más de un idioma y haga falta enrutado por locale, plurales con ICU
o carga diferida de catálogos. La diferencia práctica:

| Ahora (M0-12) | `next-intl` (B-05) |
|---|---|
| Catálogo TypeScript importado por el servidor y serializado al cliente por el proveedor. | Catálogos cargados por segmento de ruta y expuestos con un proveedor propio. |
| `t('home.title')` tipado contra el catálogo español. | Mensajes ICU con parámetros, plurales y rich text. |
| Idioma por cookie y cabecera; sin rutas `/es` ni `/en`. | Enrutado por locale y `Link`/`redirect` conscientes del idioma. |
| Sin selector visible: solo `es` tiene catálogo. | Selector y preferencia por perfil con varios catálogos completos. |
| Auditoría estática propia. | ESLint de `next-intl` y las mismas reglas de textos centralizados. |

Lo que **no** cambia con `next-intl`: el catálogo sigue siendo la fuente única,
los namespaces se conservan, los componentes siguen sin cadenas visibles y
`format` sigue usando `Intl`. La migración afecta al acceso y al enrutado, no a
la estructura de las claves. Hasta entonces no se instala la dependencia ni se
promete un selector.

## 11. Privacidad y coste

- La cookie de idioma no identifica a nadie y no se comparte con terceros.
- El catálogo completo se serializa al cliente dentro del `LocaleProvider`; por
  eso `src/messages/` no debe contener información interna, datos personales ni
  secretos.
- `profiles.locale` se exporta con la cuenta cuando exista exportación (M1).
- Sin servicios de traducción ni dependencias nuevas: coste 0 €/mes.
