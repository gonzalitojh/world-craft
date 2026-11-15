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
  common: {
    close: 'Cerrar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
  },
  a11y: {
    skipToContent: 'Saltar al contenido',
    mainNavigation: 'Navegación principal',
    sidebarNavigation: 'Navegación lateral',
    mobileNavigation: 'Menú de navegación',
    breadcrumbs: 'Ruta de navegación',
    sectionNavigation: 'Secciones de esta página',
    brandHome: 'World Craft, ir al inicio',
    closeDialog: 'Cerrar el diálogo',
    closeDrawer: 'Cerrar el panel',
    dismissToast: 'Descartar el aviso',
    openCommandPalette: 'Abrir la paleta de comandos',
    openCommandPaletteShortcut: 'Abrir la paleta de comandos (Ctrl o Cmd + K)',
    openMenu: 'Abrir el menú de navegación',
    openMore: 'Abrir más destinos',
  },
  toast: {
    regionPolite: 'Avisos',
    regionAssertive: 'Avisos urgentes',
  },
  command: {
    title: 'Paleta de comandos',
    description:
      'Busca una sección o una acción. Usa las flechas para moverte y Enter para elegir.',
    placeholder: 'Escribe un comando o busca…',
    empty: 'Ningún comando coincide con esa búsqueda.',
    groupDefault: 'Acciones',
    groupNavigation: 'Ir a',
    groupTheme: 'Tema',
    themeSystem: 'Usar el tema del sistema',
    themeLight: 'Pasar al tema claro',
    themeDark: 'Pasar al tema oscuro',
  },
  empty: {
    defaultTitle: 'Todavía no hay nada aquí',
  },
  nav: {
    home: 'Inicio',
    login: 'Entrar',
    health: 'Estado',
    design: 'Diseño',
    worlds: 'Mundos',
    manuscripts: 'Manuscritos',
    more: 'Más',
    groupMain: 'Navegación',
    groupUpcoming: 'Próximamente',
  },
  shell: {
    menuTitle: 'Menú',
    menuDescription: 'Los mismos destinos que la navegación de escritorio.',
    moreTitle: 'Más',
    moreDescription: 'Acceso, licencia y estado del sistema.',
    upcomingNote: 'Llegan en las siguientes fases; todavía no tienen página.',
    licenseTitle: 'Licencia',
    licenseNote: 'El código se publica con licencia MIT.',
    statusTitle: 'Estado del sistema',
    statusNote: 'Comprueba que la aplicación responde.',
  },
  theme: {
    label: 'Tema',
    system: 'Sistema',
    light: 'Claro',
    dark: 'Oscuro',
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
  design: {
    eyebrow: 'Fase M0 · Sistema de diseño',
    title: 'El taller por dentro, a tamaño real',
    description:
      'Todo lo que ves aquí es el sistema que usa la aplicación: los mismos tokens, los mismos componentes y las mismas reglas. Cambia de tema, recorre las secciones y prueba con el teclado: nada depende solo del color ni del ratón.',
    commandLabel: 'Abrir los comandos',
    contentsLabel: 'En esta página',
    usageLabel: 'Cuándo usarlo',
    meta: {
      themesLabel: 'Temas',
      themesValue: 'Claro, Oscuro y Sistema',
      contrastLabel: 'Contraste mínimo',
      contrastValue: '4.5:1 en texto · 3:1 en gráficos',
      widthsLabel: 'Anchos probados',
      widthsValue: '360 · 768 · 1280 px',
    },
    sections: {
      foundations: 'Fundamentos',
      components: 'Componentes',
      patterns: 'Patrones',
      accessibility: 'Accesibilidad',
      captures: 'Capturas',
    },
    sectionNotes: {
      foundations:
        'La materia prima: color, tipografía, espacio, radios, elevación y estados.',
      components:
        'Cada pieza con sus variantes, sus estados y una nota de cuándo usarla.',
      patterns: 'Composiciones que se repiten en las pantallas del taller.',
      accessibility: 'Teclado, foco, atajos y reglas que no se negocian.',
      captures:
        'Imágenes de referencia en ambos temas, generadas con Playwright.',
    },
    palette: {
      rawTitle: 'Paleta cruda',
      rawNote:
        'Son los únicos colores literales del proyecto y viven en un solo archivo. Cada valor existe dos veces, una por tema, y ninguna pantalla los usa directamente.',
      semanticTitle: 'Paleta semántica',
      semanticNote:
        'Los componentes no eligen colores: piden papeles (superficie, tinta, acento, estado). Esta capa decide qué mitad de la paleta se pinta en cada tema.',
      contrastTitle: 'Contraste medido',
      contrastNote:
        'Ratio real de cada pareja en los dos temas, calculado con la misma fórmula que la prueba de tokens. AA exige 4.5:1 en texto y 3:1 en bordes y foco.',
      lightLabel: 'Claro',
      darkLabel: 'Oscuro',
      tokens: {
        paper: 'Papel',
        'paper-raised': 'Papel elevado',
        'paper-sunken': 'Papel hundido',
        ink: 'Tinta',
        'ink-muted': 'Tinta atenuada',
        border: 'Borde',
        'border-strong': 'Borde fuerte',
        accent: 'Acento',
        'accent-strong': 'Acento fuerte',
        'accent-ink': 'Tinta sobre acento',
        'accent-muted': 'Acento suave',
        danger: 'Peligro',
        success: 'Éxito',
        warning: 'Aviso',
        info: 'Información',
        focus: 'Foco',
      },
      pairs: {
        foreground: 'Tinta sobre papel',
        muted: 'Tinta atenuada sobre papel',
        accent: 'Acento sobre papel',
        'accent-ink': 'Tinta sobre acento',
        focus: 'Foco sobre papel',
        danger: 'Peligro sobre su superficie',
        success: 'Éxito sobre su superficie',
        warning: 'Aviso sobre su superficie',
        info: 'Información sobre su superficie',
      },
    },
    typography: {
      title: 'Tipografía',
      note: 'Fraunces para títulos, Inter para interfaz y JetBrains Mono para datos técnicos. Los tamaños display usan clamp(): crecen con la pantalla sin romper en móvil.',
      displayXl: 'Un mundo que todavía no existe',
      displayLg: 'Escala de título grande',
      displayMd: 'Escala de título medio',
      displaySm: 'Escala de título pequeño',
      body: 'El cuerpo de texto usa una medida cómoda de lectura y un interlineado de 1.6. Los párrafos largos se limitan con --prose-max para que la vista no se pierda en líneas interminables.',
      mono: 'sha-1f4c9a · 2026-11-15T10:00:00Z',
      eyebrow: 'Fase M0 · Fundaciones',
      longTextTitle: 'Un párrafo largo, como los que llegarán',
      longText:
        'Los cartógrafos del taller dibujan costas que todavía no existen y anotan cada cabo con la misma tinta con la que luego escriben la escena en la que ese cabo se convierte en refugio. El texto de la interfaz nunca debe competir con el mundo: por eso el cuerpo usa una medida cómoda, un interlineado de 1.6 y un ancho máximo que evita que la vista salte de línea en línea sin saber dónde estaba. Cuando el párrafo es largo de verdad, la columna se mantiene estrecha, los márgenes respiran y nada se sale de su caja, ni siquiera en la pantalla más pequeña.',
      longWordTitle: 'Una palabra sin espacios',
      longWord: 'cartografia-vectorial-de-las-mareas-grises-sin-espacios-2026',
      longWordNote:
        'Las URLs, los identificadores y los nombres técnicos no se parten solos: el contenedor los ajusta con overflow-wrap y min-width en lugar de esconderlos con puntos suspensivos.',
    },
    spacing: {
      title: 'Espaciado',
      note: 'Escala de 4 px sobre la que se construyen rellenos y separaciones. Los contenedores de ancho completo usan unidades relativas, nunca píxeles fijos.',
      valueLabel: 'Paso',
    },
    radii: {
      title: 'Radios',
      note: 'Del cuadrado suave al círculo completo. Los controles usan md; las tarjetas y los diálogos, lg.',
    },
    elevation: {
      title: 'Elevación',
      note: 'Las sombras usan el tinte del tema, no negro puro: en oscuro no se ven como manchas y en claro no ensucian el papel.',
      card: 'Tarjeta',
      dialog: 'Diálogo',
      rail: 'Rail',
    },
    states: {
      title: 'Estados',
      note: 'El color nunca va solo: cada estado lleva texto y, cuando ayuda, un icono. Así se entiende también sin distinguir tonos.',
      danger: 'Eliminado',
      success: 'Guardado',
      warning: 'Sin conexión',
      info: 'Borrador',
    },
    components: {
      button: {
        title: 'Botón',
        note: 'Una acción por botón. La variante por defecto es la acción principal de la pantalla; outline y ghost acompañan sin competir; destructive solo para lo irreversible, siempre con confirmación.',
        variants: 'Variantes',
        sizes: 'Tamaños',
        states: 'Estados',
        primary: 'Guardar',
        outline: 'Ver estado',
        ghost: 'Descartar',
        destructive: 'Eliminar',
        link: 'Volver al inicio',
        small: 'Filtro',
        large: 'Crear mundo',
        disabled: 'No disponible',
        loading: 'Guardando…',
        icon: 'Buscar',
      },
      input: {
        title: 'Campo de texto',
        note: 'Para datos cortos de una línea. Siempre dentro de un campo con etiqueta visible; el estado inválido se marca con borde y anillo, no solo con color de texto.',
        label: 'Nombre del mundo',
        placeholder: 'Las Mareas Grises',
        description: 'Aparece en la cabecera del mundo.',
        disabledLabel: 'Campo deshabilitado',
        disabledValue: 'Sin permiso de edición',
      },
      textarea: {
        title: 'Área de texto',
        note: 'Para textos de varias líneas, como sinopsis o notas de sesión. Crece en vertical y no ensancha la página.',
        label: 'Sinopsis',
        placeholder: 'Resume el mundo en dos o tres líneas',
      },
      select: {
        title: 'Selector',
        note: 'Se usa el control nativo a propósito: en móvil abre el selector del sistema y el teclado funciona sin código extra.',
        label: 'Rol en el mundo',
        editor: 'Editor',
        viewer: 'Lector',
      },
      field: {
        title: 'Campo con etiqueta',
        note: 'Agrupa etiqueta, ayuda y error, y los asocia al control. El error sustituye a la ayuda y se anuncia al enfocar el campo.',
        label: 'Correo autorizado',
        description: 'Solo este correo podrá entrar al taller.',
        errorLabel: 'Nombre del mundo',
        error: 'Ya existe un mundo con ese nombre.',
      },
      card: {
        title: 'Tarjeta',
        note: 'Agrupa contenido relacionado con una superficie elevada. Nunca se usa como decoración: si no hay nada que agrupar, no hay tarjeta.',
        heading: 'Fichas conectadas',
        body: 'Personajes, lugares y objetos con atributos propios y relaciones entre ellos.',
        footer: 'Ver la ficha',
      },
      badge: {
        title: 'Etiqueta',
        note: 'Estado breve junto a un título. Lleva texto siempre: el tono refuerza, no informa por sí solo.',
        neutral: 'Neutral',
        accent: 'Borrador',
        success: 'Publicado',
        warning: 'Revisar',
        danger: 'Archivado',
        info: 'En revisión',
      },
      empty: {
        /*
         * El nombre de la región es su título: dos especímenes con el mismo
         * texto rompen `landmark-unique` de axe aunque sean secciones
         * distintas. Cada uno se nombra por su contexto.
         */
        title: 'Estado vacío en un componente',
        note: 'Explica qué falta, por qué y qué puede hacer la persona. Es un patrón obligatorio: una pantalla vacía sin salida es un callejón.',
        heading: 'Todavía no hay fichas',
        body: 'Crea la primera ficha para empezar a tejer relaciones entre personajes y lugares.',
        action: 'Crear ficha',
      },
      dialog: {
        title: 'Diálogo',
        note: 'Para una decisión que interrumpe. Atrapa el foco, bloquea el fondo, cierra con Escape y devuelve el foco a quien lo abrió. Siempre con título.',
        trigger: 'Abrir el diálogo',
        heading: 'Renombrar el mundo',
        body: 'El nombre anterior quedará en el historial del mundo.',
        confirm: 'Guardar',
      },
      drawer: {
        title: 'Panel lateral',
        note: 'Para navegación o filtros que conviven con el contenido. El panel inferior se reserva a acciones secundarias en móvil.',
        left: 'Abrir por la izquierda',
        right: 'Abrir por la derecha',
        bottom: 'Abrir por abajo',
        heading: 'Panel de ejemplo',
        body: 'Comparte con el diálogo la trampa de foco, el cierre con Escape y la devolución del foco.',
      },
      tabs: {
        title: 'Pestañas',
        note: 'Para vistas hermanas del mismo contenido. Se mueven con las flechas, Inicio y Fin, y cada pestaña tiene su panel asociado.',
        first: 'Fichas',
        second: 'Relaciones',
        third: 'Mapas',
        firstBody: 'La lista de fichas del mundo, con su tipo y su estado.',
        secondBody:
          'El grafo de relaciones entre fichas, con el tipo de vínculo.',
        thirdBody: 'La geografía vectorial y sus capas.',
      },
      toast: {
        title: 'Avisos efímeros',
        note: 'Confirman algo que ya ha pasado sin robar el foco. Se anuncian en una región viva, se pausan al pasar el ratón y los errores no se cierran solos.',
        info: 'Borrador guardado',
        infoBody: 'El mundo se ha guardado sin publicar.',
        success: 'Mundo publicado',
        successBody: 'Ya pueden verlo los miembros del taller.',
        warning: 'Conexión inestable',
        warningBody: 'Los cambios se reintentarán en unos segundos.',
        error: 'No se pudo guardar',
        errorBody: 'Revisa la conexión y vuelve a intentarlo.',
      },
      tooltip: {
        title: 'Globo de ayuda',
        note: 'Solo para botones de icono y para el rail colapsado. Nunca es la única etiqueta: el disparador conserva su nombre accesible.',
        trigger: 'Buscar en el mundo',
        helper: 'Buscar en el mundo',
      },
      command: {
        title: 'Paleta de comandos',
        note: 'Atajo global Ctrl + K o Cmd + K. Filtra, se mueve con las flechas y devuelve el foco al cerrarse. El contenido se carga la primera vez que se abre.',
        trigger: 'Abrir la paleta desde aquí',
      },
      theme: {
        title: 'Selector de tema',
        note: 'Vive en la topbar de todas las pantallas; aquí se prueba sin salir del catálogo. «Sistema» sigue al sistema operativo y la preferencia se guarda en este navegador.',
      },
    },
    patterns: {
      form: {
        title: 'Formulario',
        note: 'Un formulario, un objetivo. La ayuda va antes del control y el error después, con el mismo texto que anuncia el lector de pantalla.',
        heading: 'Crear una ficha',
        name: 'Nombre',
        nameDescription: 'El nombre visible en el mapa.',
        namePlaceholder: 'La torre de sal',
        summary: 'Resumen',
        summaryPlaceholder: 'Una sola frase que sitúe la ficha',
        role: 'Papel en la historia',
        rolePrimary: 'Protagonista',
        roleSecondary: 'Secundario',
        submit: 'Crear ficha',
      },
      empty: {
        title: 'Estado vacío en una página',
        note: 'Se coloca donde iría el contenido y ofrece siempre la acción que lo llena.',
        heading: 'Ningún mapa todavía',
        body: 'Cuando dibujes el primer mapa, aparecerá aquí con sus capas y sus marcadores.',
      },
      header: {
        title: 'Cabecera con migajas',
        note: 'En móvil solo se ven el padre y la página actual; el resto aparece al ganar ancho.',
      },
    },
    accessibility: {
      tabOrderTitle: 'Orden de tabulación',
      tabOrderNote:
        'El orden del documento es el orden del teclado: salto al contenido, topbar, navegación lateral y contenido. Nada de tabindex positivos.',
      tabOrder: [
        'El enlace de salto es lo primero que recibe el foco y lleva al contenido.',
        'Después, la marca y las acciones de la topbar.',
        'Luego, la navegación lateral o la barra inferior, según el ancho.',
        'Por último, el contenido de la página y sus enlaces internos.',
      ],
      focusTitle: 'Foco visible',
      focusNote:
        'Todos los controles comparten un anillo de foco de 2 px con contraste suficiente en los dos temas. Ningún componente lo desactiva sin sustituto.',
      focusAction: 'Botón para probar el foco',
      keysTitle: 'Teclas',
      keysNote:
        'Los componentes interactivos se manejan con el teclado estándar; no hay gestos exclusivos del ratón.',
      keys: [
        {
          keys: 'Tab',
          action:
            'Avanza al siguiente control y mantiene el foco dentro de diálogos y paneles.',
        },
        {
          keys: 'Esc',
          action:
            'Cierra el diálogo, el panel o la paleta y devuelve el foco a quien los abrió.',
        },
        {
          keys: 'Flechas',
          action: 'Mueven la selección en pestañas y en la paleta de comandos.',
        },
        {
          keys: 'Inicio y Fin',
          action: 'Saltan al primer o al último elemento de la lista activa.',
        },
        {
          keys: 'Enter',
          action: 'Activa el elemento seleccionado sin cerrar el contexto.',
        },
        {
          keys: 'Ctrl + K',
          action: 'Abre y cierra la paleta de comandos desde cualquier punto.',
        },
      ],
      colorTitle: 'El color no es la única señal',
      colorNote:
        'Los estados combinan texto, icono y tono. Si se desaturan los dos temas, la información sigue estando ahí.',
      motionTitle: 'Movimiento reducido',
      motionNote:
        'Con prefers-reduced-motion activo no se declara ninguna animación: diálogos, paneles y avisos aparecen en su sitio sin desplazarse.',
    },
    captures: {
      note: 'Cuatro PNG de la primera pantalla del taller en los dos temas, generados con Playwright desde esta misma página y versionados para compararlos entre entregas. Muestran el shell real: topbar, rail, barra inferior móvil y el inicio de los fundamentos.',
      regenerate: 'Se regeneran con «pnpm design:captures».',
      paths: [
        'docs/diseno/capturas/design-system-1280-light.png',
        'docs/diseno/capturas/design-system-1280-dark.png',
        'docs/diseno/capturas/design-system-360-light.png',
        'docs/diseno/capturas/design-system-360-dark.png',
      ],
    },
  },
} as const;
