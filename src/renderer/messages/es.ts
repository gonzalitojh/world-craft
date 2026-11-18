/**
 * Mensajes visibles del renderer.
 *
 * Todo el texto de interfaz pasa por aquí para que esté centralizado, tipado y
 * preparado para añadir más idiomas sin tocar los componentes (ADR 0009). El
 * traductor con `Intl`, plurales y formatos llega con la issue #71; hasta
 * entonces los mensajes con parámetros son funciones puras.
 *
 * Convención de ejemplo: los textos de la página de muestras describen un
 * mundo ficticio plausible («Las Mareas Grises»), nunca datos reales.
 */
export const messages = {
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
    createSoon:
      'La creación de mundos llegará en una próxima versión. Mientras tanto, la página de muestras enseña el sistema de diseño completo.',
    nextStepsTitle: 'Qué podrás hacer cuando exista el primer mundo',
    nextSteps: [
      'Escribir fichas de personajes, lugares y organizaciones con sus campos y etiquetas.',
      'Unir fichas con relaciones y ver el conjunto en el grafo de la historia.',
      'Dibujar mapas por capas y enlazarlos a los lugares del mundo.',
      'Redactar el manuscrito por libros, capítulos y escenas, con contador de palabras.',
    ],
    note: 'Tus datos se quedan en este equipo, en una carpeta propia que sobrevive a las actualizaciones de la aplicación.',
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
} as const;
