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
`licenses/` junto al ejecutable estos **7 textos completos**:

- `sharp-LICENSE.txt` — Apache-2.0 de sharp.
- `img-sharp-win32-LICENSE.txt` — Apache-2.0 del paquete de plataforma de sharp;
  el binario libvips que incluye se cubre con el texto siguiente.
- `libvips-LICENSE.txt` — LGPL-3.0-or-later del binario libvips.
- `gpl-3.0.txt` — texto de GPL-3.0 que acompaña a la LGPL.
- `electron-updater-LICENSE.txt` — MIT de electron-updater.
- `tiptap-LICENSE.txt` — MIT de Tiptap y ProseMirror.
- `source-serif-4-OFL.txt` — SIL Open Font License 1.1 de Source Serif 4.

`pnpm verify:package` comprueba que los textos existen en el paquete.

## Fuente: Source Serif 4

| Componente | Versión | Licencia | Origen |
|---|---|---|---|
| Source Serif 4 (woff2, subset latin, pesos 400 y 600) | Google Fonts v15 (`@fontsource/source-serif-4` 5.3.1); upstream 4.005R | SIL Open Font License 1.1 | https://github.com/adobe-fonts/source-serif |

Copyright 2014 The Source Serif 4 Project Authors, con el nombre reservado
«Source». La familia procede del proyecto upstream de Adobe (release 4.005R); los
dos archivos woff2 con subset latin se obtuvieron del paquete OFL de Google
Fonts distribuido por Fontsource 5.3.1:

- `source-serif-4-regular-latin.woff2` (peso 400, 20.088 bytes), descargado de
  `https://cdn.jsdelivr.net/npm/@fontsource/source-serif-4@5.3.1/files/source-serif-4-latin-400-normal.woff2`.
  SHA-256: `02194DEB92D3975DD30E11A3824A1F1DB32B48C93654E60560CB81CE8E7B5F95`.
- `source-serif-4-semibold-latin.woff2` (peso 600, 21.532 bytes), descargado de
  `https://cdn.jsdelivr.net/npm/@fontsource/source-serif-4@5.3.1/files/source-serif-4-latin-600-normal.woff2`.
  SHA-256: `F2B7E1CF1D277B7608231868135648F8AD8E2B58D8E97CA088BEE15DC357BEE7`.
- `OFL.txt`, copia del texto publicado en
  `https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/OFL.txt`
  con la línea de copyright del proyecto.

Se empaquetan sin modificar, como activos versionados en
`src/renderer/assets/fonts/source-serif-4/`, y se sirven con `@font-face` local
desde `styles/fonts.css`. No son una dependencia npm, no se descargan en tiempo
de ejecución y la aplicación no solicita fuentes por red. `licenses.test.ts`
fija estos SHA-256 junto con el texto completo de la OFL (`OFL.txt` y
`licenses/source-serif-4-OFL.txt`, idénticos byte a byte).

## Editor: Tiptap y ProseMirror

| Componente | Versión | Licencia | Origen |
|---|---|---|---|
| `@tiptap/react` | 3.34.0 | MIT | https://github.com/ueberdosis/tiptap |
| `@tiptap/starter-kit` | 3.34.0 | MIT | https://github.com/ueberdosis/tiptap |
| `@tiptap/extension-link` | 3.34.0 | MIT | https://github.com/ueberdosis/tiptap |
| `@tiptap/pm` (ProseMirror) | 3.34.0 | MIT | https://github.com/ueberdosis/tiptap |

Tiptap GmbH y los colaboradores de ProseMirror distribuyen estos paquetes bajo
la licencia MIT. El texto completo se copia con `pnpm licenses:sync` en
`resources/licenses/tiptap-LICENSE.txt` y se publica en `licenses/` junto al
ejecutable. No se usan extensiones Pro ni servicios de colaboración.

## Resto de dependencias

El resto de dependencias de ejecución (`better-sqlite3`, `drizzle-orm`, `zod`,
`electron-updater` y `builder-util-runtime`) se distribuyen bajo licencias
permisivas compatibles (MIT y Apache-2.0) y sus avisos acompañan al paquete
correspondiente. `electron-updater` y `builder-util-runtime` son MIT y su aviso
completo viaja en `licenses/electron-updater-LICENSE.txt`. Las herramientas de
desarrollo no se distribuyen con la aplicación.

## Mantenimiento

Este archivo se actualiza cuando cambia una dependencia de ejecución, cuando se
actualiza sharp o libvips, cuando cambia la fuente empaquetada o cuando se
incorpora un binario nuevo al instalador. El empaquetado incluye este archivo y
los 7 textos de `resources/licenses/` junto a la aplicación; los cambios de
versión deben reflejarse en ambos sitios en la misma tarea.
