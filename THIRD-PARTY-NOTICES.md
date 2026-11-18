# Avisos de software de terceros

World Craft es una aplicación de escritorio local-first. Este archivo recoge las
licencias del software de terceros que viaja con el producto y que no está
cubierto por la licencia del propio repositorio.

## Imágenes: sharp y libvips

| Componente | Versión | Licencia | Origen |
|---|---|---|---|
| `sharp` | 0.35.5 | Apache-2.0 | https://github.com/lovell/sharp |
| `@img/sharp-win32-arm64` (y el paquete equivalente `@img/sharp-win32-x64`) | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | https://github.com/lovell/sharp |
| `@img/colour` | 1.1.0 | MIT | https://github.com/lovell/colour |
| libvips | 8.18.7 (incluido en el paquete de plataforma) | LGPL-3.0-or-later | https://github.com/libvips/libvips |

### sharp

Copyright Lovell Fuller y colaboradores. Se distribuye bajo la licencia
Apache, versión 2.0. El texto completo acompaña al paquete en
`node_modules/sharp/LICENSE`.

### libvips y los binarios de plataforma

libvips es Copyright John Cupitt y colaboradores y se distribuye bajo la
licencia GNU Lesser General Public License, versión 3 o posterior
(LGPL-3.0-or-later). El binario incluido en `@img/sharp-win32-…` se distribuye
**sin modificar**, tal como lo publica el proyecto sharp. World Craft enlaza con
él como biblioteca compartida y no deriva ni relicencia su código.

El texto completo de ambas licencias acompaña a cada paquete de plataforma en su
archivo `LICENSE`. Las fuentes de libvips y de sharp están disponibles en los
repositorios indicados arriba.

## Resto de dependencias

El resto de dependencias de ejecución (`better-sqlite3`, `drizzle-orm` y `zod`)
se distribuyen bajo licencias permisivas compatibles (MIT y Apache-2.0) y sus
avisos acompañan al paquete correspondiente. Las herramientas de desarrollo no
se distribuyen con la aplicación.

## Mantenimiento

Este archivo se actualiza cuando cambia una dependencia de ejecución, cuando se
actualiza sharp o libvips o cuando se incorpora un binario nuevo al instalador.
El empaquetado de #68 debe incluir este archivo junto a la aplicación.
