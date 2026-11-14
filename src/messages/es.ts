/**
 * Mensajes de la interfaz en español.
 *
 * Todos los textos visibles (incluidos los `aria-label`) viven aquí para
 * cumplir el ADR 0012: las pantallas no contienen cadenas hardcodeadas y
 * añadir `en.ts` o `it.ts` no debe obligar a tocar componentes.
 *
 * Las claves se acceden con `t('home.title')` o con `getMessages()`.
 */
export const es = {
  meta: {
    title: 'World Craft',
    titleTemplate: '%s · World Craft',
    description:
      'Taller privado para crear y mantener mundos de ficción: fichas, relaciones, mapas y manuscritos.',
    applicationName: 'World Craft',
    manifestDescription:
      'Taller privado de mundos de ficción: fichas, relaciones, mapas y manuscritos.',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    mainNavigation: 'Navegación principal',
    brandHome: 'World Craft, ir al inicio',
  },
  nav: {
    home: 'Inicio',
    login: 'Entrar',
    health: 'Estado',
  },
  footer: {
    note: 'World Craft es una herramienta privada: el contenido de cada mundo solo lo ven sus miembros.',
    license: 'Código con licencia MIT.',
    statusLink: 'Estado del sistema',
  },
  home: {
    eyebrow: 'Fase M0 · Fundaciones',
    title: 'Un taller de cartógrafo para dar forma a mundos que aún no existen',
    description:
      'World Craft reúne fichas, relaciones, mapas y manuscritos en un solo lugar privado. Cada mundo tiene su propia geografía, su propio elenco y sus propias reglas; tú decides quién entra.',
    primaryAction: 'Entrar al taller',
    secondaryAction: 'Ver el estado técnico',
    pillarsTitle: 'Qué encontrará el taller',
    pillars: [
      {
        title: 'Fichas conectadas',
        description:
          'Personajes, lugares y objetos con atributos propios y relaciones entre ellos.',
      },
      {
        title: 'Mapas y grafo',
        description:
          'Geografía vectorial y un grafo de conocimiento que crece con cada vínculo.',
      },
      {
        title: 'Manuscritos',
        description:
          'Escenas y borradores que se exportan sin quedar atrapados en la aplicación.',
      },
    ],
    privateNote:
      'El contenido es privado por defecto: sin sesión no hay acceso a ningún mundo.',
  },
  login: {
    title: 'Entrar en World Craft',
    description:
      'El acceso estará disponible en la fase M1, con allowlist e invitaciones.',
    cardTitle: 'Acceso próximamente',
    cardBody:
      'Estamos construyendo la autenticación: correo autorizado, invitación de un solo uso y roles por mundo. Todavía no hay ningún formulario que puedas usar.',
    disabledAction: 'Entrar (no disponible)',
    disabledReason:
      'El botón se activará cuando la autenticación esté publicada.',
    backHome: 'Volver al inicio',
  },
  health: {
    title: 'Estado del sistema',
    description:
      'Comprobación mínima de que la aplicación está desplegada y responde.',
    statusLabel: 'Estado',
    statusOk: 'Operativo',
    statusOkDescription:
      'La aplicación responde y el endpoint de salud devuelve un estado correcto.',
    detailsTitle: 'Detalles del despliegue',
    commitLabel: 'Commit',
    commitUnknown: 'local (sin datos de Vercel)',
    checkedAtLabel: 'Comprobado',
    apiLabel: 'Endpoint',
    apiLink: 'Consultar /api/health',
    backHome: 'Volver al inicio',
  },
  error: {
    title: 'Algo se ha torcido en el taller',
    description:
      'La página no ha podido cargarse. Puedes reintentarlo; si el problema continúa, vuelve al inicio y avísanos.',
    retry: 'Reintentar',
    backHome: 'Volver al inicio',
  },
  loading: {
    label: 'Cargando…',
  },
  notFound: {
    title: 'Esta página no está en el mapa',
    description:
      'La dirección no existe o ha cambiado de sitio. Vuelve al inicio para seguir explorando.',
    backHome: 'Volver al inicio',
  },
} as const;
