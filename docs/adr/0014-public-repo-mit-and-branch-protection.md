# ADR 0014 — Repositorio público, licencia MIT y protección de ramas

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-14
- **Fecha del documento:** 2026-11-14
- **Issue:** #5
- **Decisiones del registro:** D-009, D-010
- **Decisores:** usuario (decisión y aprobación); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0005, ADR 0013

## Contexto

El repositorio se creó privado en GitHub Free. En ese plan, las reglas de
protección de ramas y los rulesets solo están disponibles para repositorios
públicos, así que `main` y `dev` no podían protegerse sin pagar GitHub Pro. El
plan de desarrollo asume un repositorio público sin secretos para aprovechar
GitHub Actions sin límite de minutos (§3.7) y mantener el coste en 0 €/mes. La
licencia seguía sin decidir y el historial ya contiene el correo personal de los
commits.

Hay que decidir ahora porque la protección de ramas es un guardrail del flujo
SDD: sin ella, el publisher podría hacer push directo a `main` o reescribir el
historial por error. El repositorio todavía no contiene código de aplicación ni
secretos, por lo que el momento de abrirlo es el más seguro.

## Decisión

1. **Repositorio público.** El repositorio `gonzalitojh/world-craft` pasa a
   público. No contiene secretos, credenciales ni datos personales más allá del
   correo del historial de commits.
2. **Licencia MIT.** Se usa MIT con titular `gonzalitojh` y año 2026, mediante el
   archivo `LICENSE`. Es permisiva, compatible con el stack y no añade
   obligaciones operativas.
3. **Protección con rulesets.** Se crean los rulesets `protect-dev` y
   `protect-main`, activos y limitados a `refs/heads/dev` y `refs/heads/main`.
4. **Reglas comunes.** Prohibir el borrado de la rama, prohibir el force push y
   exigir Pull Request. La PR requiere 0 aprobaciones, no descarta revisiones
   obsoletas al hacer push, no exige revisión de code owners ni la aprobación del
   último push, y exige resolver los hilos de revisión.
5. **Bypass del propietario solo en `main`.** `protect-dev` no tiene bypass. En
   `protect-main`, el usuario propietario puede saltarse las reglas para promover
   `dev` a `main` cuando la versión sea estable.
6. **Sin required status checks.** No se exigen checks todavía; llegan con la
   issue #6 (M0-05, CI). Añadirlos antes bloquearía todas las PRs.
7. **Seguridad del repositorio.** Se activan el escaneo de secretos, la push
   protection y el reporte privado de vulnerabilidades. Las vulnerabilidades se
   reportan según `SECURITY.md`.
8. **Operación de PRs.** Se activa el borrado de la rama al fusionar y se dejan
   los permisos de GitHub Actions en solo lectura por defecto.
9. **Correo de commits.** Los commits futuros usan el correo `noreply` de GitHub.
   El historial anterior no se reescribe.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Seguir privado sin protección | GitHub Free no permite rulesets ni protección de ramas en repositorios privados; se pierde el guardrail del flujo SDD. |
| GitHub Pro de pago | Permite proteger ramas privadas, pero rompe el objetivo de 0 €/mes y no aporta nada más necesario para el MVP. |
| Licencia AGPL | Añade obligaciones de copyleft y de distribución de código que no encajan con una herramienta personal. |
| Licencia propietaria o sin licencia | Dificulta la portabilidad, la reutilización y la claridad legal del proyecto. |
| Protección de ramas clásica | Es menos flexible que los rulesets y no permite expresar el bypass del propietario con la misma precisión. |
| Required status checks desde el inicio | Bloquearía las PRs hasta que exista CI (issue #6). Se pospone. |

## Consecuencias

### Positivas

- `main` y `dev` quedan protegidas sin coste y sin depender del plan de pago.
- El flujo de PR contra `dev` se refuerza a nivel de GitHub, no solo por
  convención.
- El propietario conserva la capacidad de promover `dev` a `main`.
- Actions sin límite de minutos y escaneo de secretos en repositorios públicos.
- La licencia MIT deja claro qué se puede hacer con el código.

### Negativas y riesgos

- El código y el historial quedan visibles públicamente, incluido el correo de
  los commits antiguos.
- GitHub puede cambiar las condiciones de los planes gratuitos.
- Los rulesets no exigen checks hasta que llegue la issue #6.
- Un repositorio público atrae forks y clones fuera del control del propietario.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Sin impacto directo. |
| Temas (Claro/Oscuro) | Sin impacto directo. |
| Accesibilidad | Sin impacto directo. |
| Seguridad y privacidad | Repositorio público sin secretos; escaneo y push protection; reporte privado; correo `noreply` en commits futuros. |
| Coste | Se mantiene en 0 €/mes y se evita GitHub Pro. |
| Portabilidad de datos | La licencia MIT y el repositorio público facilitan clonar, migrar y reutilizar. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Protección solo en repos públicos | GitHub Free no protege ramas en repos privados | Repositorio público sin secretos y rulesets activos | Issue #5 |
| Límite de GitHub Actions | 2.000 min/mes en privado; ilimitado en público | Mantener el repositorio público sin secretos | ADR 0013 |
| Cambio de condiciones de GitHub | Sin coste inmediato, pero puede variar | Revisión periódica y ruta a otro proveedor si cambia | ADR 0013 |
| Exposición de historial | Correo personal en commits antiguos | Commits futuros con correo `noreply`; no se reescribe el historial | Issue #5 |
| Bypass del propietario en `main` | Riesgo de saltarse la PR por error | Uso limitado a la promoción `dev` → `main` | D-010 |

## Plan de revisión

Se revisa al activar CI en la issue #6 (para añadir required status checks), en
cada lanzamiento de fase y si GitHub modifica las condiciones de los planes
gratuitos o de los rulesets. Un cambio de licencia o de visibilidad exige un ADR
nuevo y aprobación explícita del usuario.

## Referencias

- Issue: [#5](https://github.com/gonzalitojh/world-craft/issues/5)
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.7 y §4.4
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-009 y D-010
- [`docs/proceso-sdd.md`](../proceso-sdd.md), §7
- Documentación oficial de GitHub sobre rulesets, protección de ramas en planes
  gratuitos, escaneo de secretos y reporte privado de vulnerabilidades,
  consultada el 14/11/2026.
