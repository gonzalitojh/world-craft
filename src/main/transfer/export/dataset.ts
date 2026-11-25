/**
 * Construcción de `world.json` a partir de una instantánea.
 *
 * El orden es determinista: tipos y etiquetas por clave o nombre, fichas por
 * nombre y slug, versiones y relaciones por fecha e ID, y assets por ID. Las
 * referencias rotas que no impiden exportar el contenido (enlaces internos a
 * fichas en papelera, valores `reference` sin destino, versiones ilegibles) se
 * sanean y generan avisos. Un asset ausente o una relación sin tipo aborta la
 * exportación: el ZIP nunca se publica con contenido incoherente.
 */
import {
  ENTITY_TAGS_MAX,
  isEntityStatus,
  type EntityRichTextDocument,
} from '../../../shared/contracts/entities';
import {
  ENTITY_TYPE_COLORS,
  type EntityFieldDefinition,
} from '../../../shared/contracts/entity-types';
import { isRelationMetadata } from '../../../shared/contracts/relations';
import type {
  TransferCounts,
  TransferWarning,
} from '../../../shared/contracts/transfer';
import { entityFieldTemplateSchema } from '../../../shared/entity-types/fields';
import { validateEntityDescription } from '../../../shared/entities/description';
import { SYSTEM_ENTITY_TYPES } from '../../../shared/entity-types/catalog';
import {
  validateEntityFieldValues,
  type EntityFieldValue,
} from '../../../shared/entity-types/fields';
import { TransferError } from '../errors';
import {
  countWorldTransfer,
  parseWorldTransfer,
  type WorldTransfer,
} from '../format/world';
import {
  remapDescriptionLinks,
  remapGallery,
  remapOptionalAssetId,
  remapReferenceAttributes,
} from '../format/remap';
import { TransferWarningCollector } from '../format/warnings';
import type {
  SnapshotAsset,
  SnapshotEntityType,
  SnapshotRelationType,
  WorldSnapshot,
} from './snapshot';

/** Resultado de construir el contenido exportable. */
export interface WorldDataset {
  readonly world: WorldTransfer;
  readonly counts: TransferCounts;
  readonly warnings: readonly TransferWarning[];
}

