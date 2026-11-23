import { describe, expect, it } from 'vitest';

import {
  buildRelationView,
  flattenRelationItems,
} from '@/renderer/lib/relation-groups';
import type {
  RelationEdge,
  RelationEntityRef,
} from '@/shared/contracts/relations';

const SELF = '01900000-0000-7000-8000-000000000001';
const ALPHA = '01900000-0000-7000-8000-000000000002';
const BETA = '01900000-0000-7000-8000-000000000003';
const GAMMA = '01900000-0000-7000-8000-000000000004';
const DELTA = '01900000-0000-7000-8000-000000000005';
const WORLD = '01900000-0000-7000-8000-000000000099';
const TYPE_LOCATED = '018f0000-0000-7000-8000-000000000109';
const TYPE_MENTOR = '018f0000-0000-7000-8000-000000000110';
const BASE_TIME = 1_760_000_000_000;
const NAME_MAX = 'A'.repeat(120);
const SYNTHETIC_NAME = 'N'.repeat(220);
const LABEL_MAX = 'L'.repeat(80);

function entityRef(
  id: string,
  name: string,
  overrides: Partial<RelationEntityRef> = {},
): RelationEntityRef {
  return {
    id,
    name,
    typeKey: 'character',
    typeName: 'Personaje',
    typeIcon: 'user-round',
    typeColor: 'moss',
    ...overrides,
  };
}

interface EdgeOverrides {
  readonly id?: string;
  readonly source?: RelationEntityRef;
  readonly target?: RelationEntityRef;
  readonly typeId?: string;
  readonly typeKey?: string;
  readonly typeName?: string;
  readonly typeInverseName?: string;
  readonly typeColor?: RelationEdge['typeColor'];
  readonly label?: string | null;
  readonly inverseLabel?: string | null;
  readonly notes?: string | null;
  readonly strength?: number;
}

function makeEdge(overrides: EdgeOverrides = {}): RelationEdge {
  const id = overrides.id ?? '01900000-0000-7000-8000-0000000000aa';

  return {
    id,
    worldId: WORLD,
    typeId: overrides.typeId ?? TYPE_LOCATED,
    typeKey: overrides.typeKey ?? 'located-in',
    typeName: overrides.typeName ?? 'Ubicado en',
    typeInverseName: overrides.typeInverseName ?? 'Contiene',
    typeColor: overrides.typeColor ?? 'prussian',
    isSystemType: true,
    label: overrides.label ?? null,
    inverseLabel: overrides.inverseLabel ?? null,
    notes: overrides.notes ?? null,
    strength: overrides.strength ?? 3,
    metadata: {},
    source: overrides.source ?? entityRef(SELF, 'Mara Viento'),
    target:
      overrides.target ??
      entityRef(ALPHA, 'Puerto Sal', {
        typeKey: 'city',
        typeName: 'Ciudad',
        typeIcon: 'building-2',
        typeColor: 'ochre',
      }),
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  };
}

