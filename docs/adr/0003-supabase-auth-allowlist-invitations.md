# ADR 0003 — Supabase Auth, allowlist e invitaciones

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-004
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0011, ADR 0013

## Contexto

La aplicación es privada: no hay registro público ni contenido visible sin
sesión. Se necesita autenticación gestionada, sesiones seguras en Next.js y un
mecanismo de invitación que no confunda el acceso a la aplicación con el acceso
a un mundo concreto.

## Decisión

1. **Proveedor:** Supabase Auth con `@supabase/ssr`.
2. **Métodos:** correo y contraseña como método principal; enlace mágico como
   secundario.
3. **Registro cerrado:** solo pueden entrar los correos de `allowed_emails`,
   gestionada por el propietario. La allowlist concede acceso a la aplicación,
   no a los mundos de otras personas.
4. **Sesiones:** cookies HttpOnly y SameSite; middleware que refresca la sesión
   y protege las rutas privadas.
5. **Invitaciones a un mundo:** token de un solo uso, almacenado como hash,
   ligado al correo invitado y con caducidad (`world_invitations`). El rol se
   fija al aceptar y se materializa en `world_members`.
6. **Autorización:** cada Server Action vuelve a comprobar la membresía y el
   rol; RLS es la última línea, no la única.
7. **Service role:** solo en servidor para tareas administrativas y nunca se
   expone al cliente.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Better Auth | Buena alternativa autogestionada, pero exige más trabajo de integración con RLS y el despliegue serverless. |
| Auth.js | Menos integración con RLS de Supabase y más piezas que mantener. |
| Clerk | Servicio de pago para las funciones necesarias; rompe el objetivo de coste cero. |
| Registro público | Contradice el principio de producto privado por defecto y la regla de acceso del proyecto. |
| Invitaciones sin caducidad ni correo | Mayor riesgo de reutilización y de acceso no deseado. |

## Consecuencias

### Positivas

- Auth, sesiones y RLS comparten el mismo proveedor y el mismo modelo de datos.
- La allowlist separa claramente el acceso a la app del acceso a cada mundo.
- Las invitaciones de un solo uso reducen el riesgo de enlaces filtrados.
- El middleware y las comprobaciones de servidor cubren el flujo completo.

### Negativas y riesgos

- Dependencia del SMTP de Supabase en Free, con límites bajos y marca.
- Complejidad del refresco de sesión en App Router.
- El propietario debe gestionar la allowlist y las invitaciones manualmente.
- El enlace mágico puede fallar si el correo llega tarde o cae en spam.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Formularios de acceso y aceptación de invitación usables a 360, 768 y 1280 px. |
| Temas (Claro/Oscuro) | Los formularios usan los tokens del ADR 0010 en ambos temas. |
| Accesibilidad | Etiquetas, errores asociados, foco visible y `aria-live` en el envío. |
| Seguridad y privacidad | Cookies seguras, service role solo en servidor, tokens hasheados y caducidad. |
| Coste | 0 €/mes con Supabase Free; Resend Free es opcional. |
| Portabilidad de datos | La cuenta se puede exportar y eliminar; el correo es el único dato personal necesario. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Límite de usuarios | 50.000 MAU en Supabase Free | Uso personal; no hay crecimiento público | ADR 0013 |
| Correos de Auth | SMTP integrado con límites bajos y marca en Free | Email/contraseña como método principal; Resend Free (3.000/mes, 100/día) si hace falta | M1-01 (#11) |
| Envío fallido de invitación | Depende del SMTP | Reintento, aviso en la interfaz y alternativa de enlace manual | M1-07 (#43) |
| Abuso de login o invitaciones | Sin coste adicional | Límites básicos, validación de tamaño y rate limiting si hiciera falta | M5-05 (#32) |

## Plan de revisión

Se revisa si cambian los límites de Supabase Auth, si el correo se convierte en
un problema recurrente o si se añade un proveedor de identidad. Un cambio de
proveedor de Auth requiere un ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.2 D5 y §3.4
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-004
- Documentación oficial de Supabase Auth y `@supabase/ssr`, consultada el
  12/11/2026.
