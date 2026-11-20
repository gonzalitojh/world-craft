# ADR 0018 — Empaquetado NSIS, actualizador manual y preservación

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-20
- **Fecha del documento:** 2026-11-20
- **Issue:** #68
- **Decisiones del registro:** D-041
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0003, ADR 0013, ADR 0015, ADR 0016, ADR 0017

## Contexto

El ADR 0003 fijó electron-builder con NSIS por usuario y electron-updater con
GitHub Releases, pero no cómo se materializa: dónde vive la configuración, qué
pantallas tiene el instalador, cómo se desempaquetan los módulos nativos, qué
versión se publica, cómo se comporta el actualizador sin firma y qué se prueba
antes de dar un artefacto por bueno. La issue #68 (M0-08) tenía que convertir esa
decisión en un instalador real sin arriesgar los datos existentes.

Las restricciones eran: Windows x64, instalación sin administrador, coste
0 €/mes, funcionamiento offline salvo la comprobación de actualizaciones,
ninguna subida de contenido del usuario, ninguna versión pública todavía y una
firma de código que sigue fuera del MVP (ADR 0015). El desarrollo se hace en
Windows, pero la CI de calidad corre en Ubuntu y debe seguir funcionando.

## Decisión

1. **Configuración versionada y salida ignorada.** electron-builder 26.18.0 se
   configura en `electron-builder.config.cjs`, en CommonJS para poder leer
   `package.json` con `require` y recibir comentarios. Los iconos, el script NSIS
   y las licencias viven en `resources/` (`buildResources`); los artefactos se
   generan en `release/`, que está ignorado por git. No se usa `build/` ni un
   archivo YAML. La versión del producto es **0.1.0** y debe coincidir entre
   `package.json`, `APP_VERSION`, `app.getVersion()`, `latest.yml` y
   `ProductVersion`; un test de consistencia lo comprueba.
2. **NSIS asistido por usuario.** `oneClick:false`, `perMachine:false`,
   `allowElevation:false` y `customInstallMode` fuerzan la instalación del
   usuario actual en `%LOCALAPPDATA%\Programs\World Craft`, sin UAC. Se permite
   cambiar la carpeta, se crea acceso directo solo en el menú Inicio (no en el
   escritorio), el idioma es `es_ES`, el artefacto se llama
   `world-craft-${version}-setup.${ext}` y no hay página de componentes.
   `deleteAppDataOnUninstall:false` es explícito y `customUnInstall` avisa, solo
   cuando el desinstalador no es silencioso, de que `%APPDATA%\World Craft` se
   conserva.
3. **Paquete x64 con binarios nativos fuera del asar.** `win.target` es NSIS x64
   y los scripts pasan `--x64`. `supportedArchitectures` declara
   `os: [current, win32]` y `cpu: [x64, arm64]` para que Linux conserve su sharp
   nativo y para poder empaquetar desde un equipo ARM64; `afterPack` poda los
   binarios que no son win32-x64, de modo que el paquete final solo contiene
   `sharp-win32-x64` y `better-sqlite3` `win32-x64`. `better-sqlite3`, `sharp` y
   `@img/*` se externalizan y se desempaquetan del asar; `electron-updater` y
   `builder-util-runtime` se externalizan; `npmRebuild`, `nodeGypRebuild` y
   `buildDependenciesFromSource` quedan en `false`. El paquete incluye `out/`,
   `package.json`, `LICENSE`, `THIRD-PARTY-NOTICES.md` y `licenses/`; no incluye
   código fuente ni herramientas de desarrollo.
4. **Sin firma, con integridad por HTTPS y checksums.** `win.signExecutable`,
   `win.verifyUpdateCodeSignature` y `forceCodeSigning` quedan en `false`; el
   `app-update.yml` generado no lleva `publisherName` ni token.
   `latest.yml` no incluye firma Ed25519 porque electron-builder 26.18.0 no la
   soporta: la firma de manifiestos se decide en M5. La integridad actual se
   apoya en HTTPS, en el SHA-512 de `latest.yml` y en el `SHA256SUMS` con el
   instalador, el blockmap y `latest.yml`. SmartScreen se documenta según el
   ADR 0015; el instalador se distribuye sin Authenticode.
5. **Actualizador manual, consentido y cancelable.** `electron-updater` 6.8.11 y
   `builder-util-runtime` 9.7.0 se externalizan. **No hay comprobación
   automática**: se consulta solo desde el botón «Actualizaciones» de la barra
   superior y su diálogo. Los estados son `unavailable`, `idle`, `checking`,
   `up-to-date`, `available`, `downloading`, `downloaded`, `installing` y
   `error`. La comprobación tiene timeout de 30 s y un `epoch` descarta
   resultados tardíos; la descarga exige consentimiento y se cancela de verdad
   con un `CancellationToken`; la instalación solo se acepta desde `downloaded`
   y reinicia con consentimiento. `autoDownload` y `autoInstallOnAppQuit` son
   `false`; el actualizador se deshabilita en desarrollo, en modo seguro y si
   falta `app-update.yml`, sin impedir el arranque.
