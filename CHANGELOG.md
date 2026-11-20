# Changelog

Todos los cambios relevantes de World Craft se documentan en este archivo. El
formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado [Semantic Versioning](https://semver.org/lang/es/). La interfaz está
en español; los identificadores y las ramas, en inglés.

Todavía **no hay ninguna versión publicada**: la aplicación está en la fase de
fundaciones de escritorio. Los cambios se acumulan en «Sin publicar» hasta la
primera versión estable.

## [Sin publicar]

### Añadido

- Documentación del pivote a escritorio: plan, arquitectura Electron, modelo
  SQLite, migraciones, copias y recuperación, continuidad, sistema de diseño,
  internacionalización, plan de pruebas y ADRs 0001–0015.
- Inventario del pivote en [`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md):
  archivos eliminados y cuentas externas que hay que cerrar.
- Tooling mínimo de calidad para el repositorio de escritorio: TypeScript
  estricto, ESLint, Prettier, Vitest, CI y Dependabot.
- Scaffold de escritorio con Electron, electron-vite, React y TypeScript estricto
  (#62): `pnpm dev` abre una ventana segura con una pantalla inicial provisional,
  `pnpm build` compila los tres procesos en `out/` (todavía sin instalador),
  `pnpm start` previsualiza el build y `pnpm verify:build` valida artefactos, CSP
  y ausencia de URLs remotas.
- Pruebas unitarias del scaffold (25) y job `build` en la CI.
- IPC tipado con allowlist de canales y validación Zod en el proceso principal
  (#63): preload nominativo con `appInfo` y `shell.openExternal`, comprobación
  del remitente y errores estables (`INVALID_INPUT`, `UNKNOWN_CHANNEL`,
  `INTERNAL_ERROR`, `UNTRUSTED_SENDER`), con 54 pruebas en verde.
- Apertura de enlaces externos solo para `https` válidos (#63): sin
  credenciales, con longitud máxima y rechazo de loopback y redes privadas; la
  ventana no navega y las ventanas nuevas se siguen denegando.
- Catálogo de GitHub de escritorio: 46 etiquetas, 7 hitos y 41 issues
  (#61–#101) con contexto, alcance, dependencias, criterios y variante.
- Persistencia local con SQLite, better-sqlite3 y Drizzle ORM (#64): base en
  `userData/data/world-craft.sqlite`, WAL, comprobación de integridad y cierre
  idempotente, con el módulo nativo cargado en Node y Electron sin
  `electron-rebuild`.
- Migraciones versionadas (#64): journal de Drizzle validado con Zod, checksum
  SHA-256, lote transaccional, `user_version` como número de migraciones y
  rechazo de bases ajenas o de versión superior.
- Copia previa a cada migración de una base existente (#64): manifiesto, SHA-256
  e `integrity_check` en solo lectura; si la copia falla, no se migra.
- Modo seguro de arranque (#64): sin conexión de escritura, códigos estables, log
  JSONL rotativo sin contenido y diálogo nativo con abrir copias, continuar o
  salir. La restauración guiada queda para M0-07.
- Pruebas de persistencia (#64): 89 unitarias y 18 de integración con bases
  temporales, más `pnpm db:check` en la CI y `pnpm verify:native` para el módulo
  nativo.
- Scripts `db:generate`, `db:check`, `test:unit`, `test:integration` y
  `verify:native`, y copia de `drizzle/` a `out/main/drizzle` con verificación en
  `verify:build`.
- Sistema de diseño implementado (#65): tokens en tres capas (`palette.css`,
  `semantic.css` y `scales.css`), con la paleta como única fuente de color y
  overrides agrupados por tema.
- Temas Claro y Oscuro conmutables desde la barra superior (#65): el tema vive
  en memoria, arranca en Claro y todavía no se guarda entre sesiones.
- Componentes base nativos sin dependencias nuevas (#65): botón, campo de texto,
  insignia, tarjeta, estado vacío, diálogo, pestañas, aviso toast y tooltip, con
  estados, teclado y textos del catálogo.
- Shell de escritorio (#65): enlace de salto, barra lateral de 240 px plegable a
  64 px, barra superior de 56 px, navegación Inicio/Muestras con `aria-current` y
  `main` enfocable.
- Logotipo de la aplicación en el rail: `src/renderer/assets/world-craft-logo.svg`
  se muestra con sus propios colores y se puede sustituir sin tocar componentes.
- Páginas de Inicio con estado vacío y de Muestras para revisar el sistema de
  diseño en los dos temas (#65).
- Pruebas de tokens y contraste (#65): 14 pruebas que calculan ratios WCAG por
  tema, prohíben colores literales fuera de la paleta, exigen
  `prefers-reduced-motion` y evitan `overflow-x: hidden`; el repositorio pasa a
  103 pruebas unitarias.
- Servicio de assets locales (#66): importación de imágenes validada por
  contenido (PNG, JPEG, WebP, GIF y AVIF; SVG rechazado), límites de 25 MB,
  8192 px por lado y 24 Mpx, orientación EXIF, re-codificación a WebP y
  miniatura de 320 px, con escritura atómica en `assets/.tmp/` y metadatos en
  SQLite. Sin interfaz ni IPC todavía: la subida y la galería llegan con M1.
- Protocolo `wc-asset://` (#66): `asset/<id>` y `thumb/<id>` con gramática
  cerrada, ruta resuelta desde SQLite, rechazo de traversal, rutas absolutas,
  UNC, NUL, symlinks y junctions, MIME `image/webp` y cabeceras `nosniff`,
  `Content-Length`, caché privada inmutable y CSP de respuesta. No se registra
  en modo seguro.
- Migración `0001_assets` (#66): tabla `assets` con `CHECK` de `kind`, tamaño y
  hash hexadecimal e índices por mundo y hash, rollback de referencia y
  `user_version` 2. La clave foránea a `worlds` se difiere a M1.
- Purga de huérfanos recuperable (#66): plan de solo lectura, confirmación
  `purge-orphans`, copia verificada con SHA-256 y manifiesto en
  `backups/orphans/` antes de borrar, sin tocar archivos referenciados ni
  enlaces.
- `sharp@^0.35.5` externalizado y verificado en Node y Electron (#66), con las
  licencias de sharp y libvips en `THIRD-PARTY-NOTICES.md`. #68 debe
  desempaquetarlo del asar e incluir los textos completos.
- Pruebas de assets (#66): unitarias de URL, rutas, formatos, importación,
  huérfanos, protocolo, log y mutex, e integración de importación, protocolo,
  repositorio, purga y migración sobre SQLite real. El total pasa a 176
  unitarias en verde (4 omitidas) y 40 de integración en verde (1 omitida).
- Copias automáticas al arrancar (#67): diaria, semanal y mensual con buckets de
  fecha local (día, semana ISO y mes), creación del periodo en curso aunque
  falten arranques, y retención de 7/4/12. Un fallo de copia se registra y nunca
  bloquea la apertura.
- Manifiesto de copia v2 (#67), compatible con la lectura de v1: motivo, fecha,
  versión de esquema, tamaño, SHA-256, integridad y `assetsIncluded: false`. La
  verificación comprueba manifiesto, tamaño, hash, `integrity_check` y
  `user_version`, y rechaza copias corruptas o de versión futura. Las copias
  contienen solo SQLite y manifiesto, no assets.
- Restauración desde el diálogo de modo seguro (#67): copia válida más reciente
  o carpeta dentro de `backups/`, confirmación con fecha y versión, copia
  pre-restauración en bruto de la base y sus WAL/SHM, lock, marcador
  `.restore.pending`, reemplazo con `.rollback` y relanzamiento. Si falla, vuelve
  al modo seguro sin dejar la app a medias. La pantalla de Ajustes sigue prevista
  para M1 y las copias pre-restauración son recuperación manual.
- Rotación de copias pre-migración a 5 (#67), que cierra la deuda del ADR 0016;
  las copias pre-restauración no se podan, las corruptas no cuentan ni se borran
  y nunca se elimina la copia válida más reciente.
- Modo seguro ampliado (#67): detecta restauraciones interrumpidas
  (`.rollback`, `.restore.tmp`, `.restore.pending`) sin crear una base vacía y
  añade los códigos `DB_RESTORE_INVALID`, `DB_RESTORE_FAILED`,
  `DB_RESTORE_INTERRUPTED` y `DB_RESTORE_ROLLBACK_FAILED`.
- Pruebas de copias y restauración (#67): manifiesto, buckets, rotación,
  creación, corrupción, restauración, rollback, restauración interrumpida,
  preservación de assets y modo seguro. El total pasa a 216 unitarias en verde
  (4 omitidas) y 84 de integración en verde (1 omitida).
- Instalador NSIS por usuario (#68): versión 0.1.0, `appId`
  `com.gonzalitojh.worldcraft`, instalación en
  `%LOCALAPPDATA%\Programs\World Craft` sin UAC, acceso directo solo en el menú
  Inicio y desinstalación que conserva `%APPDATA%\World Craft`. El artefacto
  local es `release/world-craft-0.1.0-setup.exe` (132.698.671 bytes); la release
  pública llega con M5.
- Configuración de empaquetado en `electron-builder.config.cjs` y `resources/`
  (#68): icono ICO de 7 tamaños, `installer.nsh`, paquete x64 con
  `better-sqlite3` y `sharp` desempaquetados del asar, poda de binarios no x64,
  `app-update.yml` sin token y licencias completas en `licenses/`.
- Scripts `icons`, `licenses:sync`, `dist:dir`, `dist`, `package:checksums` y
  `verify:package` (#68), más `scripts/verify-install.ps1` para la prueba manual
  de instalación, actualización y desinstalación.
- Actualizaciones manuales desde la barra superior (#68): botón
  «Actualizaciones», diálogo con versión instalada, última comprobación, estados
  y progreso; comprobación con timeout, descarga con consentimiento y
  cancelación real, instalación solo desde `downloaded` y reinicio consentido.
  Sin auto-check y sin envío de contenido; el interruptor y la frecuencia llegan
  con Ajustes en M1.
- Instancia única (#68): abrir World Craft de nuevo enfoca la ventana existente y
  el segundo proceso no toca la base, el IPC ni el actualizador.
- Preservación de datos entre instalaciones (#68): prueba de integración con
  SQLite, assets y copias temporales, y prueba real de instalación,
  actualización 0.1.0→0.1.1 y desinstalación con 194 archivos de `userData`
  intactos y registro solo en HKCU.
- Job `package` no bloqueante en `windows-latest` (#68): `verify:native`,
  `dist`, `verify:build`, `package:checksums` y `verify:package --installer`, sin
  publicar ni subir artefactos.
- Pruebas del empaquetado y del actualizador (#68): configuración NSIS, iconos,
  licencias, contrato y estados del actualizador, red, log, textos e instancia
  única, más preservación entre instalaciones. El total pasa a 282 unitarias en
  verde (4 omitidas) y 85 de integración en verde (1 omitida).
- Base de pruebas de escritorio (#70): Testing Library con `jsdom` para
  componentes, Playwright Electron para E2E con `userData`, `APPDATA` y
  `LOCALAPPDATA` temporales en `os.tmpdir()` y axe-core para el shell en los dos
  temas. `pnpm test` suma 7 pruebas de componentes y `pnpm test:e2e` añade 9 E2E
  de arranque, navegación, ventana a 1024/1280/1600 px, temas y accesibilidad sin
  errores críticos.
- Configuración de pruebas (#70): `vitest.components.config.ts`,
  `playwright.config.ts`, `tsconfig.tests.json` y fixtures compartidos. La CI
  ejecuta unitarias, componentes e integración; los E2E, Windows-only, se
  ejecutan en local antes de `review` y en el workflow de release de M5.
- Internacionalización centralizada (#71): catálogo tipado con registro por
  idioma, proveedor `I18nProvider`, hooks `useI18n`/`useMessages` y formatos de
  fechas, números, porcentajes, listas y plurales con `Intl`. El shell, los
  componentes base, las páginas y el actualizador leen del proveedor.
- Pruebas de i18n (#71): catálogo sin hojas vacías, claves y parámetros
  tipados, formatos con `Intl` y recorrido del AST de JSX que falla ante textos
  visibles hardcodeados. El locale del perfil queda pendiente de Ajustes; hasta
  entonces se usa el idioma de reserva `es`.

### Cambiado

- World Craft pasa de aplicación web a **aplicación de escritorio Windows** con
  persistencia local. El renderer no accede a Node; la base de datos es SQLite y
  los assets viven en `app.getPath('userData')`.
- El proceso SDD, las etiquetas, los hitos y las variantes de modelo se adaptan
  al trabajo de escritorio; los subagentes heredan el modelo de la sesión.
- `sdd-master` queda fijado como agente primario por defecto en `opencode.jsonc`
  (`default_agent`), de modo que una sesión nueva entra directamente en el flujo
  SDD.
- La Definition of Done sustituye el responsive web por la ventana de escritorio
  a 1024, 1280 y 1600 px, y añade preservación de datos y seguridad Electron.
- El aviso de modo seguro incorpora «Restaurar copia.» y mantiene abrir la
  carpeta de copias, continuar sin escritura y salir (#67).
- El arranque crea las copias automáticas del periodo en curso y poda las
  sobrantes antes de crear la ventana; no se copia al cerrar (#67).
- Las copias pre-migración ya no crecen sin límite: se conservan las 5 más
  recientes, y los eventos `backup.schedule` y `backup.restore` se registran sin
  rutas, nombres, tamaños, SHA, identificadores ni contenido (#67).
- World Craft ya se puede instalar y abrir como aplicación de escritorio local.
  El instalador se genera y se prueba en el repositorio, pero **no hay release
  pública**; la publicación oficial y la actualización real contra GitHub
  Releases llegan con M5 (#68).
- El arranque adquiere el lock de instancia única antes de `whenReady` y compone
  el actualizador después de la persistencia; la ventana no se crea hasta que el
  arranque y las copias automáticas terminan (#68).
- El paquete deja de ser solo `out/`: incluye `LICENSE`,
  `THIRD-PARTY-NOTICES.md` y `licenses/`, externaliza los módulos nativos y los
  poda a Windows x64 (#68).
- La CI de escritorio queda cerrada (#69): `lint`, `typecheck`, `test` y
  `build` son required checks de `dev` y `main`; `gitleaks` y `audit` siguen sin
  bloquear y el job `package` de Windows queda para M5. La caché de pnpm, los
  límites gratuitos y la ruta de la build de Windows están documentados.
- `pnpm typecheck` cubre también las pruebas con `tsconfig.tests.json` y
  `pnpm test` incluye las pruebas de componentes (#70).

### Eliminado

- La aplicación Next.js, Supabase, Vercel y Cloudflare R2, junto con su esquema
  PostgreSQL, migraciones, pruebas, scripts y configuración.
- Los ADRs de la etapa web, las capturas de referencia y los task files de las
  issues antiguas.

### Seguridad

- Escaneo de secretos con `gitleaks` y auditoría de dependencias en la CI.
- Reglas de aislamiento de Electron, allowlist IPC y validación con Zod en la
  documentación y en el proceso de revisión.
- Ventana con `contextIsolation`, `sandbox`, `nodeIntegration: false`,
  `webSecurity: true` y `webviewTag: false`; DevTools deshabilitadas en la
  versión empaquetada (#62).
- CSP estricta de producción inyectada antes de los scripts y CSP de desarrollo
  limitada a loopback; navegación, redirecciones, ventanas nuevas, webviews y
  descargas bloqueadas, permisos denegados y peticiones HTTP(S)/WS remotas
  canceladas (#62).
- Preload congelado que solo expone `window.worldCraft.appInfo` y
  `shell.openExternal`, sin `ipcRenderer` ni `invoke` genérico; el proceso
  principal comprueba el remitente y valida la entrada de cada canal (#62, #63).
- Base de datos aislada del renderer (#64): `src/main/db/` no importa Electron,
  las rutas se validan contra `userData`, las migraciones se leen solo del bundle
  y los logs de arranque no incluyen SQL, filas, rutas ni contenido.
- Modo seguro sin conexión de escritura (#64) y rechazo de bases ajenas,
  manipuladas o de versión superior antes de aplicar cualquier cambio.
- Restauración confinada a `backups/` con `realpath` y `relative`, verificación
  previa y posterior, copia pre-restauración en bruto, lock y marcador durable
  con rollback (#67). La lógica vive en `src/main/backup/`, sin importar
  Electron, y el renderer no obtiene acceso a rutas ni a la base.
- Copias y restauración sin secretos ni datos sensibles en logs o avisos: los
  mensajes están centralizados y no incluyen rutas, nombres, tamaños, SHA ni
  contenido (#67).
- Actualizador aislado en la partición `electron-updater` con caché desactivada
  (#68): solo HTTPS a GitHub y sus descargas, sin credenciales ni puertos no
  estándar, eliminación de `x-user-staging-id`, `authorization`, `private-token`
  y `cookie`, permisos denegados y log `logs/updates.log` sin URLs, rutas,
  versiones ni contenido. No se envía contenido del usuario (#68).
- Instalador por usuario sin UAC y con `deleteAppDataOnUninstall:false` (#68):
  actualizar, reinstalar o desinstalar no borra la base, los assets ni las
  copias. El desinstalador avisa de que los datos se conservan.
- El instalador y `latest.yml` se distribuyen sin firma, coherente con el ADR
  0015; no hay firma Ed25519 de manifiestos en electron-builder 26.18.0 y se
  decide en M5. La integridad se apoya en HTTPS, SHA-512 y `SHA256SUMS`.
- Instancia única antes de abrir la base (#68): se cierra el riesgo de dos
  procesos migrando o restaurando a la vez.

## Cómo se escribe una entrada

- **Sección «Sin publicar».** Cada PR añade su entrada aquí; al publicar una
  versión, esa sección pasa a `## [X.Y.Z] - AAAA-MM-DD` y se abre una nueva.
- **Categorías de Keep a Changelog:** `Añadido`, `Cambiado`, `Obsoleto`,
  `Eliminado`, `Corregido` y `Seguridad`. Usa solo las que tengan contenido.
- **Una línea por cambio**, en pasado, pensada para una persona usuaria, con el
  enlace a la issue cuando aporte contexto.
- **Solo cambios relevantes.** Los refactors internos sin efecto visible no
  necesitan entrada.
- **Misma tarea.** La entrada se escribe en la PR que introduce el cambio; el
  publisher comprueba que existe antes de publicar.
- **Versiones.** Mientras no exista una versión publicada, el proyecto no fija
  número: se usará `0.y.z` durante el desarrollo y `1.0.0` con el primer uso real.
