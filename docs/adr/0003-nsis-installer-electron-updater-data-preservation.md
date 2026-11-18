# ADR 0003 — Instalador NSIS, electron-updater y preservación de datos

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-023, D-031
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0005 de la etapa web (Vercel)
- **Relacionados:** ADR 0012, ADR 0015

## Contexto

World Craft debe instalarse como una aplicación de Windows, actualizarse sin
perder datos y desinstalarse sin borrar la biblioteca del usuario. Tampoco hay
presupuesto para servicios de distribución ni para un certificado de firma en
el MVP.

## Decisión

1. **electron-builder** con target **NSIS** por usuario, instalación en
   `%LOCALAPPDATA%\Programs\World Craft`, sin privilegios de administrador y con
   opción de cambiar la carpeta.
2. **electron-updater** con **GitHub Releases** y `latest.yml`.
3. La actualización se descarga en segundo plano y se instala al reiniciar, con
   consentimiento del usuario; se puede desactivar.
4. Los datos viven en `app.getPath('userData')` y **nunca** se tocan desde el
   instalador o el desinstalador.
5. El desinstalador conserva `userData` y muestra su ruta al terminar.
6. Antes de aplicar migraciones tras una actualización se crea una copia
   verificable y se ejecuta en transacción.
7. El instalador se distribuye sin firmar; el aviso de SmartScreen se documenta
   (ADR 0015).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Squirrel.Windows | Menos control del instalador y del formato; electron-builder cubre mejor el flujo. |
| MSIX | Firma y sideloading más complejos; no aporta al MVP. |
| WiX | Más trabajo y menos integración con Electron. |
| Instalador portable (ZIP) | No cumple el requisito de aplicación instalable ni el flujo de actualización. |
| Descarga manual de un EXE | Peor experiencia y más soporte; GitHub Releases ya es gratuito. |

## Consecuencias

### Positivas

- Instalación y actualización sin administrador.
- Datos separados de los binarios: actualizar o desinstalar no los borra.
- Distribución gratuita con GitHub Releases.
- Control del canal estable y beta con pre-releases.

### Negativas y riesgos

- Sin firma, SmartScreen puede mostrar un aviso.
- electron-updater depende de GitHub Releases; si el repo cambia, hay que
  actualizar la configuración.
- El instalador ocupa ~100 MB.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Acceso directo en el menú Inicio; una sola ventana. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | El instalador de NSIS es estándar; se documenta el aviso. |
| Seguridad y privacidad | HTTPS, checksums y verificación de actualización. |
| Datos y preservación | `userData` intacto; copia antes de migrar; modo seguro. |
| Coste | 0 €/mes con GitHub Free. |
| Portabilidad de datos | Exportación/importación y copia del archivo SQLite. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Aviso de SmartScreen | Sin firma | Documentar el aviso y publicar checksums | ADR 0015 |
| Límite de GitHub Releases | Suficiente para uso personal | Releases pequeñas, sin binarios duplicados | M5 |
| Actualización corrupta | Fallo de red o disco | Descarga verificada y copia previa | M5 |

## Plan de revisión

Se revisa si se adopta firma de código, si GitHub cambia las condiciones de
Releases o si aparece otro canal de distribución gratuito. La prueba de
instalación/actualización/desinstalación se ejecuta en cada release.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D5 y §3.8
- [`docs/continuidad.md`](../continuidad.md)
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-023 y D-031
- Documentación de electron-builder y electron-updater consultada el 18/11/2026.
