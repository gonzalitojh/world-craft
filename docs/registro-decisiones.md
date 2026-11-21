# Registro de decisiones de World Craft

Registro append-only de las decisiones de producto y arquitectura tomadas
durante la planificación y el desarrollo. Cada entrada indica la fecha, el
contexto, la decisión, sus consecuencias y las issues afectadas. Las decisiones
arquitectónicas se reflejan también en `docs/adr/`; este registro conserva el
histórico de la conversación y del plan.

> **Nota de alcance.** Las entradas anteriores al 18/11/2026 correspondían a la
> etapa web (Next.js, Supabase, Vercel y Cloudflare R2) y se conservan en el
> historial de git. Este registro se reinicia con el pivote a escritorio: las
> decisiones vigentes son las de esta página y las de los ADRs 0001–0023.

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

## 2026-11-18 — Persistencia local implementada (M0-04)

**Contexto.** La issue #64 convierte la decisión de persistencia del pivote en
infraestructura ejecutable: abrir SQLite en `userData`, comprobar integridad,
migrar con copia previa y arrancar en modo seguro si algo falla. Todavía no hay
instalador ni tablas de dominio; la restauración guiada y la interfaz de copias
pertenecen a M0-07.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-040 | SQLite, migraciones y modo seguro | `better-sqlite3` 13.2.0 con Node-API 10 y prebuild compartido, sin `electron-rebuild`; base en `userData/data/world-craft.sqlite` con WAL, `synchronous=NORMAL`, `foreign_keys=ON` y `busy_timeout=5000`; una conexión de main; integridad antes de WAL; runner propio sobre el journal de Drizzle con Zod, checksum SHA-256 normalizado, lote transaccional y `user_version` como número de migraciones aplicadas; copia online con manifiesto, SHA-256 e integridad antes de migrar una base existente; rechazo de bases con tablas propias sin `schema_migrations`; modo seguro sin conexión de escritura, códigos estables, log JSONL rotativo sin contenido y diálogo nativo con abrir copias, continuar o salir; `better-sqlite3` y `drizzle-orm` externalizados y `drizzle/` copiado al build. | La actualización no puede dejar una base a medias ni perder datos; un fallo se explica sin exponer SQL ni rutas; la restauración guiada, la retención de copias y la UI quedan para M0-07; #68 debe desempaquetar el módulo nativo del asar; el bloqueo de instancia única se cierra antes de M1/#68. ADR 0016. |

## 2026-11-19 — Copias y restauración implementadas (M0-07)

**Contexto.** La issue #67 implementa el alcance de D-031 y completa la deuda de
D-040 sin cambiar ninguna decisión.

- Copias automáticas diaria, semanal y mensual al arrancar, con buckets locales y
  retención 7/4/12; manifiesto v2 compatible con la lectura de v1; las copias
  solo contienen SQLite y manifiesto, no assets.
- Retención de 5 copias pre-migración, que cierra la deuda del ADR 0016;
  `pre-restore` no se poda y su recuperación es manual.
- Restauración desde el diálogo nativo de modo seguro con verificación,
  confirmación, copia pre-restauración en bruto, lock, marcador durable
  `.restore.pending`, `.rollback`, relanzamiento y detección de restauraciones
  interrumpidas. La pantalla Ajustes → Datos y las copias manuales siguen
  previstas para M1.
- Residuales documentados: sin `requestSingleInstanceLock` el lock no es una
  exclusión mutua estricta; un lock obsoleto o ilegible puede requerir borrado
  manual de `data/.restore.lock`; una base de 0 bytes se considera nueva; una
  base válida con restos obliga a modo seguro; la limpieza fallida de
  `.rollback` puede repetir el modo seguro; la rotación se difiere si no hay
  copia nueva ni pre-migración; hasta tres `integrity_check` por arranque; y la
  durabilidad cubre el cierre del proceso, no un corte de energía.
- Referencias: ADR 0012, ADR 0016, `docs/persistencia.md` y `docs/continuidad.md`.

## 2026-11-20 — Empaquetado, actualizaciones y preservación implementados (M0-08)

