## Resumen

<!-- Qué hace esta PR y por qué. -->

## Issue relacionada

<!-- Referencia la issue con el formato "Issue: #N".
     No añadas keywords de cierre: la issue se cierra al fusionar en dev. -->

Issue: #

## Cambios

- <!-- Cambio incluido. -->

## Pruebas ejecutadas

- [ ] Typecheck
- [ ] Lint
- [ ] Tests unitarios
- [ ] Build (cuando exista)
- [ ] E2E del flujo crítico (si aplica)

<!-- Detalla comandos y resultados. -->

## Documentación

- [ ] ADR actualizado o creado (si aplica)
- [ ] Manual de usuario actualizado (si el cambio es visible)
- [ ] Changelog actualizado en «Sin publicar» (si el cambio es relevante)
- [ ] Task file actualizado

## Checklist de UI (solo si aplica)

- [ ] Ventana comprobada a 1024, 1280 y 1600 px, sin scroll horizontal de página.
- [ ] Los dos temas (Claro y Oscuro) comprobados, con contraste AA.
- [ ] Accesibilidad revisada: teclado, foco visible, axe sin errores críticos y `prefers-reduced-motion`.

## Datos y seguridad Electron (solo si aplica)

- [ ] Migración probada con copia previa y datos existentes intactos.
- [ ] Operaciones destructivas con confirmación y copia recuperable.
- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` y `webSecurity: true`.
- [ ] Canales IPC en allowlist y validados con Zod.
- [ ] Sin secretos, credenciales ni datos personales.
- [ ] Dependencias justificadas y sin servicios de pago.

## Base

Esta PR va contra `dev`, nunca contra `main`. Sin keywords de cierre.
