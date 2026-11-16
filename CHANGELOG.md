# Changelog

Todos los cambios relevantes de World Craft se documentan en este archivo. El
formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado [Semantic Versioning](https://semver.org/lang/es/). La interfaz está
en español; los identificadores y las ramas, en inglés.

Todavía **no hay ninguna versión publicada**: la aplicación está en fase M0. Los
cambios se acumulan en «Sin publicar» hasta la primera versión estable.

## [Sin publicar]

### Añadido

- Documentación base del proyecto (issue
  [#10](https://github.com/gonzalitojh/world-craft/issues/10)): mapa de
  arquitectura, esqueleto del manual de usuario, este changelog y enlaces cruzados
  desde el README y CONTRIBUTING.
- Modelo de datos en PostgreSQL con Drizzle, 24 tablas, siete migraciones con
  rollback, RLS por mundo y seed idempotente del catálogo del sistema (issue
  [#9](https://github.com/gonzalitojh/world-craft/issues/9)).
- Sistema de diseño con tokens, dos temas, shell responsive, componentes base y
  página viva `/design-system` (issue
  [#8](https://github.com/gonzalitojh/world-craft/issues/8)).
- Scaffold de Next.js 16 con App Router, React 19, TypeScript estricto, Tailwind
  CSS 4 y contrato de entorno validado con Zod (issue
  [#7](https://github.com/gonzalitojh/world-craft/issues/7)).
- Entorno reproducible con Node 22, pnpm, ESLint, Prettier, Vitest, Playwright y
  CI en GitHub Actions (issue
  [#6](https://github.com/gonzalitojh/world-craft/issues/6)).
- Repositorio con licencia MIT, protección de ramas, plantillas de issue y PR,
  etiquetas, hitos y Dependabot (issue
  [#5](https://github.com/gonzalitojh/world-craft/issues/5)).
- ADRs fundacionales 0001–0013 y su índice (issue
  [#4](https://github.com/gonzalitojh/world-craft/issues/4)).
- Proceso SDD con puertas, estados, task files y publicación local-first (issue
  [#3](https://github.com/gonzalitojh/world-craft/issues/3)).
- Agentes de IA adaptados al proyecto y política de variantes de modelo (issues
  [#2](https://github.com/gonzalitojh/world-craft/issues/2) y
  [#48](https://github.com/gonzalitojh/world-craft/issues/48)).

### Cambiado

- El repositorio deja de ser un esqueleto heredado y pasa a tener reglas,
  proceso, entorno, diseño y modelo de datos propios (fase M0).

### Seguridad

- RLS activa en todas las tablas de contenido, `anon` sin privilegios y
  privilegios por tabla y columna.
- Escaneo de secretos con `gitleaks` y auditoría de dependencias en la CI.

## Cómo se escribe una entrada

- **Sección «Sin publicar».** Cada PR añade su entrada aquí; al publicar una
  versión, esa sección pasa a `## [X.Y.Z] - AAAA-MM-DD` y se abre una nueva.
- **Categorías de Keep a Changelog:** `Añadido`, `Cambiado`, `Obsoleto`,
  `Eliminado`, `Corregido` y `Seguridad`. Usa solo las que tengan contenido.
- **Una línea por cambio**, en pasado, pensada para una persona usuaria, con el
  enlace a la issue cuando aporte contexto.
- **Solo cambios relevantes.** Los refactors internos sin efecto visible no
  necesitan entrada.
- **Misma tarea.** La entrada se escribe en la PR que introduce el cambio; el
  publisher comprueba que existe antes de publicar. La casilla correspondiente
  está en `.github/pull_request_template.md`.
- **Versiones.** Mientras no exista una versión publicada, el proyecto no fija
  número: se usará `0.y.z` durante el desarrollo y `1.0.0` con el primer uso real.
