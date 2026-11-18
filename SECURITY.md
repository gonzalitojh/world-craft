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
- El actualizador: origen de las releases y verificación de integridad.
- La sanitización de contenido rico y la validación de subidas.
- Las dependencias y su cadena de suministro.
- Los secretos usados en el desarrollo o en la firma opcional de código.

Quedan fuera de alcance los ataques de denegación de servicio, la ingeniería
social, el spam y los problemas que dependan de servicios de terceros y ya estén
gestionados por sus proveedores.

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
