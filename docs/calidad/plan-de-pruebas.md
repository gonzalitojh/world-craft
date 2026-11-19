# Plan de pruebas y calidad

> **Estado:** vigente desde el 18/11/2026 (pivote a escritorio).
> **Ámbito:** estrategia de pruebas, calidad, accesibilidad, rendimiento,
> preservación de datos y verificación antes de publicar.
> **Decisiones:** ADR 0010 (testing), ADR 0012 (datos) y ADR 0013 (CI).

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
| Componentes | Vitest + Testing Library | Renderer, formularios, estados, teclado, temas. | `tests/unit/` y `tests/components/` |
| Integración | Vitest + SQLite temporal | Esquema, migraciones, consultas, FTS5, backups, importación. | `tests/integration/` |
| E2E | Playwright Electron | Arranque, ventana, flujos críticos, temas, accesibilidad. | `tests/e2e/` |
| Manual | Checklist | Instalación, actualización, desinstalación y percepción visual. | Task file |

`tests/unit/` e `tests/integration/` existen y están en verde (M0-02 a M0-07).
`components/` y `e2e/` se crearán con sus issues y hasta entonces son contrato
previsto.

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

Lo siguiente **no está hecho todavía** y pertenece a #70 y a la revisión local:

- Componentes con estados de reposo, hover, foco, error, deshabilitado y carga
  en una matriz visual real a 1024, 1280 y 1600 px.
- Navegación por teclado y foco visible revisados en la aplicación.
- `aria-live` en los flujos de guardado y error de las pantallas de dominio (los
  avisos del shell ya lo usan).
- axe sin errores críticos en pantallas principales.
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

### 3.6 Distribución

- Instalador NSIS instala, actualiza y desinstala.
- `userData` sobrevive a las tres operaciones.
- `latest.yml` y los artefactos de release son correctos.
- La app arranca sin conexión.
- SmartScreen se documenta y el checksum coincide.

### 3.7 Scaffold, persistencia y artefactos (implementado)

- **216 pruebas unitarias en verde (4 omitidas)** en `tests/unit/`: identidad y
  ventana mínima, opciones de seguridad de `BrowserWindow`, CSP de producción y
  desarrollo, resolución del renderer, guards de navegación/sesión/red, contrato
  y router IPC, API congelada del preload, validación de enlaces externos,
  journal, checksum, rutas de datos, UUIDv7, logger, lógica del aviso de modo
  seguro, tokens y contraste del sistema de diseño, servicio de assets y copias
  (manifiesto, rutas de restauración, buckets, rotación y composición de modo
  seguro).
- **84 pruebas de integración en verde (1 omitida)** en `tests/integration/`:
  creación e idempotencia de la base, pragmas, migración inicial, versión
  adelantada, estado incoherente, archivo no SQLite, corrupción, log sin rutas,
  base ajena, checksum alterado, rollback del lote, preservación con copia,
  restauración manual heredada, fallo de copia, rollback de referencia, upgrade
  a `0001_assets`, importación, protocolo, repositorio y purga con SQLite real, y
  creación, verificación, restauración, rotación y restauración interrumpida de
  copias.
- **Comandos.** `pnpm test:unit`, `pnpm test:integration`, `pnpm test`,
  `pnpm db:check`, `pnpm verify:native` y `pnpm verify:build`.
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
  2×2. Hoy se ejecuta a mano; debe añadirse a la CI antes de #68.
- **Manual del scaffold.** DevTools sin `require` ni `process`, navegación
  externa bloqueada y arranque sin red. La comprobación visual de la ventana a
  1024, 1280 y 1600 px y de los dos temas con el shell de #65 queda pendiente
  para #70 y la revisión local.
- **Pendiente.** E2E con Playwright (#70), auditoría de accesibilidad, temas y
  ventana (#93), y pruebas del instalador y del asar (#68).

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

Pendiente antes de M1/#68: endurecer el inventario y la rotación con `realpath` y
contención, y añadir una prueba de junction dentro de `backups/daily`.

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
- Los E2E usan un `userData` temporal y lo borran al terminar.

## 6. CI

| Job | Bloqueante | Qué ejecuta |
|---|---|---|
| `lint` | Sí | ESLint + `format:check`. |
| `typecheck` | Sí | `tsc --noEmit` por proyecto (`tsconfig.node` y `tsconfig.web`). |
| `test` | Sí | `pnpm test`: 216 unitarias en verde (4 omitidas) + 84 de integración en verde (1 omitida). |
| `build` | No hasta #69 | `pnpm db:check`, `pnpm build` y `pnpm verify:build`: journal, artefactos, CSP, URLs remotas y externalización. |
| `e2e` | No | Playwright Electron en Windows; pendiente de #70. |
| `gitleaks` | No | Escaneo de secretos. |
| `audit` | No | `pnpm audit --audit-level=high`. |

El repositorio ya ejecuta `lint`, `typecheck`, `test` y `build`, y el job `build`
incluye `db:check`. `build` no es todavía required: añadirlo a la protección de
`dev` corresponde a #69. `e2e` llegará con #70 y la auditoría de accesibilidad,
temas y ventana con #93. `verify:native` no está en la CI y debe añadirse antes
de #68. Los required checks se aplican en los rulesets `protect-dev` y
`protect-main`. La CI no tiene credenciales ni datos de usuario.

## 7. Checklist de QA por issue

- [ ] Criterios de aceptación cumplidos.
- [ ] Tests nuevos o actualizados y en verde.
- [ ] Typecheck, lint, `pnpm test`, `pnpm db:check`, build y `verify:build` en
      verde; `verify:native` si se toca el módulo nativo.
- [ ] Ventana a 1024, 1280 y 1600 px.
- [ ] Temas Claro y Oscuro, contraste AA.
- [ ] Teclado, foco, axe y movimiento reducido.
- [ ] Preservación de datos si hay migración o borrado.
- [ ] Offline si toca arranque, datos o actualizaciones.
- [ ] Seguridad Electron si toca IPC, assets, importación o CSP.
- [ ] Manual actualizado si el cambio es visible.
- [ ] Task file actualizado.

## 8. Checklist de release

- [ ] CI en verde en `dev`.
- [ ] Instalador generado y probado en una máquina limpia.
- [ ] Actualización desde la versión anterior probada.
- [ ] Desinstalación conserva `userData`.
- [ ] Copia y restauración probadas.
- [ ] Manual actualizado.
- [ ] Changelog actualizado.
- [ ] Checksums publicados.
- [ ] SmartScreen documentado.
- [ ] Release etiquetada y `latest.yml` correcto.

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
