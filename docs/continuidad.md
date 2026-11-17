# Continuidad y disponibilidad

> **Estado:** vigente desde el 17/11/2026 (issue
> [#41](https://github.com/gonzalitojh/world-craft/issues/41), M0-11).
> **Ámbito:** healthcheck real, monitorización, keep-alive, pausa y reactivación
> de Supabase, y copia semanal de infraestructura.
> **Decisiones:** [ADR 0013](adr/0013-free-tier-continuity.md) (continuidad de
> free tiers) y [ADR 0009](adr/0009-testing-pwa-backups.md) §9.3 (backups).
> **Runbook de base de datos:** [`base-de-datos/operacion.md`](base-de-datos/operacion.md).

Este documento explica cómo se mantiene vivo un proyecto de Supabase Free sin
pagar y qué se hace cuando se pausa. No contiene credenciales, correos reales ni
URLs privadas: los valores concretos viven en el panel de Supabase, en Vercel y
en la configuración de GitHub.

## 1. Qué protege la continuidad

Supabase Free **pausa** un proyecto tras una semana sin actividad. La pausa no
borra los datos: el proyecto conserva su contenido y Supabase mantiene una
ventana de restauración de **un año**. Lo que se rompe es la aplicación: la base
deja de aceptar conexiones hasta que alguien la reactiva a mano.

La estrategia tiene tres capas:

| Capa | Qué hace | Dónde vive |
|---|---|---|
| Healthcheck real | Consulta Supabase de verdad y devuelve 200 o 503 | `src/lib/health.ts` y `/api/health` |
| Monitor externo | Avisa por correo si el healthcheck deja de responder | UptimeRobot Free (monitor principal) |
| Keep-alive de respaldo | Llama al healthcheck cada seis horas desde GitHub Actions | `.github/workflows/keepalive.yml` |

La copia semanal de infraestructura es independiente y se explica en §6.

## 2. Contrato de `/api/health`

El endpoint no se limita a comprobar que Next.js responde: ejecuta `select 1`
contra la base con `DATABASE_URL`, la misma cadena del runtime. **No usa**
`SUPABASE_SERVICE_ROLE_KEY` ni ninguna clave de servicio.

| HTTP | Cuerpo | Significado |
|---|---|---|
| `200` | `{"status":"ok","database":"available","timestamp":"…"}` | Supabase aceptó la consulta en menos de cinco segundos. |
| `503` | `{"status":"degraded","database":"paused","timestamp":"…"}` | No se pudo abrir la conexión: DNS, timeout, rechazo o *tenant* ausente. Es el síntoma habitual de un proyecto pausado, aunque una caída de red produce lo mismo. |
| `503` | `{"status":"degraded","database":"error","timestamp":"…"}` | No se pudo completar la comprobación: configuración ausente o inválida, credenciales o permisos, base inexistente u otro fallo. |

Propiedades del endpoint:

- **Sin caché:** `Cache-Control: no-store` y renderizado dinámico.
- **Con límite:** cinco segundos; una comprobación colgada no bloquea al monitor.
- **Sin detalles:** el cuerpo nunca incluye el error original, el host, el rol,
  el SQL ni la cadena de conexión. Los detalles se consultan en los logs del
  servidor, donde tampoco deben aparecer credenciales.
- **Barato:** `select 1` no toca tablas ni depende de RLS.
- **Sin límite propio:** el endpoint es anónimo y cada petición consulta la base.
  El timeout acota el coste y los monitores consultan cada 30–60 minutos, pero si
  aparece abuso se limita en el borde (Vercel o Cloudflare). Queda como deuda
  aceptada hasta que exista esa configuración.
- **Público:** solo revela disponibilidad y hora; la página `/health` añade el
  commit y el detalle de la comprobación. No hay datos de usuarios ni contenido.

La página `/health` usa la misma comprobación y muestra el estado con icono y
texto (no solo color): operativo/degradado y disponible/sin respuesta/error.

## 3. Monitor principal: UptimeRobot Free

El monitor se crea en la cuenta del propietario; el repositorio no puede
configurarlo. Pasos reproducibles:

1. Crear una cuenta gratuita en UptimeRobot y entrar en **Add New Monitor**.
2. Tipo **HTTP(s)**, nombre `World Craft producción`, URL
   `https://<dominio-de-producción>/api/health` (por ejemplo, el subdominio
   `*.vercel.app` del ADR 0006).
3. Intervalo **30–60 minutos**. El plan Free permite cinco minutos; no hace falta
   bajar de 30 para evitar ruido y correos innecesarios.
4. Confirmar que el monitor considera sano un **HTTP 200**. UptimeRobot ya marca
   como caída cualquier `4xx`/`5xx`, y el endpoint devuelve `503` cuando Supabase
   no responde.
5. En **Alert Contacts**, añadir el correo que recibirá los avisos y activar las
   notificaciones de caída y recuperación. Enviar un **Test Notification** y
   comprobar que llega (incluida la carpeta de spam).
6. Opcional: crear una **Maintenance Window** para las ventanas de despliegue o
   de restauración y evitar falsos positivos.
7. Anotar en el task file de la issue la fecha de alta, el intervalo, el correo
   configurado (sin escribirlo en el repositorio) y el resultado del aviso de
   prueba.

Comprobación manual del endpoint:

```bash
curl -i https://<dominio-de-producción>/api/health
```

Debe devolver `200` con `"database":"available"`. Con Supabase pausado devuelve
`503` y `"database":"paused"`.

### 3.1 Prueba de siete días

La pausa solo se demuestra con tiempo: no se puede simular en una sesión.

1. Con el monitor activo y el healthcheck en verde, dejar pasar **siete días
   completos** sin abrir la aplicación.
2. Revisar en UptimeRobot que no hay caídas y que las comprobaciones siguen
   llegando.
3. Abrir `/api/health` y comprobar que sigue devolviendo `200` y
   `"database":"available"`.
4. En el panel de Supabase, confirmar que el proyecto sigue activo (no aparece
   como pausado).
5. Anotar fecha de inicio, fecha de fin y resultado en el task file.

Si el proyecto se pausa durante la prueba, el monitor avisará: sigue el runbook
de §5 y revisa si el intervalo o la actividad del healthcheck son suficientes.

## 4. Keep-alive de respaldo: GitHub Actions

`.github/workflows/keepalive.yml` llama al healthcheck cada seis horas y también
puede lanzarse a mano desde **Actions → Keep-alive → Run workflow**.

Configuración única en GitHub (Settings → Secrets and variables → Actions →
Variables):

| Nombre | Tipo | Valor |
|---|---|---|
| `HEALTHCHECK_URL` | Variable de repositorio | URL completa del healthcheck de producción, con `https://`. |

- Si la variable falta, el workflow **no falla**: emite un aviso y termina. El
  monitor principal sigue siendo UptimeRobot.
- Si la URL no empieza por `https://`, el workflow falla a propósito para no
  enviar la comprobación en claro.
- Si el endpoint no devuelve `200`, el workflow falla y deja un resumen con el
  código recibido.
- **Límite de GitHub:** los workflows programados se desactivan tras 60 días sin
  actividad en un repositorio público. Cualquier push los reactiva. Por eso este
  cron es un respaldo y no el monitor principal.
- Los workflows programados se ejecutan desde la rama por defecto (`main`). Hasta
  que el propietario promueva `dev` a `main`, el cron usa la versión de `main`;
  para probar la versión nueva antes, se lanza a mano desde la rama. La misma
  regla se aplica a la copia semanal de §6.

## 5. Runbook: pausa y reactivación de Supabase

### 5.1 Síntomas

- `/api/health` devuelve `503` con `"database":"paused"`.
- UptimeRobot envía un correo de caída.
- El keep-alive de GitHub falla con un código distinto de `200`.
- La aplicación muestra errores de conexión al cargar datos.

Antes de restaurar, confirma en el panel de Supabase que el proyecto aparece
como **Paused**. Un `paused` del healthcheck también puede ser una caída de red,
un DNS o una credencial caducada; restaurar no arregla esos casos.

### 5.2 Reactivación

1. Entrar en el panel de Supabase con la cuenta del propietario y abrir el
   proyecto.
2. Pulsar **Restore project** (o **Resume**) y esperar a que termine. Suele tardar
   unos minutos.
3. **Revisar las claves tras restaurar.** La pausa conserva los datos, pero
   conviene comprobar en **Project Settings → API** y **Database** que
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, la contraseña de la base y
   las cadenas `DATABASE_URL`/`DIRECT_URL` siguen siendo las mismas. Si Supabase
   las ha rotado, o si hay cualquier duda de exposición, genera claves nuevas y
   actualízalas **solo** en Vercel y en `.env.local`. Nunca las pegues en issues,
   logs, capturas ni documentación.
4. Comprobar la conexión desde local:

   ```bash
   pnpm db:ping
   pnpm db:verify
   ```

   `db:ping` valida la conexión, el rol `authenticated` y `auth.uid()`;
   `db:verify` confirma migraciones, RLS y privilegios.
5. Comprobar el despliegue:

   ```bash
   curl -i https://<dominio-de-producción>/api/health
   ```

   Debe volver a `200` y `"database":"available"`.
6. En UptimeRobot, confirmar que el monitor vuelve a verde. Si se abrió una
   ventana de mantenimiento, cerrarla.
7. Repasar los correos de aviso: UptimeRobot manda caída y recuperación; GitHub
   deja el resumen del workflow. Comprobar que no hay avisos duplicados ni
   antiguos sin resolver.
8. Anotar en el task file o en el registro de incidencias: causa, hora de pausa,
   hora de restauración, claves revisadas (sin valores) y resultado de
   `db:ping`, `db:verify` y `/api/health`.

### 5.3 Datos y ventana de restauración

- La pausa **no borra** los datos del proyecto.
- Supabase mantiene una **ventana de restauración de un año**. Pasada esa
  ventana, el proyecto y sus datos pueden perderse de forma definitiva.
- La copia semanal (§6) y la exportación de mundo (M5) son la red de seguridad
  independiente del proveedor.
- Si el proyecto se recrea en lugar de restaurarse, hay que aplicar migraciones
  (`pnpm db:migrate`), seed (`pnpm db:seed`) y verificar (`pnpm db:verify`); los
  datos solo vuelven desde una copia.

## 6. Copia semanal de infraestructura

`.github/workflows/backup.yml` se ejecuta los domingos a las 03:00 UTC y también
a mano. El detalle completo —restauración probada, copia en R2 y política de
claves— se cierra en M5-06 (issue [#33](https://github.com/gonzalitojh/world-craft/issues/33)).

Qué hace:

1. Comprueba que existen los secretos. Si falta alguno, avisa en el resumen y
   **no genera ninguna copia** (no simula un éxito).
2. Ejecuta `pg_dump` con el mismo criterio que el runbook:
   `--schema=public --no-owner --no-privileges --format=custom`.
3. Verifica la copia con `pg_restore --list`.
4. La cifra con GPG simétrico AES-256 y borra el volcado en claro.
5. Guarda el archivo `.gpg` y su `sha256` como artefacto durante **90 días**.
6. Los workflows programados se ejecutan desde la rama por defecto (`main`); hasta
   que se promueva `dev`, la copia semanal usa la versión de `main`. Para probar
   cambios de la rama, lanza el workflow a mano.

**El artefacto es descargable por cualquiera con acceso de lectura al
repositorio.** Como el repositorio es público, el cifrado AES-256 es la única
barrera: usa una `BACKUP_PASSPHRASE` larga y única, guárdala en el gestor de
contraseñas y no la reutilices. El volcado contiene datos personales (por
ejemplo, correos de la allowlist y de invitaciones), así que el artefacto se
trata como material sensible. M5-06 valorará mover la copia al bucket privado de
R2.

Configuración única en GitHub (Settings → Secrets and variables → Actions →
Secrets):

| Nombre | Contenido |
|---|---|
| `SUPABASE_DB_URL` | Cadena del pooler de sesión (`DIRECT_URL`, puerto 5432), con `sslmode=require`. |
| `BACKUP_PASSPHRASE` | Frase larga y aleatoria para cifrar la copia; se guarda también en el gestor de contraseñas del propietario. |

Restauración de una copia:

```bash
gpg --decrypt world-craft-<fecha>.dump.gpg > world-craft-<fecha>.dump
pg_restore --no-owner --no-privileges --dbname "$DIRECT_URL" world-craft-<fecha>.dump
```

Antes de restaurar, lee [`base-de-datos/operacion.md`](base-de-datos/operacion.md)
§9.1 y ejecuta `pnpm db:verify` y `pnpm test:db` después. Los artefactos caducan a
los 90 días y no sustituyen a la exportación de un mundo completo.

## 7. Alertas esperadas

| Origen | Cuándo avisa | Canal |
|---|---|---|
| UptimeRobot | El healthcheck no devuelve `200` durante el intervalo configurado, y cuando se recupera. | Correo del propietario. |
| GitHub Actions (keep-alive) | El healthcheck no devuelve `200` o la URL no es `https://`. | Correo de GitHub y resumen del workflow. |
| GitHub Actions (backup) | Falla `pg_dump`, la verificación o el cifrado. | Correo de GitHub y resumen del workflow. |
| Supabase | Pausa inminente o cuota cerca del límite, si el proyecto tiene avisos activos. | Correo del propietario. |

Un aviso de caída no se silencia: se confirma el estado en Supabase y se sigue
el runbook. Los falsos positivos por despliegue se cubren con una ventana de
mantenimiento, no desactivando el monitor.

## 8. Límites y revisión

- **Coste:** UptimeRobot Free, Supabase Free, Vercel Hobby y GitHub Actions en
  repositorio público; 0 €/mes.
- **UptimeRobot Free:** 50 monitores y comprobaciones cada cinco minutos; aquí se
  usa uno cada 30–60 minutos.
- **GitHub Actions:** minutos ilimitados en repositorio público; el keep-alive
  son cuatro llamadas al día y el backup una ejecución semanal.
- **Artefactos:** 90 días de retención. La copia en R2 es opcional y se decide en
  M5-06.
- **Revisión mensual:** estado del monitor, última copia, uso de Supabase y
  correos de aviso. Si una cuota supera el 70 %, se documenta y se decide entre
  optimizar o migrar (ADR 0013).

## 9. Enlaces

- [ADR 0013](adr/0013-free-tier-continuity.md): continuidad de free tiers.
- [ADR 0009](adr/0009-testing-pwa-backups.md): testing, PWA y backups.
- [`base-de-datos/operacion.md`](base-de-datos/operacion.md): migraciones,
  copias, restauración y runbook de base de datos.
- [`almacenamiento.md`](almacenamiento.md): R2, lifecycle y credenciales.
- `.github/workflows/keepalive.yml` y `.github/workflows/backup.yml`.