**Contexto.** La issue #68 materializa el ADR 0003 en un instalador Windows real
sin administrador y en una actualización manual que no puede perder datos. El
MVP sigue sin release pública ni firma de código, y la comprobación automática
con su interruptor pertenece a Ajustes (M1). La prueba real se hizo en local con
el instalador 0.1.0; la actualización contra GitHub Releases se completará en M5.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-041 | Empaquetado NSIS, actualizador manual y preservación | electron-builder 26.18.0 con configuración comentada en `electron-builder.config.cjs`, recursos en `resources/`, salida en `release/` ignorada y versión 0.1.0; NSIS asistido por usuario (`oneClick:false`, `perMachine:false`, `allowElevation:false`, `customInstallMode` al usuario actual, `%LOCALAPPDATA%\Programs\World Craft`, acceso directo solo en Inicio, sin página de componentes, `deleteAppDataOnUninstall:false` y aviso de datos conservados al desinstalar); paquete x64 con asar, `asarUnpack` de `better-sqlite3`, `sharp` y `@img`, `npmRebuild:false`, `supportedArchitectures` con `current`/`win32` y poda `afterPack` de binarios no x64; sin firma (`signExecutable:false`, `verifyUpdateCodeSignature:false`, `forceCodeSigning:false`) y `latest.yml` sin Ed25519 porque electron-builder 26.18.0 no la soporta; electron-updater 6.8.11 y builder-util-runtime 9.7.0 externalizados, sin auto-check, comprobación manual de 30 s con `epoch`, descarga con consentimiento y cancelación real por `CancellationToken`, instalación solo desde `downloaded` y reinicio consentido, `autoDownload:false` y `autoInstallOnAppQuit:false`; partición `electron-updater` con `cache:false`, allowlist HTTPS de GitHub, saneado de cabeceras y permisos denegados, sin envío de contenido y log `logs/updates.log` sin URLs ni rutas; instancia única antes de la base con `second-instance` enfocando la ventana; `resources/licenses/` con los 5 textos completos; job `package` no bloqueante en `windows-latest` con `verify:native`, `dist`, `verify:build`, `package:checksums` y `verify:package --installer`, sin publicar. | Actualizar, reinstalar y desinstalar no borran ni corrompen `userData`: la prueba real con actualización 0.1.0→0.1.1 conservó 194 archivos, incluida la base, los assets y las copias diarias; el instalador es de 132.698.671 bytes y no pide UAC ni escribe en HKLM; la actualización es opcional, cancelable y privada, pero no hay interruptor hasta Ajustes M1 porque tampoco hay auto-check; el instalador y `latest.yml` van sin firma y SmartScreen se documenta (ADR 0015); la actualización real contra GitHub Releases, la firma de manifiestos y el job `package` required quedan para M5/#69; el detalle está en el ADR 0018. |

- Referencias: ADR 0018, ADR 0003, ADR 0013, ADR 0015, ADR 0016,
  `docs/arquitectura.md`, `docs/continuidad.md` y `docs/persistencia.md`.

## 2026-11-20 — Mundos del MVP implementados (M1-01)

**Contexto.** La issue #72 abre el contenido de M1 con el primer CRUD completo.
El mundo es la raíz de fichas, mapas, manuscritos y partidas; había que fijar el
modelo, el borrado, la actividad, la portada, la descripción y el idioma sin
adelantar formatos ni funciones que dependen de issues posteriores. Las
decisiones de alcance se acordaron con el usuario y se crearon las issues de
seguimiento #114 (descripción enriquecida), #115 (portada) y #116 (integridad de
assets).

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-042 | Mundos del MVP | `worlds` como raíz con `slug` único global, borrado lógico (`deleted_at`), archivo (`status`/`archived_at`) e idioma `es`/`en`/`it`; `activity_log` por mundo con `diff` JSON; migración `0002_worlds` aditiva con `user_version` 3 y rollback; dominio puro en `src/main/worlds/` con transacciones que agrupan cada mutación y su actividad; ocho canales IPC con Zod estricto y guardas en el preload; dashboard, lista con búsqueda/filtro, página de mundo con progreso y actividad aislada; portada nullable a `assets` sin selector hasta #115; descripción en texto plano hasta #114; papelera visible y purga en #77; FK `assets.world_id` en #116. | El identificador de un mundo nunca se reutiliza; archivar es reversible y eliminar conserva la fila; la actividad global etiqueta cada acción con su mundo y excluye la papelera; el dashboard y la ficha caben a 1024 px en ambos temas; los datos existentes (`app_settings` y `assets`) se conservan al migrar; la portada y la descripción rica no bloquean el MVP. ADR 0019. |

- Referencias: ADR 0019, #114, #115, #116, #77, `docs/manual-de-usuario.md`,
  `docs/base-de-datos/esquema.md` y `docs/calidad/plan-de-pruebas.md`.

