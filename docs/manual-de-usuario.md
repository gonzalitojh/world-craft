# Manual de usuario de World Craft

> **Estado: en construcción.** World Craft está en fase **M0** (fundaciones y
> proceso). Todavía no hay producto: no se puede iniciar sesión, crear mundos ni
> escribir. Este documento fija la **estructura** del manual y describe lo poco
> que ya se puede ver. Se completará en la fase M5 (issue
> [#28](https://github.com/gonzalitojh/world-craft/issues/28)) y se actualizará
> con cada funcionalidad visible que se añada antes.

World Craft será una aplicación privada para **crear y mantener mundos de
ficción**: fichas de personajes, lugares y objetos, relaciones entre ellos,
mapas, un grafo navegable, manuscritos y herramientas de juego creativo. Todo el
contenido requiere sesión y permisos: **no hay contenido público por defecto**.

## 1. Lo que se puede hacer hoy (fase M0)

Muy poco, y es lo esperado en esta fase:

| Página | Qué se puede hacer |
|---|---|
| Portada (`/`) | Leer qué es World Craft, en qué fase está y cuáles son sus tres pilares. |
| Acceso (`/login`) | Ver el aviso de que el acceso llegará con la autenticación. El botón está deshabilitado: **no hay formulario ni sesión**. |
| Estado (`/health`) | Comprobar que el despliegue responde y si la base de datos de Supabase está disponible, con el commit y la hora de la comprobación. |
| Sistema de diseño (`/design-system`) | Recorrer los colores, tipografía, componentes y patrones de la interfaz, y cambiar entre tema Claro y Oscuro. |

En la página de estado, «Operativo» significa que la aplicación y Supabase
responden; «Degradado» significa que la aplicación responde pero la comprobación
de la base de datos no se ha completado. En ese caso no hay nada que puedas hacer
desde la web: el propietario recibe el aviso del monitor y reactiva el proyecto.
La comprobación es la misma que usa el monitor externo y se repite cada vez que
abres la página.

Consejo: en el sistema de diseño puedes probar el **selector de tema** de la
barra superior. La preferencia se guarda en tu navegador y se mantiene entre
visitas. La opción **Sistema** sigue el tema de tu dispositivo.

## 2. Primeros pasos (se completará en M1)

Cuando exista el acceso, el recorrido previsto será:

1. Entrar con el correo autorizado.
2. Crear el primer mundo.
3. Añadir fichas y relacionarlas.
4. Invitar a otras personas y decidir su rol.

Hasta entonces no hay cuentas, ni invitaciones, ni datos que guardar.

## 3. Acceso a la aplicación

- **Previsto (M1-01):** acceso con correo mediante Supabase Auth y una lista de
  correos permitidos (allowlist).
- **Importante:** la allowlist da acceso a la **aplicación**, no a los mundos de
  otras personas. Cada mundo tiene sus propios miembros y roles.
- **Hoy:** la página de acceso es un aviso; no se puede entrar.

## 4. Mundos y roles

- **Previsto (M1-02, M1-07):** cualquier persona autorizada podrá crear sus
  propios mundos y será su propietaria.
- **Roles por mundo:** `Propietario`, `Editor` y `Lector`.
  - El propietario gestiona miembros y roles y no puede perder la propiedad sin
    transferirla antes.
  - El editor puede crear y modificar contenido.
  - El lector puede consultar el contenido sin modificarlo.
- **Invitaciones:** de un solo uso, ligadas al correo y con caducidad.

## 5. Fichas y entidades

- **Previsto (M1-03, M1-04):** fichas de personajes, lugares, organizaciones,
  objetos, conceptos y demás tipos, con plantillas y un mundo de ejemplo.
- **Relaciones tipadas y backlinks:** cada ficha mostrará con qué otras está
  relacionada y en qué dirección.

## 6. Mapas y grafo

- **Previsto (M2):** mapas vectoriales con MapLibre y Terra Draw, con la opción
  de calcar una imagen de fondo georreferenciada; marcadores y vínculos entre el
  mapa y las fichas; vista de grafo interactiva.

## 7. Escritura

- **Previsto (M3):** editor de manuscritos con autoguardado, estructura de
  libros, capítulos y escenas, herramientas de diálogo, historial de versiones y
  exportación a DOCX, PDF, EPUB y Markdown.

## 8. Juego creativo

- **Previsto (M4):** motor de dados, tablas de inspiración, contenido inicial de
  fantasía, ciencia ficción, terror y contemporáneo, tablas personalizadas y
  packs de contenido ampliables desde la propia aplicación.

## 9. Cuenta, preferencias y datos

- **Previsto (M1-06, M5):** ajustes de cuenta y preferencias, cambio de tema y
  de idioma, exportación e importación de un mundo completo en formatos abiertos,
  y eliminación de la cuenta.
- **Hoy:** la única preferencia que funciona es el tema, en el sistema de diseño.

## 10. Búsqueda y atajos

- **Previsto (M1-05):** búsqueda global y paleta de comandos con `Ctrl`/`Cmd` +
  `K` (el botón de búsqueda ya existe en el shell).
- **Hoy:** la paleta abre, pero no busca datos porque todavía no hay contenido.

## 11. Temas y accesibilidad

- **Dos temas:** Claro y Oscuro, más la opción **Sistema**.
- La interfaz se puede recorrer con teclado, el foco es visible y se respeta la
  preferencia de **movimiento reducido** del sistema operativo.
- El diseño se adapta a móvil, tablet y ordenador sin desplazamiento horizontal
  de página.

## 12. Privacidad y frecuencia de actualización

- **Datos privados.** Todo el contenido requiere sesión y permisos; no se
  publica nada por defecto.
- **Dónde se guardan.** Los datos vivirán en una base PostgreSQL gestionada por
  Supabase, con aislamiento por mundo. Los archivos irán a un almacén privado con
  enlaces temporales.
- **Frecuencia de actualización.** Las páginas leerán los datos al cargarse; no
  hay refresco en segundo plano ni sincronización en tiempo real en el alcance
  inicial. Los borradores sin conexión y la instalación como aplicación llegan
  con la PWA (M5).
- **Copias.** Habrá copias de seguridad y exportación de datos; el procedimiento
  técnico está en
  [`docs/base-de-datos/operacion.md`](base-de-datos/operacion.md).

## 13. Preguntas frecuentes

**¿Puedo crear una cuenta?**
Todavía no. El acceso llega con la fase M1.

**¿Se ve mi mundo a otras personas?**
No. No hay contenido público y cada mundo tiene sus propios miembros.

**¿Cuánto cuesta?**
El objetivo es 0 €/mes con planes gratuitos. No hay funciones de pago.

**¿Puedo usar la aplicación en el móvil?**
La interfaz ya es responsive y el uso como aplicación instalable llegará con la
PWA (M5).

**¿En qué idioma estará?**
En español durante el MVP, con la estructura preparada para añadir inglés e
italiano.

## 14. Cómo se mantiene este manual

Cualquier cambio que afecte a lo que la persona usuaria ve o hace debe
actualizar este documento en la misma tarea (regla 3 de
[`AGENTS.md`](../AGENTS.md)). Los cambios puramente internos no lo tocan. La
versión formal y completa llega con M5-01 (issue
[#28](https://github.com/gonzalitojh/world-craft/issues/28)); hasta entonces, cada
funcionalidad visible añade o corrige su sección.

## 15. Más información

- [README](../README.md): qué es el proyecto y cómo arrancarlo en local.
- [Arquitectura](arquitectura.md): cómo está organizada la aplicación.
- [Plan de desarrollo](plan-desarrollo.md): alcance y fases.
- [Registro de decisiones](registro-decisiones.md) e [índice de ADRs](adr/README.md).
- [Proceso SDD](proceso-sdd.md): cómo se trabaja en el repositorio.
