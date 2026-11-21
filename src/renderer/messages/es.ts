/**
 * Mensajes visibles del renderer.
 *
 * Todo el texto de interfaz pasa por aquí para que esté centralizado, tipado y
 * preparado para añadir más idiomas sin tocar los componentes (ADR 0009). Este
 * archivo es la fuente del tipo `MessageCatalog`; el traductor, el proveedor y
 * los formatos con `Intl` viven en `index.ts`, `translator.ts` y
 * `src/renderer/i18n/`. Los mensajes con parámetros son funciones puras.
 *
 * Convención de ejemplo: los textos de la página de muestras describen un
 * mundo ficticio plausible («Las Mareas Grises»), nunca datos reales.
 */
export const es = {
  app: {
    title: 'World Craft',
  },
  shell: {
    skipToContent: 'Saltar al contenido principal',
    brandName: 'World Craft',
    railLabel: 'Barra lateral de la aplicación',
    navigationLabel: 'Navegación principal',
    views: {
      home: 'Inicio',
      search: 'Búsqueda',
      worlds: 'Mundos',
      world: 'Mundo',
      entities: 'Fichas',
      entity: 'Ficha',
      samples: 'Muestras',
    },
    collapse: 'Plegar menú lateral',
    expand: 'Expandir menú lateral',
    searchTrigger: 'Buscar',
    searchShortcut: 'Ctrl+K',
    viewMenuLabel: 'Más acciones de la vista',
    quickCreate: 'Crear una ficha',
    theme: {
      currentLight: 'Claro',
      currentDark: 'Oscuro',
      switchLabel: (current: string): string =>
        `Cambiar el tema de la interfaz. Tema actual: ${current}`,
    },
  },
  home: {
    continueTitle: 'Continuar',
    continueWorldAction: 'Abrir el mundo',
    continueEntityAction: 'Abrir la ficha',
    continueEntityFallback: 'Última ficha abierta',
    continueEntityMeta: (worldName: string): string => `en «${worldName}»`,
    recentTitle: 'Mundos recientes',
    seeAll: 'Ver todos los mundos',
    activityTitle: 'Actividad reciente',
    activityEmpty: 'Todavía no hay actividad registrada.',
    loading: 'Cargando tus mundos…',
    errorTitle: 'No se pudieron cargar los mundos',
    errorDescription:
      'La aplicación no pudo leer la lista de mundos. Vuelve a intentarlo; tus datos siguen guardados en este equipo.',
    retry: 'Volver a intentar',
    emptyTitle: 'Todavía no hay ningún mundo',
    emptyDescription:
      'Un mundo reúne las fichas, las relaciones, los mapas y el manuscrito de tu historia. Cuando crees el primero aparecerá aquí, con su portada, su descripción y los accesos a cada sección.',
    emptyAction: 'Crear mundo',
    nextStepsTitle: 'Qué podrás hacer cuando exista el primer mundo',
    nextSteps: [
      'Escribir fichas de personajes, lugares y organizaciones con sus campos y etiquetas.',
      'Unir fichas con relaciones y ver el conjunto en el grafo de la historia.',
      'Dibujar mapas por capas y enlazarlos a los lugares del mundo.',
      'Redactar el manuscrito por libros, capítulos y escenas, con contador de palabras.',
    ],
    note: 'Tus datos se quedan en este equipo, en una carpeta propia que sobrevive a las actualizaciones de la aplicación.',
  },
  worlds: {
    status: {
      active: 'Activo',
      archived: 'Archivado',
    },
    actions: {
      create: 'Crear mundo',
    },
    languages: {
      es: 'Español',
      en: 'Inglés',
      it: 'Italiano',
    },
    dashboard: {
      retry: 'Volver a intentar',
    },
    list: {
      lead: 'Todos los mundos de este equipo. Puedes buscar por nombre o resumen y filtrar por estado.',
      searchLabel: 'Buscar mundos',
      searchPlaceholder: 'Nombre o resumen',
      statusLabel: 'Estado',
      statusAll: 'Todos',
      statusActive: 'Activos',
      statusArchived: 'Archivados',
      count: {
        one: '{count} mundo',
        other: '{count} mundos',
      },
      resultsTitle: 'Resultados de mundos',
      emptyTitle: 'Todavía no hay ningún mundo',
      emptyDescription:
        'Crea el primer mundo para empezar a reunir fichas, mapas y manuscritos en un mismo lugar.',
      emptyFilterTitle: 'Ningún mundo coincide con el filtro',
      emptyFilterDescription:
        'Prueba con otro texto o cambia el filtro de estado para ver más mundos.',
      clearFilters: 'Quitar filtros',
      loading: 'Cargando la lista de mundos…',
      errorTitle: 'No se pudo cargar la lista de mundos',
      errorDescription:
        'La aplicación no pudo leer la lista. Vuelve a intentarlo; tus datos siguen guardados.',
      retry: 'Volver a intentar',
    },
    card: {
      open: 'Abrir',
      openNamed: (name: string): string => `Abrir el mundo «${name}»`,
      edit: 'Editar',
      duplicate: 'Duplicar',
      archive: 'Archivar',
      restore: 'Restaurar',
      delete: 'Eliminar',
      actionsNamed: (name: string): string => `Más acciones de «${name}»`,
      relativeUpdated: (relative: string): string => `Actualizado ${relative}`,
      noSummary: 'Sin resumen todavía.',
    },
    detail: {
      back: 'Volver a Inicio',
      loading: 'Cargando el mundo…',
      errorTitle: 'No se pudo cargar el mundo',
      errorDescription:
        'Puede que el mundo se haya movido a la papelera o que la lectura haya fallado. Vuelve a Inicio e inténtalo de nuevo.',
      errorBack: 'Volver a Inicio',
      noSummary: 'Sin resumen todavía.',
      noDescription:
        'Este mundo todavía no tiene descripción. Puedes añadirla con el botón Editar.',
      metadataTitle: 'Datos del mundo',
      created: (date: string): string => `Creado el ${date}`,
      updated: (date: string): string => `Actualizado el ${date}`,
      language: (language: string): string =>
        `Idioma del contenido: ${language}`,
      slug: (slug: string): string => `Identificador: ${slug}`,
      progressTitle: 'Preparación del mundo',
      progressLead:
        'Completa la ficha del mundo para que sea fácil reconocerlo en la lista y en las exportaciones.',
      progressValue: (done: number, total: number): string =>
        `${done} de ${total} campos completados`,
      progressPercent: (percent: string): string =>
        `Preparación de la ficha: ${percent}`,
      progressDone: 'Completado',
      progressPending: 'Pendiente',
      fields: {
        name: 'Nombre',
        summary: 'Resumen',
        description: 'Descripción',
        genres: 'Géneros',
        language: 'Idioma',
      },
      activityTitle: 'Actividad de este mundo',
      activityLead:
        'Solo se muestran las acciones de este mundo. El contenido de otros mundos no aparece aquí.',
      activityEmpty: 'Todavía no hay actividad en este mundo.',
      activityError: 'No se pudo cargar la actividad de este mundo.',
      quickTitle: 'Accesos rápidos',
      quickLead:
        'Las demás secciones del mundo llegarán con las próximas versiones. Mientras tanto, la ficha del mundo ya funciona.',
      quickPlanned: 'Previsto',
      quick: {
        entities: {
          title: 'Fichas',
          description:
            'Personajes, lugares, organizaciones y objetos del mundo.',
        },
        maps: {
          title: 'Mapas',
          description: 'Mapas por capas y vínculos entre lugares y fichas.',
        },
        manuscripts: {
          title: 'Manuscrito',
          description: 'Libros, capítulos y escenas con contador de palabras.',
        },
        game: {
          title: 'Juego',
          description: 'Dados, tablas de inspiración y sesiones del mundo.',
        },
      },
    },
    form: {
      createTitle: 'Crear un mundo',
      editTitle: (name: string): string => `Editar «${name}»`,
      nameLabel: 'Nombre del mundo',
      namePlaceholder: 'Por ejemplo, Las Mareas Grises',
      nameRequired: 'Escribe un nombre para el mundo.',
      slugLabel: 'Identificador',
      slugHint:
        'Se usa en rutas y exportaciones. En un mundo nuevo, si lo dejas vacío se genera a partir del nombre. En uno existente se conserva salvo que escribas otro.',
      slugInvalid:
        'Usa solo minúsculas, números y guiones simples; por ejemplo, mareas-grises.',
      summaryLabel: 'Resumen',
      summaryHint:
        'Una o dos frases para reconocer el mundo en la lista. Máximo 280 caracteres.',
      descriptionLabel: 'Descripción',
      descriptionHint: 'Máximo 4.000 caracteres.',
      genresLabel: 'Géneros',
      genresHint:
        'Separa los géneros con comas. Máximo 8, de 40 caracteres cada uno.',
      genresInvalid:
        'Usa como máximo 8 géneros de 40 caracteres cada uno, separados por comas.',
      languageLabel: 'Idioma del mundo',
      coverNote:
        'La portada se podrá elegir cuando exista la galería de imágenes del mundo.',
      submitCreate: 'Crear mundo',
      submitEdit: 'Guardar cambios',
      cancel: 'Cancelar',
      formError: 'Revisa los datos del formulario. El mundo no se ha guardado.',
    },
    duplicate: {
      title: 'Duplicar mundo',
      body: (name: string): string =>
        `Se creará un mundo nuevo a partir de «${name}». La portada no se copia.`,
      nameLabel: 'Nombre del mundo nuevo',
      defaultName: (name: string): string => `${name} — copia`,
      submit: 'Duplicar',
      cancel: 'Cancelar',
    },
    confirm: {
      archiveTitle: (name: string): string => `Archivar «${name}»`,
      archiveBody:
        'El mundo se ocultará de la lista de activos, pero no se borrará nada. Podrás restaurarlo cuando quieras.',
      archiveSubmit: 'Archivar',
      restoreTitle: (name: string): string => `Restaurar «${name}»`,
      restoreBody:
        'El mundo volverá a la lista de mundos activos y seguirá con todo su contenido.',
      restoreSubmit: 'Restaurar',
      deleteTitle: (name: string): string => `Eliminar «${name}»`,
      deleteBody:
        'El mundo se moverá a la papelera y dejará de aparecer en Inicio y Mundos. Podrás recuperarlo desde la papelera cuando esté disponible.',
      deleteSubmit: 'Mover a la papelera',
      cancel: 'Cancelar',
    },
    notices: {
      created: (name: string): string => `Se ha creado el mundo «${name}».`,
      updated: (name: string): string =>
        `Se han guardado los cambios de «${name}».`,
      duplicated: (name: string): string => `Se ha creado el mundo «${name}».`,
      archived: (name: string): string => `Se ha archivado «${name}».`,
      restored: (name: string): string => `Se ha restaurado «${name}».`,
      deleted: (name: string): string =>
        `«${name}» se ha movido a la papelera.`,
      failed:
        'No se pudo completar la acción. Tus datos siguen guardados; vuelve a intentarlo.',
      notFound:
        'El mundo ya no existe o se ha movido a la papelera. Actualiza la lista.',
      invalid: 'Revisa los datos del formulario e inténtalo de nuevo.',
    },
    activity: {
      loading: 'Cargando la actividad…',
      retry: 'Volver a intentar',
      actions: {
        created: 'Mundo creado',
        updated: 'Mundo actualizado',
        archived: 'Mundo archivado',
        restored: 'Mundo restaurado',
        duplicated: 'Mundo duplicado',
        deleted: 'Mundo movido a la papelera',
      },
    },
  },
  entities: {
    status: {
      active: 'Activa',
      draft: 'Borrador',
      archived: 'Archivada',
    },
    statusFilter: {
      all: 'Todos los estados',
      active: 'Activas',
      draft: 'Borradores',
      archived: 'Archivadas',
    },
    list: {
      title: 'Fichas del mundo',
      lead: 'Personajes, lugares, organizaciones y todo lo que forma la enciclopedia de este mundo.',
      searchLabel: 'Buscar fichas',
      searchPlaceholder: 'Nombre, alias o contenido',
      filtersLabel: 'Filtros de fichas',
      typeLabel: 'Tipo',
      typeAll: 'Todos los tipos',
      tagLabel: 'Etiqueta',
      tagAll: 'Todas las etiquetas',
      favoriteLabel: 'Solo favoritas',
      statusLabel: 'Estado',
      count: (count: number): string =>
        count === 1 ? '1 ficha' : `${count} fichas`,
      emptyTitle: 'Todavía no hay fichas',
      emptyDescription:
        'Crea la primera ficha para empezar a reunir personajes, lugares y todo lo que necesitas recordar.',
      emptyFilterTitle: 'Ninguna ficha coincide con el filtro',
      emptyFilterDescription:
        'Prueba con otro texto o quita algún filtro para ver más fichas.',
      clearFilters: 'Quitar filtros',
      loading: 'Cargando las fichas…',
      errorTitle: 'No se pudieron cargar las fichas',
      errorDescription:
        'La aplicación no pudo leer las fichas de este mundo. Vuelve a intentarlo; tus datos siguen guardados.',
      retry: 'Volver a intentar',
      create: 'Nueva ficha',
      manageTypes: 'Gestionar tipos',
      menuLabel: 'Acciones de las fichas',
      noTypes: 'Este mundo no tiene tipos disponibles.',
      typesError: 'No se pudieron cargar los tipos del mundo.',
      worldMissing: 'Abre un mundo para ver sus fichas.',
      backToWorld: 'Volver al mundo',
    },
    card: {
      open: 'Abrir ficha',
      openNamed: (name: string): string => `Abrir la ficha ${name}`,
      favorite: 'Marcar como favorita',
      unfavorite: 'Quitar de favoritas',
      favoriteNamed: (name: string): string => `Marcar ${name} como favorita`,
      unfavoriteNamed: (name: string): string => `Quitar ${name} de favoritas`,
      noSummary: 'Sin resumen todavía.',
      updated: (date: string): string => `Actualizada el ${date}`,
      gallery: (count: number): string =>
        count === 1 ? '1 imagen' : `${count} imágenes`,
      edit: 'Editar',
    },
    create: {
      title: 'Nueva ficha',
      lead: 'Elige el tipo, ponle un nombre y añade el resto cuando quieras. Se guarda en este mundo.',
      typeLabel: 'Tipo de ficha',
      nameLabel: 'Nombre',
      namePlaceholder: 'Nombre de la ficha',
      summaryLabel: 'Resumen',
      summaryPlaceholder: 'Una línea para recordar de qué trata',
      submit: 'Crear ficha',
      cancel: 'Cancelar',
      created: (name: string): string => `Ficha ${name} creada.`,
    },
    quick: {
      button: 'Nueva ficha',
      title: 'Creación rápida de ficha',
      lead: 'Elige un mundo, un tipo y un nombre. Podrás completar la ficha justo después.',
      worldLabel: 'Mundo',
      worldPlaceholder: 'Elige un mundo',
      typesLoading: 'Cargando los tipos del mundo…',
      submit: 'Crear y abrir',
      cancel: 'Cancelar',
      error: 'No se pudo crear la ficha. Revisa el mundo, el tipo y el nombre.',
    },
    detail: {
      back: 'Volver a las fichas',
      loading: 'Cargando la ficha…',
      errorTitle: 'No se pudo abrir la ficha',
      errorDescription:
        'La ficha no existe o ya no está disponible. Vuelve a la lista; tus datos siguen guardados.',
      retry: 'Volver a intentar',
      nameLabel: 'Nombre',
      aliasesLabel: 'Alias',
      aliasesHint: 'Separa los alias con comas.',
      summaryLabel: 'Resumen',
      descriptionLabel: 'Descripción',
      descriptionHint:
        'Formato básico y enlaces internos a otras fichas de este mundo.',
      attributesTitle: 'Campos del tipo',
      attributesEmpty: 'Este tipo no tiene campos adicionales.',
      statusLabel: 'Estado',
      imageTitle: 'Imagen principal',
      imageEmpty: 'Todavía no hay imagen principal.',
      chooseMain: 'Elegir imagen',
      changeMain: 'Cambiar imagen',
      galleryTitle: 'Galería',
      galleryEmpty: 'Añade imágenes para ilustrar la ficha.',
      addImages: 'Añadir imágenes',
      importing: 'Importando imágenes…',
      removeImage: 'Quitar de la galería',
      removeImageNamed: (alt: string): string =>
        `Quitar ${alt || 'la imagen'} de la galería`,
      setMain: 'Usar como principal',
      setMainNamed: (alt: string): string =>
        `Usar ${alt || 'la imagen'} como principal`,
      imageOption: (index: number): string => `Imagen ${index}`,
      mainBadge: 'Principal',
      tagsTitle: 'Etiquetas',
      tagsEmpty: 'Sin etiquetas.',
      tagsLimit: (max: number): string =>
        `Has alcanzado el máximo de ${max} etiquetas por ficha.`,
      removeTagNamed: (name: string): string =>
        `Quitar la etiqueta ${name} de la ficha`,
      newTag: 'Nueva etiqueta',
      menuLabel: 'Acciones de la ficha',
      delete: 'Mover a la papelera',
      deleteTitle: (name: string): string => `¿Mover «${name}» a la papelera?`,
      deleteBody:
        'La ficha dejará de aparecer en la lista. La papelera visible y la restauración llegan con la siguiente entrega.',
      deleteSubmit: 'Mover a la papelera',
      deleted: (name: string): string => `Ficha ${name} movida a la papelera.`,
      save: 'Guardar ahora',
      saving: 'Guardando…',
      saved: 'Guardado',
      unsaved: 'Cambios sin guardar',
      saveError: 'No se pudo guardar. Tus cambios siguen en pantalla.',
      notFound: 'La ficha ya no existe.',
      invalid: 'Revisa los campos marcados antes de guardar.',
      imageError: 'No se pudieron importar las imágenes.',
      noImages:
        'Todavía no hay imágenes en este mundo. Añade una para empezar.',
      favorite: 'Marcar como favorita',
      unfavorite: 'Quitar de favoritas',
    },
    attributes: {
      required: 'Obligatorio',
      emptyOption: 'Sin valor',
      textMax: (max: number): string => `Máximo ${max} caracteres.`,
      referenceEmpty: 'Sin ficha',
      referenceNone: 'No hay fichas de ese tipo.',
      errors: {
        required: 'Este campo es obligatorio.',
        'unknown-field': 'Este campo no pertenece al tipo.',
        'invalid-text': 'Escribe un texto válido.',
        'text-too-long': 'El texto es demasiado largo.',
        'invalid-number': 'Escribe un número válido.',
        'number-too-small': 'El número es demasiado pequeño.',
        'number-too-large': 'El número es demasiado grande.',
        'invalid-date': 'Escribe una fecha válida.',
        'invalid-option': 'Elige una opción válida.',
        'invalid-reference': 'Elige una ficha válida.',
      },
    },
    editor: {
      label: 'Editor de descripción',
      bold: 'Negrita',
      boldShort: 'B',
      italic: 'Cursiva',
      italicShort: 'I',
      headingShort: (level: number): string => `H${level}`,
      heading1: 'Título 1',
      heading2: 'Título 2',
      heading3: 'Título 3',
      bulletList: 'Lista con viñetas',
      orderedList: 'Lista numerada',
      quote: 'Cita',
      link: 'Enlace a una ficha',
      linkOpen: 'Abrir enlace',
      linkRemove: 'Quitar enlace',
      linkTitle: 'Enlazar a una ficha',
      linkLead: 'Elige una ficha de este mundo para enlazarla desde el texto.',
      linkSearch: 'Buscar ficha',
      linkEmpty: 'No hay fichas que coincidan.',
      linkSubmit: 'Insertar enlace',
      linkCancel: 'Cancelar',
      placeholder: 'Escribe la descripción de la ficha…',
      linkNotAllowed:
        'Solo se permiten enlaces internos a fichas de este mundo.',
    },
    tags: {
      title: 'Nueva etiqueta',
      lead: 'Las etiquetas agrupan fichas de este mundo y se pueden filtrar desde la lista.',
      nameLabel: 'Nombre',
      namePlaceholder: 'Nombre de la etiqueta',
      colorLabel: 'Color',
      submit: 'Crear etiqueta',
      cancel: 'Cancelar',
      created: (name: string): string => `Etiqueta ${name} creada.`,
      error: 'No se pudo crear la etiqueta.',
      colors: {
        moss: 'Bosque',
        ochre: 'Arena',
        danger: 'Terracota',
        prussian: 'Pizarra',
      },
    },
    types: {
      title: 'Tipos de ficha',
      lead: 'Los tipos del sistema son iguales en todos los mundos y no se editan. Duplica uno para ajustar sus campos en este mundo.',
      systemBadge: 'Del sistema',
      customBadge: 'Personalizado',
      fieldCount: (count: number): string =>
        count === 1 ? '1 campo' : `${count} campos`,
      create: 'Crear tipo',
      duplicate: 'Duplicar',
      duplicateNamed: (name: string): string => `Duplicar el tipo ${name}`,
      edit: 'Editar',
      editNamed: (name: string): string => `Editar el tipo ${name}`,
      remove: 'Borrar',
      removeNamed: (name: string): string => `Borrar el tipo ${name}`,
      removeTitle: (name: string): string => `¿Borrar el tipo «${name}»?`,
      removeBody:
        'El tipo dejará de estar disponible para crear fichas nuevas. Las fichas existentes conservan su contenido.',
      removeSubmit: 'Borrar tipo',
      removeBlocked:
        'No se puede borrar un tipo que todavía tiene fichas. Cambia esas fichas de tipo o bórralas primero.',
      nameLabel: 'Nombre',
      keyLabel: 'Clave',
      keyHint: 'Minúsculas, números y guiones. No cambia al editar.',
      iconLabel: 'Icono',
      colorLabel: 'Color',
      fieldsTitle: 'Campos',
      fieldsEmpty: 'Este tipo no tiene campos personalizados.',
      fieldsLockedHint:
        'Si el tipo ya tiene fichas, no puedes quitar campos ni cambiar su tipo; sí puedes ajustar etiquetas, opciones y añadir campos.',
      addField: 'Añadir campo',
      removeField: 'Quitar campo',
      removeFieldNamed: (label: string): string => `Quitar el campo ${label}`,
      fieldLabel: 'Etiqueta',
      fieldKey: 'Clave',
      fieldType: 'Tipo de campo',
      fieldRequired: 'Obligatorio',
      fieldOptions: 'Opciones',
      fieldOptionsHint: 'Una por línea, con el formato «valor: Etiqueta».',
      fieldMin: 'Mínimo',
      fieldMax: 'Máximo',
      fieldTarget: 'Tipo de destino',
      fieldTargetAny: 'Cualquier tipo',
      fieldTypeNames: {
        text: 'Texto',
        number: 'Número',
        date: 'Fecha',
        select: 'Selección',
        reference: 'Referencia a ficha',
      },
      save: 'Guardar tipo',
      createSubmit: 'Crear tipo',
      cancel: 'Cancelar',
      created: (name: string): string => `Tipo ${name} creado.`,
      updated: (name: string): string => `Tipo ${name} actualizado.`,
      removed: (name: string): string => `Tipo ${name} borrado.`,
      duplicateTitle: (name: string): string => `Duplicar «${name}»`,
      duplicateLead:
        'Se creará una copia editable en este mundo con la misma plantilla de campos.',
      duplicateNameLabel: 'Nombre del nuevo tipo',
      duplicateSubmit: 'Duplicar tipo',
      error: 'Revisa los datos del tipo e inténtalo de nuevo.',
      loading: 'Cargando los tipos…',
      errorLoad: 'No se pudieron cargar los tipos.',
      close: 'Cerrar',
      noIcon: 'Icono',
      icons: {
        'book-open': 'Libro abierto',
        'building-2': 'Edificio',
        'calendar-days': 'Calendario',
        church: 'Templo',
        compass: 'Brújula',
        cpu: 'Circuito',
        crown: 'Corona',
        dna: 'ADN',
        flag: 'Bandera',
        gem: 'Gema',
        languages: 'Idiomas',
        leaf: 'Hoja',
        lightbulb: 'Bombilla',
        'map-pin': 'Marcador de mapa',
        package: 'Paquete',
        palette: 'Paleta',
        'paw-print': 'Huella',
        scroll: 'Pergamino',
        shield: 'Escudo',
        skull: 'Calavera',
        sparkles: 'Destellos',
        star: 'Estrella',
        sun: 'Sol',
        swords: 'Espadas',
        tent: 'Tienda',
        'user-round': 'Persona',
        users: 'Grupo',
        waves: 'Olas',
        wind: 'Viento',
        zap: 'Rayo',
      },
    },
    notices: {
      created: (name: string): string => `Ficha ${name} creada.`,
      updated: 'Ficha guardada.',
      favorite: (name: string): string => `${name} está en favoritas.`,
      unfavorite: (name: string): string => `${name} ya no está en favoritas.`,
      removed: (name: string): string => `Ficha ${name} movida a la papelera.`,
      failed: 'No se pudo completar la acción. Tus datos siguen guardados.',
      invalid: 'Revisa los datos e inténtalo de nuevo.',
      notFound: 'La ficha ya no existe o se ha movido a la papelera.',
    },
    relations: {
      title: 'Relaciones',
      lead: 'Une esta ficha con otras del mundo. Cada relación se lee con una etiqueta desde el origen y con su inversa desde el destino.',
      outgoingTitle: 'Desde esta ficha',
      incomingTitle: 'Backlinks',
      incomingLead:
        'Fichas que apuntan a esta; la etiqueta es la inversa de cada relación.',
      empty:
        'Todavía no hay relaciones. Une esta ficha con otra para empezar a tejer el mundo.',
      outgoingEmpty: 'Esta ficha todavía no apunta a ninguna otra.',
      incomingEmpty: 'Ninguna ficha apunta todavía a esta.',
      add: 'Añadir relación',
      manageTypes: 'Tipos de relación',
      edit: 'Editar',
      editNamed: (label: string, name: string): string =>
        `Editar la relación «${label}» con ${name}`,
      remove: 'Eliminar',
      removeNamed: (label: string, name: string): string =>
        `Eliminar la relación «${label}» con ${name}`,
      removeTitle: (label: string, name: string): string =>
        `¿Eliminar la relación «${label}» con ${name}?`,
      removeBody:
        'La relación desaparecerá de las dos fichas. Las fichas y sus datos no se borran.',
      removeSubmit: 'Eliminar relación',
      strength: (value: number): string => `Fuerza ${value} de 5`,
      notesLabel: 'Notas',
      typeLabel: 'Tipo de relación',
      typeHint: (forward: string, inverse: string): string =>
        `Directa: ${forward} · Inversa: ${inverse}`,
      targetLabel: 'Ficha de destino',
      targetPlaceholder: 'Elige una ficha',
      searchLabel: 'Buscar ficha de destino',
      searchPlaceholder: 'Nombre o alias',
      noCandidates: 'No hay otras fichas en este mundo.',
      noMatches: 'No hay fichas que coincidan con la búsqueda.',
      labelLabel: 'Etiqueta directa',
      labelHint: 'Opcional. Si la dejas vacía se usa el nombre del tipo.',
      inverseLabelLabel: 'Etiqueta inversa',
      inverseLabelHint: 'Opcional. Es la que se verá en la ficha de destino.',
      strengthLabel: 'Fuerza',
      strengthOptions: {
        '1': '1 · Apenas relevante',
        '2': '2 · Menor',
        '3': '3 · Importante',
        '4': '4 · Muy importante',
        '5': '5 · Esencial',
      },
      createTitle: 'Añadir relación',
      createLead:
        'Elige el tipo y la ficha de destino. Podrás ajustar la etiqueta y la fuerza.',
      editTitle: 'Editar relación',
      editLead:
        'Cambia el tipo, las etiquetas, las notas o la fuerza. El origen y el destino no cambian.',
      submitCreate: 'Crear relación',
      submitEdit: 'Guardar relación',
      cancel: 'Cancelar',
      created: (label: string, name: string): string =>
        `Relación creada: ${label} ${name}.`,
      updated: 'Relación guardada.',
      removed: 'Relación eliminada.',
      error: 'Revisa los datos de la relación e inténtalo de nuevo.',
      deleteError: 'No se pudo eliminar la relación.',
      loading: 'Cargando las relaciones…',
      loadError: 'No se pudieron cargar las relaciones.',
      retry: 'Volver a intentar',
      backlinkHint: (name: string): string => `Se lee desde ${name}`,
      relationWith: (name: string): string => `Relación con ${name}`,
      types: {
        title: 'Tipos de relación',
        lead: 'Los tipos del sistema son iguales en todos los mundos y no se editan. Crea tipos propios para las relaciones que necesite tu historia.',
        systemBadge: 'Del sistema',
        customBadge: 'Personalizado',
        readOnly: 'Solo lectura',
        create: 'Crear tipo',
        edit: 'Editar',
        editNamed: (name: string): string =>
          `Editar el tipo de relación ${name}`,
        remove: 'Borrar',
        removeNamed: (name: string): string =>
          `Borrar el tipo de relación ${name}`,
        removeTitle: (name: string): string =>
          `¿Borrar el tipo de relación «${name}»?`,
        removeBody:
          'El tipo dejará de estar disponible para crear relaciones nuevas. Las relaciones existentes no se tocan.',
        removeSubmit: 'Borrar tipo',
        removeBlocked:
          'No se puede borrar un tipo que todavía tiene relaciones. Elimina antes esas relaciones.',
        nameLabel: 'Etiqueta directa',
        inverseNameLabel: 'Etiqueta inversa',
        keyLabel: 'Clave',
        keyHint: 'Minúsculas, números y guiones. No cambia al editar.',
        colorLabel: 'Color',
        createTitle: 'Crear tipo de relación',
        editTitle: (name: string): string =>
          `Editar el tipo de relación «${name}»`,
        createLead:
          'Define cómo se lee la relación desde el origen y desde el destino.',
        editLead: 'Ajusta las dos etiquetas y el color del tipo.',
        save: 'Guardar tipo',
        createSubmit: 'Crear tipo',
        cancel: 'Cancelar',
        created: (name: string): string => `Tipo de relación ${name} creado.`,
        updated: (name: string): string =>
          `Tipo de relación ${name} actualizado.`,
        removed: (name: string): string => `Tipo de relación ${name} borrado.`,
        error: 'Revisa los datos del tipo e inténtalo de nuevo.',
        loading: 'Cargando los tipos de relación…',
        errorLoad: 'No se pudieron cargar los tipos de relación.',
        close: 'Cerrar',
        colors: {
          moss: 'Bosque',
          ochre: 'Arena',
          danger: 'Terracota',
          prussian: 'Pizarra',
        },
      },
    },
  },
  samples: {
    lead: 'Banco interno del sistema de diseño v2. Reúne la paleta y los roles semánticos, la tipografía, las primitivas con sus estados y contenido largo, para comprobar en Claro y Oscuro que nada se sale de su contenedor ni pierde contraste.',
    palette: {
      title: 'Paleta y roles',
      lead: 'Cada muestra pinta un rol semántico real. Las superficies cambian con el tema y el texto principal conserva el contraste AA en ambos.',
      surfacesTitle: 'Superficies',
      surfaces: {
        bg: 'Fondo de ventana',
        surface: 'Paneles y tarjetas',
        raised: 'Diálogos y menús',
        sunken: 'Zonas hundidas',
      },
      accentsTitle: 'Acento, foco y selección',
      accents: {
        accent: 'Acento y acción primaria',
        accentSurface: 'Superficie de acento',
        focus: 'Anillo de foco',
        selection: 'Selección de texto',
      },
      statesTitle: 'Estados',
      states: {
        success: 'Éxito',
        warning: 'Aviso',
        danger: 'Peligro',
      },
      contrastNote:
        'El texto principal supera 13:1 sobre las superficies y el secundario 4,5:1 en los dos temas.',
    },
    typography: {
      title: 'Tipografía y lectura',
      lead: 'Source Serif 4 viaja con la aplicación en dos cortes locales. La interfaz y los datos usan pilas del sistema y nunca descargan fuentes.',
      uiTitle: 'Interfaz y datos',
      uiBody:
        'La navegación, los formularios y los metadatos usan la pila del sistema a 14 px con interlineado 1,5.',
      contentTitle: 'Lectura larga (400)',
      contentBody:
        'La expedición salió del puerto de Punta Sal con tres goletas y una tripulación de cuarenta y dos personas. Durante once semanas recorrió las islas del norte, levantó actas de cada desembarco y dibujó a mano las líneas de bajamar que el atlas oficial daba por definitivas. El cuaderno recoge los nombres que los clanes usan para cada bajío y las tarifas que cobran por guiar barcos.',
      contentStrongTitle: 'Título de contenido (600)',
      contentStrong:
        'Crónica de la expedición al archipiélago de las Mareas Grises',
      monoTitle: 'Datos y código',
      monoValue: 'mareas-grises/costa-norte/capa-de-rutas-1926.geojson',
      charsTitle: 'Caracteres del español',
      chars: 'ÁÉÍÓÚÜÑáéíóúüñ¿¡«»—… €',
      displayTitle: 'Título de pantalla (32 px)',
      displayText: 'Las Mareas Grises',
    },
    iconButtons: {
      title: 'Botones de icono',
      lead: 'El nombre accesible es obligatorio y el tooltip aparece con el foco y con el ratón. El icono nunca es el único indicador: siempre hay una etiqueta accesible.',
      edit: 'Editar ficha',
      editTooltip: 'Abre la ficha de Aldo Varela en modo edición.',
      delete: 'Mover a la papelera',
      favorite: 'Fijar en el mundo',
      favoriteOn: 'Fijada en el mundo',
      more: 'Más acciones',
      loading: 'Guardando la ficha',
    },
    menu: {
      sectionTitle: 'Menú de acciones',
      lead: 'Las acciones secundarias viven en un menú «⋯». Se abre con clic, Enter o Espacio, se recorre con flechas e Inicio/Fin, y se cierra con Escape devolviendo el foco al disparador.',
      trigger: 'Acciones de la ficha',
      edit: 'Editar ficha',
      duplicate: 'Duplicar ficha',
      archive: 'Archivar ficha',
      delete: 'Mover a la papelera',
      disabled: 'Exportar ficha (próximamente)',
      edgeLabel: 'Acciones de la ficha en el borde derecho',
      longLabel: 'Menú con muchas acciones',
      longAction: (index: number): string => `Acción ${index}`,
      editNotice:
        'Se ha abierto la ficha de ejemplo en modo edición. Demostración sin cambios reales.',
      duplicateNotice:
        'Se ha duplicado la ficha de ejemplo. Demostración sin cambios reales.',
      archiveNotice:
        'Se ha archivado la ficha de ejemplo. Demostración sin cambios reales.',
      deleteNotice:
        'La ficha de ejemplo se ha movido a la papelera. Demostración sin cambios reales.',
    },
    buttons: {
      title: 'Botones',
      lead: 'Variantes, tamaños y estados. Un botón cargando se anuncia con aria-busy, queda deshabilitado y muestra un indicador sin texto.',
      primary: 'Crear mundo',
      secondary: 'Exportar mundo',
      ghost: 'Cancelar',
      danger: 'Vaciar papelera',
      small: 'Acción breve',
      loading: 'Guardando',
      disabled: 'No disponible',
    },
    fields: {
      title: 'Campos y controles',
      lead: 'La etiqueta siempre está visible y la ayuda o el error se asocian con aria-describedby. Los controles usan borde fuerte y foco de 2+2 px.',
      normalLabel: 'Nombre del mundo',
      normalValue: 'Las Mareas Grises',
      hintLabel: 'Género y tono',
      hint: 'Una frase breve que ayuda a recordar de qué trata el mundo.',
      errorLabel: 'Año de la crónica',
      errorValue: 'mil ochocientos',
      error: 'Escribe un año de cuatro cifras, por ejemplo 1926.',
      disabledLabel: 'Identificador interno',
      disabledValue: 'mundo-0001',
      readonlyLabel: 'Ruta de la copia',
      readonlyValue: 'copias/2026-11-18/mareas-grises.json',
      requiredLabel: 'Autor de la crónica',
      requiredPlaceholder: 'Nombre y apellidos',
      areaLabel: 'Descripción de la escena',
      areaValue:
        'La marea baja dejó al descubierto las losas del muelle viejo. Aldo anotó la hora y el nivel del agua antes de que el viento borrara las marcas.',
      selectLabel: 'Estado de la ficha',
      selectActive: 'Activa',
      selectDraft: 'Borrador',
      selectArchived: 'Archivada',
      checkboxLabel: 'Mostrar la ficha en el mapa',
      checkboxHint:
        'La marca del mapa usa el color del tipo, nunca solo el color.',
      checkboxErrorLabel: 'Aceptar los pactos de sal',
      checkboxError: 'Debes aceptar los pactos antes de publicar la ficha.',
      radioLegend: 'Tono de la crónica',
      radioOne: 'Épico',
      radioTwo: 'Íntimo',
      radioThree: 'Documental',
      radioHint:
        'El tono ajusta el ejemplo de escritura, no los datos de la ficha.',
      radioError: 'Elige un tono para la crónica.',
    },
    badges: {
      title: 'Insignias',
      lead: 'El tono nunca es el único indicador: cada insignia lleva siempre su texto.',
      neutral: 'Borrador',
      accent: 'En revisión',
      success: 'Publicado',
      warning: 'Faltan datos',
      danger: 'Con error',
    },
    card: {
      sectionTitle: 'Tarjeta',
      title: 'Ficha de ejemplo: Aldo Varela',
      body: 'Cartógrafo del archipiélago, especializado en costas de marea y rutas de balleneros. Mantiene un cuaderno de bitácora con los pactos de sal firmados por los clanes del norte.',
      badge: 'Personaje',
      plainTitle: 'Ficha sin tono: Mira Solís',
      plainBody:
        'Cartógrafa rival, especializada en costas occidentales y disputas de límites. La tarjeta sin tono se separa por superficie y espacio, sin borde ni sombra.',
      menuLabel: 'Acciones de la tarjeta',
      editNotice:
        'Se ha abierto la tarjeta de ejemplo en modo edición. Demostración sin cambios reales.',
      duplicateNotice:
        'Se ha duplicado la tarjeta de ejemplo. Demostración sin cambios reales.',
      deleteNotice:
        'La tarjeta de ejemplo se ha movido a la papelera. Demostración sin cambios reales.',
    },
    tabs: {
      sectionTitle: 'Pestañas',
      label: 'Secciones de la ficha de ejemplo',
      summary: {
        label: 'Resumen',
        body: 'Aldo Varela nació en el faro de Punta Sal y aprendió a leer las mareas antes que las letras. Su mapa del archipiélago sigue incompleto porque la costa cambia con cada invierno.',
      },
      relations: {
        label: 'Relaciones',
        body: 'Trabaja para la cofradía de balleneros del norte y mantiene una disputa antigua con la cartógrafa Mira Solís por los límites de la costa occidental.',
      },
      notes: {
        label: 'Notas',
        body: 'Pendiente: decidir si el cuaderno de bitácora es una ficha propia o una sección de esta ficha.',
      },
    },
    dialog: {
      sectionTitle: 'Diálogo',
      open: 'Abrir diálogo de ejemplo',
      title: 'Mover la ficha Aldo Varela a la papelera',
      body: 'La ficha se moverá a la papelera y podrás restaurarla durante treinta días. Las relaciones con otras fichas se conservarán.',
      iconLabel: 'Copiar el identificador de la ficha',
      iconTooltip:
        'Copia el identificador interno completo de la ficha para pegarlo en otro lugar.',
      menuLabel: 'Acciones dentro del diálogo',
      cancel: 'Cancelar',
      confirm: 'Mover a la papelera',
      confirmed:
        'La ficha de ejemplo se ha movido a la papelera. Es una demostración: no se ha borrado nada real.',
    },
    tooltip: {
      sectionTitle: 'Ayuda emergente',
      label: 'Abre el panel de capas del mapa. Atajo: Ctrl+L.',
      trigger: 'Capas',
    },
    toasts: {
      title: 'Avisos',
      lead: 'Sin temporizadores: cada aviso se cierra a mano y se anuncia en una región aria-live.',
      infoButton: 'Mostrar aviso informativo',
      successButton: 'Mostrar aviso de éxito',
      errorButton: 'Mostrar aviso de error',
      info: 'El mapa se ha guardado con los cambios de la última capa.',
      success: 'Copia de seguridad creada en la carpeta del mundo.',
      error:
        'No se pudo exportar el mundo. Revisa el espacio libre del disco y vuelve a intentarlo.',
    },
    empty: {
      sectionTitle: 'Estado vacío',
      title: 'Aquí aparecerán los mundos de muestra',
      description:
        'Esta página aún no tiene datos reales. Cuando exista el primer mundo, se verá como una tarjeta con su portada, su descripción y las secciones disponibles.',
      action: 'Mostrar un aviso de ejemplo',
      actionMessage:
        'Los mundos de muestra llegarán con el primer mundo creado. Esto es solo una demostración del estado vacío.',
    },
    panel: {
      title: 'Panel',
      lead: 'Sección con encabezado real, acciones y pie opcional. Sin borde ni sombra: la jerarquía la dan la superficie y el espacio.',
      panelTitle: 'Propiedades de la ficha',
      panelDescription:
        'Datos que acompañan al documento y se editan en contexto.',
      panelMenuLabel: 'Acciones del panel',
      panelBody:
        'Tipo: Personaje. Estado: Activa. Etiquetas: costa, balleneros, pactos de sal.',
      panelFooter: 'Los cambios del panel se guardan con la ficha.',
      save: 'Guardar cambios',
      editNotice:
        'El panel de ejemplo ha abierto la edición de la ficha. Demostración sin cambios reales.',
      deleteNotice:
        'La ficha del panel de ejemplo se ha movido a la papelera. Demostración sin cambios reales.',
      more: 'Más acciones del panel',
    },
    skeleton: {
      title: 'Carga',
      lead: 'El esqueleto es decorativo y se oculta a los lectores de pantalla. El contenedor anuncia que está ocupado y el resultado llega por la región aria-live del contexto.',
      loading: 'Cargando las fichas del mundo…',
      cardTitle: 'Fichas recientes',
    },
    typeMarks: {
      title: 'Marcas de tipo de entidad',
      lead: 'Los tokens persistidos conservan su nombre. La interfaz los resuelve como marca gráfica sobre una superficie tintada y el texto siempre usa el color principal.',
      moss: 'Bosque',
      ochre: 'Arena',
      danger: 'Terracota',
      prussian: 'Pizarra',
      note: 'Marca y etiqueta con el color persistido; el texto del tipo se lee en el color principal.',
    },
    longContent: {
      title: 'Contenido largo',
      lead: 'Título, párrafo, nombre sin espacios y ruta: nada debe desbordar ni crear desplazamiento horizontal de página.',
      heading:
        'Crónica de la expedición al archipiélago de las Mareas Grises: los pactos de sal, las rutas de los balleneros y el mapa inconcluso del cartógrafo Aldo Varela',
      paragraph:
        'La expedición salió del puerto de Punta Sal con tres goletas y una tripulación de cuarenta y dos personas. Durante once semanas recorrió las islas del norte, levantó actas de cada desembarco y dibujó a mano las líneas de bajamar que el atlas oficial daba por definitivas. El cuaderno recoge los nombres que los clanes usan para cada bajío, las tarifas que cobran por guiar barcos y las historias que cuentan sobre las luces que aparecen en el horizonte cuando la marea cambia de golpe.',
      name: 'AldoVarelaDeLaTorreYDelAmoDelArchipielagoDeLasMareasGrisesYNieblasDelSurOccidentalYDelNorteProfundoYDeLasRutasBallenerasDelSigloDiecinueveYDeLosPactosDeSalFirmadosPorLosClanesDelArchipielagoYDeLaCostaOccidentalYDeSusBajiosYCorrientes',
      path: 'C:\\Users\\cartografa\\Documents\\World Craft\\mundos\\mareas-grises\\mapas\\costa-norte-del-archipielago\\capa-de-rutas-balleneras-1926.geojson',
    },
  },
  search: {
    title: 'Búsqueda global',
    lead: 'Encuentra mundos, fichas y relaciones por su título, su contenido, sus alias o sus notas. Todo se consulta en este equipo, sin conexión.',
    inputLabel: 'Buscar en tu biblioteca',
    inputPlaceholder: 'Nombre, alias, texto o nota…',
    filtersLabel: 'Filtros de búsqueda',
    worldLabel: 'Mundo',
    worldAll: 'Todos los mundos',
    kindLabel: 'Tipo de contenido',
    kindAll: 'Todo el contenido',
    kinds: {
      world: 'Mundos',
      entity: 'Fichas',
      relation: 'Relaciones',
    },
    entityTypeLabel: 'Tipo de ficha',
    entityTypeAll: 'Todos los tipos de ficha',
    entityTypeHint: 'Elige un mundo para filtrar por tipo de ficha.',
    tagLabel: 'Etiqueta',
    tagAll: 'Todas las etiquetas',
    tagHint: 'Elige un mundo para filtrar por etiqueta.',
    statusLabel: 'Estado',
    statusAll: 'Todos los estados',
    statuses: {
      active: 'Activos',
      draft: 'Borradores',
      archived: 'Archivados',
    },
    statusValue: {
      active: 'Activo',
      draft: 'Borrador',
      archived: 'Archivado',
    },
    clearFilters: 'Quitar filtros',
    resultsLabel: 'Resultados de búsqueda',
    count: (count: number): string =>
      count === 1 ? '1 resultado' : `${count} resultados`,
    showing: (shown: number, total: number): string =>
      `Mostrando ${shown} de ${total}.`,
    took: (milliseconds: number): string =>
      `Tiempo de búsqueda: ${milliseconds} ms.`,
    fuzzy: (terms: string): string =>
      `No había una coincidencia exacta; se muestran resultados parecidos a ${terms}.`,
    loading: 'Buscando en tu biblioteca…',
    errorTitle: 'No se pudo completar la búsqueda',
    errorDescription:
      'La aplicación no pudo consultar el índice. Vuelve a intentarlo; tus datos siguen guardados en este equipo.',
    retry: 'Volver a intentar',
    emptyTitle: 'Ningún resultado coincide',
    emptyDescription:
      'Prueba con otra palabra, revisa la ortografía o quita algún filtro para ampliar la búsqueda.',
    recentTitle: 'Recientes',
    favoritesTitle: 'Favoritos',
    suggestionsLead:
      'Lo último que has tocado y las fichas que has marcado como favoritas.',
    suggestionsLoading: 'Cargando recientes y favoritos…',
    suggestionsError:
      'No se pudieron cargar las sugerencias. Puedes buscar igualmente.',
    suggestionsEmpty: 'Todavía no hay contenido para sugerir.',
    noSnippet: 'Sin texto adicional.',
    openPrefix: 'Abrir',
    kindBadge: (kind: string): string => `Tipo: ${kind}`,
    favoriteBadge: 'Favorita',
    updated: (date: string): string => `Actualizado el ${date}`,
    listLabel: 'Resultados de la búsqueda global',
    rebuilt: (documents: number): string =>
      documents === 1
        ? 'Índice reconstruido: 1 documento.'
        : `Índice reconstruido: ${documents} documentos.`,
    rebuildError:
      'No se pudo reconstruir el índice de búsqueda. Vuelve a intentarlo; tus datos siguen guardados.',
  },
  palette: {
    title: 'Paleta de comandos',
    inputLabel: 'Buscar o ejecutar un comando',
    placeholder: 'Escribe para buscar o ejecutar…',
    listLabel: 'Comandos y resultados',
    hints: '↑↓ para moverte · Enter para abrir · Esc para cerrar',
    commands: {
      home: 'Ir a Inicio',
      worlds: 'Ir a Mundos',
      search: 'Abrir la página de búsqueda',
      createWorld: 'Crear un mundo',
      createEntity: 'Crear una ficha',
      toggleTheme: 'Cambiar entre tema claro y oscuro',
      rebuild: 'Reconstruir el índice de búsqueda',
    },
    searchFor: (query: string): string =>
      `Ver todos los resultados para «${query}»`,
    loading: 'Buscando…',
    error: 'No se pudieron cargar los resultados. Vuelve a intentarlo.',
    noResults: 'Ningún comando ni resultado coincide.',
    commandBadge: 'Comando',
  },
  components: {
    form: {
      requiredMark: '*',
      requiredField: 'Este campo es obligatorio.',
    },
    dialog: {
      close: 'Cerrar',
    },
    toast: {
      regionLabel: 'Avisos de la aplicación',
      dismiss: 'Cerrar aviso',
      dismissTone: (tone: string): string =>
        `Cerrar aviso de ${tone.toLocaleLowerCase('es')}`,
      tones: {
        info: 'Información',
        success: 'Éxito',
        error: 'Error',
      },
    },
  },
  updates: {
    open: 'Actualizaciones',
    openWithUpdate: (version: string): string =>
      `Actualizaciones. Hay una versión nueva disponible: ${version}.`,
    title: 'Actualizaciones de World Craft',
    installedVersionLabel: 'Versión instalada',
    lastCheckedLabel: 'Última comprobación',
    lastChecked: (formatted: string): string =>
      `Última comprobación: ${formatted}.`,
    neverChecked: 'Todavía no se ha comprobado ninguna actualización.',
    privacy:
      'La comprobación consulta GitHub Releases y no envía el contenido de tus mundos, tus fichas ni datos personales.',
    progressLabel: (percent: string): string =>
      `Descarga de la actualización: ${percent}.`,
    percentValue: (percent: string): string => percent,
    statuses: {
      unavailable: (reason: string): string =>
        `Actualizaciones desactivadas. ${reason}`,
      idle: 'Listo para buscar actualizaciones.',
      checking: 'Buscando una versión nueva…',
      upToDate: (version: string): string =>
        `Ya tienes la última versión (${version}).`,
      available: (version: string): string =>
        `Hay una versión nueva disponible: ${version}.`,
      downloading: (percent: string): string =>
        `Descargando la actualización: ${percent}.`,
      downloaded: (version: string): string =>
        `La versión ${version} está descargada y lista para instalarse.`,
      installing: 'Instalando la actualización. La aplicación se reiniciará.',
      error: (message: string): string => message,
    },
    reasons: {
      notPackaged:
        'Las actualizaciones solo están disponibles en la versión instalada.',
      safeMode:
        'La aplicación ha arrancado en modo seguro y las actualizaciones están desactivadas.',
      notConfigured:
        'La configuración de actualizaciones no está disponible en esta instalación.',
      moduleMissing: 'El componente de actualizaciones no se ha podido cargar.',
    },
    errors: {
      checkFailed:
        'No se pudo comprobar si hay actualizaciones. Revisa la conexión e inténtalo de nuevo.',
      downloadFailed:
        'No se pudo descargar la actualización. Revisa el espacio libre y la conexión.',
      installFailed:
        'No se pudo iniciar la instalación. Cierra la aplicación y vuelve a intentarlo.',
      invalidState: 'La acción no está disponible en este momento.',
      transport:
        'No se pudo comunicar con el proceso principal. Vuelve a intentarlo.',
    },
    actions: {
      check: 'Buscar actualizaciones',
      retry: 'Volver a intentar',
      cancel: 'Cancelar',
      download: 'Descargar actualización',
      install: 'Reiniciar e instalar',
    },
  },
} as const;
