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

`tests/unit/` e `tests/integration/` existen y están en verde (M0-02 a M0-04).
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

- Base nueva → `0000_init` → `user_version` 1, tablas del sistema y sin copia
  previa (justificado: no hay datos que preservar).
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
- Restauración manual de la copia → integridad y migraciones pendientes.

Estos casos viven en `tests/integration/` y usan bases temporales en
`os.tmpdir()`.

### 3.3 IPC y seguridad

El IPC tipado está implementado desde #63 y el scaffold cubre el aislamiento del
renderer, la CSP, la navegación, los permisos y la red.

- Cada canal tiene esquema de entrada y salida.
- Un canal desconocido se rechaza.
- Un payload inválido devuelve un error tipado, no una excepción interna.
- El renderer no accede a `require`, `process`, `fs` ni `ipcRenderer`.
- El protocolo de assets rechaza rutas fuera de `assets/` (previsto, #66).
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
- Copia y exportación sin bloquear la ventana.
- Sin fugas evidentes al abrir y cerrar editor, mapa y grafo varias veces.

### 3.6 Distribución

- Instalador NSIS instala, actualiza y desinstala.
- `userData` sobrevive a las tres operaciones.
- `latest.yml` y los artefactos de release son correctos.
- La app arranca sin conexión.
- SmartScreen se documenta y el checksum coincide.

### 3.7 Scaffold, persistencia y artefactos (implementado)

- **103 pruebas unitarias** en `tests/unit/`: identidad y ventana mínima,
  opciones de seguridad de `BrowserWindow`, CSP de producción y desarrollo,
  resolución del renderer, guards de navegación/sesión/red, contrato y router
  IPC, API congelada del preload, validación de enlaces externos, journal,
  checksum, rutas de datos, logger, lógica del aviso de modo seguro y tokens y
  contraste del sistema de diseño.
- **18 pruebas de integración** en `tests/integration/`: creación e idempotencia
  de la base, pragmas, migración inicial, versión adelantada, estado incoherente,
  archivo no SQLite, corrupción, log sin rutas, base ajena, checksum alterado,
  rollback del lote, preservación con copia, restauración manual, fallo de copia
  y rollback de referencia.
- **Comandos.** `pnpm test:unit`, `pnpm test:integration`, `pnpm test`,
  `pnpm db:check`, `pnpm verify:native` y `pnpm verify:build`.
- **Build.** `pnpm build` compila `out/main/index.cjs`, `out/preload/index.cjs` y
  `out/renderer/index.html`, y copia `drizzle/` a `out/main/drizzle`; no genera
  instalador.
- **Verificación.** `pnpm verify:build` comprueba la existencia y tamaño de los
  artefactos, que la CSP de producción va antes de los scripts, que no contiene
  `unsafe-*` ni URLs remotas, que el journal y `0000_init.sql` están en el build
  y que `better-sqlite3` y `drizzle-orm` están externalizados.
- **Nativo.** `pnpm verify:native` carga `better-sqlite3` en Node y Electron y
  comprueba SQLite 3.54.1 con FTS5. Hoy se ejecuta a mano; debe añadirse a la CI
  antes de #68.
- **Manual del scaffold.** DevTools sin `require` ni `process`, navegación
  externa bloqueada y arranque sin red. La comprobación visual de la ventana a
  1024, 1280 y 1600 px y de los dos temas con el shell de #65 queda pendiente
  para #70 y la revisión local.
- **Pendiente.** E2E con Playwright (#70), auditoría de accesibilidad, temas y
  ventana (#93), y pruebas del instalador y del asar (#68).

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
| `test` | Sí | `pnpm test`: 103 unitarias + 18 de integración. |
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