6. **Red aislada y sin contenido.** electron-updater usa su partición
   `electron-updater` con `cache:false`; antes de permitir tráfico se comprueba
   que `autoUpdater.netSession` es esa sesión. Solo se admite HTTPS a
   `github.com`, `api.github.com` y subdominios de `githubusercontent.com`, sin
   credenciales ni puertos no estándar; se eliminan las cabeceras
   `x-user-staging-id`, `authorization`, `private-token` y `cookie`, y todos los
   permisos se deniegan. El actualizador no envía el contenido de los mundos ni
   datos personales. `logs/updates.log` es JSONL tipado, rota a 256 KiB y no
   incluye URLs, rutas, versiones ni contenido.
7. **Instancia única antes de tocar datos.** `app.requestSingleInstanceLock()`
   se adquiere antes de `whenReady`, de la base, del IPC y de la ventana. Si ya
   hay otra instancia, el proceso nuevo no inicializa nada y se cierra; la
   instancia existente recibe `second-instance` y enfoca su ventana. Está activo
   también en desarrollo.
8. **Licencias completas en el instalador.** `pnpm licenses:sync` copia a
   `resources/licenses/` los textos de sharp, `@img/sharp-win32-*`, libvips
   (LGPL-3.0-or-later) y GPL-3.0, además de electron-updater; `extraFiles` los
   publica en `licenses/` junto al ejecutable. `THIRD-PARTY-NOTICES.md` explica
   el origen y la ausencia de modificaciones en libvips.
9. **CI de empaquetado no bloqueante.** El job `package` corre en
   `windows-latest` y ejecuta `verify:native`, `dist`, `verify:build`,
   `package:checksums` y `verify:package --installer`. No publica, no recibe
   `GH_TOKEN` y no sube artefactos. #69 confirmó el job de Ubuntu y mantiene
   `package` fuera de los required checks hasta M5; la release completa con
   publicación llega con M5.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Instalador `oneClick` | Instala sin mostrar carpeta ni pasos y dificulta explicar el aviso de SmartScreen y la separación de datos; se prefiere el asistido por usuario. |
| Instalación `perMachine` con UAC | Exige administrador y escribe en `Program Files`, justo lo que el proyecto evita para que actualizar o desinstalar no toque los datos. |
| Instalador portable (ZIP) | No crea accesos directos ni registro de desinstalación y no cumple el requisito de aplicación instalable con actualizaciones. |
| Comprobación automática al arrancar | Sin Ajustes en M0 no habría forma de desactivarla, y el ADR 0003 exige consentimiento; se pospone a M1 con su interruptor. |
| Actualizador propio o Squirrel.Windows | Más código y mantenimiento; electron-updater ya cubre GitHub Releases, `latest.yml` y descarga diferencial. |
| Carpeta `build/` para recursos | electron-builder la usa por defecto, pero `resources/` es más explícita y evita confundirla con `out/`; es solo una convención de configuración. |
| Configuración en YAML | No permite comentar la lógica de `afterPack` ni escribir `app-update.yml` para las builds `--dir`; CommonJS se prueba con Vitest. |
| Servidor propio de actualizaciones | Coste y mantenimiento; GitHub Releases es gratuito y ya se usa para el código. |
| Publicar también arm64 o un instalador universal | Duplica artefactos y pruebas; el producto se distribuye x64 y la poda elimina los binarios ajenos. |
| Firma Ed25519 de manifiestos ahora | electron-builder 26.18.0 no la soporta; inventarla o parchear el empaquetado añade riesgo sin resolver Authenticode. Se decide en M5. |

## Consecuencias

### Positivas

- Instalar, actualizar, reinstalar y desinstalar no requieren administrador ni
  tocan `%APPDATA%\World Craft`; la prueba real dejó 194 archivos de `userData`
  intactos.
- El paquete es reproducible, x64 y más pequeño al podar los binarios nativos
  que no se usan; `verify:package` comprueba asar, binarios, licencias, icono,
  versión y manifiestos.
- El actualizador no abre red hasta que el usuario lo pide, no descarga sin
  consentimiento, se puede cancelar y no envía contenido.
- La instancia única elimina la carrera entre procesos que quedaba abierta desde
  el ADR 0016.
- El coste sigue siendo 0 €/mes y la aplicación funciona sin conexión.

