/**
 * Catálogo de los tipos de entidad del sistema.
 *
 * Es contenido editable en código, no datos remotos. Las filas se siembran en
 * la migración `0003_entity_types` con los mismos identificadores, claves,
 * iconos, colores y plantillas; una prueba de integración comprueba que la base
 * y este catálogo coinciden literalmente.
 *
 * Los nombres y las etiquetas están en español porque son contenido del
 * catálogo, no textos de la interfaz: la interfaz los recibe como datos. Las
 * claves son estables y en inglés para exportaciones y referencias.
 *
 * Los tipos del sistema no se editan ni se borran desde la aplicación. Para
 * cambiar una plantilla se duplica el tipo en el mundo, que copia sus campos y
 * permite ajustarlos sin tocar el original.
 */
import {
  type EntityFieldDefinition,
  type EntityTypeColor,
  type EntityTypeIcon,
} from '../contracts/entity-types';

/**
 * Marca de tiempo simbólica del seed (2026-11-20).
 *
 * Los tipos del sistema no tienen una fecha de creación de usuario; se fija un
 * valor estable para que una eventual pantalla no muestre 1970.
 */
export const SYSTEM_ENTITY_TYPE_CREATED_AT = 1_795_132_800_000;

/** Forma de un tipo del sistema. */
export interface SystemEntityTypeDefinition {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly icon: EntityTypeIcon;
  readonly color: EntityTypeColor;
  readonly fields: readonly EntityFieldDefinition[];
}

