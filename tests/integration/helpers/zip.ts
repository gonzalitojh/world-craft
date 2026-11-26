import { crc32 } from 'node:zlib';

/** Entrada de un ZIP construido a mano para pruebas adversariales. */
export interface RawZipEntry {
  readonly name: string;
  readonly data: Buffer;
  readonly externalAttributes?: number;
  readonly flags?: number;
  /** Tamaño sin cifrar cuando el dato incluye una cabecera de cifrado. */
  readonly uncompressedSize?: number;
  /** Datos sobre los que se calcula el CRC (por defecto, `data`). */
  readonly crcData?: Buffer;
}

/**
 * Construye un ZIP en modo «store» con nombres arbitrarios.
 *
 * yazl valida las rutas y no permite `..`, así que las pruebas de traversal y
 * enlaces necesitan escribir el formato mínimo a mano. yauzl lo lee igual que
 * un ZIP normal.
 */
export function buildRawZip(entries: readonly RawZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const uncompressedSize = entry.uncompressedSize ?? entry.data.byteLength;
    const crc = crc32(entry.crcData ?? entry.data);
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.byteLength, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.byteLength, 26);
    local.writeUInt16LE(0, 28);

    const localOffset = offset;

    locals.push(local, name, entry.data);
    offset += 30 + name.byteLength + entry.data.byteLength;

    const central = Buffer.alloc(46);

    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.flags ?? 0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.byteLength, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(
      entry.externalAttributes ?? (0o100644 << 16) >>> 0,
      38,
    );
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, name);
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.byteLength, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 18);

  return Buffer.concat([...locals, centralBuffer, end]);
}
