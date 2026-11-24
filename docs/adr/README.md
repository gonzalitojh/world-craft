# Registro de decisiones de arquitectura (ADR)

> **Estado:** serie vigente desde el 18/11/2026 para la aplicación de escritorio.
> **Ámbito:** decisiones arquitectónicas y de producto con consecuencias
> técnicas. El histórico de la etapa web se conserva en git y no se mantiene.

## 1. Qué es un ADR

Un ADR documenta una decisión importante: el contexto, la decisión, las
alternativas, las consecuencias y los riesgos. Un ADR aceptado **no se edita**
para cambiar la decisión: se crea otro que lo supersede. La plantilla está en
[`0000-template.md`](0000-template.md).

## 2. Índice

| ADR | Tema | Estado | Registro |
|---|---|---|---|
| [0001](0001-electron-vite-react-typescript.md) | Electron + Vite + React + TypeScript | Aceptado | D-020, D-033 |
| [0002](0002-sqlite-better-sqlite3-drizzle-fts5.md) | SQLite + better-sqlite3 + Drizzle + FTS5 | Aceptado | D-021 |
| [0003](0003-nsis-installer-electron-updater-data-preservation.md) | Instalador NSIS, electron-updater y preservación | Aceptado | D-023, D-031 |
| [0004](0004-electron-security-typed-ipc.md) | Seguridad Electron e IPC tipado | Aceptado | D-024, D-025 |
| [0005](0005-local-assets-custom-protocol.md) | Assets locales y protocolo `wc-asset://` | Aceptado | D-022 |
| [0006](0006-two-themes-desktop-design-system.md) | Dos temas y sistema de diseño de escritorio | Aceptado | D-026; revisado en D-048/0025 y D-050/0027 |
| [0007](0007-tiptap-editor-exporters.md) | Editor Tiptap y exportadores | Aceptado | D-027 |
| [0008](0008-maplibre-terra-draw-react-flow-elk.md) | MapLibre/Terra Draw y React Flow/ELK | Aceptado | D-028 |
| [0009](0009-centralized-i18n.md) | Internacionalización centralizada | Aceptado | D-029 |
| [0010](0010-testing-strategy.md) | Estrategia de pruebas | Aceptado | D-030 |
| [0011](0011-single-user-local-model.md) | Modelo local de un solo usuario | Aceptado | D-025 |
| [0012](0012-backup-restore-recovery.md) | Copias, restauración y recuperación | Aceptado | D-031 |
| [0013](0013-ci-releases.md) | CI, releases y distribución | Aceptado | D-032 |
| [0014](0014-repository-structure-tooling.md) | Estructura del repositorio y tooling | Aceptado | D-033, D-038 |
| [0015](0015-optional-code-signing-smartscreen.md) | Firma de código opcional y SmartScreen | Aceptado | D-034 |
| [0016](0016-sqlite-migrations-safe-mode.md) | SQLite, migraciones propias y modo seguro | Aceptado | D-040 |
| [0017](0017-assets-service-sharp-orphan-purge.md) | Servicio de assets locales, sharp, miniatura y purga recuperable (#66) | Aceptado | D-022 |
| [0018](0018-nsis-packaging-and-update-service.md) | Empaquetado NSIS, actualizador manual y preservación (#68) | Aceptado | D-041 |
| [0019](0019-worlds-crud-mvp.md) | Mundos del MVP: CRUD, actividad y borrado lógico (#72) | Aceptado | D-042 |
| [0020](0020-entity-types-custom-fields.md) | Tipos de entidad del sistema y campos personalizados (#73) | Aceptado | D-043 |
| [0021](0021-entities-crud-gallery-tags-editor.md) | Fichas: modelo, galería, etiquetas y editor enriquecido (#74) | Aceptado | D-044 |
| [0022](0022-relations-backlinks-graph-api.md) | Relaciones tipadas, etiquetas inversas y API del grafo (#75) | Aceptado | D-045 |
| [0023](0023-global-search-fts5-command-palette.md) | Búsqueda global FTS5 y paleta de comandos (#76) | Aceptado | D-046 |
| [0024](0024-obligatory-specialized-subagents.md) | Invocación obligatoria de los subagentes especializados | Aceptado | D-047 |
| [0025](0025-visual-direction-v2.md) | Dirección visual v2 y sistema «estudio moderno» (#124) | Aceptado | D-048; nota de D-050/0027 |
| [0026](0026-minimal-editor-mentions.md) | Editor mínimo, menú Formato y menciones `@` / `[[ ]]` (#131) | Aceptado | D-049 |
| [0027](0027-ui-preferences-persistence.md) | Preferencias de interfaz persistentes: claves `ui.*`, tres canales y arranque sin parpadeo (#132) | Aceptado | D-050 |
| [0028](0028-trash-versions-and-pre-purge-backup.md) | Papelera, versiones de contenido y copia previa a la purga (#77) | Aceptado | D-051 |

## 3. Relación con otros documentos

- [`AGENTS.md`](../../AGENTS.md): reglas obligatorias.
- [`docs/proceso-sdd.md`](../proceso-sdd.md): proceso y puertas.
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md): alcance y decisiones de
  producto.
- [`docs/registro-decisiones.md`](../registro-decisiones.md): histórico
  append-only.
- [`docs/arquitectura.md`](../arquitectura.md): implementación de las
  decisiones.

## 4. Cómo crear un ADR

1. Copia `0000-template.md` como `NNNN-slug-en-kebab-case.md` con el siguiente
   número libre.
2. Completa todas las secciones; no inventes cifras.
3. Añade la fila al índice de la sección 2.
4. Enlaza el ADR desde el plan, la arquitectura o el registro si aplica.
5. Si supersede a otro, actualiza el estado del anterior y enlaza el nuevo.
6. Verifica que los enlaces locales resuelven y que el ADR está en español.

## 5. Convenciones

- Un ADR por decisión coherente.
- Estados: `propuesto`, `aceptado`, `supersedido por ADR NNNN`.
- Fecha de decisión y fecha del documento.
- Al menos una alternativa real y el motivo del descarte.
- Impacto en ventana, temas, accesibilidad, seguridad, datos y coste.
- Riesgos de free tier: si no aplica, se explica.
- Sin secretos, datos personales ni cifras sin fuente.

## 6. Historial

| Fecha | Cambio |
|---|---|
| 2026-11-18 | Serie de escritorio 0001–0015; se retiran los ADRs web 0001–0020. |
| 2026-11-18 | Se añade el ADR 0016 (persistencia local, migraciones y modo seguro, #64). |
| 2026-11-19 | Se añade el ADR 0017 (servicio de assets locales, sharp y purga recuperable, #66). |
| 2026-11-19 | Se anota la implementación de M0-07 (#67) en los ADR 0012 y 0016: manifiesto v2, copias automáticas, retención 7/4/12/5 y restauración desde modo seguro. |
| 2026-11-20 | Se añade el ADR 0018 (empaquetado NSIS, actualizador manual y preservación, #68) y se anota su implementación en los ADR 0003, 0013, 0015 y 0016. |
| 2026-11-20 | Se añade el ADR 0019 (mundos del MVP: CRUD, actividad y borrado lógico, #72). |
| 2026-11-20 | Se añade el ADR 0020 (tipos de entidad del sistema y campos personalizados, #73). |
| 2026-11-20 | Se añade el ADR 0021 (fichas, galería, etiquetas y editor enriquecido, #74). |
| 2026-11-20 | Se añade el ADR 0022 (relaciones tipadas, etiquetas inversas y API del grafo, #75). |
| 2026-11-20 | Se añade el ADR 0023 (búsqueda global FTS5 y paleta de comandos, #76). |
| 2026-11-21 | Se añade el ADR 0024 (invocación obligatoria de los subagentes especializados, tarea local `subagent-routing`). |
| 2026-11-21 | Se añade el ADR 0025 (dirección visual v2, #124) y se anota que revisa la estética del ADR 0006 sin supersederlo. |
| 2026-11-23 | Se añade el ADR 0026 (editor mínimo, menú Formato y menciones `@` / `[[ ]]`, #131). |
| 2026-11-24 | Se añade el ADR 0027 (preferencias de interfaz persistentes, #132) y se anota que revisa el arranque del tema en los ADR 0006 y 0025 sin supersederlos. |
| 2026-11-24 | Se añade el ADR 0028 (papelera, versiones de contenido y copia previa a la purga, #77), con la decisión D-051, y se anota la convivencia de `pre-purge` con el manifiesto v2 del ADR 0012. |
