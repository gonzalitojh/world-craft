# ADR 0011 — Modelo local de un solo usuario

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-18
- **Fecha del documento:** 2026-11-18
- **Issue:** pivote a escritorio (catálogo nuevo)
- **Decisiones del registro:** D-025
- **Decisores:** usuario / agentes
- **Supersede:** ADR 0003 y ADR 0011 de la etapa web
- **Relacionados:** ADR 0004, ADR 0002

## Contexto

La etapa web tenía Supabase Auth, allowlist, invitaciones, roles por mundo y
RLS. El producto pasa a ser una aplicación de escritorio para una persona en un
equipo Windows. Mantener auth y permisos remotos añadiría complejidad, cuentas
y una superficie de ataque que no aporta valor.

## Decisión

1. World Craft es una **aplicación local de un solo usuario**.
2. No hay autenticación de aplicación, allowlist, invitaciones ni roles.
3. No hay RLS ni tablas de miembros; el acceso lo controla la cuenta de Windows
   y los permisos de la carpeta de datos.
4. La seguridad se centra en:
   - aislamiento del renderer,
   - IPC validado,
   - CSP y protocolo de assets,
   - importación segura,
   - dependencias y secretos.
5. Si en el futuro se añade colaboración o sincronización, se diseña con un ADR
   nuevo y no se reutiliza el modelo web.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Mantener Supabase Auth | Requiere red, cuenta y proyecto remoto; contradice el producto local. |
| Login local con contraseña | No aporta protección real frente a otro usuario de Windows con acceso al perfil. |
| Roles locales | No hay varios usuarios; sería complejidad sin uso. |
| RLS en SQLite | No existe el concepto; se resolvería con vistas o permisos de archivo. |

## Consecuencias

### Positivas

- Desaparecen tablas, flujos y errores de auth.
- No hay cuentas ni datos personales en la nube.
- La app funciona sin conexión desde el primer arranque.
- Menos código y menos superficie de ataque.

### Negativas y riesgos

- Un usuario de Windows con acceso a la sesión puede abrir la base.
- No hay separación entre usuarios del mismo equipo.
- La colaboración y la sincronización quedan fuera del MVP.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Ventana y escritorio | No hay pantalla de login. |
| Temas (Claro/Oscuro) | No aplica. |
| Accesibilidad | Menos fricción de acceso. |
| Seguridad y privacidad | Depende de la cuenta y los permisos de Windows. |
| Datos y preservación | La copia y la exportación son la vía de traslado. |
| Coste | 0 €/mes; sin Supabase ni auth. |
| Portabilidad de datos | ZIP/JSON y copia del archivo SQLite. |

## Riesgos de free tier y mitigación

No aplica: no hay servicio de autenticación. El único riesgo es el acceso
físico al equipo, que se documenta en el manual y en la guía de seguridad.

## Plan de revisión

Se revisa si el producto necesita colaboración, varios perfiles en el mismo
equipo o sincronización. Cualquiera de esos casos exige un ADR nuevo con modelo
de datos, seguridad y coste.

## Referencias

- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §1.5 y §3.5
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-025
- [`docs/arquitectura.md`](../arquitectura.md), §5
- Documentación de seguridad de Windows consultada el 18/11/2026.
