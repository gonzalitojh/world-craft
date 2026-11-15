# ADR 0018 — Sistema de diseño: tokens, componentes y shell

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-15
- **Fecha del documento:** 2026-11-15
- **Issue:** #8 (M0-07)
- **Decisiones del registro:** D-002 y D-016
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0001, ADR 0005, ADR 0009, ADR 0010, ADR 0012, ADR 0015,
  ADR 0017

## Contexto

El ADR 0010 fijó dos temas (Claro y Oscuro), una paleta papel/tinta y WCAG AA,
pero no concretó cómo se organizan los tokens, qué componentes base existen, ni
cómo se estructura el shell responsive. El scaffold del ADR 0017 solo tenía una
única paleta cruda `--craft-*`, un puñado de tokens semánticos, un `Button` y un
tema elegido por `prefers-color-scheme` sin interruptor.

La issue #8 (M0-07) debía entregar el sistema de diseño completo antes de que
lleguen autenticación (M1-01, issue #11), base de datos (M0-08, issue #9) y las
entidades del producto (M1-02, issue #12 y M1-03, issue #13). Sin él, cada
pantalla nueva inventaría sus colores, espaciados y navegación, y el coste de
corregirlo crecería con cada issue.

El usuario aprobó el plan el 15/11/2026 y cerró tres decisiones abiertas: (1) se
aprueban las cuatro dependencias nuevas de Radix y `cmdk`; (2) la textura de
papel se aplaza a M1-02; (3) las capturas de referencia se guardan en el
repositorio como cuatro PNG de viewport (1280 y 360, claro y oscuro).

## Decisión

1. **Tokens en tres capas.** Los estilos viven en `src/styles/` y
   `src/app/globals.css` solo importa.
   - `tokens/palette.css` es la **única fuente de valores `#hex` y `rgb()`** del
     proyecto. Cada color existe dos veces, con sufijo `-light` y `-dark`, y la
     paleta no depende del tema activo.
   - `tokens/semantic.css` asigna un papel a cada color por tema
     (`--surface`, `--surface-raised`, `--surface-sunken`, `--foreground`,
     `--muted-foreground`, `--border`, `--border-strong`, `--accent`,
     `--accent-strong`, `--accent-ink`, `--accent-muted`, `--danger`,
     `--success`, `--warning`, `--info` con sus variantes `-ink` y `-surface`,
     `--focus`, `--overlay` y las elevaciones `--elevation-*`) usando solo
     `var(--craft-*)`, sin ningún valor literal.
   - `@theme inline` de Tailwind mapea esos papeles a utilidades
     (`bg-surface`, `text-foreground`, `border-border`, `shadow-card`…). `inline`
     es obligatorio: las utilidades resuelven `var()` en tiempo de ejecución y
     cambiar de tema no recompila CSS.
   - `tokens/scales.css` contiene lo que no cambia con el tema: tipografía
     fluida con `clamp()`, interlineado, tracking, radios, medidas del shell
     (`--rail-width`, `--rail-width-collapsed`, `--topbar-height`,
     `--bottombar-height`, `--content-max`, `--prose-max`, `--gutter`), capas
     `--z-*` y movimiento `--duration-*` / `--ease-standard`.
     La escala display fija también el **peso en el token**
     (`--text-display-*--font-weight: 600`): la portada, el `h1` de cada página
     y los títulos de `/design-system` comparten trazo sin que cada pantalla
     elija `font-semibold`, y el tamaño decide la jerarquía (`xl` en portada,
     `lg` en el `h1` de página, `md` en secciones y `sm` en títulos cortos). El
     tracking sale siempre de `tracking-display`, nunca de `tracking-tight`.
   - `base.css` aplica borde, superficie, texto, foco global y
     `prefers-reduced-motion`; `motion.css` declara las animaciones de overlays,
     drawers y avisos solo dentro de `prefers-reduced-motion: no-preference`.
   - `tests/unit/tokens.test.ts` es el contrato del CSS: falla si aparece un
     color fuera de `palette.css`, si un tema queda a medias, si un mapeo no
     sale de la paleta o si una pareja baja de AA. Además, compara cada valor
     con `src/lib/theme-palette.ts`, la copia en TypeScript que necesitan
     `themeColor`, el manifest y la página viva.
2. **Doce componentes base, además del `Button` existente.** Los componentes
   viven en `src/components/ui/` y consumen solo utilidades semánticas.
   - **Nativos, sin dependencia:** `input`, `textarea`, `select` nativo (no el
     primitivo de Radix, para conservar teclado, lector de pantalla y selector
     del sistema en móvil), `field` (etiqueta, descripción y error con `useId`,
     `aria-describedby` y `aria-invalid`), `card`, `badge` y `empty-state`
     (con `titleAs`, que por defecto pinta `h3` y baja a `h4` cuando ya hay un
     `h3`: así dos especímenes con el mismo texto no comparten nombre de
     región).
   - **Diálogo y panel sobre `@radix-ui/react-dialog`:** `dialog` y `drawer`
     comparten el mismo primitivo; el drawer cambia posición y animación
     (`data-side`) y **no usa Vaul ni gestos de arrastre**. Los dos exigen título
     accesible y reciben `titleHidden` para casos como la paleta de comandos.
     El botón de cierre se pinta antes de `children` en el documento aunque su
     posición sea absoluta: el orden de tabulación coincide con el visual.
   - **`tabs` sobre `@radix-ui/react-tabs`**, que aporta roles, `aria-selected`,
     `aria-controls` y flechas/Inicio/Fin.
   - **`tooltip` sobre `@radix-ui/react-tooltip`**, con uso restringido a
     botones de icono y al rail colapsado; nunca como única etiqueta accesible,
     porque el globo no existe hasta que se abre.
   - **`toast` propio**, sin `sonner` ni Radix Toast: dos regiones `aria-live`
     persistentes (`polite` y `assertive`), avisos que se pausan al pasar el
     ratón o al enfocar, y variantes con icono y texto además del tono.
   - **`command` con `cmdk`** sobre el diálogo, cargado con
     `next/dynamic({ ssr: false })` solo al abrir la paleta, para no enviar la
     dependencia en el bundle inicial.
3. **Dependencias aprobadas por el usuario el 2026-11-15.**
   `@radix-ui/react-dialog` 1.3.1, `@radix-ui/react-tabs` 1.2.1,
   `@radix-ui/react-tooltip` 1.4.1 y `cmdk` 1.1.1, todas MIT, compatibles con
   React 19 y sin coste. Se mantienen las ya presentes
   (`@radix-ui/react-slot`, `class-variance-authority`, `clsx`,
   `tailwind-merge` y Lucide). No se instala Motion ni el kit completo de
   shadcn/ui.
4. **Shell con route groups y tres anchos.**
   - `(public)` conserva los landmarks existentes (`banner`, `main`,
     `contentinfo`) y el `id="contenido"` del enlace de salto; `(workspace)`
     estrena topbar con migajas, rail y barra inferior. Los route groups no
     cambian las URLs.
   - **768–1023 px:** el rail se colapsa a iconos (`--rail-width-collapsed`) con
     globo de ayuda; **≥1024 px:** rail completo (`--rail-width`) con etiquetas y
     encabezados de grupo; **<768 px:** rail oculto y barra inferior con tres
     destinos y un drawer «Más» (acceso, próximamente, licencia y estado).
   - La topbar es `sticky` y usa `--topbar-height`; el `main` reserva el alto de
     la barra inferior más `env(safe-area-inset-bottom)`.
   - La barra inferior cumple ese alto con `min-h-(--bottombar-height)`: token,
     reserva del `main` y desplazamiento de los avisos miden lo mismo. Su panel
     «Más» (`Drawer side="bottom"`) suma el área segura a su relleno para que la
     última acción no quede bajo la barra del sistema.
   - `src/lib/navigation.ts` concentra datos y funciones puras de navegación,
     migajas y ruta activa, con `disabled` para los destinos sin página: nunca
     se pinta un enlace a una ruta inexistente.
   - Los estados vacíos se documentan como patrón, no como adorno: siempre
     explican qué falta y qué puede hacer la persona.
5. **Tema Claro/Oscuro/Sistema persistente y sin parpadeo.**
   - La preferencia se guarda en `localStorage` bajo `wc-theme`; el tema
     resuelto se escribe en `<html data-theme>` y la preferencia en
     `<html data-theme-preference>` para que el script sepa si debe seguir al
     sistema o mantener una elección explícita.
   - El arranque es un **`<script>` en línea** en el layout raíz, no
     `next/script` con `strategy="beforeInteractive"`: con esa estrategia el
     atributo llegaba tarde y el tema claro se pintaba antes de aplicar el
     oscuro, con parpadeo. Lo comprueba `tests/e2e/themes.spec.ts` («el tema ya
     está resuelto al terminar de parsear el documento»).
   - El script es estático: solo interpola constantes del proyecto, nunca datos
     de usuario. Si `localStorage` o `matchMedia` fallan, cae al tema claro que
     `:root` ya define.
   - `ThemeProvider` lee el DOM con `useSyncExternalStore` en lugar de volcar su
     estado desde un efecto, para no sobrescribir lo resuelto durante la
     hidratación. El selector es un `<select>` nativo etiquetado y accesible por
     teclado.
   - `themeColor` y el manifest derivan de `src/lib/theme-palette.ts`, porque
     ninguno resuelve variables CSS; un test verifica que coincidan con
     `palette.css`.
6. **Página viva y capturas de referencia.** `/design-system` es un Server
   Component con islas cliente para lo interactivo y muestra fundamentos,
   componentes, patrones, accesibilidad y capturas. Las cuatro imágenes de
   [`docs/diseno/capturas/`](../diseno/capturas/) (1280 y 360 px, claro y oscuro)
   se regeneran con `pnpm design:captures`, que ejecuta solo el proyecto
   `captures` de Playwright con viewport, `deviceScaleFactor: 1`,
   `reducedMotion: 'reduce'` y el tema inyectado antes del primer pintado.
7. **Aplazamientos explícitos.** La textura de papel queda para M1-02 (issue
   #12); Motion no se instala y las animaciones son CSS; los tokens de entidad
   (tipos de ficha, mapas, relaciones) quedan para M1-03 (issue #13); la CSP con
   `nonce` o hash sigue pendiente de M1-01 (issue #11), porque el script de tema
   en línea necesita una política que lo autorice.
8. **Deudas aceptadas.** No hay sincronización de tema entre pestañas; la
   etiqueta del selector de tema se oculta por debajo de `sm` (sigue siendo
   `sr-only`, con «Tema» como nombre accesible); `format:check` es sensible a
   CRLF en local; `error.tsx` y `loading.tsx` se cubren solo en pruebas
   unitarias, no en E2E; y las claves `common.*` del catálogo de textos todavía
   no tienen uso.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Un solo archivo de tokens | Mezclar valores crudos, papeles por tema y escalas impide verificar que un color no se escape de la paleta. Tres capas con un test por capa hacen comprobable la regla. |
| Colores literales en `semantic.css` | Rompe la única fuente de verdad y obliga a tocar dos sitios por cada cambio; el test de capas lo impide. |
| `@theme` sin `inline` | Copiaría el valor de `var(--surface)` en el build: cambiar de tema exigiría recompilar CSS. |
| Variantes `dark:` de Tailwind | Dispersan el tema por los componentes y contradicen los selectores agrupados que exige la regla 4 de `AGENTS.md`. |
| Radix Select para `select` | Aporta una lista emergente propia y pierde el selector nativo del sistema en móvil sin ganar nada en accesibilidad. |
| Vaul para el drawer | Se solapa con Radix Dialog y añade gestos de arrastre que obligan a probar teclado, foco y `prefers-reduced-motion` de nuevo; el diálogo ya resuelve lo necesario. |
| `sonner` o Radix Toast | No ofrecen de serie dos regiones `aria-live` persistentes ni la pausa al enfocar que necesita el proyecto; el componente propio es pequeño y verificable. |
| `next/script` con `beforeInteractive` | En esta versión de Next encola el script en `self.__next_s` y lo ejecuta el framework: el atributo llegaba tarde y había parpadeo, comprobado con E2E. |
| Sincronizar la preferencia de tema entre pestañas | Requiere escuchar `storage` y decidir qué pestaña manda; no hay producto que lo necesite todavía. Se registra como deuda. |
| Textura de papel en esta issue | Añade peso y riesgo de contraste; se prueba mejor junto con las entidades de M1-02. |
| Instalar Motion | Las animaciones necesarias caben en CSS y `prefers-reduced-motion`; una dependencia más no aporta valor hoy. |
| Tokens de entidad antes de M1-03 | No hay tipos de ficha ni categorías definidas; inventarlas ahora obligaría a rehacerlas. |
| CSP con `unsafe-inline` para el script de tema | Debilita la política justo donde hay que protegerla; se hará con `nonce` o hash en M1-01. |
| Capturas generadas fuera del repositorio | Sin PNG versionados no hay referencia comparable entre versiones; el script las regenera de forma reproducible. |

## Consecuencias

### Positivas

- Una sola fuente de hex y un test que la protege: es imposible añadir un color
  suelto sin que salte la suite.
- Los componentes usan utilidades semánticas, así que añadir una pantalla no
  exige decidir colores ni duplicar overrides de tema.
- El shell cubre escritorio, tablet y móvil con la misma estructura y sin
  scroll horizontal de página a 360, 768 y 1280 px.
- El tema se resuelve antes del primer pintado y respeta «Sistema», con pruebas
  E2E de que no hay parpadeo.
- La tipografía display tiene una sola fuente de verdad: tamaño, interlineado y
  peso viven en el token, así que ninguna pantalla puede inventar un `h1` más
  ligero o un `tracking` distinto.
- La página `/design-system` documenta el sistema con ejemplos reales y
  contraste medido, y las capturas permiten detectar regresiones visuales.
- Los destinos sin página se anuncian como no disponibles en vez de generar
  enlaces muertos ni 404.
- Las dependencias nuevas son cuatro, MIT, con peers de React 19 y sin coste.

### Negativas y riesgos

- **Disciplina de tokens (LOW).** Cualquier color nuevo debe entrar por
  `palette.css` y mapearse en `semantic.css`; saltarse el orden rompe el test,
  pero el orden en sí depende de revisión.
- **Duplicación deliberada de la paleta (LOW).** `theme-palette.ts` replica los
  colores sólidos porque `themeColor`, el manifest y el cálculo de contraste en
  servidor no resuelven CSS. El test de coincidencia evita que se desincronicen.
- **Sin sincronización de tema entre pestañas (LOW aceptada).** Cambiar el tema
  en una pestaña no lo cambia en las demás hasta recargar.
- **Avisos y barra inferior en móvil (resuelta en la revisión de UI/UX).** El
  aviso era fijo abajo y tapaba la barra de navegación, incluidos sus toques
  (el aviso de error no se cierra solo). El contenedor lleva `data-slot` y una
  regla `:has` en `base.css` lo sube el alto de `--bottombar-height` cuando el
  shell del taller ha pintado la barra, por debajo de `md`. La barra cumple ese
  alto con `min-h-(--bottombar-height)`: antes medía 51 px y el token decía 68,
  así que la reserva del `main` y el aviso no coincidían con la barra real.
- **Foco inicial en el cierre de diálogo y panel (LOW aceptada).** El cierre va
  antes de `children` para que el orden de tabulación coincida con el visual;
  Radix enfoca el primer elemento tabulable, así que al abrir el foco cae en el
  cierre y `Tab` lleva al contenido. Se acepta a cambio de un orden de teclado
  predecible.
- **`format:check` sensible a CRLF en local (LOW aceptada).** En Windows, el
  salto de línea puede hacer fallar la comprobación de Prettier sin que haya un
  cambio real de formato.
- **`error`/`loading` solo en unitarias (LOW aceptada).** Los estados de error y
  carga no tienen E2E propio en esta issue.
- **`common.*` sin uso (LOW aceptada).** Claves del catálogo reservadas para
  piezas compartidas que aún no existen.
- **Superficie del sistema crece.** Doce componentes y un shell completo añaden
  código que hay que mantener; se compensa con tests de componentes y con la
  página viva como referencia.
- **Dependencia de Radix.** Cuatro paquetes con versiones mayores propias
  obligan a seguir sus cambios; Dependabot los agrupa y la política de
  antigüedad de 24 h de pnpm frena versiones recién publicadas.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Rail de iconos entre 768 y 1023 px, rail completo desde 1024 px y barra inferior con drawer por debajo de 768 px. `main` reserva la barra inferior y el área segura. Sin scroll horizontal de página a 360, 768 y 1280 px, con contenido largo y palabras sin espacios. |
| Temas (Claro/Oscuro) | Dos temas reales con preferencia Claro/Oscuro/Sistema persistida en `wc-theme`; el claro funciona sin JavaScript y el oscuro se aplica antes del primer pintado. Contraste AA medido en el test de tokens y revisado en la página viva. |
| Accesibilidad | Foco visible global, navegación completa por teclado, títulos obligatorios en diálogo y drawer, dos regiones `aria-live` en los avisos, tooltip solo como refuerzo, objetivos táctiles de 44 px y `prefers-reduced-motion` respetado en CSS. |
| Seguridad y privacidad | El script de tema es estático y no interpola datos de usuario; el tema es una preferencia local sin datos personales. La CSP con `nonce`/hash sigue pendiente de M1-01. Las dependencias nuevas son MIT y se auditan con `pnpm audit`. |
| Coste | 0 €/mes: cuatro dependencias libres, fuentes autoalojadas y capturas generadas en local. No se añade ningún servicio. |
| Portabilidad de datos | No hay modelo de datos ni contenido de usuario; el tema es una preferencia local y no se introduce ningún formato propietario. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Peso del bundle por `cmdk` y Radix | Ancho de banda y builds de Vercel Hobby (ADR 0005 y ADR 0013) | `cmdk` se carga con `next/dynamic({ ssr: false })` al abrir la paleta; Radix se importa por primitivo, no como kit completo. | Línea base de Lighthouse y facturación de Vercel |
| PNG de referencia en el repositorio | Tamaño del repositorio y del clon | Cuatro imágenes de viewport (no página completa), con límites de tamaño en la prueba y sin datos reales. | `tests/e2e/captures.spec.ts` |
| Descarga de Chromium para regenerar capturas | ~350 MB y minutos de máquina en local o CI | Solo se ejecuta con `pnpm design:captures`; la suite funcional lo ignora y en CI no es obligatorio. | Workflow `e2e` |
| Dependencias de terceros | Sin coste económico | Licencias MIT, peers de React 19 y `pnpm audit --audit-level=high`; Dependabot agrupa minor y patch. | CI y Dependabot |
| Fuentes autoalojadas | Ancho de banda de Vercel | `next/font` las sirve desde el propio dominio con `display: 'swap'`; el navegador no contacta con Google. | Línea base de Lighthouse |

No se añade ningún servicio de pago ni se supera un free tier conocido.

## Plan de revisión

Se revisa en M1-01 (issue #11) al añadir la CSP con `nonce` o hash que autorice
el script de tema; en M1-02 (issue #12) al incorporar la textura de papel y las
entidades; en M1-03 (issue #13) al definir los tokens de entidad; en M0-09
(issue #10) al documentar la arquitectura y el manual de usuario; y en M5-02
(issue #29) en la revisión de accesibilidad. También se revisa si se plantea un
tercer tema, si cambia la dirección visual, si una dependencia cambia de
licencia o de peers, o si la sincronización de tema entre pestañas pasa a ser
necesaria. Reabre la decisión una issue de `area: ui`, `area: accessibility`,
`area: security` o `area: architecture`.

## Referencias

- Issue: [#8](https://github.com/gonzalitojh/world-craft/issues/8)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D2 y D15, §3.6
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-002 y D-016
- [ADR 0010](0010-two-themes-design-system.md), decisión de dos temas y
  contraste AA que este ADR desarrolla
- [ADR 0012](0012-i18n-centralized-roadmap.md), textos centralizados y tipados
- [ADR 0017](0017-nextjs-scaffold-and-env-contract.md), scaffold, Tailwind
  CSS-first, `data-theme` y deuda de CSP
- [`docs/diseno/sistema-de-diseno.md`](../diseno/sistema-de-diseno.md), guía
  práctica de tokens, componentes y shell
- [`docs/diseno/capturas/`](../diseno/capturas/), capturas de referencia
- [`AGENTS.md`](../../AGENTS.md), reglas 2, 3, 4 y 14
- Documentación oficial de Radix UI (Dialog, Tabs y Tooltip), `cmdk`, Tailwind
  CSS 4 (`@theme inline`) y Next.js 16 (`next/dynamic` y `next/script`),
  consultada el 15/11/2026