## 2026-11-20 — Tipos de entidad del sistema y campos personalizados (M1-02)

**Contexto.** La issue #73 necesita tipos con plantillas de campos distintas sin
migrar el esquema por cada campo. Había que decidir dónde viven los tipos del
sistema, cómo se protegen, cómo se validan las plantillas y los valores, cómo se
aíslan por mundo y cómo se transfieren con la exportación futura.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-043 | Tipos de entidad y campos personalizados | Los 18 tipos del sistema se siembran en la migración `0003_entity_types` como filas con `world_id NULL`, `is_system = 1` e IDs UUIDv7 fijos que coinciden con `src/shared/entity-types/catalog.ts`; los personalizados pertenecen a un mundo, usan claves únicas, iconos Lucide y tokens de color cerrados, y usan borrado lógico con `deleted_at`; la plantilla se guarda como JSON y se valida con Zod (texto, número, fecha, selección y referencia), y `validateEntityFieldValues` devuelve errores por `fieldKey`; los tipos del sistema no se editan ni se borran y se pueden duplicar en un mundo; duplicar un mundo copia sus tipos en la misma transacción; el formato `entity-types.v1` exporta e importa solo los tipos personalizados, sin IDs internos, y #78 lo compondrá en el ZIP del mundo. | Añadir campos no exige migrar el esquema; una importación no arrastra IDs ni datos de otro mundo; el catálogo y el seed se comparan en una prueba; el color nunca es el único indicador y usa la paleta verificada en ambos temas; la gestión visual de tipos y las fichas llegan con #74; la papelera visible de tipos y la purga, con #77. ADR 0020. |

- Referencias: ADR 0020, #74, #77, #78, `docs/base-de-datos/esquema.md`,
  `docs/base-de-datos/migraciones.md` y `docs/calidad/plan-de-pruebas.md`.

## 2026-11-20 — Fichas, galería, etiquetas y editor enriquecido (M1-03)

**Contexto.** La issue #74 convierte los tipos de #73 en la pantalla central de
la enciclopedia. Había que decidir el modelo de ficha y galería, el formato de
la descripción rica, cómo exponer las imágenes sin rutas, cómo filtrar etiquetas
y favoritos por mundo, cómo autoguardar sin perder contenido y cómo gestionar
los tipos personalizados desde la interfaz.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-044 | Fichas, galería, etiquetas y editor | Migración `0004_entities` aditiva con `entities`, `tags`, `entity_tags` y `entity_gallery`; ficha con tipo estable, slug único por mundo y borrado lógico; descripción como JSON de ProseMirror con lista cerrada de nodos y `description_text` para búsqueda, sin HTML; Tiptap 3 MIT (ADR 0007) limitado a formato básico y enlaces internos `wc-entity://<uuid>`; galería relacional ordenada y imagen principal por `assets`; `assets:list` y `assets:import` con diálogo nativo, WebP y miniaturas `wc-asset://thumb`; etiquetas de color por mundo con creación idempotente; filtros por tipo, etiqueta, favorito, estado y búsqueda en el proceso principal; autoguardado con debounce de 700 ms y guardado explícito; gestión visual de tipos personalizados con bloqueo del borrado y de la retirada o cambio de tipo de un campo si tienen fichas; creación rápida desde el shell. | La ficha completa se guarda y se recupera sin red; las imágenes no duplican archivos ni exponen rutas; el color no es el único indicador; los tipos del sistema solo se duplican; el tipo de una ficha no cambia tras crearla; la papelera y la restauración llegan con #77 y la búsqueda global con #76; la galería añade una tabla no prevista en el esquema objetivo, documentada con rollback. ADR 0021. |

- Referencias: ADR 0021, ADR 0007, ADR 0017, ADR 0020, #76, #77, #78,
  `docs/manual-de-usuario.md`, `docs/base-de-datos/esquema.md` y
  `docs/calidad/plan-de-pruebas.md`.

## 2026-11-20 — Relaciones tipadas y backlinks (M1-04)