/** Los 18 tipos del sistema, en el orden en que se muestran. */
export const SYSTEM_ENTITY_TYPES: readonly SystemEntityTypeDefinition[] = [
  {
    id: '018f0000-0000-7000-8000-000000000001',
    key: 'character',
    name: 'Personaje',
    icon: 'user-round',
    color: 'moss',
    fields: [
      { key: 'age', label: 'Edad', type: 'number', required: false, min: 0 },
      {
        key: 'species',
        label: 'Especie',
        type: 'text',
        required: false,
        maxLength: 80,
      },
      {
        key: 'occupation',
        label: 'Oficio',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'affiliation',
        label: 'Afiliación',
        type: 'reference',
        required: false,
        targetTypeKey: 'organization',
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: false,
        options: [
          { value: 'alive', label: 'Vivo' },
          { value: 'dead', label: 'Muerto' },
          { value: 'missing', label: 'Desaparecido' },
          { value: 'unknown', label: 'Desconocido' },
        ],
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000002',
    key: 'place',
    name: 'Lugar',
    icon: 'map-pin',
    color: 'prussian',
    fields: [
      {
        key: 'region',
        label: 'Región',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'climate',
        label: 'Clima',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'population',
        label: 'Población',
        type: 'number',
        required: false,
        min: 0,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000003',
    key: 'city',
    name: 'Ciudad',
    icon: 'building-2',
    color: 'ochre',
    fields: [
      {
        key: 'population',
        label: 'Población',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        key: 'government',
        label: 'Gobierno',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      { key: 'founded', label: 'Fundación', type: 'date', required: false },
      {
        key: 'region',
        label: 'Región',
        type: 'text',
        required: false,
        maxLength: 120,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000004',
    key: 'nation',
    name: 'Nación',
    icon: 'flag',
    color: 'danger',
    fields: [
      {
        key: 'capital',
        label: 'Capital',
        type: 'reference',
        required: false,
        targetTypeKey: 'city',
      },
      {
        key: 'government',
        label: 'Gobierno',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      { key: 'founded', label: 'Fundación', type: 'date', required: false },
      {
        key: 'population',
        label: 'Población',
        type: 'number',
        required: false,
        min: 0,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000005',
    key: 'culture',
    name: 'Cultura',
    icon: 'palette',
    color: 'ochre',
    fields: [
      {
        key: 'language',
        label: 'Idioma',
        type: 'reference',
        required: false,
        targetTypeKey: 'language',
      },
      {
        key: 'values',
        label: 'Valores',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'region',
        label: 'Región',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000006',
    key: 'race',
    name: 'Raza',
    icon: 'dna',
    color: 'moss',
    fields: [
      {
        key: 'origin',
        label: 'Origen',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
      {
        key: 'lifespan',
        label: 'Longevidad',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        key: 'traits',
        label: 'Rasgos',
        type: 'text',
        required: false,
        maxLength: 500,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000007',
    key: 'organization',
    name: 'Organización',
    icon: 'users',
    color: 'prussian',
    fields: [
      {
        key: 'purpose',
        label: 'Propósito',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'leader',
        label: 'Líder',
        type: 'reference',
        required: false,
        targetTypeKey: 'character',
      },
      { key: 'founded', label: 'Fundación', type: 'date', required: false },
      {
        key: 'headquarters',
        label: 'Sede',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000008',
    key: 'religion',
    name: 'Religión',
    icon: 'church',
    color: 'ochre',
    fields: [
      {
        key: 'deity',
        label: 'Deidad',
        type: 'reference',
        required: false,
        targetTypeKey: 'deity',
      },
      {
        key: 'doctrine',
        label: 'Doctrina',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'followers',
        label: 'Fieles',
        type: 'number',
        required: false,
        min: 0,
      },
      { key: 'founded', label: 'Fundación', type: 'date', required: false },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000009',
    key: 'deity',
    name: 'Deidad',
    icon: 'sun',
    color: 'ochre',
    fields: [
      {
        key: 'domain',
        label: 'Dominio',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'pantheon',
        label: 'Panteón',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'symbol',
        label: 'Símbolo',
        type: 'text',
        required: false,
        maxLength: 120,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000010',
    key: 'magic',
    name: 'Magia',
    icon: 'sparkles',
    color: 'prussian',
    fields: [
      {
        key: 'source',
        label: 'Fuente',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'cost',
        label: 'Coste',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'practitioners',
        label: 'Practicantes',
        type: 'text',
        required: false,
        maxLength: 120,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000011',
    key: 'item',
    name: 'Objeto',
    icon: 'package',
    color: 'moss',
    fields: [
      {
        key: 'material',
        label: 'Material',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'origin',
        label: 'Origen',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
      {
        key: 'powers',
        label: 'Poderes',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'value',
        label: 'Valor',
        type: 'number',
        required: false,
        min: 0,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000012',
    key: 'creature',
    name: 'Criatura',
    icon: 'paw-print',
    color: 'moss',
    fields: [
      {
        key: 'habitat',
        label: 'Hábitat',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
      {
        key: 'size',
        label: 'Tamaño',
        type: 'select',
        required: false,
        options: [
          { value: 'tiny', label: 'Diminuto' },
          { value: 'small', label: 'Pequeño' },
          { value: 'medium', label: 'Mediano' },
          { value: 'large', label: 'Grande' },
          { value: 'huge', label: 'Enorme' },
        ],
      },
      {
        key: 'danger',
        label: 'Peligro',
        type: 'select',
        required: false,
        options: [
          { value: 'low', label: 'Bajo' },
          { value: 'medium', label: 'Medio' },
          { value: 'high', label: 'Alto' },
          { value: 'legendary', label: 'Legendario' },
        ],
      },
      {
        key: 'diet',
        label: 'Dieta',
        type: 'text',
        required: false,
        maxLength: 120,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000013',
    key: 'language',
    name: 'Idioma',
    icon: 'languages',
    color: 'prussian',
    fields: [
      {
        key: 'family',
        label: 'Familia',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'speakers',
        label: 'Hablantes',
        type: 'number',
        required: false,
        min: 0,
      },
      {
        key: 'script',
        label: 'Escritura',
        type: 'text',
        required: false,
        maxLength: 120,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000014',
    key: 'event',
    name: 'Evento',
    icon: 'calendar-days',
    color: 'danger',
    fields: [
      { key: 'start-date', label: 'Inicio', type: 'date', required: false },
      { key: 'end-date', label: 'Fin', type: 'date', required: false },
      {
        key: 'location',
        label: 'Lugar',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
      {
        key: 'outcome',
        label: 'Consecuencias',
        type: 'text',
        required: false,
        maxLength: 500,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000015',
    key: 'conflict',
    name: 'Conflicto',
    icon: 'swords',
    color: 'danger',
    fields: [
      { key: 'start-date', label: 'Inicio', type: 'date', required: false },
      { key: 'end-date', label: 'Fin', type: 'date', required: false },
      {
        key: 'belligerents',
        label: 'Bandos',
        type: 'text',
        required: false,
        maxLength: 500,
      },
      {
        key: 'outcome',
        label: 'Resultado',
        type: 'text',
        required: false,
        maxLength: 500,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000016',
    key: 'technology',
    name: 'Tecnología',
    icon: 'cpu',
    color: 'prussian',
    fields: [
      {
        key: 'era',
        label: 'Época',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'inventor',
        label: 'Inventor',
        type: 'reference',
        required: false,
        targetTypeKey: 'character',
      },
      {
        key: 'purpose',
        label: 'Función',
        type: 'text',
        required: false,
        maxLength: 500,
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000017',
    key: 'flora-fauna',
    name: 'Flora y fauna',
    icon: 'leaf',
    color: 'moss',
    fields: [
      {
        key: 'habitat',
        label: 'Hábitat',
        type: 'reference',
        required: false,
        targetTypeKey: 'place',
      },
      {
        key: 'diet',
        label: 'Dieta',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'danger',
        label: 'Peligro',
        type: 'select',
        required: false,
        options: [
          { value: 'low', label: 'Bajo' },
          { value: 'medium', label: 'Medio' },
          { value: 'high', label: 'Alto' },
          { value: 'legendary', label: 'Legendario' },
        ],
      },
    ],
  },
  {
    id: '018f0000-0000-7000-8000-000000000018',
    key: 'concept',
    name: 'Concepto',
    icon: 'lightbulb',
    color: 'ochre',
    fields: [
      {
        key: 'domain',
        label: 'Ámbito',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'opposite',
        label: 'Opuesto',
        type: 'text',
        required: false,
        maxLength: 120,
      },
      {
        key: 'related',
        label: 'Relacionado con',
        type: 'text',
        required: false,
        maxLength: 500,
      },
    ],
  },
];

/** Claves reservadas por el sistema. */
export const SYSTEM_ENTITY_TYPE_KEYS: readonly string[] = Object.freeze(
  SYSTEM_ENTITY_TYPES.map((type) => type.key),
);

const SYSTEM_ENTITY_TYPE_KEY_SET: ReadonlySet<string> = new Set(
  SYSTEM_ENTITY_TYPE_KEYS,
);

/** Indica si una clave pertenece a un tipo del sistema. */
export function isSystemEntityTypeKey(value: unknown): boolean {
  return typeof value === 'string' && SYSTEM_ENTITY_TYPE_KEY_SET.has(value);
}

/** Devuelve el tipo del sistema con esa clave, si existe. */
export function findSystemEntityTypeByKey(
  key: string,
): SystemEntityTypeDefinition | null {
  return SYSTEM_ENTITY_TYPES.find((type) => type.key === key) ?? null;
}

/** Posición del tipo del sistema, para ordenar la lista. */
export function systemEntityTypeOrder(key: string): number {
  const index = SYSTEM_ENTITY_TYPES.findIndex((type) => type.key === key);

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
