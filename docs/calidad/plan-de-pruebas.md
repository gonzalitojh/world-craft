# Plan de pruebas y calidad

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** estrategia de pruebas, calidad, accesibilidad, rendimiento,
> preservación de datos y verificación antes de publicar.
> **Decisiones:** ADR 0010 (testing), ADR 0012 (datos), ADR 0013 (CI) y
> ADR 0018 (empaquetado, actualizador y preservación).

## 1. Principios

1. **Probar lo que puede romper datos.** Migraciones, backups, importación y
   borrados tienen prioridad sobre la cobertura cosmética.
2. **TDD pragmático.** Primero un test que reproduce el fallo o define el
   contrato; después la implementación. Sin sobreingeniería en CRUDs simples.
3. **Pirámide:** muchos tests unitarios, integración con SQLite real y pocos
   E2E de flujos críticos.
4. **Sin mocks de la base para el esquema.** Las migraciones y consultas se
   prueban contra SQLite temporal.
5. **La accesibilidad y los temas son parte de la definición de terminado.**
6. **La CI no sustituye la revisión local.** El usuario prueba antes de
   publicar.

## 2. Niveles

| Nivel | Herramienta | Qué cubre | Dónde |
|---|---|---|---|
| Unitario | Vitest | Dominio, validaciones Zod, utilidades, i18n, tokens, lógica de exportación. | `tests/unit/` |
| Componentes | Vitest + Testing Library | Renderer, formularios, estados, teclado, temas. | `tests/components/` |
| Integración | Vitest + SQLite temporal | Esquema, migraciones, consultas, FTS5, backups, importación. | `tests/integration/` |
| E2E | Playwright Electron | Arranque, ventana, flujos críticos, temas, accesibilidad. | `tests/e2e/` |
| Manual | Checklist | Instalación, actualización, desinstalación y percepción visual. | Task file |

