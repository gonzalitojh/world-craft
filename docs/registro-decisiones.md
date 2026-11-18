# Registro de decisiones de World Craft

Registro append-only de las decisiones de producto y arquitectura tomadas
durante la planificación y el desarrollo. Cada entrada indica la fecha, el
contexto, la decisión, sus consecuencias y las issues afectadas. Las decisiones
arquitectónicas se reflejan también en `docs/adr/`; este registro conserva el
histórico de la conversación y del plan.

> **Nota de alcance.** Las entradas anteriores al 18/11/2026 correspondían a la
> etapa web (Next.js, Supabase, Vercel y Cloudflare R2) y se conservan en el
> historial de git. Este registro se reinicia con el pivote a escritorio: las
> decisiones vigentes son las de esta página y las de los ADRs 0001–0015.

## 2026-11-18 — Pivote a aplicación de escritorio Windows

**Contexto.** La etapa web llegó a M0: shell, sistema de diseño, i18n, esquema
PostgreSQL con RLS y almacenamiento R2. No había producto ni datos reales de
usuarios. El usuario decidió convertir World Craft en una **aplicación de
escritorio Windows instalable**, con persistencia local y sin dependencia de
servicios cloud. El objetivo es coste 0 €/mes, privacidad, funcionamiento
offline y control total de los datos.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-020 | Shell de escritorio | **Electron + Vite + React 19 + TypeScript**. Se descartan Tauri 2, .NET/WPF y Avalonia por el ecosistema React que necesitan Tiptap, React Flow, MapLibre y shadcn/ui. | Instalador más grande (~100 MB) a cambio de madurez, SQLite nativo y actualizaciones. ADR 0001. |
| D-021 | Persistencia | **SQLite + better-sqlite3 + Drizzle ORM + Zod**, con FTS5 para búsqueda y migraciones versionadas. Se descartan `node:sqlite`, libSQL, JSON/lowdb, IndexedDB y PGlite. | Base de datos de un solo archivo, transaccional y portable; operaciones en el proceso principal. ADR 0002. |
| D-022 | Archivos | Assets en el sistema de archivos local, bajo `userData`, con rutas relativas y protocolo propio `wc-asset://` validado. Se descarta `file://`. | El renderer no ve rutas absolutas; las imágenes se re-codifican a WebP con miniaturas. ADR 0005. |
| D-023 | Instalador y actualizaciones | **electron-builder + NSIS por usuario** en `%LOCALAPPDATA%\Programs\World Craft`, sin admin, y **electron-updater** con GitHub Releases. | Actualizar o desinstalar nunca toca `userData`; actualización opcional y cancelable. ADR 0003. |
| D-024 | Seguridad Electron | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, CSP estricta, IPC allowlisted con Zod y sin contenido remoto. | El renderer no accede a Node; cada canal tiene contrato tipado. ADR 0004. |
| D-025 | Modelo de usuario | **Aplicación local de un solo usuario**: sin auth, allowlist, invitaciones, roles por mundo ni RLS. | Desaparecen las tablas y flujos de acceso; la seguridad se centra en el aislamiento del renderer y las rutas. ADR 0011. |
| D-026 | Temas y diseño | **Dos temas, Claro y Oscuro**, con tokens en tres capas, contraste AA y diseño para ratón/teclado. Ventana mínima **1024×700**; referencias 1024, 1280 y 1600. | Sin requisitos móviles ni responsive web; se conserva la estética de «taller de cartógrafo». ADR 0006. |
| D-027 | Editor | **Tiptap 3** sobre ProseMirror, con extensiones propias y contenido JSON + texto plano. Las extensiones Pro no se contratan. | Historial por snapshots propios; colaboración fuera del MVP. ADR 0007. |
| D-028 | Mapas y grafo | **MapLibre GL JS + Terra Draw** con GeoJSON, y **React Flow 12 + ELK.js** para el grafo. | Spike temprano para mapas y exportación SVG; layout en worker y filtros para grafos grandes. ADR 0008. |
| D-029 | Idioma | Español en el MVP, con catálogo tipado y estructura preparada para inglés e italiano; `Intl` para fechas y números. | Sin cadenas visibles dispersas; identificadores en inglés. ADR 0009. |
| D-030 | Pruebas | **Vitest** para dominio, esquema, migraciones e IPC; **Testing Library** para componentes; **Playwright Electron** para E2E; **axe-core**, gitleaks y auditoría de dependencias. | Cada migración y el instalador incluyen prueba de preservación de datos. ADR 0010. |
| D-031 | Copias y recuperación | Copia diaria rotativa, copia previa a cada migración, `PRAGMA integrity_check`, restauración guiada y exportación de mundo en ZIP. | Los datos siempre tienen una copia recuperable; la app arranca en modo seguro si la migración falla. ADR 0012. |
| D-032 | CI y releases | CI en GitHub Actions con `lint`, `typecheck` y `test` como required checks; `gitleaks` y `audit` no bloqueantes; `build` se añade con el scaffold de Electron; releases NSIS en GitHub Releases. | Repo público con Actions gratuitas; sin servicios de pago. ADR 0013. |
| D-033 | Estructura y tooling | Aplicación única, no monorepo, con `src/main`, `src/preload`, `src/renderer` y `src/shared`; Node 22 LTS, pnpm y TypeScript estricto. | Baseline sin Next.js; el scaffold Electron se crea en M0. ADR 0014. |
| D-034 | Firma de código | La firma de Windows queda **opcional, de pago y fuera del MVP**; el instalador se distribuye sin firmar y se documenta SmartScreen. | Solo se adopta con aprobación explícita y ADR propio. ADR 0015. |
| D-035 | Modelo de agentes | Se eliminan `model:` y las variantes fijas del frontmatter de los ocho agentes. Los subagentes heredan el modelo y la variante de la sesión. | El usuario puede usar su suscripción de OpenCode o el modelo gratuito; no se fuerza proveedor. La variante sigue recomendada por issue. |
| D-036 | Catálogo de issues | Se sustituyen los hitos y el catálogo web por M0–M5 de escritorio y Backlog; se añaden `area: desktop`, `area: persistence` y `area: packaging`, y se elimina `area: auth`. | Las issues web se borran con autorización del usuario; los números no se reutilizan. |

