# Política de seguridad

World Craft es una aplicación de escritorio Windows, monousuario y local, en
construcción. Esta política explica cómo reportar un problema de seguridad y qué
alcance tiene.

## Versiones soportadas

El proyecto no tiene todavía versiones estables ni publicadas. Solo se mantienen
las ramas permanentes `dev` (integración) y `main` (estable, promovida por el
propietario); las ramas de trabajo se eliminan al fusionar. No se da soporte a
versiones antiguas, forks ni ramas abandonadas.

## Cómo reportar una vulnerabilidad

- Usa el **reporte privado** de GitHub Security Advisories del repositorio:
  pestaña **Security** → **Advisories** → **Report a vulnerability**.
- Describe el problema, el impacto, los pasos para reproducirlo y, si es
  posible, una propuesta de corrección.
- Incluye la versión, rama o commit afectado.

**No abras una issue pública con detalles de la vulnerabilidad.** Tampoco
publiques pruebas de concepto, datos sensibles ni capturas con información real
antes de que el problema esté resuelto.

## Alcance

Se revisan, entre otros:

- El aislamiento de Electron: `contextIsolation`, `nodeIntegration`, `sandbox`
  y `webSecurity`.
- La allowlist de canales IPC y la validación de entrada con Zod.
- La CSP, la carga de contenido remoto y la apertura de enlaces externos.
- El protocolo de assets: validación de rutas y escape de `userData`.
- Las migraciones de SQLite, las copias de seguridad, la restauración y el modo
  seguro.
- La preservación de datos al actualizar, reinstalar o desinstalar.
- El actualizador: origen de las releases, verificación de integridad, aislamiento
  de red y ausencia de envío de contenido.
- La sanitización de contenido rico y la validación de subidas.
- Las dependencias y su cadena de suministro.
- Los secretos usados en el desarrollo o en la firma opcional de código.

Quedan fuera de alcance los ataques de denegación de servicio, la ingeniería
social, el spam y los problemas que dependan de servicios de terceros y ya estén
gestionados por sus proveedores.

## Actualizador y distribución

- La comprobación de actualizaciones es **manual** y opcional. No hay
  auto-check; el interruptor y la frecuencia llegarán con Ajustes en M1.
- El actualizador usa una partición propia (`electron-updater`) con caché
  desactivada y solo permite HTTPS a `github.com`, `api.github.com` y subdominios
  de `githubusercontent.com`. Rechaza credenciales embebidas y puertos no
  estándar, elimina las cabeceras `x-user-staging-id`, `authorization`,
  `private-token` y `cookie`, y deniega todos los permisos.
- La descarga exige consentimiento, se cancela con `CancellationToken` y la
  instalación solo se acepta desde el estado `downloaded`; la aplicación no se
  actualiza ni se reinicia sola.
- El actualizador no envía el contenido de los mundos ni datos personales. El
  log `logs/updates.log` no incluye URLs, rutas, versiones ni contenido.
- **El instalador y `latest.yml` no están firmados** (ADR 0015). La integridad
  actual se apoya en HTTPS, el SHA-512 de `latest.yml` y `SHA256SUMS`; no hay
  firma Ed25519 de manifiestos porque electron-builder 26.18.0 no la soporta. La
  firma Authenticode es opcional y de pago, y requiere aprobación explícita.
- La instalación es por usuario, no usa UAC y no escribe en HKLM; el
  desinstalador conserva `userData`.
- Residuales aceptados: sin firma Authenticode, SmartScreen puede avisar; la
  cancelación de la comprobación no aborta el socket HTTP; `shell.openExternal`
  mantiene la política de cualquier `https:` válido sin allowlist de dominios
  (preexistente de #63, endurecimiento futuro); y las dos vulnerabilidades
  moderadas detectadas en dependencias son de desarrollo y no llegan al
  instalador. La actualización real contra una release pública se prueba en M5.

## Respuesta

La respuesta es en **mejor esfuerzo**, sin SLA garantizado y sin programa de
bug bounty ni recompensas económicas. Se acusará recibo cuando sea posible, se
investigará el reporte y se avisará al reportero cuando exista una corrección o
una decisión sobre el caso.

## Secretos

La regla 13 de [`AGENTS.md`](AGENTS.md) prohíbe incluir claves, tokens,
contraseñas, correos reales, URLs privadas o credenciales en el repositorio. Si
detectas una fuga, no la publiques: repórtala de forma privada y espera
instrucciones.
