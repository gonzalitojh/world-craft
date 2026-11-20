# Internacionalización

> **Estado:** implementado en M0-11 (#71). Pendiente: persistir el locale del
> perfil y añadir el selector de Ajustes.
> **Ámbito:** catálogo de textos, claves tipadas, locale, formatos y proceso
> para añadir idiomas.

## 1. Objetivo

La interfaz del MVP está en **español**. Todos los textos visibles se
centralizan en un catálogo tipado para que añadir inglés o italiano no obligue
a refactorizar componentes. Los identificadores de código, base de datos y
ramas van en inglés; los comentarios y la documentación, en español.

## 2. Estructura

```text
src/shared/contracts/locale.ts   Locale, idioma de reserva y etiquetas de Intl
src/renderer/messages/
  es.ts                          Catálogo completo del MVP (fuente del tipo)
  index.ts                       MessageCatalog, CATALOGS y getCatalog()
  translator.ts                  MessagePath, createTranslator() y plantillas
src/renderer/i18n/
  create.ts                      createI18n(locale)
  provider.tsx                   I18nProvider, useI18n() y useMessages()
  formats.ts                     createFormatters(locale) sobre Intl
src/main/messages/es.ts          Textos tipados de los diálogos nativos
```

- `es.ts` exporta `es` como objeto `const`. `src/renderer/messages/index.ts`
  deriva de él la forma `MessageCatalog`, que conserva las claves y las firmas
  de las funciones pero ensancha los textos a `string` para que otro idioma
  pueda traducirlos.
- `CATALOGS` está tipado como `Record<Locale, MessageCatalog>`: si un idioma
  figura en `SUPPORTED_LOCALES` y no tiene catálogo completo, el typecheck
  falla.
- `src/shared/contracts/locale.ts` es la única fuente de los idiomas
  soportados, del idioma de reserva y de la etiqueta BCP 47 que recibe `Intl`.
  Es un módulo puro que main, preload y renderer pueden importar.

## 3. Reglas

1. Ningún componente contiene cadenas visibles hardcodeadas. Los componentes
   leen el catálogo con `useMessages()` o `useI18n()`.
2. Las claves son estables, en `camelCase` y agrupadas por dominio:
   `worlds.create.title`, `entities.delete.confirm`, `settings.backup.restore`.
3. No se concatenan fragmentos para formar frases; se usan mensajes completos
   con parámetros. Si un mensaje lleva datos, es una función tipada del
   catálogo (`shell.version`) o una plantilla con marcadores que se resuelve
   con `formatMessage()`.
4. Los plurales se resuelven con `Intl.PluralRules` a través de
   `formatters.plural()`, no con `if` sobre el número.
5. Fechas, números, porcentajes, listas y ordenación usan `Intl` con el locale
   activo del proveedor.
6. Los textos de error visibles también están en el catálogo; los códigos
   internos no se muestran.
7. Los nombres de usuario, mundos y fichas no se traducen.
8. Los textos de `aria-label`, `alt`, `title`, `placeholder` y `aria-live`
   también salen del catálogo.

## 4. Catálogo

### 4.1 Forma

```ts
export const es = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  worlds: {
    create: {
      title: 'Crear mundo',
      submit: 'Crear mundo',
    },
    empty: 'Todavía no hay mundos. Crea el primero para empezar.',
  },
  entities: {
    count: (count: string): string => `${count} fichas`,
  },
} as const;
```

Un mensaje con parámetros es una función pura del catálogo. Para plantillas
nuevas con marcadores también existe `formatMessage('{count} fichas', {
count: '2' })`.

### 4.2 Tipos

```ts
type MessageCatalog = MessageShape<typeof es>;
type MessagePath = MessagePath<MessageCatalog>;
```

`createTranslator(catalog)` devuelve `t(path, ...args)`:

- `path` solo admite claves existentes.
- Los argumentos se derivan de la firma del mensaje.
- Una clave ausente o un argumento incorrecto rompe el typecheck.
- Un catálogo traducido se puede pasar al mismo traductor sin tocar
  componentes.

La prueba `tests/unit/i18n/catalog.test.ts` comprueba las hojas no vacías, la
resolución de parámetros, el fallo de una clave inexistente y que un catálogo
traducido funciona.

## 5. Locale

- Idioma inicial y de reserva: `es`.
- `SUPPORTED_LOCALES` contiene los idiomas con catálogo completo. Hoy solo
  `es`.
- El locale del perfil se resolverá con `resolveLocale()`: un valor ausente,
  corrupto o sin catálogo cae al idioma de reserva y la interfaz nunca se queda
  sin textos.
- El locale se guardará en los ajustes locales de la aplicación y se pasará al
  renderer por el preload. Hasta que exista esa persistencia, `main.tsx` monta
  `I18nProvider` con `DEFAULT_LOCALE`.
- Cambiar de idioma no reinicia la app: el proveedor memoiza
  `createI18n(locale)` y vuelve a pintar los componentes que lo consumen.
- Los formatos usan el locale activo, no el del sistema operativo si difieren.

## 6. Formatos

`createFormatters(locale)` expone:

| Dato | Método | API | Ejemplo |
|---|---|---|---|
| Fecha | `formatDate` | `Intl.DateTimeFormat` | `18 nov 2026` |
| Fecha y hora | `formatDateTime` | `Intl.DateTimeFormat` | `18 nov 2026, 10:30` |
| Número | `formatNumber` | `Intl.NumberFormat` | `1.234` |
| Porcentaje | `formatPercent` | `Intl.NumberFormat` | `42 %` |
| Lista | `formatList` | `Intl.ListFormat` | `A, B y C` |
| Plural | `plural` | `Intl.PluralRules` | `1 ficha`, `2 fichas` |
| Ordenación | `compare` | `Intl.Collator` | Orden alfabético español |

Las fechas se guardan en UTC y se muestran en la zona local del equipo. Los
porcentajes se pasan como fracción (`0.42` → `42 %`). La prueba
`tests/unit/i18n/formats.test.ts` cubre fechas, números, porcentajes, listas,
plurales y ordenación.

## 7. Añadir un idioma

1. Añadir el código a `SUPPORTED_LOCALES` y su etiqueta BCP 47 a
   `INTL_LOCALES` en `src/shared/contracts/locale.ts`.
2. Crear `src/renderer/messages/en.ts` (o `it.ts`) exportando un catálogo que
   cumpla `satisfies MessageCatalog`; traducir todas las claves y conservar las
   firmas de las funciones.
3. Registrarlo en `CATALOGS` de `src/renderer/messages/index.ts`.
4. Ejecutar `test:unit`: `catalog-complete` falla si falta una clave y
   `no-hardcoded` si algún componente introduce un literal.
5. Añadir la opción en Ajustes → Idioma y pasar el locale elegido a
   `I18nProvider`.
6. Revisar textos largos y truncados a 1024 px en los dos temas.
7. Actualizar el manual y el changelog si el cambio es visible.

No se usa una librería de i18n pesada en el MVP: el catálogo tipado y `Intl`
cubren las necesidades. Si en el futuro se necesita carga dinámica o traducción
colaborativa, se valorará en un ADR.

## 8. Pruebas

| Prueba | Archivo | Qué comprueba |
|---|---|---|
| `catalog` | `tests/unit/i18n/catalog.test.ts` | Hojas no vacías, claves tipadas, parámetros, clave ausente y catálogo alternativo. |
| `no-hardcoded` | `tests/unit/i18n/no-hardcoded.test.ts` | El AST de JSX no contiene textos ni atributos visibles literales. |
| `formats` | `tests/unit/i18n/formats.test.ts` | Fechas, números, porcentajes, listas, plurales y ordenación con `Intl`. |
| `status` | `tests/unit/updates/status.test.ts` | Los estados del actualizador usan el catálogo y el formato activos. |
| `provider` | `tests/components/i18n-provider.test.tsx` | Los componentes leen los textos del proveedor. |

Las pruebas se ejecutan con Vitest. La prueba de cadenas hardcodeadas recorre
con la API de TypeScript los `.tsx` de componentes, páginas, shell y `App.tsx`;
ignora atributos técnicos (`className`, `role`, `id`, `type`), comentarios y
puntuación suelta.

## 9. Accesibilidad y textos

- Los textos de `aria-label` y `alt` también están en el catálogo.
- Los mensajes de `aria-live` son completos y no concatenados.
- Los errores de formulario se asocian al campo y se anuncian.
- Las abreviaturas y siglas se explican en el manual o en un tooltip.
- No se usan mayúsculas sostenidas para frases largas.

## 10. Documentos relacionados

- [Sistema de diseño](diseno/sistema-de-diseno.md)
- [Manual de usuario](manual-de-usuario.md)
- [Plan de pruebas](calidad/plan-de-pruebas.md)
- [ADR 0009](adr/0009-centralized-i18n.md)
