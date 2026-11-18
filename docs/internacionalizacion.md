# Internacionalización

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** catálogo de textos, claves tipadas, locale, formatos y proceso
> para añadir idiomas.

## 1. Objetivo

La interfaz del MVP está en **español**. Todos los textos visibles se
centralizan en un catálogo tipado para que añadir inglés o italiano no obligue
a refactorizar componentes. Los identificadores de código, base de datos y
ramas van en inglés; los comentarios y la documentación, en español.

## 2. Estructura

```text
src/renderer/messages/
  es.ts          Catálogo completo del MVP
  index.ts       Tipos, locale por defecto y carga
  translator.ts  Resolución de claves y plurales
```

La ruta se creará con el scaffold del renderer; es el contrato previsto, no un
archivo existente. El catálogo se exporta como objeto const para que TypeScript
derive las claves válidas.

## 3. Reglas

1. Ningún componente contiene cadenas visibles hardcodeadas.
2. Las claves son estables, en `camelCase` y agrupadas por dominio:
   `worlds.create.title`, `entities.delete.confirm`, `settings.backup.restore`.
3. No se concatenan fragmentos para formar frases; se usan mensajes completos
   con parámetros.
4. Los plurales se resuelven con `Intl.PluralRules`, no con `if` sobre el
   número.
5. Fechas, números, monedas y listas usan `Intl` con el `locale` activo.
6. Los textos de error visibles también están en el catálogo; los códigos
   internos no se muestran.
7. Los nombres de usuario, mundos y fichas no se traducen.

## 4. Catálogo

### 4.1 Forma

```ts
export const es = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    search: 'Buscar',
    loading: 'Cargando…',
    retry: 'Reintentar',
  },
  worlds: {
    create: {
      title: 'Crear mundo',
      name: 'Nombre del mundo',
      submit: 'Crear mundo',
    },
    empty: 'Todavía no hay mundos. Crea el primero para empezar.',
  },
  entities: {
    count: {
      one: '{count} ficha',
      other: '{count} fichas',
    },
  },
} as const;
```

### 4.2 Tipos

```ts
type MessageCatalog = typeof es;
type MessageKey = DotPath<MessageCatalog>;
```

El traductor acepta solo claves existentes. Un texto que falte rompe el
typecheck, no la interfaz en tiempo de ejecución.

## 5. Locale

- Idioma inicial: `es`.
- El locale se guarda en `config.json` (`locale: "es"`).
- La app detecta el idioma del sistema solo como propuesta; el usuario decide.
- El locale activo se pasa al renderer por el preload, no se lee de
  `navigator.language` en cada componente.
- Cambiar de idioma no reinicia la app; el catálogo se recarga y la interfaz se
  vuelve a pintar.
- Los formatos usan el locale activo, no el del sistema operativo si difieren.

## 6. Formatos

| Dato | API | Ejemplo |
|---|---|---|
| Fecha corta | `Intl.DateTimeFormat` | `18 nov 2026` |
| Fecha y hora | `Intl.DateTimeFormat` | `18 nov 2026, 10:30` |
| Número | `Intl.NumberFormat` | `1.234` |
| Porcentaje | `Intl.NumberFormat` | `12 %` |
| Lista | `Intl.ListFormat` | `A, B y C` |
| Plural | `Intl.PluralRules` | `1 ficha`, `2 fichas` |
| Ordenación | `Intl.Collator` | Orden alfabético español |

Las fechas se guardan en UTC y se muestran en la zona local del equipo.

## 7. Añadir un idioma

1. Copiar `es.ts` a `en.ts` y traducir todas las claves.
2. Añadir el catálogo a `index.ts` y al tipo `Locale`.
3. Añadir la opción en Ajustes → Idioma.
4. Ejecutar la prueba de catálogo completo: todas las claves del español deben
   existir en el nuevo idioma.
5. Revisar textos largos y truncados en la interfaz.
6. Actualizar el manual si el cambio es visible.

No se usa una librería de i18n pesada en el MVP: el catálogo tipado y `Intl`
cubren las necesidades. Si en el futuro se necesita carga dinámica o traducción
colaborativa, se valorará en un ADR.

## 8. Pruebas

| Prueba | Qué comprueba |
|---|---|
| `catalog-complete` | Todas las claves usadas existen y no hay claves huérfanas. |
| `no-hardcoded` | Los componentes no contienen textos visibles literales. |
| `plural` | Los plurales usan `Intl.PluralRules`. |
| `format` | Fechas y números usan `Intl` y el locale activo. |
| `locale-switch` | Cambiar de idioma no rompe la interfaz. |

Las pruebas se ejecutan con Vitest. La prueba de cadenas hardcodeadas revisa
los archivos del renderer y excluye comentarios, rutas y nombres técnicos.

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