**Contexto.** La issue #75 necesita unir las fichas de #74 con relaciones
tipadas, navegables y preparadas para el grafo de M2. Había que decidir cómo
representar la dirección y la etiqueta inversa, dónde viven los tipos del
sistema, cómo validar duplicados y aislamiento, qué borrar al eliminar una
arista y cómo exponer el grafo sin acoplar la ficha a su detalle.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-045 | Relaciones tipadas, etiquetas inversas y API del grafo | Migración `0005_relations` aditiva con `relation_types` y `relations`; 18 tipos del sistema sembrados con `world_id NULL`, `is_system = 1` e IDs UUIDv7 fijos que coinciden con `src/shared/relations/catalog.ts`; tipos personalizados por mundo con clave única y color de la paleta cerrada; aristas dirigidas con origen, destino, tipo, etiquetas opcionales, notas, fuerza 1–5 y metadatos JSON; la etiqueta efectiva es el override o el nombre del tipo y la inversa se lee desde la ficha de destino; se rechazan autorreferencias, duplicados exactos, duplicados invertidos de tipos simétricos, fichas o tipos de otro mundo y fichas en la papelera; los tipos del sistema no se editan ni se borran y los personalizados en uso tampoco; las relaciones se borran de forma directa y confirmada, mientras las aristas de fichas en papelera se ocultan; `relations:list` expone aristas con origen, destino y tipo resueltos y filtros por ficha y tipo para M2-04. | El lore se recorre en ambos sentidos sin duplicar filas; la API sirve a los backlinks y al grafo futuro; los tipos personalizados se aíslan por mundo; la simetría se deduce de etiquetas iguales y necesitaría una columna si se vuelve ambigua; los metadatos se guardan pero aún no se editan en la interfaz; la papelera y la exportación de relaciones llegan con #77 y #78. ADR 0022. |

- Referencias: ADR 0022, ADR 0019, ADR 0020, ADR 0021, #77, #78,
  `docs/manual-de-usuario.md`, `docs/base-de-datos/esquema.md` y
  `docs/calidad/plan-de-pruebas.md`.

## 2026-11-20 — Búsqueda global FTS5 y paleta de comandos (M1-05)

**Contexto.** La issue #76 necesitaba encontrar mundos, fichas y relaciones sin
conexión y concentrar la navegación y las acciones en una paleta de teclado. La
búsqueda por `instr` de las fichas no escalaba a 10.000 documentos ni ofrecía
prefijos, ranking o resaltado. Había que decidir qué se indexa, cómo se
sincroniza, cómo se toleran los errores tipográficos y qué se hace con mapas,
manuscritos y escenas, que todavía no existen.

| ID | Tema | Decisión | Consecuencias principales |
|---|---|---|---|
| D-046 | Búsqueda global FTS5 y paleta de comandos | Migración `0006_search` aditiva con `search_documents`, FTS5 `search_fts` (unicode61, `remove_diacritics 2`, prefijos 2/3/4) y el vocabulario `search_vocabulary`; vistas por tipo y triggers en `worlds`, `entities`, `relations`, `relation_types`, `entity_tags` y `tags`; se indexan mundos, fichas y relaciones, y los tipos `map`, `manuscript` y `scene` quedan reservados en el `CHECK` para las migraciones de M2 (mapas) y M3 (manuscritos y escenas); los documentos de relación indexan etiquetas y notas, no los nombres de las fichas; la consulta usa prefijos y, si no hay coincidencia, expande términos del vocabulario con Levenshtein acotado; los filtros por mundo, tipo de documento, tipo de ficha, etiqueta y estado se combinan en SQL; `highlight` y `snippet` devuelven texto con marcadores de control, nunca HTML; recientes y favoritos se derivan de `updated_at` e `is_favorite` sin historial nuevo; `search:rebuild` reconstruye el índice en una transacción y se ofrece desde la paleta; la paleta `Ctrl+K` usa combobox/listbox, se ignora en campos editables y con diálogos abiertos, y reúne navegación, creación, tema y reconstrucción. | La búsqueda responde en menos de 150 ms con 10.000 fichas y funciona sin red; el índice se actualiza al crear, editar, borrar o restaurar y se puede reconstruir sin tocar el contenido; los filtros y el resaltado son seguros y accesibles; los triggers añaden coste a cada escritura y la optimización fina llega con M5-02; los errores en la primera letra quedan fuera de la tolerancia; la papelera de #77 deberá verificar la purga definitiva. ADR 0023. |

- Referencias: ADR 0023, ADR 0002, ADR 0004, ADR 0006, ADR 0022, #77, #78,
  `docs/manual-de-usuario.md`, `docs/base-de-datos/esquema.md`,
  `docs/base-de-datos/migraciones.md` y `docs/calidad/plan-de-pruebas.md`.
