# ADR 0015 — Firma de código opcional y SmartScreen

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-034
- **Decisores:** usuario / agentes
- **Supersede:** —
- **Relacionados:** ADR 0003, ADR 0013

## Contexto

Windows SmartScreen muestra un aviso al ejecutar instaladores sin firma. La
firma de código evita ese aviso, pero requiere un certificado de pago y un
proceso de verificación. El objetivo del proyecto es 0 €/mes y el MVP no debe
bloquearse por un coste recurrente.

## Decisión

1. El instalador del MVP se distribuye **sin firmar**.
2. El manual explica el aviso de SmartScreen y cómo continuar de forma segura.
3. Se publican **checksums** de los artefactos en la release.
4. La firma de código queda como **mejora opcional de pago**, fuera del MVP.
5. Adoptarla requiere:
   - aprobación explícita del usuario,
   - este ADR actualizado o uno nuevo con coste y ruta de salida,
   - integración en el pipeline de release,
   - prueba en una máquina limpia.
6. Mientras no se apruebe, no se usan certificados de prueba en producción ni
   se pide al usuario que instale autoridades.

> **Implementación (M0-08, #68, 20/11/2026).** El instalador 0.1.0 y `latest.yml`
> se generan sin firma; `win.signExecutable`, `verifyUpdateCodeSignature` y
> `forceCodeSigning` están en `false`, y el `app-update.yml` no declara
> `publisherName`. No se añade firma Ed25519 a los manifiestos porque
> electron-builder 26.18.0 no la soporta; la decisión se aplaza a M5. La
> integridad actual se apoya en HTTPS, el SHA-512 de `latest.yml` y
> `SHA256SUMS`. El manual explica SmartScreen y los checksums. El detalle está en
> el [ADR 0018](0018-nsis-packaging-and-update-service.md).

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Certificado EV de pago | Coste anual y trámites; no es imprescindible para el MVP. |
| Certificado de prueba | No elimina el aviso y confunde al usuario. |
| Publicar solo código fuente | No cumple el requisito de aplicación instalable. |
| Microsoft Store | Cuenta, revisión y firma; fuera del alcance. |

## Consecuencias

### Positivas

- El MVP se distribuye sin coste.
- El usuario puede verificar el checksum.
- La decisión queda abierta y documentada.

### Negativas y riesgos

- SmartScreen puede disuadir a algunos usuarios.
- Un instalador sin firma es más fácil de suplantar si se descarga de un sitio
  no oficial.
- La firma futura exige cambios en CI y en la documentación.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | Aviso en la instalación; no afecta al uso. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | El aviso se documenta con pasos claros. |
| Seguridad y privacidad | Checksums y descarga desde GitHub Releases. |
| Datos y preservación | No aplica. |
| Coste | 0 €/mes mientras no se firme. |
| Portabilidad de datos | No aplica. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Aviso de SmartScreen | Sin firma | Manual con pasos y checksums | Manual |
| Suplantación | Descarga externa | Enlace oficial y verificación de hash | M5 |
| Coste futuro | Certificado de pago | Aprobación explícita y ADR | Backlog |

## Plan de revisión

Se revisa si el número de usuarios afectados por SmartScreen justifica el
coste, si aparece un certificado gratuito viable o si Microsoft cambia el
programa de firma. Cualquier adopción exige un ADR nuevo con coste y ruta de
salida.

## Referencias

- [`docs/manual-de-usuario.md`](../manual-de-usuario.md), sección 13
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.8
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-034
- Documentación de SmartScreen consultada el 18/11/2026.
