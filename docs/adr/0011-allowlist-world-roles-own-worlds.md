# ADR 0011 — Allowlist, roles por mundo y mundos propios

- **Estado:** aceptado
- **Fecha de la decisión:** 2026-11-12
- **Fecha del documento:** 2026-11-14
- **Issue:** #4
- **Decisiones del registro:** D-004
- **Decisores:** usuario (aprobación del plan); agentes (redacción)
- **Supersede:** —
- **Relacionados:** ADR 0002, ADR 0003, ADR 0004

## Contexto

La aplicación es privada y multiusuario de forma acotada: un autor principal, y
amigos invitados que pueden leer o editar un mundo concreto. Hay que separar el
acceso a la aplicación del acceso a cada mundo y evitar cualquier fuga de datos
entre usuarios. La allowlist por sí sola no puede ser el único control.

## Decisión

1. **Allowlist de aplicación:** `allowed_emails` decide quién puede entrar en la
   aplicación. No concede acceso a los mundos de otras personas.
2. **Membresía de mundo:** `world_members` relaciona usuario y mundo con rol
   `owner`, `editor` o `viewer`.
3. **Mundos propios:** cualquier usuario autorizado puede crear sus propios
   mundos y es su `owner`.
4. **Propiedad:** el `owner` gestiona miembros y roles y no puede perderse ni
   eliminarse a sí mismo sin transferir antes la propiedad.
5. **Invitaciones:** de un solo uso, ligadas al correo y con caducidad, según el
   ADR 0003.
6. **RLS:** activa en todas las tablas de contenido, comprobando la membresía y
   el rol adecuado.
7. **Servidor:** las Server Actions vuelven a comprobar el permiso; RLS es la
   última línea, no la única.
8. **Service role:** solo en servidor y nunca expuesto al cliente.
9. **Contenido público:** no existe por defecto. Una wiki o vista pública queda
   en el backlog (B-02) y requeriría un ADR nuevo.

## Alternativas consideradas

| Alternativa | Motivo del descarte |
|---|---|
| Registro público | Contradice el producto privado y la regla de acceso. |
| Aplicación mono-usuario | Impide compartir un mundo con un amigo con rol de lectura o edición. |
| Roles globales | Un usuario con edición en un mundo tendría permiso en todos. |
| Enlaces públicos de solo lectura | Convierte el contenido privado en accesible sin control de membresía. |
| Invitación sin correo ni caducidad | Mayor riesgo de reutilización y de acceso no deseado. |

## Consecuencias

### Positivas

- Separación clara entre entrar en la app y acceder a un mundo.
- El aislamiento se refuerza en base de datos y en servidor.
- El usuario puede crear y compartir sus propios mundos sin depender del dueño
  de la instancia.
- La transferencia de propiedad evita mundos huérfanos.

### Negativas y riesgos

- Más tablas, políticas RLS y pruebas que un modelo mono-usuario.
- Una política RLS mal escrita puede filtrar datos; hay que probarla.
- La gestión de miembros añade interfaz y casos límite.
- La allowlist requiere administración manual.

### Impacto transversal

| Dimensión | Impacto |
|---|---|
| Responsive | Gestión de miembros usable a 360, 768 y 1280 px. |
| Temas (Claro/Oscuro) | Roles y estados con contraste AA en ambos temas. |
| Accesibilidad | Etiquetas, errores asociados y foco visible en invitaciones. |
| Seguridad y privacidad | Es la decisión central: RLS, comprobación en servidor y sin contenido público. |
| Coste | Sin coste adicional; las invitaciones usan el correo del ADR 0003. |
| Portabilidad de datos | La exportación de un mundo incluye sus miembros y roles. |

## Riesgos de free tier y mitigación

| Riesgo | Límite o coste | Mitigación | Seguimiento |
|---|---|---|---|
| Fuga entre usuarios | Riesgo muy alto | RLS + tests con dos usuarios + comprobación en servidor | M1-01 (#11) y M5-05 (#32) |
| Escalado de rol | Riesgo alto | Validación de rol en cada mutación y pruebas de permisos | M1-07 (#43) |
| Invitaciones abusivas | Sin coste adicional | Caducidad, un solo uso, límites básicos y registro de actividad | M1-07 (#43) |
| Correo no entregado | Límite del SMTP | Reintento y enlace manual de respaldo | ADR 0003 |

## Plan de revisión

Se revisa si se añade contenido público, si cambia el modelo de roles o si una
prueba de RLS detecta una fuga. Cualquier cambio de modelo de acceso exige un
ADR nuevo.

## Referencias

- Issue: #4
- [`docs/plan-desarrollo.md`](../plan-desarrollo.md), §3.4 y §7
- [`docs/registro-decisiones.md`](../registro-decisiones.md), D-004
- [`AGENTS.md`](../../AGENTS.md), regla 15
