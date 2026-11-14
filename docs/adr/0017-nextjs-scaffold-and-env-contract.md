# ADR 0017 — Scaffold de Next.js y contrato de entorno

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-14
- **Fecha del documento:** 2026-11-14
- **Issue:** #7 (M0-06)
- **Decisiones del registro:** D-015
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0016
- **Relacionados:** ADR 0001, ADR 0005, ADR 0009, ADR 0010, ADR 0012, ADR 0015, ADR 0016

## Contexto

El ADR 0016 dejó un repositorio reproducible con TypeScript, ESLint, Prettier,
Vitest, Playwright y CI, pero deliberadamente **sin aplicación**: el único
código de producto era `src/lib/env.ts`, `build` compilaba con `tsc` a `dist` y
el esquema de entorno mezclaba claves públicas y de servidor. La issue #7
(M0-06) debía entregar la primera base ejecutable —Next.js con App Router,
TypeScript estricto, Tailwind CSS, shadcn/ui mínimo, fuentes, páginas base,
metadatos y validación de entorno— sin adelantar autenticación (M1-01, issue
#11), base de datos (M0-08, issue #9) ni el sistema de diseño completo (M0-07,
issue #8).

El usuario aprobó el plan de la issue el 14/11/2026, incluida la integración
manual del scaffold, la separación del entorno en esquemas público y de
servidor y que el proyecto de Vercel lo conecte él al publicar. Las versiones
debían respetar la política de antigüedad mínima de 24 h de pnpm 12 y los peers
declarados por las herramientas ya instaladas, lo que condicionó varias
elecciones (ESLint y `jsx`).

## Decisión

1. **Stack y versiones.** Next.js 16.4.6 con App Router, React 19.3.1 y React
   DOM 19.3.1, TypeScript 5.9.3 en modo estricto. Se mantienen las flags del
   ADR 0016 (`strict`, `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`,
   `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: Bundler`) y se
   añaden `jsx: "react-jsx"`, `incremental`, el plugin de Next y el alias
   `@/*` → `src/*`. Se elimina `tsconfig.build.json` y la compilación a `dist`:
   el artefacto es `.next`, generado por `next build`.
2. **Desviación del plan en `jsx`.** El plan preveía `jsx: "preserve"`, pero
   Next.js 16 impone `react-jsx` y reescribe `tsconfig.json` en cada arranque.
   Se adopta el valor que impone el framework para que la configuración
   versionada coincida con la que se ejecuta y no aparezcan diffs espurios.
3. **Scripts.** `dev` (`next dev`), `build` (`next build`), `start`
   (`next start`), `clean` (`node scripts/clean.mjs`, multiplataforma, borra
   `.next`, `dist`, `coverage`, `playwright-report` y `test-results`), `lint`
   (`eslint .`, porque Next 16 ya no incluye `next lint`), `typecheck`
   (`tsc --noEmit`), `test`, `test:e2e`, `format` y `format:check`.
4. **Tailwind CSS 4.3.5 CSS-first.** Sin `tailwind.config`: `@import
   'tailwindcss'` y `@theme inline` en `src/app/globals.css`, con
   `@tailwindcss/postcss` y PostCSS 8.5.32. Una única paleta cruda `--craft-*`
   y tokens semánticos mínimos (`surface`, `foreground`, `surface-raised`,
   `muted-foreground`, `border`, `accent`, `accent-ink`, `danger`,
   `danger-ink`, `focus`). Los componentes usan solo las utilidades semánticas
   (`bg-surface`, `text-foreground`…), nunca la paleta cruda ni variantes
   `dark:`. El sistema de diseño completo sigue siendo de M0-07.
5. **Tema por preferencia del sistema, sin interruptor.** `:root` y
   `[data-theme="light"]` sirven el tema claro completo (funciona sin
   JavaScript); `[data-theme="dark"]` aplica el oscuro. Un script inline en el
   `body` fija `data-theme` desde `prefers-color-scheme` antes del primer
   pintado y lo mantiene sincronizado si el sistema cambia. No hay toggle
   visible hasta M0-07, que también definirá la persistencia de la preferencia.
6. **shadcn/ui mínimo.** `components.json` (estilo `new-york`, RSC, alias
   `@/components`, `@/lib`, `@/lib/utils`), `cn` con `clsx` y `tailwind-merge`
   en `src/lib/utils.ts`, y solo el componente `Button` adaptado a los tokens.
   Lucide 1.72.0 como librería de iconos. No se instala el kit completo ni
   Motion.
7. **Contrato de entorno público/servidor.** Se elimina `src/lib/env.ts` y se
   separa en cuatro módulos:
   - `src/lib/env/public-schema.ts`: esquema Zod de `NEXT_PUBLIC_SITE_URL`
     (solo `http`/`https`), helpers de cadena vacía y `parsePublicEnv`, que
     **copia únicamente claves `NEXT_PUBLIC_*`** aunque reciba `process.env`
     completo.
   - `src/lib/env/public.ts`: `publicEnv` validado, importable desde cliente.
   - `src/lib/env/server-schema.ts`: esquema puro de servidor (variables
     públicas + `NODE_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`, Supabase,
     `DATABASE_URL` y R2, todas opcionales salvo `NODE_ENV`).
   - `src/lib/env/server.ts`: `serverEnv` con `import 'server-only'`, de modo
     que importarlo desde un componente cliente rompe la compilación.
   Las cadenas vacías se tratan como ausentes. `src/lib/site-url.ts` resuelve
   el origen del sitio con el orden `NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_URL}`
   → `http://localhost:3000`, restringido a `http`/`https`.
8. **Rutas base y textos.** App Router con `/` (portada de fase), `/login`
   (placeholder con botón deshabilitado, sin formulario), `/health` (estado del
   despliegue: commit corto, hora de comprobación y enlace al endpoint),
   `/api/health` (JSON `{ status, timestamp }` con `dynamic = 'force-dynamic'`
   y `Cache-Control: no-store`), más `error.tsx` (sin `message` ni `digest`),
   `loading.tsx` y `not-found.tsx`. Todos los textos visibles, incluidos
   `aria-label`, viven en `src/messages/es.ts` y se leen con `t()` o
   `getMessages()`, con claves tipadas derivadas del catálogo (ADR 0012).
9. **Metadatos, assets y cabeceras.** `layout.tsx` define `metadataBase` a
   partir del origen resuelto, título con plantilla, descripción,
   `applicationName`, `robots: { index: false, follow: false }` (aplicación
   privada), manifest y `icon.svg`; `viewport` declara `colorScheme: 'light
   dark'` y `themeColor` para ambos esquemas. `manifest.ts` es mínimo (nombre,
   icono SVG, colores, `standalone`) y no incluye service worker. `next.config.ts`
   fija `reactStrictMode`, la raíz de Turbopack, `allowedDevOrigins` para
   Playwright en `127.0.0.1`, `poweredByHeader: false`, formatos AVIF/WebP,
   `dangerouslyAllowSVG: false` y las cabeceras `X-Content-Type-Options:
   nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy:
   strict-origin-when-cross-origin`.
10. **CSP y `Permissions-Policy` diferidas.** El scaffold no emite Content
    Security Policy: el script de tema es inline y una CSP con `nonce` exige
    integrarla con el renderizado dinámico y la sesión que llegan con M1-01.
    Se registra como deuda **MEDIUM** aceptada; el contenido actual es
    estático, sin autenticación ni datos. `Permissions-Policy` se añadirá en la
    misma issue.
11. **Fuentes autoalojadas.** Fraunces (display), Inter (interfaz) y JetBrains
    Mono (datos técnicos) con `next/font/google`, servidas desde el propio
    dominio con `display: 'swap'`: el navegador no hace peticiones a Google.
12. **ESLint sin `eslint-config-next`.** `eslint-config-next` todavía declara
    peers incompatibles con ESLint 10.14.0, así que se aplican
    `@next/eslint-plugin-next` 16.4.6 y `eslint-plugin-react-hooks` 7.1.1 por
    separado, solo a `**/*.{ts,tsx}`, sobre `@eslint/js`, `typescript-eslint` y
    `eslint-config-prettier`.
13. **Pruebas y calidad.** Vitest 5 con entorno `node`, alias `@` y tests de
    esquemas, mensajes, `cn`, health, `site-url` y `Button`; Playwright 1.65.0
    con `webServer` (`corepack pnpm dev`) y E2E de rutas, API, 404, responsive
    (360/768/1280), dos temas y axe. CI mantiene los IDs de los required checks
    (`lint`, `typecheck`, `test`, `build`), define `NEXT_TELEMETRY_DISABLED=1` y
    ejecuta `next build` y el E2E con servidor; `e2e`, `gitleaks` y `audit`
    siguen sin bloquear.
14. **Línea base de Lighthouse.** Se mide con Lighthouse 13.6.0 contra
    `next start` en móvil y escritorio y se registra en
    [`docs/calidad/linea-base-lighthouse.md`](../calidad/linea-base-lighthouse.md)
    sin fijar umbrales.
15. **Vercel.** El repositorio queda listo para importarlo como proyecto
    (framework autodetectado, Node desde `.nvmrc`, variables públicas y de
    servidor separadas). La conexión del proyecto y la generación de la
    **preview** son una acción del propietario al publicar; el criterio de
    aceptación queda pendiente de esa acción externa.
16. **`agentRules: false`.** Next.js 16 puede escribir bloques de instrucciones
    para agentes en `AGENTS.md`. El proyecto ya lo gobierna con el proceso SDD
    y el ADR 0015, así que se desactiva para que el framework no añada ni
    reescriba contenido.
17. **Relación con el ADR 0016.** Este ADR supersede al 0016 porque cambian los
    scripts, el `tsconfig`, el esquema de entorno y la configuración de ESLint.
    Se mantienen expresamente las subdecisiones del 0016 sobre Node 22 LTS,
    pnpm vía Corepack y lockfile congelado, CI con los cuatro required checks,
    gitleaks con `pnpm audit --audit-level=high`, Dependabot semanal y
    protección de ramas. El 0016 se conserva íntegro como histórico.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `create-next-app` | El repositorio ya tenía `package.json`, `tsconfig`, ESLint, Vitest, Playwright y CI de la issue #6; el generador habría sobrescrito o duplicado configuración y no respeta las versiones fijadas por la ventana de pnpm 12. La integración manual deja un diff revisable. |
| Mantener `tsconfig.build.json` y compilar con `tsc` a `dist` | Next.js genera su propio artefacto en `.next`; mantener dos salidas duplicaba configuración y scripts sin uso real. |
| `jsx: "preserve"` como decía el plan | Next.js 16 lo reescribe a `react-jsx` en cada arranque: versionar `preserve` produciría diffs constantes y una configuración distinta a la ejecutada. |
| `eslint-config-next` | Sus peers no aceptan ESLint 10.14.0; los plugins de Next y React Hooks por separado dan la misma cobertura sin degradar ESLint. |
| Un único esquema de entorno como en el ADR 0016 | Mezclar claves públicas y secretas permite que un import accidental arrastre secretos al bundle del cliente. La separación con `server-only` convierte ese error en un fallo de compilación. |
| Solo variables CSS con `@media (prefers-color-scheme)` | Duplicaría todos los mapeos y dificultaría el toggle de M0-07. `data-theme` con una paleta cruda única permite cambiar de tema sin recompilar CSS ni duplicar reglas. |
| Variantes `dark:` de Tailwind | Dispersan el tema por los componentes y contradicen el patrón de selectores agrupados que exige la regla 4 de `AGENTS.md`. |
| Instalar el kit completo de shadcn/ui y Motion en M0-06 | No hay producto que los use todavía; se añadirán componentes cuando una pantalla los necesite. |
| CSP con `nonce` en esta issue | Requiere renderizado dinámico y una fuente de nonce por petición que llegará con la sesión de M1-01; aplicarla ahora obligaría a debilitarla con `unsafe-inline`. |
| Toggle de tema visible en M0-06 | La preferencia y el control pertenecen al sistema de diseño de M0-07; adelantarlo obligaba a decidir persistencia y UI sin ese marco. |
| Conectar el proyecto de Vercel desde el repositorio | Requiere credenciales y una cuenta del propietario; el repositorio solo puede dejar la configuración documentada. |

## Consecuencias

### Positivas

- Un clon se arranca con `corepack enable`, `pnpm install` y `pnpm dev`, y se
  verifica con `typecheck`, `lint`, `test` y `build` sin servicios externos.
- La separación público/servidor convierte una fuga de secretos al cliente en
  un error de compilación y está cubierta por tests.
- El tema claro funciona sin JavaScript y el oscuro se aplica antes del primer
  pintado, sin parpadeo ni dependencia de una preferencia guardada.
- Los textos centralizados y tipados hacen que una clave inexistente falle en
  compilación (ADR 0012).
- La CI existente sigue siendo válida: no cambian los IDs de los required
  checks ni la protección de ramas.
- La línea base de Lighthouse deja una referencia reproducible antes de que
  exista producto.

### Negativas y riesgos

- **Deuda de CSP (MEDIUM aceptada).** Sin Content Security Policy, el script
  de tema inline y cualquier contenido futuro no tienen una segunda línea de
  defensa. Se cierra con `nonce`/hash y `Permissions-Policy` en M1-01; el
  contenido actual es estático y sin datos.
- **`server-schema.ts` sin `server-only` (LOW aceptada).** Solo `server.ts`
  lleva la marca, porque los tests importan el esquema puro. La disciplina de
  imports se documenta aquí y en el README; no hay valores de secretos en el
  módulo.
- **`/health` muestra los 7 primeros caracteres de `VERCEL_GIT_COMMIT_SHA`
  (LOW aceptada).** El repositorio es público y `/api/health` no expone el
  commit; se acepta como dato de diagnóstico.
- **Duplicación de colores literales.** `themeColor` en `layout.tsx` y los
  colores del manifest no admiten variables CSS; replican `--craft-paper` y
  `--craft-night`/`--craft-ink` y llevan comentario. Si cambian los tokens hay
  que cambiarlos a mano.
- **Sin toggle de tema.** Hasta M0-07 el usuario no puede forzar un tema
  distinto al del sistema.
- **Desviación de `jsx`.** La configuración difiere del plan aprobado;
  se documenta aquí para que no se interprete como un cambio de alcance.
- **Preview de Vercel pendiente.** El criterio de aceptación no puede
  verificarse hasta que el propietario conecte el proyecto al publicar.
- **Rendimiento de la línea base.** Con el Chromium de Playwright la portada
  puntúa 69 (móvil) y 75 (escritorio) por la CPU del entorno; con Chrome
  estable sube a 97/100. Son cifras de referencia, no umbrales.
- **Vulnerabilidad moderada de `minimatch`** compartida por `eslint` y
  `typescript-eslint`, sin parche compatible; se mantiene el riesgo de tooling
  ya aceptado en el ADR 0016 (`pnpm audit --audit-level=high` en verde).

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Layout fluido con unidades relativas; comprobado de 320 a 1920 px en `/`, `/login`, `/health` y 404, sin scroll horizontal de página y con contenido largo. |
| Temas (Claro/Oscuro) | Dos temas reales desde el scaffold: claro por defecto en `:root`, oscuro por `data-theme`; contraste AA verificado en reposo, hover y foco; toggle en M0-07. |
| Accesibilidad | Un solo `h1`, landmarks, enlace «Saltar al contenido», foco visible, `prefers-reduced-motion`, estados con icono y texto, y axe sin hallazgos críticos ni graves en cuatro rutas y dos temas. |
| Seguridad y privacidad | Entorno público/servidor con `server-only`, `robots: noindex`, cabeceras de seguridad, `poweredByHeader: false`, SVG no inline, telemetría de Next desactivada en CI; CSP pendiente de M1-01. |
| Coste | 0 €/mes: Vercel Hobby, GitHub Actions en repositorio público, fuentes autoalojadas y herramientas de licencia libre. |
| Portabilidad de datos | No aplica todavía: no hay modelo de datos ni contenido de usuario. Los textos son un catálogo tipado y no se introduce ningún formato propietario. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Ancho de banda y builds de Vercel Hobby | Límites del plan Hobby descritos en el ADR 0005 y revisados en el ADR 0013 | Mantener el scaffold ligero (23 peticiones y ~300 KiB en la línea base), sin recursos de terceros y con fuentes autoalojadas. | Facturación de Vercel y ADR 0013 |
| Minutos de GitHub Actions | Repositorio público: sin límite de minutos; 2.000 min/mes si pasara a privado | Jobs ligeros y caché de pnpm; el E2E descarga Chromium solo en su job no bloqueante. | Pestaña Actions |
| Descarga de Chromium en cada ejecución de E2E | ~350 MB por job y minutos de CI | Job `e2e` no required y caché opcional si crece el uso. | Workflow `e2e` |
| Peticiones a Google Fonts | Cuota y dependencia de terceros | `next/font/google` descarga y autoaloja las fuentes en el build; el navegador no contacta con Google. | `layout.tsx` y línea base |
| Lighthouse medido en local | No consume servicio, pero depende de la CPU del host | Se registra el `benchmarkIndex` y una medición de control con Chrome estable; no se fijan umbrales. | `docs/calidad/linea-base-lighthouse.md` |

No se añade ningún servicio de pago ni se supera un free tier conocido.

## Plan de revisión

Se revisa en M0-07 (issue #8) al introducir el sistema de diseño, el toggle de
tema y los tokens definitivos; en M1-01 (issue #11) al añadir autenticación,
CSP con `nonce` y `Permissions-Policy`; en M0-08 (issue #9) cuando Supabase
exija claves obligatorias y se endurezca `server-schema.ts`; y en M0-09 (issue
#10) al documentar la arquitectura y el manual. También se revisa al subir de
versión mayor de Next.js, React, Tailwind o ESLint, si cambian los free tiers
de Vercel o GitHub, o si la preview de Vercel revela una configuración
distinta. Reabre la decisión una issue de `area: infra`, `area: architecture`,
`area: ui` o `area: security`.

## Referencias

- Issue: [#7](https://github.com/gonzalitojh/world-craft/issues/7)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D17, §3.7 y §4.7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-013, D-014 y
  D-015
- [ADR 0016](0016-entorno-tooling-ci.md), supersedido por este ADR
- [ADR 0001](0001-nextjs-app-router.md), [ADR 0005](0005-vercel-hobby.md),
  [ADR 0009](0009-testing-pwa-backups.md),
  [ADR 0010](0010-two-themes-design-system.md),
  [ADR 0012](0012-i18n-centralized-roadmap.md) y
  [ADR 0015](0015-coste-contexto-cache-variante-fija.md)
- [`docs/calidad/linea-base-lighthouse.md`](../calidad/linea-base-lighthouse.md)
- [`README.md`](../../README.md), secciones de stack, entorno, temas, calidad y
  despliegue
- Documentación oficial de Next.js 16 (App Router, `agentRules`, fuentes,
  metadatos y cabeceras), Tailwind CSS 4 (CSS-first y `@theme inline`), shadcn/ui,
  ESLint 10 y Lighthouse 13, consultada el 14/11/2026.