### Negativas y riesgos

- El instalador ocupa **132.698.671 bytes** (~126,6 MiB) y el blockmap añade
  ~139 KB; cada release consume espacio de GitHub Releases.
- Sin Authenticode, SmartScreen puede mostrar un aviso y un tercero podría
  suplantar el instalador si se descarga fuera del origen oficial. Los checksums
  ayudan, pero no sustituyen a la firma.
- La cancelación de la comprobación descarta el resultado por `epoch`, pero no
  aborta el socket de `checkForUpdates()`; es un residual de red/UX sin envío de
  datos.
- No hay interruptor para desactivar las actualizaciones hasta Ajustes (M1);
  hoy no hace falta porque tampoco hay comprobación automática.
- Los scripts de empaquetado son Windows-only y el job `package` es lento; no
  bloquea todavía las PRs.
- La actualización real contra una release pública de GitHub no se puede probar
  hasta M5.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | El instalador crea acceso directo solo en Inicio; una única instancia enfoca la ventana existente. |
| Temas (Claro/Oscuro) | El botón «Actualizaciones» y su diálogo usan los tokens y se revisaron en ambos temas a 1024, 1280 y 1600 px. |
| Accesibilidad | Diálogo nativo con trampa de foco, `Escape`, `aria-live`, `<progress>` etiquetado y textos del catálogo; axe sobre el shell y E2E desde #70, y auditoría completa en #93. |
| Seguridad y privacidad | Partición aislada, allowlist HTTPS de GitHub, cabeceras saneadas, permisos denegados y logs sin URLs ni contenido; sin firma Authenticode. |
| Datos y preservación | `userData` fuera de la instalación, `deleteAppDataOnUninstall:false`, aviso al desinstalar y prueba de instalación/actualización/desinstalación. |
| Coste | 0 €/mes: GitHub Free, electron-builder y electron-updater open source; la firma de código sigue siendo opcional y de pago. |
| Portabilidad de datos | No cambia: SQLite y assets locales; la exportación/importación llega con M1. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Tamaño de GitHub Releases | Límite por archivo y almacenamiento del plan Free | Un instalador por versión, sin binarios duplicados ni artefactos de CI | M5 |
| Minutos de Actions en Windows | Los runners de Windows consumen más minutos que Ubuntu | Job `package` no bloqueante y acotado; la release completa se hace en M5 | M5 |
| SmartScreen sin firma | Aviso para el usuario; reputación no disponible | Manual con pasos, checksums publicados y descarga solo desde el origen oficial | ADR 0015 |
| Firma de código | Certificado de pago | Fuera del MVP; cualquier adopción exige aprobación y ADR | Backlog |
| Servidor de actualizaciones | No aplica: se usa GitHub Releases | Sin servidor propio, sin cuotas adicionales | M5 |
| Manifiestos sin firma Ed25519 | Integridad solo por HTTPS y SHA-512 | `SHA256SUMS`, `latest.yml` verificado y decisión de firma en M5 | M5 |
| Dependencia de GitHub | Si cambia el repo o el proveedor, hay que actualizar `app-update.yml` | Configuración versionada y prueba real de actualización en M5 | M5 |

## Plan de revisión

Se revisa en M5 al publicar la primera release real y probar la actualización
contra GitHub Releases, al decidir la firma de código y la firma Ed25519 de
manifiestos, y al añadir Ajustes en M1 con el interruptor y la frecuencia de
comprobación. También se reabre si cambia electron-builder a una versión con
firma de manifiestos, si GitHub modifica las condiciones de Releases o si el job
`package` pasa a required en M5. Cualquier cambio de instalador, de canal o de
verificación de actualizaciones exige un ADR nuevo.

## Referencias

- Issue: #68 — Instalador NSIS, actualizaciones y preservación de datos.
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.8 y §4.6.
- [`docs/arquitectura.md`](../arquitectura.md), secciones 2.7 y 6.
- [`docs/continuidad.md`](../continuidad.md), sección 7.
- [`docs/persistencia.md`](../persistencia.md), secciones 2, 9 y 10.
- [`docs/calidad/plan-de-pruebas.md`](../calidad/plan-de-pruebas.md), sección 3.10.
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-041.
- [ADR 0003](0003-nsis-installer-electron-updater-data-preservation.md),
  [ADR 0013](0013-ci-releases.md), [ADR 0015](0015-optional-code-signing-smartscreen.md),
  [ADR 0016](0016-sqlite-migrations-safe-mode.md) y
  [ADR 0017](0017-assets-service-sharp-orphan-purge.md).
- Documentación de electron-builder 26.18.0, electron-updater 6.8.11 y NSIS
  consultada el 19/11/2026.
