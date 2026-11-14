# Línea base de Lighthouse (M0-06, issue #7)

Primera medición de Lighthouse del scaffold de Next.js, registrada como
**línea base**: no fija umbrales ni criterios de aceptación, solo deja
constancia del punto de partida antes de que exista producto.

## Datos de la medición

| Dato | Valor |
|---|---|
| Fecha | 2026-11-14, 16:51–16:53 UTC |
| Rama | `chore/issue-7-nextjs-scaffold` |
| Commit base | `4c8ecd3` |
| Estado del árbol | **Sin commitear**: se midió el árbol de trabajo con los cambios de la issue #7 |
| Sistema | Windows 11, PowerShell |
| Node / pnpm | Node 22.23.5 / pnpm 12.18.0 (vía Corepack) |
| Aplicación | Next.js 16.4.6, `pnpm build` + `pnpm start` |
| Build | `BUILD_ID=iNXCkxsyb4l_HTPg7rUqJ` |
| URL medida | `http://localhost:3100/` |
| Lighthouse | 13.6.0 |
| Navegador principal | Chromium 159.0.8154.6 (Playwright 1.65.0, revisión 1255) |
| Navegador de control | Chrome estable 157.0.8103.51 del sistema |
| Categorías | performance, accessibility, best-practices, seo |

Se midieron dos navegadores porque el Chromium que distribuye Playwright rinde
mucho peor que un Chrome estable en esta máquina (ver
[Entorno y benchmark](#entorno-y-benchmark)). La tabla principal usa el
Chromium de Playwright, tal como pedía la tarea; la de control permite
distinguir el coste de la aplicación del coste del navegador.

## Resultado principal · Chromium de Playwright

### Puntuaciones (0–100)

| Categoría | Móvil | Escritorio |
|---|---:|---:|
| Rendimiento (performance) | 69 | 75 |
| Accesibilidad (accessibility) | 100 | 100 |
| Buenas prácticas (best-practices) | 100 | 100 |
| SEO | 60 | 60 |

### Métricas

| Métrica | Móvil | Escritorio |
|---|---|---|
| FCP (First Contentful Paint) | 1,3 s | 0,5 s |
| LCP (Largest Contentful Paint) | 1,3 s | 0,5 s |
| TBT (Total Blocking Time) | 3.950 ms | 620 ms |
| CLS (Cumulative Layout Shift) | 0 | 0 |
| Speed Index | 3,4 s | 1,2 s |
| Time to Interactive | 6,5 s | 1,3 s |
| Respuesta del servidor | 90 ms | 10 ms |
| `benchmarkIndex` del host | 171 | 198,5 |

Los dos pases registraron el aviso de Lighthouse «The tested device appears to
have a slower CPU than Lighthouse expects», que penaliza el rendimiento. Los
valores son los que muestra Lighthouse (redondeados por la herramienta); los
JSON completos no se versionan.

## Medición de control · Chrome estable del sistema

### Puntuaciones (0–100)

| Categoría | Móvil | Escritorio |
|---|---:|---:|
| Rendimiento (performance) | 97 | 100 |
| Accesibilidad (accessibility) | 100 | 100 |
| Buenas prácticas (best-practices) | 100 | 100 |
| SEO | 60 | 60 |

### Métricas

| Métrica | Móvil | Escritorio |
|---|---|---|
| FCP (First Contentful Paint) | 0,8 s | 0,2 s |
| LCP (Largest Contentful Paint) | 0,8 s | 0,2 s |
| TBT (Total Blocking Time) | 210 ms | 10 ms |
| CLS (Cumulative Layout Shift) | 0 | 0 |
| Speed Index | 0,8 s | 0,2 s |
| Time to Interactive | 3,2 s | 0,6 s |
| `benchmarkIndex` del host | 652,5 | 577,5 |

Con el Chrome estable solo el pase móvil conserva el aviso de CPU; el de
escritorio no lo muestra.

## Accesibilidad

- **0 violaciones** en las cuatro ejecuciones: la categoría de accesibilidad
  puntúa 100 y ninguna auditoría de axe queda por debajo de 1.
- Coincide con los tests E2E de `tests/e2e/a11y.spec.ts`, que pasan axe sobre
  `/`, `/login`, `/health` y la 404 en tema claro y oscuro sin hallazgos
  críticos ni graves.

## Entorno y benchmark

`benchmarkIndex` mide la velocidad del procesador del host: cuanto más bajo,
más penaliza Lighthouse las métricas de rendimiento. En esta máquina el
Chromium de Playwright obtiene 171–198,5 y el Chrome estable 577,5–652,5, una
diferencia de 3–4 veces que explica la brecha de TBT y de puntuación.

Por eso la tabla principal no debe leerse como «rendimiento real de la
aplicación»: mide la aplicación sobre un navegador lento. La tabla de control,
con el mismo build y el mismo servidor, es la referencia más representativa.

Contexto de red y peso (idéntico en ambos navegadores): 23 peticiones, unos
300 KiB de peso total, ninguna petición a terceros y un ahorro estimado de
30 KiB de JavaScript sin usar. El mayor recurso es el chunk principal de
Next.js (unos 72 KiB) seguido de tres fuentes WOFF2 autoalojadas por
`next/font`.

## Comandos reproducibles

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$env:NEXT_TELEMETRY_DISABLED = "1"

# 1. Build y servidor de producción en el puerto 3100
corepack pnpm build
corepack pnpm exec next start -p 3100

# 2. Navegador (en otra consola)
$env:CHROME_PATH = "$env:LOCALAPPDATA\ms-playwright\chromium-1255\chrome-win64\chrome.exe"
# Alternativa de control:
# $env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# 3. Móvil (por defecto)
corepack pnpm dlx lighthouse@13.6.0 http://localhost:3100 `
  --output=json --output-path=.\lh-mobile.json `
  --only-categories=performance,accessibility,best-practices,seo `
  --chrome-flags="--headless=new" --quiet

# 4. Escritorio
corepack pnpm dlx lighthouse@13.6.0 http://localhost:3100 `
  --preset=desktop --output=json --output-path=.\lh-desktop.json `
  --only-categories=performance,accessibility,best-practices,seo `
  --chrome-flags="--headless=new" --quiet
```

Los JSON se generaron en una carpeta temporal fuera del repositorio y se
borraron al terminar: no se versionan.

## Notas

- **SEO 60 no es un defecto del scaffold.** `layout.tsx` declara
  `robots: { index: false, follow: false }` a propósito (aplicación privada), y
  la única auditoría de SEO que falla es `is-crawlable`. Cuando exista una
  página pública habrá que revisar esa decisión.
- **Línea base sin umbrales**: no hay objetivos de rendimiento acordados
  todavía; estas cifras se usan para comparar futuras mediciones, no para
  bloquear cambios.
- **El rendimiento varía entre ejecuciones** (carga de la máquina, caché del
  sistema de archivos, calibración del throttling). Las diferencias de pocos
  puntos no son significativas.
- El aviso de CPU del entorno de medición se documenta aquí y no se corrige:
  la línea base refleja esta máquina, no un runner de CI.
- Accesibilidad, buenas prácticas y SEO dan el mismo resultado en los dos
  navegadores, así que son las cifras más estables de esta línea base.