describe('buildRelationView', () => {
  it('separa salientes y backlinks y elige la contraparte correcta', () => {
    const outgoing = makeEdge();
    const incoming = makeEdge({
      id: 'incoming',
      source: entityRef(BETA, 'Altar de sal'),
      target: entityRef(SELF, 'Mara Viento'),
    });

    const view = buildRelationView([outgoing, incoming], SELF, 'es');

    expect(view.outgoing.count).toBe(1);
    expect(view.incoming.count).toBe(1);
    expect(view.total).toBe(2);

    const outItem = view.outgoing.groups[0]?.items[0];
    const inItem = view.incoming.groups[0]?.items[0];

    expect(outItem?.counterpart.id).toBe(ALPHA);
    expect(outItem?.isBacklink).toBe(false);
    expect(outItem?.effectiveLabel).toBe('Ubicado en');
    expect(outItem?.reciprocalLabel).toBe('Contiene');

    // El backlink se lee al revés y navega al origen.
    expect(inItem?.counterpart.id).toBe(BETA);
    expect(inItem?.isBacklink).toBe(true);
    expect(inItem?.effectiveLabel).toBe('Contiene');
    expect(inItem?.reciprocalLabel).toBe('Ubicado en');
  });

  it('usa las sobrescrituras de etiqueta en ambas direcciones', () => {
    const edge = makeEdge({
      label: 'Aliada desde la infancia',
      inverseLabel: 'Aliada de',
    });

    const outgoing = buildRelationView([edge], SELF, 'es');
    const incoming = buildRelationView([edge], ALPHA, 'es');

    expect(outgoing.outgoing.groups[0]?.effectiveLabel).toBe(
      'Aliada desde la infancia',
    );
    expect(outgoing.outgoing.groups[0]?.reciprocalLabel).toBe('Aliada de');
    expect(incoming.incoming.groups[0]?.effectiveLabel).toBe('Aliada de');
    expect(incoming.incoming.groups[0]?.showTypeName).toBe(true);
  });

  it('separa dos etiquetas sobrescritas del mismo tipo en dos grupos', () => {
    const first = makeEdge({
      id: 'first',
      label: 'Aliada desde la infancia',
      inverseLabel: 'Aliada de',
      target: entityRef(ALPHA, 'Puerto Sal'),
    });
    const second = makeEdge({
      id: 'second',
      label: 'Rival desde la marea',
      inverseLabel: 'Rival de',
      target: entityRef(BETA, 'Altar de sal'),
    });

    const view = buildRelationView([first, second], SELF, 'es');

    expect(view.outgoing.groups).toHaveLength(2);
    expect(view.outgoing.groups.map((group) => group.items.length)).toEqual([
      1, 1,
    ]);

    for (const group of view.outgoing.groups) {
      expect(group.showTypeName).toBe(true);
    }
  });

  it('no mezcla el mismo tipo si cambia la etiqueta recíproca', () => {
    const first = makeEdge({
      id: 'first',
      inverseLabel: 'Contiene',
      target: entityRef(ALPHA, 'Puerto Sal'),
    });
    const second = makeEdge({
      id: 'second',
      inverseLabel: 'Alberga',
      target: entityRef(BETA, 'Altar de sal'),
    });

    const view = buildRelationView([first, second], SELF, 'es');

    expect(view.outgoing.groups).toHaveLength(2);
    expect(
      view.outgoing.groups.map((group) => group.reciprocalLabel).sort(),
    ).toEqual(['Alberga', 'Contiene']);
  });

  it('no repite la recíproca cuando el tipo es simétrico', () => {
    const edge = makeEdge({
      typeId: TYPE_MENTOR,
      typeKey: 'related-with',
      typeName: 'Relacionado con',
      typeInverseName: 'Relacionado con',
    });

    const view = buildRelationView([edge], SELF, 'es');
    const group = view.outgoing.groups[0];

    expect(group?.effectiveLabel).toBe('Relacionado con');
    expect(group?.reciprocalLabel).toBe('Relacionado con');
    expect(group?.showTypeName).toBe(false);
  });

  it('ordena grupos por etiqueta con acentos y números y entradas por nombre', () => {
    const groupEdges = [
      makeEdge({
        id: 'arbol',
        label: 'Árbol',
        inverseLabel: 'Bosque',
        target: entityRef(ALPHA, 'Ficha 10'),
      }),
      makeEdge({
        id: 'bosque',
        label: 'Bosque',
        inverseLabel: 'Árbol',
        target: entityRef(BETA, 'Ficha 2'),
      }),
      makeEdge({
        id: 'caverna-diez',
        label: 'Caverna 10',
        inverseLabel: 'Caverna',
        target: entityRef(GAMMA, 'Álvaro'),
      }),
      makeEdge({
        id: 'caverna-dos',
        label: 'Caverna 2',
        inverseLabel: 'Caverna',
        target: entityRef(DELTA, 'Beatriz'),
      }),
    ];

    const view = buildRelationView(groupEdges, SELF, 'es');

    expect(view.outgoing.groups.map((group) => group.effectiveLabel)).toEqual([
      'Árbol',
      'Bosque',
      'Caverna 2',
      'Caverna 10',
    ]);

    const names = view.outgoing.groups
      .flatMap((group) => group.items)
      .map((item) => item.counterpart.name);

    expect(names).toEqual(['Ficha 10', 'Ficha 2', 'Beatriz', 'Álvaro']);
  });

  it('ordena las entradas de un grupo por nombre, con números y acentos', () => {
    const edges = [
      makeEdge({ id: 'a', target: entityRef(ALPHA, 'Ficha 10') }),
      makeEdge({ id: 'b', target: entityRef(BETA, 'Ficha 2') }),
      makeEdge({ id: 'c', target: entityRef(GAMMA, 'Álvaro') }),
      makeEdge({ id: 'd', target: entityRef(DELTA, 'Beatriz') }),
    ];

    const view = buildRelationView(edges, SELF, 'es');
    const names = view.outgoing.groups
      .flatMap((group) => group.items)
      .map((item) => item.counterpart.name);

    expect(view.outgoing.groups).toHaveLength(1);
    expect(names).toEqual(['Álvaro', 'Beatriz', 'Ficha 2', 'Ficha 10']);
  });

  it('no muta la lista original y una lista vacía devuelve dos direcciones', () => {
    const list = [makeEdge({ id: 'b' }), makeEdge({ id: 'a' })];
    const snapshot = list.map((edge) => edge.id);

    const view = buildRelationView(list, SELF, 'es');

    expect(list.map((edge) => edge.id)).toEqual(snapshot);
    expect(view.total).toBe(2);

    const empty = buildRelationView([], SELF, 'es');

    expect(empty.total).toBe(0);
    expect(empty.outgoing.groups).toEqual([]);
    expect(empty.incoming.groups).toEqual([]);
  });

  it('conserva nombres de 200+ caracteres y etiquetas de 80', () => {
    const view = buildRelationView(
      [
        makeEdge({
          label: LABEL_MAX,
          inverseLabel: LABEL_MAX,
          target: entityRef(ALPHA, SYNTHETIC_NAME),
        }),
      ],
      SELF,
      'es',
    );

    const group = view.outgoing.groups[0];
    const item = group?.items[0];

    expect(group?.effectiveLabel).toHaveLength(80);
    expect(item?.counterpart.name).toHaveLength(220);

    const atLimit = buildRelationView(
      [makeEdge({ target: entityRef(ALPHA, NAME_MAX) })],
      SELF,
      'es',
    );

    expect(atLimit.outgoing.groups[0]?.items[0]?.counterpart.name).toHaveLength(
      120,
    );
  });

  it('resuelve 500 relaciones sin perder ni duplicar ninguna', () => {
    const edges = Array.from({ length: 500 }, (_, index) =>
      index % 2 === 0
        ? makeEdge({
            id: `out-${String(index)}`,
            target: entityRef(
              `01900000-0000-7000-9000-${String(index).padStart(12, '0')}`,
              `Ficha ${String(index)}`,
            ),
          })
        : makeEdge({
            id: `in-${String(index)}`,
            source: entityRef(
              `01900000-0000-7000-9000-${String(index).padStart(12, '0')}`,
              `Ficha ${String(index)}`,
            ),
            target: entityRef(SELF, 'Mara Viento'),
          }),
    );

    const view = buildRelationView(edges, SELF, 'es');
    const items = flattenRelationItems(view);
    const ids = items.map((item) => item.relation.id);

    expect(view.outgoing.count).toBe(250);
    expect(view.incoming.count).toBe(250);
    expect(view.total).toBe(500);
    expect(new Set(ids).size).toBe(500);
    expect(
      view.outgoing.groups.reduce(
        (count, group) => count + group.items.length,
        0,
      ),
    ).toBe(250);
  });

  it('clasifica una autorelación solo como saliente y la cuenta una vez', () => {
    const self = entityRef(SELF, 'Mara Viento');
    const view = buildRelationView(
      [makeEdge({ id: 'self', source: self, target: self })],
      SELF,
      'es',
    );

    expect(view.outgoing.count).toBe(1);
    expect(view.incoming.count).toBe(0);
    expect(view.total).toBe(1);
    expect(view.outgoing.groups[0]?.items[0]?.isBacklink).toBe(false);
    expect(view.outgoing.groups[0]?.items[0]?.counterpart.id).toBe(SELF);
  });

  it('aplana en orden visible: salientes primero y después backlinks', () => {
    const view = buildRelationView(
      [
        makeEdge({
          id: 'incoming',
          source: entityRef(BETA, 'Beta'),
          target: entityRef(SELF, 'Mara'),
        }),
        makeEdge({
          id: 'outgoing',
          target: entityRef(ALPHA, 'Alfa'),
        }),
      ],
      SELF,
      'es',
    );

    expect(flattenRelationItems(view).map((item) => item.relation.id)).toEqual([
      'outgoing',
      'incoming',
    ]);
  });
});