### Issues y publicación

El pivote se trabaja en la rama local `docs/desktop-pivot`, con un commit
local y sin push ni PR hasta que el usuario lo pida. Las issues antiguas se
eliminan y el catálogo nuevo empieza en el número siguiente disponible. El
inventario completo de archivos, issues, labels, hitos y cuentas externas está
en [`docs/cambio-a-escritorio.md`](cambio-a-escritorio.md).

## 2026-11-18 — Cierre documental del pivote

**Contexto.** El pivote afecta a reglas, agentes, documentación, tooling y
catálogo de issues. Para que el repositorio no mezcle dos arquitecturas, se
sustituyen los documentos y ADRs web por la serie de escritorio.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-037 | Documentación | Reescribir `AGENTS.md`, plan, arquitectura, proceso, agentes, variantes, persistencia, esquema, migraciones, continuidad, manual, diseño, i18n y calidad; sustituir los ADRs 0001–0020 por 0001–0015. | Los documentos web quedan en el historial de git; no se mantienen en paralelo. |
| D-038 | Limpieza del repositorio | Eliminar el código y la configuración web, conservar un baseline mínimo de tooling (`src/shared/app-info.ts` y su test) y dejar el scaffold Electron para la primera issue de M0. | `lint`, `typecheck` y `test` siguen funcionando sin Next.js; `build` llega con el scaffold de Electron. |
| D-039 | Cuentas externas | El usuario cerrará manualmente Supabase, Vercel, Cloudflare R2, UptimeRobot y los secretos de GitHub Actions de la etapa web. Sentry y Resend no se configuraron; si se hubiera creado alguno, se cierra igualmente. | Se documenta el inventario y las comprobaciones en `docs/cambio-a-escritorio.md`. |
