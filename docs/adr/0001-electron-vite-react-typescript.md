# ADR 0001 — Electron + Vite + React + TypeScript

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-020, D-033
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0001 de la etapa web (Next.js)
- **Relacionados:** ADR 0002, ADR 0004, ADR 0014

## Contexto

World Craft deja de ser una aplicación web y pasa a ser una aplicación de
escritorio Windows instalable. El producto necesita un editor rico, mapas
interactivos, un grafo de relaciones, SQLite local y actualizaciones. El equipo
ya conoce React y TypeScript, y el ecosistema de esas funciones vive
principalmente en React.

## Decisión

Usar **Electron + Vite + React 19 + TypeScript** como base de la aplicación:

1. **Electron** para el proceso principal, la ventana, el acceso a SQLite, el
   sistema de archivos, las actualizaciones y el protocolo de assets.
2. **Vite** para el renderer y para el build de main/preload con
   `electron-vite`.
3. **React 19 + TypeScript estricto** en el renderer.
4. **Node 22 LTS + pnpm** como entorno de desarrollo.
5. Aplicación única, no monorepo.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Tauri 2 | Menor madurez del ecosistema React para editor, grafo y mapas; el runtime y el acceso a SQLite habrían que resolverse con más trabajo. Se reevalúa si el tamaño o la memoria se vuelven un problema. |
| .NET/WPF | Excelente en Windows, pero sin el ecosistema React que necesitan Tiptap, React Flow y MapLibre. |
| Avalonia | Multiplataforma y moderno, pero el mismo problema de ecosistema y menos documentación para este caso. |
| Aplicación web + PWA | Es justo lo que se abandona: dependencia de navegador, límites de almacenamiento y despliegue. |

## Consecuencias

### Positivas

- Un solo lenguaje (TypeScript) en main, preload y renderer.
- Ecosistema completo para editor, grafo, mapas, tabla y componentes.
- SQLite nativo y actualizaciones maduras en Windows.
- La app funciona sin conexión y sin servidor.

### Negativas y riesgos

- Instalador de ~100 MB y consumo de memoria mayor que una app nativa.
- Hay que cuidar el aislamiento del renderer y el tamaño del bundle.
- Electron cambia de versión con frecuencia; se fija y se actualiza con
  Dependabot y pruebas.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Ventana única, mínimo 1024×700, tamaño y posición recordados. |
| Temas (Claro/Oscuro) | El renderer aplica los tokens; Electron no impone tema. |
| Accesibilidad | Se hereda el soporte de Chromium; la app debe cumplir AA. |
| Seguridad y privacidad | `contextIsolation`, `sandbox`, CSP y preload mínimo (ADR 0004). |
| Datos y preservación | SQLite y assets en `userData`; el instalador no los toca. |
| Coste | 0 €/mes: Electron, Vite, React y Node son gratuitos. |
| Portabilidad de datos | Exportación/importación en JSON/ZIP (ADR 0012). |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Tamaño del instalador | ~100 MB | `asar`, compresión, sin dependencias innecesarias | Medir en M0 |
| Memoria en equipos modestos | Depende del equipo | Carga diferida de editor, mapa y grafo | Pruebas de rendimiento M5 |
| Actualizaciones de Electron | Cambios de API | Versión fija, Dependabot y CI | Cada actualización |

## Plan de revisión

Se revisa si Tauri alcanza madurez suficiente para el ecosistema React, si el
tamaño o la memoria se vuelven un problema real, o si Electron deja de ser
viable en Windows. La issue de scaffold de M0 es la primera revisión práctica.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.1 y §3.2 D1
- [`docs/arquitectura.md`](../arquitectura.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-020 y D-033
- Documentación de Electron, Vite y React consultada el 18/11/2026.
