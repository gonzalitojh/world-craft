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

Las rutas de `tests/unit/` ya existen con el scaffold (M0-02); `components/`,
`integration/` y `e2e/` se crearán con sus issues y hasta entonces son contrato
previsto.

## 3. Qué se prueba en cada área

### 3.1 Dominio y datos

- Validaciones Zod de entidades, relaciones, mapas, escenas y ajustes.
- Reglas de integridad: relación sin origen igual a destino, tipos del sistema
  no editables, assets referenciados.
- Búsqueda FTS5: coincidencias, prefijos, acentos y reconstrucción.
- Exportación/importación: ida y vuelta, IDs, assets y manifiesto.

### 3.2 Migraciones y preservación

- Base vacía → última versión.
- Base con datos → migración → mismos datos.
- Migración fallida → rollback + modo seguro.
- Copia pre-migración verificable.
- Restauración → integridad y migraciones pendientes.
- Versión de esquema superior → la app no escribe.

### 3.3 IPC y seguridad

El IPC todavía no existe (#63); las comprobaciones de canales se activan cuando
llegue. El scaffold ya cubre el aislamiento del renderer, la CSP, la navegación,
los permisos y la red.

- Cada canal tiene esquema de entrada y salida.
- Un canal desconocido se rechaza.
- Un payload inválido devuelve un error tipado, no una excepción interna.
- El renderer no accede a `require`, `process`, `fs` ni `ipcRenderer`.
- El protocolo de assets rechaza rutas fuera de `assets/`.
- La importación rechaza ZIP con `..`, rutas absolutas y enlaces.
- CSP y navegación externa bloqueada.
- No hay secretos ni rutas absolutas en logs.

### 3.4 UI y accesibilidad

- Componentes con estados de reposo, hover, foco, error, deshabilitado y carga.
- Navegación por teclado y foco visible.
- `aria-live` en guardado y errores.
- axe sin errores críticos en pantallas principales.
- Contraste AA en los dos temas.
- `prefers-reduced-motion`.
- Ventana a 1024, 1280 y 1600 px sin scroll horizontal de página.
- Textos largos, nombres sin espacios y rutas no rompen el layout.

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

### 3.7 Scaffold y artefactos (implementado)

- **54 pruebas unitarias** en `tests/unit/`: identidad y ventana mínima,
  opciones de seguridad de `BrowserWindow`, CSP de producción y desarrollo,
  resolución del renderer, guards de navegación/sesión/red, contrato y router
  IPC, API congelada del preload y validación de enlaces externos.
- **Build.** `pnpm build` compila `out/main/index.cjs`, `out/preload/index.cjs` y
  `out/renderer/index.html`; no genera instalador.
- **Verificación.** `pnpm verify:build` comprueba la existencia y tamaño de los
  artefactos, que la CSP de producción va antes de los scripts, que no contiene
  `unsafe-*` ni URLs remotas. Una prueba negativa manual (quitar la CSP o añadir
  una URL) debe hacerlo fallar.
- **Manual del scaffold.** Ventana a 1024, 1280 y 1600 px sin scroll horizontal,
  temas claro y oscuro por `prefers-color-scheme`, DevTools sin `require` ni
  `process`, navegación externa bloqueada y arranque sin red.
- **Pendiente.** E2E con Playwright (#70) y auditoría de accesibilidad, temas y
  ventana (#93).

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
| `test` | Sí | Vitest unitario (hoy 54 pruebas del scaffold y del IPC). |
| `build` | No hasta #69 | `pnpm build` y `pnpm verify:build`: artefactos, CSP y URLs remotas. |
| `e2e` | No | Playwright Electron en Windows; pendiente de #70. |
| `gitleaks` | No | Escaneo de secretos. |
| `audit` | No | `pnpm audit --audit-level=high`. |

El scaffold ya ejecuta `lint`, `typecheck`, `test` y `build`. `build` no es
todavía required: añadirlo a la protección de `dev` corresponde a #69. `e2e`
llegará con #70 y la auditoría de accesibilidad, temas y ventana con #93. Los
required checks se aplican en los rulesets `protect-dev` y `protect-main`. La CI
no tiene credenciales ni datos de usuario.

## 7. Checklist de QA por issue

- [ ] Criterios de aceptación cumplidos.
- [ ] Tests nuevos o actualizados y en verde.
- [ ] Typecheck, lint, tests, build y verify:build en verde.
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