/** Construye y valida el `world.json` de una instantánea. */
export function buildWorldDataset(snapshot: WorldSnapshot): WorldDataset {
  const warnings = new TransferWarningCollector();
  const entityTypes = buildEntityTypes(snapshot.entityTypes);
  const relationTypes = buildRelationTypes(snapshot.relationTypes);
  const tags = snapshot.tags.map((tag) => ({
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
  }));
  const tagNames = new Set(tags.map((tag) => tag.name));
  const assets = buildAssets(snapshot.assets);
  const assetIdMap = new Map(assets.map((asset) => [asset.id, asset.id]));
  const entityIdMap = new Map(
    snapshot.entities.map((entity) => [entity.id, entity.id]),
  );
  // Los tipos del sistema no viajan en el bloque de tipos personalizados, pero
  // sus plantillas se necesitan para validar los atributos de las fichas.
  const typeByKey = new Map<string, readonly EntityFieldDefinition[]>(
    SYSTEM_ENTITY_TYPES.map((type) => [type.key, type.fields]),
  );

  for (const type of entityTypes.types) {
    typeByKey.set(type.key, type.fields);
  }

  // Agrupar una vez evita recorrer toda la galería y el historial por cada
  // ficha; con los límites de D4 eso sería cuadrático.
  const galleryByEntity = new Map<string, { readonly assetId: string }[]>();

  for (const item of snapshot.gallery) {
    const current = galleryByEntity.get(item.entityId) ?? [];
    current.push({ assetId: item.assetId });
    galleryByEntity.set(item.entityId, current);
  }

  const versionsByEntity = new Map<
    string,
    (typeof snapshot.versions)[number][]
  >();

  for (const version of snapshot.versions) {
    const current = versionsByEntity.get(version.entityId) ?? [];
    current.push(version);
    versionsByEntity.set(version.entityId, current);
  }

  const entities = snapshot.entities
    .map((entity) => {
      const fields = typeByKey.get(entity.typeKey);

      if (fields === undefined) {
        // La exportación no puede inventar una plantilla: si una ficha apunta a
        // un tipo que ya no existe, los datos están corruptos.
        throw new TransferError('TRANSFER_WORLD_INVALID');
      }

      const description = parseDescription(entity.description);
      const remappedDescription = remapDescriptionLinks(
        description ?? { type: 'doc' },
        entityIdMap,
        warnings,
      );
      const attributes = parseAttributes(entity.attributes);
      const remapped = remapReferenceAttributes(
        attributes,
        fields,
        entityIdMap,
        warnings,
      );
      const gallery = remapGallery(
        galleryByEntity.get(entity.id) ?? [],
        assetIdMap,
        warnings,
      );
      const entityTagNames = (snapshot.entityTagNames.get(entity.id) ?? [])
        .filter((name) => {
          if (tagNames.has(name)) {
            return true;
          }

          warnings.add('missing-tag');
          return false;
        })
        .slice(0, ENTITY_TAGS_MAX);

      return {
        id: entity.id,
        typeKey: entity.typeKey,
        name: entity.name,
        slug: entity.slug,
        aliases: entity.aliases,
        summary: entity.summary,
        description:
          remappedDescription.document.content === undefined ||
          remappedDescription.document.content.length === 0
            ? null
            : remappedDescription.document,
        attributes: normalizeAttributes(fields, remapped.attributes, warnings),
        status: isEntityStatus(entity.status) ? entity.status : 'active',
        isFavorite: entity.isFavorite,
        imageAssetId: remapOptionalAssetId(
          entity.imageAssetId,
          assetIdMap,
          warnings,
          'missing-entity-image',
        ),
        gallery: gallery.map((assetId) => ({ assetId })),
        tagNames: entityTagNames,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        versions: (versionsByEntity.get(entity.id) ?? []).flatMap((version) => {
          const parsed = parseVersionDescription(version.description);

          if (!parsed.ok) {
            warnings.add('invalid-version');
            return [];
          }

          return [
            {
              description: parsed.document,
              label: version.label,
              origin: normalizeVersionOrigin(version.origin, warnings),
              createdAt: version.createdAt,
            },
          ];
        }),
      };
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, 'es') ||
        left.slug.localeCompare(right.slug, 'es') ||
        left.id.localeCompare(right.id),
    );

  const relations = snapshot.relations
    .flatMap((relation) => {
      if (
        !entityIdMap.has(relation.sourceId) ||
        !entityIdMap.has(relation.targetId)
      ) {
        warnings.add('broken-relation-endpoint');
        return [];
      }

      if (relation.sourceId === relation.targetId) {
        warnings.add('duplicate-relation');
        return [];
      }

      const metadata = parseMetadata(relation.metadata);

      if (metadata === null) {
        throw new TransferError('TRANSFER_WORLD_INVALID');
      }

      return [
        {
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          typeKey: relation.typeKey,
          label: normalizeOptionalLabel(relation.label),
          inverseLabel: normalizeOptionalLabel(relation.inverseLabel),
          notes: relation.notes,
          strength: relation.strength,
          metadata,
          createdAt: relation.createdAt,
          updatedAt: relation.updatedAt,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left.sourceId.localeCompare(right.sourceId) ||
        left.targetId.localeCompare(right.targetId),
    );

  const payload = parseWorldTransfer({
    format: 'world-craft-world',
    formatVersion: 1,
    world: {
      name: snapshot.world.name,
      slug: snapshot.world.slug,
      summary: snapshot.world.summary,
      description: snapshot.world.description,
      genres: snapshot.world.genres,
      language: snapshot.world.language,
      createdAt: snapshot.world.createdAt,
      updatedAt: snapshot.world.updatedAt,
    },
    entityTypes,
    relationTypes,
    tags,
    assets,
    entities,
    relations,
    coverAssetId: remapOptionalAssetId(
      snapshot.world.coverAssetId,
      assetIdMap,
      warnings,
      'missing-world-cover',
    ),
  });

  return {
    world: payload,
    counts: countWorldTransfer(payload),
    warnings: warnings.toList(),
  };
}

function buildEntityTypes(
  source: readonly SnapshotEntityType[],
): WorldTransfer['entityTypes'] {
  const parsed = entityFieldTemplateSchema;

  return {
    version: 1,
    types: source.map((type) => {
      const fields = parsed.safeParse(type.fields);

      if (!fields.success || !ENTITY_TYPE_COLORS.includes(type.color)) {
        throw new TransferError('TRANSFER_WORLD_INVALID');
      }

      return {
        key: type.key,
        name: type.name,
        icon: type.icon,
        color: type.color,
        fields:
          fields.data as unknown as WorldTransfer['entityTypes']['types'][number]['fields'],
      };
    }),
  };
}

function buildRelationTypes(
  source: readonly SnapshotRelationType[],
): WorldTransfer['relationTypes'] {
  return {
    version: 1,
    types: source.map((type) => ({
      key: type.key,
      name: type.name,
      inverseName: type.inverseName,
      color: type.color,
    })),
  };
}

function buildAssets(
  source: readonly SnapshotAsset[],
): WorldTransfer['assets'] {
  return source
    .filter((asset) => asset.kind === 'image')
    .map((asset) => ({
      id: asset.id,
      alt: asset.alt,
      width: asset.width,
      height: asset.height,
      createdAt: asset.createdAt,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function parseDescription(raw: string | null): EntityRichTextDocument | null {
  if (raw === null) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  const validated = validateEntityDescription(value);

  if (!validated.ok) {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  return validated.document;
}

function parseVersionDescription(
  raw: string | null,
):
  | { readonly ok: true; readonly document: EntityRichTextDocument | null }
  | { readonly ok: false } {
  if (raw === null) {
    return { ok: true, document: null };
  }

  try {
    return { ok: true, document: parseDescription(raw) };
  } catch {
    return { ok: false };
  }
}

function parseAttributes(
  raw: string,
): Readonly<Record<string, EntityFieldValue>> {
  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  const attributes: Record<string, EntityFieldValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      attributes[key] = entry;
    }
  }

  return attributes;
}

/**
 * Ajusta los atributos a la plantilla actual.
 *
 * Un campo que ya no existe o un valor del tipo equivocado se descarta con
 * aviso. Un campo obligatorio ausente no se puede inventar: la exportación
 * falla para no generar un paquete que la propia aplicación rechazaría.
 */
function normalizeAttributes(
  fields: readonly EntityFieldDefinition[],
  attributes: Readonly<Record<string, EntityFieldValue>>,
  warnings: TransferWarningCollector,
): Readonly<Record<string, EntityFieldValue>> {
  const fieldKeys = new Set(fields.map((field) => field.key));
  const known: Record<string, EntityFieldValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!fieldKeys.has(key)) {
      warnings.add('invalid-attribute');
      continue;
    }

    known[key] = value;
  }

  const validated = validateEntityFieldValues(fields, known);

  if (validated.ok) {
    return validated.values;
  }

  const invalidKeys = new Set(
    validated.errors
      .filter((error) => error.code !== 'required')
      .map((error) => error.fieldKey),
  );

  // Un campo obligatorio ausente en datos antiguos no se puede inventar; se
  // exporta la ficha sin él y se avisa para que el usuario lo complete.
  if (validated.errors.some((error) => error.code === 'required')) {
    warnings.add('invalid-attribute');
  }

  const cleaned: Record<string, EntityFieldValue> = {};

  for (const [key, value] of Object.entries(known)) {
    if (invalidKeys.has(key)) {
      warnings.add('invalid-attribute');
      continue;
    }

    cleaned[key] = value;
  }

  const revalidated = validateEntityFieldValues(fields, cleaned);

  if (
    !revalidated.ok &&
    revalidated.errors.some((error) => error.code !== 'required')
  ) {
    throw new TransferError('TRANSFER_WORLD_INVALID');
  }

  return revalidated.ok ? revalidated.values : cleaned;
}

function normalizeVersionOrigin(
  origin: string,
  warnings: TransferWarningCollector,
): 'auto' | 'manual' | 'restore' {
  if (origin === 'auto' || origin === 'manual' || origin === 'restore') {
    return origin;
  }

  warnings.add('unknown-version-origin');
  return 'auto';
}

function normalizeOptionalLabel(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }

  const value = raw.trim();

  return value.length === 0 ? null : value;
}

function parseMetadata(
  raw: string,
): Readonly<Record<string, string | number | boolean>> | null {
  let value: unknown;

  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  return isRelationMetadata(value) ? value : null;
}