`tests/unit/`, `tests/components/`, `tests/integration/` y `tests/e2e/` existen y
están en verde desde #70. La base de Vitest llegó con M0-02 a M0-08; Testing
Library, Playwright Electron y axe se incorporaron con el arranque de pruebas
(M0-10, #70).

## 3. Qué se prueba en cada área

### 3.1 Dominio y datos

- Validaciones Zod de entidades, relaciones, mapas, escenas y ajustes.
- Reglas de integridad: relación sin origen igual a destino, tipos del sistema
  no editables, assets referenciados.
- Búsqueda FTS5: coincidencias, prefijos, acentos y reconstrucción.
- Exportación/importación: ida y vuelta, IDs, assets y manifiesto.

### 3.2 Migraciones, copias y preservación (implementado)

- Base nueva → `0000_init` + `0001_assets` → `user_version` 2, tablas del
  sistema y `assets`, y sin copia previa (justificado: no hay datos que
  preservar).
- Base existente en `0000` → `0001_assets` → `app_settings` intacto y tabla
  `assets` creada.
- Base existente → migración → mismos datos y copia previa verificable.
- Journal válido, secuencia sin huecos, etiqueta sin traversal y checksum
  SHA-256 normalizado.
- Migración fallida → rollback del lote completo y modo seguro.
- Copia con manifiesto, tamaño, SHA-256 e integridad; fallo de copia → no se
  migra.
- Base ajena (tablas propias sin `schema_migrations`) → rechazo sin escritura.
- Versión de esquema superior → la app no escribe.
- Corrupción simulada → `integrity_check` falla, modo seguro y el archivo queda
  intacto.
- Restauración desde el diálogo de modo seguro → datos restaurados, copia
  pre-restauración creada y migraciones pendientes al relanzar.

Estos casos viven en `tests/integration/` y usan bases temporales en
`os.tmpdir()`.

### 3.3 IPC y seguridad

El IPC tipado está implementado desde #63 y el scaffold cubre el aislamiento del
renderer, la CSP, la navegación, los permisos y la red.

- Cada canal tiene esquema de entrada y salida.
- Un canal desconocido se rechaza.
- Un payload inválido devuelve un error tipado, no una excepción interna.
- El renderer no accede a `require`, `process`, `fs` ni `ipcRenderer`.
- El protocolo de assets rechaza rutas fuera de `assets/` (implementado, #66;
  detalle en 3.8).
- La importación rechaza ZIP con `..`, rutas absolutas y enlaces (previsto).
- CSP y navegación externa bloqueada.
- No hay secretos ni rutas absolutas en logs; el log de arranque es JSONL
  tipado y no incluye SQL, filas ni contenido.

### 3.4 UI y accesibilidad

Desde #65 hay una prueba unitaria estática del sistema de diseño,
`tests/unit/design-tokens.test.ts` (14 pruebas): lee los CSS reales, resuelve los
tokens de cada tema y calcula contraste WCAG 2.2; además, exige que solo
`palette.css` declare colores literales, que `--bg`/`--fg` superen 7:1, que el
deshabilitado se lea sin opacidad, que exista `prefers-reduced-motion` y que
`html`/`body` no usen `overflow-x: hidden`. La tabla completa de ratios vive en
el test y en el informe de #65.

Desde #70, `tests/e2e/accessibility.spec.ts` ejecuta axe sobre el shell real en
los dos temas y falla ante violaciones críticas (detalle en 3.11).

Desde #71, la internacionalización se prueba en `tests/unit/i18n/`: catálogo sin
hojas vacías, claves y parámetros tipados, `Intl` para fechas, números,
porcentajes, listas y plurales, y un recorrido del AST de JSX que falla si un
componente, página o el shell introduce un texto visible hardcodeado. Los
componentes leen el catálogo mediante `I18nProvider`, cubierto en
`tests/components/i18n-provider.test.tsx`.

Lo siguiente **sigue pendiente** y pertenece a #93 y a la revisión local:

- Componentes con estados de reposo, hover, foco, error, deshabilitado y carga
  en una matriz visual real a 1024, 1280 y 1600 px.
- Navegación por teclado y foco visible revisados en todas las pantallas de
  dominio.
- `aria-live` en los flujos de guardado y error de las pantallas de dominio (los
  avisos del shell ya lo usan).
- axe sin errores críticos en todas las pantallas principales, no solo el shell.
- Capturas de los dos temas y revisión de `prefers-reduced-motion` en ejecución.
- Textos largos, nombres sin espacios y rutas sin romper el layout, comprobados
  visualmente (el test solo impide el parche de `overflow-x: hidden`).

### 3.5 Rendimiento

- Arranque en frío por debajo de 3 s en un equipo de referencia.
- Apertura de un mundo con 1.000 fichas sin bloquear la UI.
- Búsqueda con 10.000 documentos en menos de 200 ms.
- Mapa con 2.000 features y grafo con 500 nodos con respuesta fluida.
- Copia y exportación sin bloquear la ventana: las copias automáticas se crean
  antes de abrir la ventana y la restauración ocurre en el diálogo de modo
  seguro; las copias manuales y la exportación de M1 no deben bloquear la UI.
- Sin fugas evidentes al abrir y cerrar editor, mapa y grafo varias veces.

### 3.6 Distribución (implementado, #68)

- El instalador NSIS 0.1.0 se genera con `pnpm dist` y se instala en
  `%LOCALAPPDATA%\Programs\World Craft` sin UAC ni registro en HKLM.
- Reinstalar y actualizar de 0.1.0 a 0.1.1 conserva la base, los assets y las
  copias de `userData`.
- Desinstalar elimina binarios y accesos directos y conserva
  `%APPDATA%\World Craft`; el aviso de datos conservados solo aparece en modo
  interactivo.
- `latest.yml`, el blockmap y `SHA256SUMS` coinciden con el instalador generado.
- La aplicación instalada arranca sin conexión; la comprobación de
  actualizaciones es manual y falla de forma controlada sin red.
- SmartScreen se documenta y el SHA-256 del instalador coincide con
  `SHA256SUMS`.
- La release pública y la actualización real contra GitHub Releases se prueban
  en M5; hoy el instalador es local.

### 3.7 Scaffold, persistencia y artefactos (implementado)

- **282 pruebas unitarias en verde (4 omitidas)** en `tests/unit/`: identidad y
  ventana mínima, opciones de seguridad de `BrowserWindow`, CSP de producción y
  desarrollo, resolución del renderer, guards de navegación/sesión/red, contrato
  y router IPC, API congelada del preload, validación de enlaces externos,
  journal, checksum, rutas de datos, UUIDv7, logger, lógica del aviso de modo
  seguro, tokens y contraste del sistema de diseño, servicio de assets, copias
  (manifiesto, rutas de restauración, buckets, rotación y composición de modo
  seguro), instalador, actualizador, instancia única y licencias.
- **7 pruebas de componentes en verde** en `tests/components/`: botón nativo
  (nombre accesible, `onClick`, `loading`, variantes) y pestañas (selección,
  panel activo, flechas, Inicio/Fin y clic). Usan Testing Library y `jsdom`.
- **85 pruebas de integración en verde (1 omitida)** en `tests/integration/`:
  creación e idempotencia de la base, pragmas, migración inicial, versión
  adelantada, estado incoherente, archivo no SQLite, corrupción, log sin rutas,
  base ajena, checksum alterado, rollback del lote, preservación con copia,
  restauración manual heredada, fallo de copia, rollback de referencia, upgrade
  a `0001_assets`, importación, protocolo, repositorio y purga con SQLite real,
  creación, verificación, restauración, rotación y restauración interrumpida de
  copias, y preservación de datos entre instalaciones.
- **Comandos.** `pnpm test` (unitarias, componentes e integración),
  `pnpm test:unit`, `pnpm test:components`, `pnpm test:integration`,
  `pnpm test:e2e`, `pnpm db:check`, `pnpm verify:native`, `pnpm verify:build`,
  `pnpm dist:dir`, `pnpm dist`, `pnpm package:checksums` y
  `pnpm verify:package`.
- **Build.** `pnpm build` compila `out/main/index.cjs`, `out/preload/index.cjs` y
  `out/renderer/index.html`, y copia `drizzle/` a `out/main/drizzle`; no genera
  instalador.
- **Verificación.** `pnpm verify:build` comprueba la existencia y tamaño de los
  artefactos, que la CSP de producción va antes de los scripts, que no contiene
  `unsafe-*` ni URLs remotas, que el journal y las migraciones (`0000_init` y
  `0001_assets`) están en el build y que `better-sqlite3`, `drizzle-orm` y
  `sharp` están externalizados.
- **Nativo.** `pnpm verify:native` carga `better-sqlite3` y `sharp` en Node y
  Electron, comprueba SQLite 3.54.1 con FTS5 y que sharp genera y lee un WebP
  2×2. Se ejecuta en el job `package` de Windows desde #68.
- **Manual del scaffold.** DevTools sin `require` ni `process`, navegación
  externa bloqueada y arranque sin red. La comprobación visual de la ventana a
  1024, 1280 y 1600 px y de los dos temas con el shell de #65 la cubre el E2E de
  #70; las capturas y la matriz visual completa siguen en #93.
- **Pendiente.** Auditoría de accesibilidad, temas y ventana de todas las
  pantallas (#93). Los E2E de arranque, ventana, temas y axe del shell están
  implementados en 3.11. El instalador, el asar y el actualizador ya están
  cubiertos en 3.6 y 3.10.

### 3.8 Assets locales (implementado, #66)

Unitarias en `tests/unit/assets/` y en `tests/unit/db/`:

- **URL y rutas:** gramática `asset|thumb + UUIDv7`, rechazo de query, hash,
  puerto, userinfo, hosts, segmentos extra, traversal, rutas absolutas, UNC,
  unidades de Windows, NUL, mayúsculas y UUID que no sean v7.
- **Contención:** `lstat`/`realpath` con symlinks y junctions de raíz, `worlds/`,
  `.tmp/`, `worlds/<worldId>` y `.tmp/<assetId>`; una raíz `assets/` enlazada
  fuera de `userData` se rechaza.
- **Formato:** detección por magic bytes de PNG, JPEG, WebP, GIF y AVIF; rechazo
  de SVG, BMP, TIFF, firmas truncadas y contenido arbitrario.
- **Importación:** publicación del WebP y la miniatura, compensación si falla el
  `INSERT`, no sobrescritura, rechazo por tamaño del WebP procesado, rechazo de
  mundo inválido y de origen sobredimensionado antes de leerlo, y log sin rutas
  ni identificadores.
- **Huérfanos y purga:** clasificación sin listar referenciados ni sus
  miniaturas, rutas corruptas contadas sin escribirse, token exacto, copia con
  manifiesto y checksums antes de borrar, aborto si la copia no verifica,
  idempotencia, anclas enlazadas, revalidación de un padre convertido en junction
  y recuperación desde la copia si el borrado falla.
- **Protocolo:** registro `standard`/`secure`/`stream` con `bypassCSP:false`,
  cabeceras seguras y longitud exacta, 400/403/404/413/415/500, MIME no admitido,
  archivo ausente y log del rechazo sin rutas.
- **Log y serialización:** JSONL con rotación a 256 KiB sin fallar si no se puede
  escribir; el mutex impide que una purga borre un asset en importación.

Integración en `tests/integration/assets/` con SQLite real:

- Importación completa con sharp: WebP, miniatura, dimensiones y hash; miniatura
  sin ampliar; JPEG con extensión falsa y HTML disfrazado rechazados; PNG
  truncado sin dejar archivos ni filas; EXIF/GPS eliminados y orientación
  aplicada; límites exactos de bytes, lado y píxeles; mismo contenido dos veces
  sin deduplicar; filas y archivos conservados al reabrir.
- Protocolo con filas reales: archivo y miniatura servidos, 404 para ID
  desconocido, 403 para traversal, mundo distinto y fila con ruta ajena, y 415
  para un MIME guardado no admitido.
- Repositorio: `insert`, `findById`, `listAll` y `count`, violaciones de los
  `CHECK` con código estable y persistencia al reabrir.
- Purga: referenciados conservados, copia verificable del huérfano, ausentes
  informados sin borrar, temporales purgados e idempotencia.
- Migración: `0000` → `0001_assets` conservando `app_settings`, `user_version` 2,
  y rollback de referencia de `0001` y `0000`.

Las pruebas de symlink de archivo se omiten en Windows sin modo desarrollador
(EPERM); las junctions sí se ejecutan. Los residuales están en el
[ADR 0017](../adr/0017-assets-service-sharp-orphan-purge.md).

### 3.9 Copias, restauración y modo seguro (implementado, #67)

Unitarias en `tests/unit/backup/` y `tests/unit/safe-mode-recovery.test.ts`:

- **Manifiesto:** v2 válido, normalización de v1 como íntegro y sin assets,
  rechazo de motivos, versiones, hashes, campos desconocidos, manifiesto ausente
  o JSON inválido, y criterio de restaurabilidad (integridad `ok` y versión
  conocida).
- **Rutas de restauración:** aceptación de una carpeta real dentro de `backups/`,
  rechazo de una carpeta fuera, de la propia raíz, de un archivo, de NUL y de
  rutas inexistentes; en la composición, rechazo de una junction que escapa y
  reinicio tras restaurar.
- **Buckets:** día y mes locales, semana ISO del primer día del año, lunes del
  año ISO siguiente, años de 53 semanas y relleno con ceros.
- **Rotación:** conserva las más recientes, no caduca si la retención cubre
  todas, protege la copia más reciente global y la del propio motivo, admite
  retención cero sin borrar una protegida y conserva la candidata que deja de
  verificar.

Integración en `tests/integration/backup-create.test.ts`,
`backup-restore.test.ts` y `backup-scheduler.test.ts` con SQLite real:

- **Creación e inventario:** copia v2 verificable, lectura de una copia v1
  pre-migración, rechazo de bytes alterados o manifiesto manipulado, inventario
  ordenado con separación de válidas y corruptas, copia en bruto de una base
  corrupta con WAL/SHM y ausencia de copia si no hay base.
- **Restauración:** datos restaurados, base actual conservada, assets intactos,
  restauración sin base actual, rechazo de copia corrupta o de versión futura,
  rollback tras fallo de cada renombrado, recuperación de WAL/SHM/journal, no
  aplicar un WAL antiguo, migración al relanzar, lock vivo rechazado y obsoleto o
  ilegible recuperado, búsqueda de la copia más reciente, copia v1 de extremo a
  extremo y preservación de `.rollback` y `.restore.tmp` obsoletos.
- **Restauración interrumpida:** fallo tras archivar el `.rollback`, fallo de la
  copia, fallo del primer renombrado, reutilización del marcador pendiente,
  `DB_RESTORE_ROLLBACK_FAILED` con restos detectados por el arranque y ausencia
  de temporales tras una restauración correcta. Se comprueba que el arranque no
  crea una base vacía.
- **Programación y rotación:** creación de los tres buckets en el primer arranque
  sin duplicar, solo el diario al cambiar el día, solo el semanal al cambiar la
  semana ISO, rotación de diarias a 7 sin tocar corruptas, conservación de la
  única copia válida de un bucket, rotación de pre-migración a 5 sin tocar otros
  motivos, arranque que no se bloquea si una carpeta es un archivo, no repetir la
  rotación sin copia nueva, rotar pre-migración tras una copia aunque no haya
  buckets nuevos, bucket con copia corrupta que no cuenta, versión futura que no
  se poda como válida ni llena el bucket, y `pre-restore` que no se poda.

Los fixtures usan `os.tmpdir()` y rutas sintéticas; no se tocan datos reales ni
se incluyen rutas del desarrollador en logs o mensajes.

Pendiente antes de M1: endurecer el inventario y la rotación con `realpath` y
contención, y añadir una prueba de junction dentro de `backups/daily`.

### 3.10 Empaquetado, actualizador y preservación (implementado, #68)

**Unitarias de empaquetado** en `tests/unit/packaging/`:

- **Configuración de electron-builder:** `appId`, `productName`, versión 0.1.0,
  NSIS asistido, `perMachine:false`, `allowElevation:false`,
  `deleteAppDataOnUninstall:false`, acceso directo solo en Inicio, sin firma,
  `asarUnpack` de los módulos nativos, `npmRebuild:false`, `extraFiles` de
  licencias y avisos, `afterPack` que escribe `app-update.yml` en las builds
  `--dir` y poda los binarios que no son win32-x64.
- **Iconos:** el ICO contiene los 7 tamaños esperados y se genera desde el
  logotipo sin dependencias nuevas.
- **Licencias:** los 5 textos completos (`sharp`, `@img/sharp-win32`, `libvips`,
  GPL-3.0 y `electron-updater`) existen, tienen contenido y están enlazados desde
  `THIRD-PARTY-NOTICES.md`.

**Unitarias del actualizador** en `tests/unit/updates/` y
`tests/unit/single-instance.test.ts`:

- **Contrato:** fases, motivos, códigos de error y validación estructural del
  snapshot; una fase incoherente se rechaza.
- **Servicio:** no hay auto-check; la comprobación manual pasa por `checking` y
  termina en `up-to-date`, `available` o `error`; el timeout y el `epoch`
  descartan resultados tardíos; cancelar la comprobación vuelve a `idle`;
  cancelar la descarga vuelve a `available`; la instalación solo se acepta desde
  `downloaded`; las órdenes repetidas no rompen el estado; `dispose` cancela y
  limpia.
- **Red:** allowlist de `github.com`, `api.github.com` y subdominios de
  `githubusercontent.com`; rechazo de HTTP, credenciales, puertos no estándar y
  hosts ajenos; saneado de `x-user-staging-id`, `authorization`,
  `private-token` y `cookie`; permisos denegados.
- **Log:** eventos tipados, rotación a 256 KiB y ausencia de URLs, rutas,
  versiones y contenido.
- **Instancia única:** un segundo proceso no inicializa nada y el primero
  enfoca su ventana.

**Integración de preservación** en
`tests/integration/packaging/preservation.test.ts`:

- `userData` temporal con base, `app_settings`, un asset y una copia
  pre-migración; se calculan hashes, se aplica una migración de fixture y se
  simulan reinstalación y borrado de una carpeta de instalación temporal. La
  base, el asset y la copia siguen intactos y la migración no pierde filas.

**Verificación del paquete:**

- `pnpm verify:package` comprueba `app.asar`, `app.asar.unpacked` con solo
  `sharp-win32-x64` y `better-sqlite3` `win32-x64`, `app-update.yml` sin token ni
  `publisherName`, `latest.yml` con SHA-512 y tamaño, `SHA256SUMS` con instalador,
  blockmap y `latest.yml`, las licencias, el icono y `ProductVersion` 0.1.0.
- La sonda nativa del paquete con `ELECTRON_RUN_AS_NODE` carga `better-sqlite3` y
  `sharp` x64, confirma SQLite 3.54.1 con FTS5 y genera un WebP real.
- **Prueba manual:** `scripts/verify-install.ps1` instala en silencio, comprueba
  que no hay registro en HKLM, arranca la aplicación, reinstala o actualiza a
  otra versión, desinstala y compara hashes de `data`, `assets` y `backups` antes
  y después. Requiere `-AcceptInstallTest` y no se ejecuta en CI.
- **Evidencia real (2026-11-20):** instalación, reinstalación y desinstalación
  sin UAC, registro solo en HKCU, actualización 0.1.0→0.1.1 y **194 archivos de
  `userData` intactos**, incluidas las copias diarias creadas por los arranques
  de prueba. Instalador de 132.698.671 bytes con SHA-256
  `4F293749704FB9C35A24163E0DC8E2350C244CFE6FA6062350E86C0B91DE53BF`;
  `latest.yml` 0.1.0 con SHA-512
  `Pp8LkuckrEIAIPqJr+SxFrUyva1cT6ppx86YSBxPhGRkciG4sfQuOioecEXavvUuqOZ97Qu675Eurl1fZD+8Fg==`
  y `SHA256SUMS` con instalador, blockmap y `latest.yml`.

**CI:** el job `package` corre en `windows-latest` con `verify:native`, `dist`,
`verify:build`, `package:checksums` y `verify:package --installer`; no publica ni
sube artefactos y **sigue sin ser required hasta M5**.

**Residuales:** la actualización real contra GitHub Releases se prueba en M5; el
instalador y `latest.yml` van sin firma (ADR 0015); la cancelación de la
comprobación no aborta el socket; la auditoría completa de axe, temas y ventana
sigue en #93; el paso de `package` a required y la build de release de Windows
se abordan en M5.

### 3.11 Componentes y E2E (implementado, #70)

**Componentes.** `pnpm test:components` ejecuta Vitest con `jsdom`, Testing
Library y `@testing-library/jest-dom` sobre `tests/components/`. El setup
(`tests/setup/components.ts`) extiende `expect` y limpia el DOM entre pruebas.
Los ejemplos cubren `Button` (nombre accesible, `onClick`, activación con
Enter/Espacio, `loading` con `aria-busy` y variantes) y `Tabs`
(tablist/tab/tabpanel, flechas, Inicio/Fin y clic). Las pruebas se typechequean
con `tsconfig.tests.json`, que añade DOM y JSX sin relajar `tsconfig.node` ni
`tsconfig.web`.

**E2E.** `pnpm test:e2e` compila con `pnpm build` y ejecuta Playwright Electron
en `tests/e2e/` (en serie, un worker, timeout de 60 s).
`tests/e2e/fixtures/electron-app.ts` crea una carpeta en `os.tmpdir()`, la pasa
como `--user-data-dir`, redirige `APPDATA` y `LOCALAPPDATA` a subcarpetas del
temporal, comprueba que `app.getPath('userData')` cae exactamente ahí, cierra la
aplicación y borra la carpeta. Una fuga de aislamiento detiene la prueba: no se
leen ni escriben `%APPDATA%`, la base, los assets ni las copias del usuario.

- **Shell:** identidad y versión, ventana visible con mínimo 1024×700, carga del
  renderer desde `file://`, navegación Inicio/Muestras con `aria-current` y
  conmutación de los dos temas.
- **Ventana:** a 1024, 1280 y 1600 px no hay scroll horizontal de página
  (`scrollWidth <= clientWidth` en `html` y `body`) con el contenido largo de la
  página de Muestras.
- **Accesibilidad:** se inyecta `axe-core` con `page.evaluate` (no está sujeto a
  la CSP) y se ejecuta sobre el documento en Claro y Oscuro. Se falla ante
  violaciones `critical`; las `serious` se anotan para #93. Una prueba negativa
  con un `img` sin `alt` confirma que la aserción detecta `image-alt` crítico y
  no es vacía. No se usa `@axe-core/playwright` porque necesita
  `browserContext.newPage()`, que el contexto de Electron no admite
  (`Target.createTarget: Not supported`).
- **Sin red:** los E2E no descargan navegadores ni hacen peticiones externas.

**Fixtures y helpers.** Las pruebas de integración reutilizan
`tests/integration/helpers/temp-db.ts` y `temp-assets.ts`; la ventana y el
`userData` temporal viven en `tests/e2e/fixtures/electron-app.ts` y la auditoría
en `fixtures/axe.ts`. Todo usa `os.tmpdir()` y se borra al terminar.

**Comandos y tiempos (equipo de referencia, 2026-11-20).** `pnpm test` ejecuta
282 unitarias (4 omitidas), 7 de componentes y 85 de integración (1 omitida) en
unos 40 s; `pnpm test:e2e` compila y ejecuta 9 pruebas en unos 21 s. Los E2E son
Windows-only, igual que la aplicación.

## 4. Cobertura

No se persigue un porcentaje global como meta. Se exige cobertura alta en:

- Migraciones y backups: **100 % de los caminos críticos**.
- Importación/exportación: casos válidos, inválidos y límites.
- IPC: todos los canales.
- Dominio: reglas de integridad.

La cobertura se mide con Vitest y se revisa en cada PR que toque esas áreas. Un
descenso injustificado bloquea la puerta de QA.

## 5. Datos de prueba

- Fixtures pequeños y legibles; sin datos personales reales.
- Nombres ficticios y evidentes (`Mundo de ejemplo`, `Personaje #1`).
- Imágenes de prueba generadas o de dominio público.
- Bases temporales en el directorio de pruebas; nunca la base del usuario.
- Los E2E crean un `userData` temporal en `os.tmpdir()`, comprueban que la
  aplicación lo usa de verdad y lo borran al terminar.

## 6. CI

| Job | Bloqueante | Qué ejecuta |
|---|---|---|
| `lint` | Sí | ESLint + `format:check`. |
| `typecheck` | Sí | `tsc --noEmit` por proyecto (`tsconfig.node`, `tsconfig.web` y `tsconfig.tests`). |
| `test` | Sí | `pnpm test`: 282 unitarias (4 omitidas), 7 de componentes y 85 de integración (1 omitida). |
| `build` | Sí desde #69 | `pnpm db:check`, `pnpm build` y `pnpm verify:build`: journal, artefactos, CSP, URLs remotas y externalización. |
| `package` | No, hasta M5 | `windows-latest`: `verify:native`, `dist`, `verify:build`, `package:checksums` y `verify:package --installer`; sin publicar ni subir artefactos. |
| `e2e` | No en CI | Sin job de PR: `pnpm test:e2e` se ejecuta en local antes de `review` y en el workflow de release de M5, en Windows. |
| `gitleaks` | No | Escaneo de secretos. |
| `audit` | No | `pnpm audit --audit-level=high`. |

Desde #69, `lint`, `typecheck`, `test` y `build` son required en los rulesets
`protect-dev` y `protect-main`; el job `build` incluye `db:check`. `package`
sigue sin ser required: empaquetar NSIS en Windows es lento y la build de release
completa llega con M5. Desde #70, `test` incluye las pruebas de componentes y no
hay job `e2e` en las PRs: los E2E se ejecutan en local antes de `review` y en el
workflow de release de M5 porque abren la aplicación real en Windows. La
auditoría de accesibilidad, temas y ventana de todas las pantallas sigue en #93.
`verify:native` se ejecuta en el job `package` de Windows desde #68. La CI no
tiene credenciales ni datos de usuario; el job `package` no recibe `GH_TOKEN`.
`gitleaks` y `audit` se revisan en la puerta de seguridad y no bloquean una PR
que no toca secretos ni dependencias.

### 6.1 Caché, límites gratuitos y build de Windows en M5

- **Caché.** `.github/actions/setup` usa `actions/setup-node` con `cache: pnpm`
  y la clave derivada de `pnpm-lock.yaml`; la instalación siempre usa
  `pnpm install --frozen-lockfile`. No hay caché manual ni se cachean `out/`,
  `release/` ni bases de datos. Un cambio de lockfile invalida la caché.
- **Límites.** El repositorio es público y usa GitHub Free: los runners estándar
  de Ubuntu y Windows no consumen minutos facturables. Los límites operativos
  que hay que vigilar son el tiempo máximo por job (6 h), los jobs concurrentes
  del plan y el almacenamiento de caché (10 GB por repositorio, con expulsión de
  entradas no usadas). `concurrency` cancela ejecuciones antiguas de la misma
  rama y ningún job sube artefactos, salvo la release de M5. Si GitHub cambia
  estas condiciones, se revisa el [ADR 0013](../adr/0013-ci-releases.md).
- **Build de Windows en M5.** El job `package` actual es la base: reutiliza
  `verify:native`, `dist`, `verify:build`, `package:checksums` y
  `verify:package --installer`. En M5 se añadirá un workflow de release que se
  dispare con un tag `vX.Y.Z` desde `main`, ejecute esos mismos pasos en
  `windows-latest`, publique el instalador NSIS, `latest.yml` y `SHA256SUMS` en
  GitHub Releases y pruebe la actualización real. La publicación usará solo el
  `GITHUB_TOKEN` del repositorio; no se añaden secretos de Supabase, Vercel ni
  R2. Cuando el tiempo del job sea aceptable, `package` podrá pasar a required;
  la firma de código sigue siendo opcional (ADR 0015).

## 7. Checklist de QA por issue

- [ ] Criterios de aceptación cumplidos.
- [ ] Tests nuevos o actualizados y en verde.
- [ ] Typecheck, lint, `pnpm test`, `pnpm db:check`, build y `verify:build` en
      verde; `verify:native` si se toca el módulo nativo; `verify:package` y
      `verify-install.ps1` si se toca el empaquetado o el actualizador.
- [ ] Ventana a 1024, 1280 y 1600 px.
- [ ] Temas Claro y Oscuro, contraste AA.
- [ ] Teclado, foco, axe y movimiento reducido.
- [ ] Preservación de datos si hay migración o borrado.
- [ ] Offline si toca arranque, datos o actualizaciones.
- [ ] Seguridad Electron si toca IPC, assets, importación o CSP.
- [ ] Manual actualizado si el cambio es visible.
- [ ] Task file actualizado.

## 8. Checklist de release

- [ ] CI en verde en `dev`, incluido el job `package` de Windows.
- [ ] `pnpm verify:native`, `pnpm dist`, `pnpm package:checksums` y
      `pnpm verify:package --installer` en verde.
- [ ] Instalador generado y probado en una máquina limpia con
      `scripts/verify-install.ps1 -AcceptInstallTest`.
- [ ] Actualización desde la versión anterior probada en local y, en M5, contra
      GitHub Releases.
- [ ] Desinstalación conserva `userData` y muestra el aviso.
- [ ] Copia y restauración probadas.
- [ ] Versión coherente entre `package.json`, `APP_VERSION`, `latest.yml` y
      `ProductVersion`.
- [ ] Licencias y `THIRD-PARTY-NOTICES.md` incluidos en el instalador.
- [ ] Manual actualizado.
- [ ] Changelog actualizado.
- [ ] SHA-256 y `SHA256SUMS` publicados; `latest.yml` con SHA-512 correcto.
- [ ] SmartScreen documentado; se comprueba que el instalador sigue sin firma
      salvo que se haya aprobado lo contrario (ADR 0015).
- [ ] Release etiquetada en GitHub Releases (M5) y `latest.yml` correcto.
- [ ] Confirmado que el job `package` no recibe credenciales ni sube artefactos.

## 9. Cuándo se ejecuta cada nivel

| Momento | Unit | Integración | E2E | Manual |
|---|---|---|---|---|
| Cada cambio | Sí | Si toca datos | No | No |
| Antes de `review` | Sí | Sí | Flujo afectado | Si es visual |
| Antes de publicar | Sí | Sí | Sí | Si hay UI |
| Antes de un release | Sí | Sí | Sí | Completo |

## 10. Documentos relacionados

- [Arquitectura](../arquitectura.md)
- [Persistencia](../persistencia.md)
- [Continuidad](../continuidad.md)
- [Sistema de diseño](../diseno/sistema-de-diseno.md)
- [ADR 0010](../adr/0010-testing-strategy.md)
- [ADR 0013](../adr/0013-ci-releases.md)
- [ADR 0016](../adr/0016-sqlite-migrations-safe-mode.md)
- [ADR 0017](../adr/0017-assets-service-sharp-orphan-purge.md)
- [ADR 0018](../adr/0018-nsis-packaging-and-update-service.md)
