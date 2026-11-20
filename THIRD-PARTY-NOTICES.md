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

El paquete que se distribuye se poda a Windows x64: incluye `sharp-win32-x64` y
`better-sqlite3` `win32-x64`, no los binarios de arm64 ni ia32.

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

El paquete de plataforma incluye el texto completo de Apache-2.0 en su archivo
`LICENSE`. El texto completo de LGPL-3.0 y de GPL-3.0 se distribuye con la
aplicación en `resources/licenses/libvips-LICENSE.txt` y
`resources/licenses/gpl-3.0.txt`, y se copia junto al ejecutable en `licenses/`.
Las fuentes de libvips y de sharp están disponibles en los repositorios
indicados arriba.

### Textos incluidos en el instalador

`pnpm licenses:sync` copia a `resources/licenses/` y el empaquetado publica en
`licenses/` junto al ejecutable estos **5 textos completos**:

- `sharp-LICENSE.txt` — Apache-2.0 de sharp.
- `img-sharp-win32-LICENSE.txt` — Apache-2.0 del paquete de plataforma de sharp;
  el binario libvips que incluye se cubre con el texto siguiente.
- `libvips-LICENSE.txt` — LGPL-3.0-or-later del binario libvips.
- `gpl-3.0.txt` — texto de GPL-3.0 que acompaña a la LGPL.
- `electron-updater-LICENSE.txt` — MIT de electron-updater.

`pnpm verify:package` comprueba que los textos existen en el paquete.

## Resto de dependencias

El resto de dependencias de ejecución (`better-sqlite3`, `drizzle-orm`, `zod`,
`electron-updater` y `builder-util-runtime`) se distribuyen bajo licencias
permisivas compatibles (MIT y Apache-2.0) y sus avisos acompañan al paquete
correspondiente. `electron-updater` y `builder-util-runtime` son MIT y su aviso
completo viaja en `licenses/electron-updater-LICENSE.txt`. Las herramientas de
desarrollo no se distribuyen con la aplicación.

## Mantenimiento

Este archivo se actualiza cuando cambia una dependencia de ejecución, cuando se
actualiza sharp o libvips o cuando se incorpora un binario nuevo al instalador.
El empaquetado incluye este archivo y los 5 textos de `resources/licenses/` junto
a la aplicación; los cambios de versión deben reflejarse en ambos sitios en la
misma tarea.
