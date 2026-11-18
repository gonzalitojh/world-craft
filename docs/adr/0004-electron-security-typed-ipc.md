# ADR 0004 — Seguridad de Electron e IPC tipado

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-024, D-025
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0003 de la etapa web (Supabase Auth/RLS)
- **Relacionados:** ADR 0001, ADR 0002, ADR 0005, ADR 0011

## Contexto

En una aplicación Electron, el renderer ejecuta contenido de la interfaz y no
debe tener acceso a Node, al sistema de archivos ni a la base de datos. A la vez,
la aplicación necesita leer/escribir SQLite, gestionar assets, copias y
actualizaciones. Sin un contrato claro, cada pantalla podría abrir un canal IPC
genérico y ampliar la superficie de ataque.

## Decisión

1. **Ventana segura:** `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`, `webSecurity: true`.
2. **Preload mínimo:** expone `window.worldCraft.<dominio>.<acción>` con
   funciones concretas; nunca `ipcRenderer`, `require` ni rutas absolutas.
3. **IPC allowlisted:** cada canal está declarado, valida entrada y salida con
   Zod y devuelve `{ ok: true, data }` o `{ ok: false, error }` con códigos
   estables.
4. **CSP estricta:** sin `unsafe-eval`; scripts y estilos desde el bundle local;
   `img-src 'self' wc-asset: data:`.
5. **Sin contenido remoto:** `will-navigate` y `setWindowOpenHandler` bloquean
   la navegación; los enlaces externos se abren con `shell.openExternal` solo
   para `https:`.
6. **Assets:** protocolo propio validado (ADR 0005).
7. **Importación:** ZIP/JSON validados, límites de tamaño y rutas, sin `..`.
8. **Logs:** sin contenido del usuario ni rutas absolutas por defecto.
9. **Dependencias:** lockfile, auditoría y licencias compatibles.

> **Precisión de implementación (#63, 18/11/2026).** La entrada se valida con
> Zod en el proceso principal, que es la frontera de confianza. La salida se
> comprueba de forma estructural en el preload, sin Zod, para no empaquetar la
> librería en preload ni renderer; una respuesta con otra forma se degrada a
> `INTERNAL_ERROR`. La decisión de validar ambos lados se mantiene.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| `nodeIntegration: true` | El renderer tendría acceso a Node y a todo el equipo; inaceptable. |
| Un único canal `invoke` genérico | Convierte el preload en un puente arbitrario y elimina la allowlist. |
| Servidor local HTTP para datos | Añade puertos, CORS y otra superficie de ataque sin necesidad. |
| `file://` para assets | Permite rutas arbitrarias y rompe el aislamiento. |

## Consecuencias

### Positivas

- Superficie de ataque pequeña y auditable.
- Contratos tipados entre renderer y main.
- El renderer se puede probar sin Electron.
- Los errores internos no se filtran a la interfaz.

### Negativas y riesgos

- Más código de contrato y validación por cada funcionalidad.
- Un canal nuevo exige preload, main, tipos y tests.
- `sandbox: true` limita algunas APIs del renderer; hay que diseñar para ello.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | La ventana no navega fuera de la app. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | Los errores IPC se anuncian con mensajes claros. |
| Seguridad y privacidad | Núcleo de la decisión: aislamiento, validación y CSP. |
| Datos y preservación | Las mutaciones pasan por main y por transacciones. |
| Coste | 0 €/mes. |
| Portabilidad de datos | La importación/exportación también pasa por contratos validados. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Canal IPC olvidado | Error de diseño | Lista central de canales y test de allowlist | Cada issue de IPC |
| Path traversal en assets | Acceso a archivos fuera de `assets/` | Normalización y comprobación de prefijo | Security review |
| XSS en el renderer | Contenido rico | CSP, sanitización y JSON de ProseMirror | Security review |

## Plan de revisión

Se revisa en cada issue que añada un canal IPC, un protocolo, importación o
contenido rico, y en la auditoría de seguridad de M5. Cualquier relajación de
CSP o del sandbox exige un ADR nuevo.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.5
- [`docs/arquitectura.md`](../arquitectura.md), §5
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-024 y D-025
- Issue #63: implementación del IPC tipado con allowlist y Zod.
- Documentación de seguridad de Electron consultada el 18/11/2026.
