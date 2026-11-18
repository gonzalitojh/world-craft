# Changelog

Todos los cambios relevantes de World Craft se documentan en este archivo. El
formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado [Semantic Versioning](https://semver.org/lang/es/). La interfaz está
en español; los identificadores y las ramas, en inglés.

Todavía **no hay ninguna versión publicada**: la aplicación está en la fase de
fundaciones de escritorio. Los cambios se acumulan en «Sin publicar» hasta la
primera versión estable.

## [Sin publicar]

### Añadido

- Documentación del pivote a escritorio: plan, arquitectura Electron, modelo
  SQLite, migraciones, copias y recuperación, continuidad, sistema de diseño,
  internacionalización, plan de pruebas y ADRs 0001–0015.
- Inventario del pivote en [`docs/cambio-a-escritorio.md`](docs/cambio-a-escritorio.md):
  archivos eliminados y cuentas externas que hay que cerrar.
- Tooling mínimo de calidad para el repositorio de escritorio: TypeScript
  estricto, ESLint, Prettier, Vitest, CI y Dependabot.
- Catálogo de GitHub de escritorio: 46 etiquetas, 7 hitos y 41 issues
  (#61–#101) con contexto, alcance, dependencias, criterios y variante.

### Cambiado

- World Craft pasa de aplicación web a **aplicación de escritorio Windows** con
  persistencia local. El renderer no accede a Node; la base de datos es SQLite y
  los assets viven en `app.getPath('userData')`.
- El proceso SDD, las etiquetas, los hitos y las variantes de modelo se adaptan
  al trabajo de escritorio; los subagentes heredan el modelo de la sesión.
- La Definition of Done sustituye el responsive web por la ventana de escritorio
  a 1024, 1280 y 1600 px, y añade preservación de datos y seguridad Electron.

### Eliminado

- La aplicación Next.js, Supabase, Vercel y Cloudflare R2, junto con su esquema
  PostgreSQL, migraciones, pruebas, scripts y configuración.
- Los ADRs de la etapa web, las capturas de referencia y los task files de las
  issues antiguas.

### Seguridad

- Escaneo de secretos con `gitleaks` y auditoría de dependencias en la CI.
- Reglas de aislamiento de Electron, allowlist IPC y validación con Zod en la
  documentación y en el proceso de revisión.

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
  publisher comprueba que existe antes de publicar.
- **Versiones.** Mientras no exista una versión publicada, el proyecto no fija
  número: se usará `0.y.z` durante el desarrollo y `1.0.0` con el primer uso real.
