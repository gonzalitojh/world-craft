# ADR 0014 — Estructura del repositorio y tooling

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-033, D-038
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0017 de la etapa web
- **Relacionados:** ADR 0001, ADR 0010, ADR 0013

## Contexto

La etapa web tenía una estructura Next.js (`src/app`, `src/components`,
`src/lib`) y tooling acoplado a Next. El pivote necesita una estructura que
separe los tres procesos de Electron y permita borrar el código web sin dejar
un esqueleto engañoso.

## Decisión

1. **Aplicación única**, no monorepo:
   ```text
   src/
     main/       Proceso principal: ventana, SQLite, assets, backups, updates, IPC
     preload/    Puente tipado y allowlist de canales
     renderer/   React + Vite: shell, pantallas, componentes, mensajes, estilos
     shared/     Tipos y contratos compartidos (sin Node ni React)
   tests/
     unit/ integration/ e2e/
   docs/
   ```
2. **Node 22 LTS**, **pnpm** y **TypeScript estricto**.
3. **ESLint 10** flat, **Prettier**, **Vitest** y **Playwright Electron**.
4. El baseline del pivote conserva un módulo mínimo
   `src/shared/app-info.ts` y su test para que `lint`, `typecheck`, `test` y
   `build` sigan funcionando sin Next.
5. El scaffold Electron se crea en la primera issue de M0; no se deja código
   web adaptado a medias.
6. Las rutas de producto se crean con su issue y se documentan como previstas
   hasta entonces.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Monorepo con paquetes | Complejidad innecesaria para una sola app. |
| Mantener Next.js y envolverlo en Electron | Arrastra servidor, RSC y dependencias web que no aportan. |
| Borrar todo y dejar el repo vacío | Rompe lint/typecheck/test y oculta el estado real. |
| Estructura por capas globales (`components/`, `hooks/`) | Peor aislamiento entre main, preload y renderer. |

## Consecuencias

### Positivas

- Separación clara de responsabilidades y límites de confianza.
- El baseline sigue verificable tras el pivote.
- El scaffold se añade sin deuda web.
- Los tests se organizan por nivel.

### Negativas y riesgos

- Hay que mantener tres tsconfig/entradas de build.
- El renderer no puede importar código de main; los contratos viven en shared.
- La primera issue de M0 tiene más trabajo de andamiaje.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | `src/main` gestiona la ventana. |
| Temas (Claro/Oscuro) | `src/renderer/styles` y tokens. |
| Accesibilidad | Componentes y pruebas en renderer. |
| Seguridad y privacidad | `src/preload` mínimo y `src/shared` sin Node. |
| Datos y preservación | `src/main/db` y backups. |
| Coste | 0 €/mes. |
| Portabilidad de datos | Exportación en main. |

## Riesgos de free tier y mitigación

No aplica: no hay servicio de pago. El único coste es el tiempo de andamiaje.

## Plan de revisión

Se revisa si la app necesita un monorepo (por ejemplo, para compartir con una
futura versión macOS) o si el baseline mínima estorba. Cualquier cambio de
estructura se documenta en este ADR o en uno nuevo.

## Referencias

- [`docs/arquitectura.md`](../arquitectura.md), §2
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D15
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-033 y D-038
- Documentación de electron-vite y pnpm consultada el 18/11/2026.
