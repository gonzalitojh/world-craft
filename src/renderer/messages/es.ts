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
    brandTagline: 'Taller de cartógrafo',
    railLabel: 'Barra lateral de la aplicación',
    navigationLabel: 'Navegación principal',
    views: {
      home: 'Inicio',
      worlds: 'Mundos',
      world: 'Mundo',
      samples: 'Muestras',
    },
    collapse: 'Plegar menú lateral',
    expand: 'Expandir menú lateral',
    version: (version: string): string => `Versión ${version}`,
    theme: {
      currentLight: 'Claro',
      currentDark: 'Oscuro',
      switchLabel: (current: string): string =>
        `Cambiar el tema de la interfaz. Tema actual: ${current}`,
    },
  },
  home: {
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
      lead: 'Desde aquí ves tus mundos, lo último que ha pasado en ellos y los accesos para seguir trabajando.',
      worldsTitle: 'Tus mundos',
      worldsLead:
        'Cada mundo reúne sus fichas, mapas, manuscritos y partidas. Abre uno para ver su ficha completa.',
      activityTitle: 'Actividad reciente',
      activityLead:
        'Lo último que ha pasado en todos tus mundos, sin mezclar su contenido.',
      activityEmpty: 'Todavía no hay actividad registrada.',
      quickTitle: 'Accesos rápidos',
      quickCreate: 'Crear un mundo nuevo',
      quickCreateDescription:
        'Empieza un mundo desde cero con su nombre, su resumen y sus géneros.',
      quickManage: 'Gestionar los mundos',
      quickManageDescription:
        'Busca, archiva, duplica o elimina los mundos que ya tienes.',
      statsTitle: 'Resumen',
      statWorlds: 'Mundos',
      statActive: 'Activos',
      statArchived: 'Archivados',
      seeAll: 'Ver todos los mundos',
      loading: 'Cargando tus mundos…',
      errorTitle: 'No se pudieron cargar los mundos',
      errorDescription:
        'La aplicación no pudo leer la lista de mundos. Vuelve a intentarlo; tus datos siguen guardados en este equipo.',
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
      editNamed: (name: string): string => `Editar el mundo «${name}»`,
      duplicate: 'Duplicar',
      duplicateNamed: (name: string): string => `Duplicar el mundo «${name}»`,
      archive: 'Archivar',
      archiveNamed: (name: string): string => `Archivar el mundo «${name}»`,
      restore: 'Restaurar',
      restoreNamed: (name: string): string => `Restaurar el mundo «${name}»`,
      delete: 'Eliminar',
      deleteNamed: (name: string): string =>
        `Eliminar el mundo «${name}» (se moverá a la papelera)`,
      updated: (date: string): string => `Actualizado el ${date}`,
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
  samples: {
    lead: 'Página de revisión del sistema de diseño. Aquí se ven los componentes base con sus estados y con contenido largo, para comprobar que nada se sale de su contenedor en los temas Claro y Oscuro.',
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
      title: 'Campos de texto',
      lead: 'La etiqueta siempre está visible y la ayuda o el error se asocian al campo con aria-describedby.',
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
    longContent: {
      title: 'Contenido largo',
      lead: 'Título, párrafo, nombre sin espacios y ruta: nada debe desbordar ni crear desplazamiento horizontal de página.',
      heading:
        'Crónica de la expedición al archipiélago de las Mareas Grises: los pactos de sal, las rutas de los balleneros y el mapa inconcluso del cartógrafo Aldo Varela',
      paragraph:
        'La expedición salió del puerto de Punta Sal con tres goletas y una tripulación de cuarenta y dos personas. Durante once semanas recorrió las islas del norte, levantó actas de cada desembarco y dibujó a mano las líneas de bajamar que el atlas oficial daba por definitivas. El cuaderno recoge los nombres que los clanes usan para cada bajío, las tarifas que cobran por guiar barcos y las historias que cuentan sobre las luces que aparecen en el horizonte cuando la marea cambia de golpe.',
      name: 'AldoVarelaDeLaTorreYDelAmoDelArchipielagoDeLasMareasGrisesYNieblasDelSurOccidentalY',
      path: 'C:\\Users\\cartografa\\Documents\\World Craft\\mundos\\mareas-grises\\mapas\\costa-norte-del-archipielago\\capa-de-rutas-balleneras-1926.geojson',
    },
  },
  components: {
    form: {
      requiredMark: '*',
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
