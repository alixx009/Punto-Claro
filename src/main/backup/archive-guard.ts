import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(inflateRaw);

export const BACKUP_WORKBOOK_LIMITS = {
  maxFileBytes: 64 * 1024 * 1024,
  maxSnapshotBytes: 64 * 1024 * 1024,
  maxSettingsBytes: 512 * 1024,
  maxExpandedBytes: 128 * 1024 * 1024,
  maxZipPartBytes: 96 * 1024 * 1024,
  maxZipEntries: 2048,
  maxSheets: 128,
  maxRows: 1_048_576,
  maxColumns: 16_384,
  maxCells: 2_000_000,
  chunkCharacters: 30_000,
} as const;

const ALLOWED_PART =
  /^(?:\[Content_Types\]\.xml|_rels\/(?:\.rels)?|xl\/|xl\/_rels\/(?:workbook\.xml\.rels)?|xl\/worksheets\/(?:sheet[1-9]\d*\.xml)?|xl\/theme\/(?:theme1\.xml)?|xl\/(?:workbook|sharedStrings|styles)\.xml|docProps\/(?:core\.xml|app\.xml)?)$/;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function invalidArchive(): never {
  throw new Error(
    "El archivo no es un respaldo válido de SUMA POS o está dañado. Selecciona un archivo .xlsx generado con Respaldo integral.",
  );
}

function oversizedArchive(): never {
  throw new Error(
    "El respaldo supera los límites de tamaño o de celdas permitidos para importarlo de forma segura.",
  );
}

function guardExtraFields(buffer: Buffer, expectedName: string): void {
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) invalidArchive();
    const kind = buffer.readUInt16LE(offset);
    const size = buffer.readUInt16LE(offset + 2);
    if (kind === 0x0001 || offset + 4 + size > buffer.length) invalidArchive();
    // JSZip also recognizes Unicode path extra fields. Both names must agree.
    if (
      kind === 0x7075 &&
      (size < 5 ||
        buffer[offset + 4] !== 1 ||
        buffer.readUInt32LE(offset + 5) !==
          crc32(Buffer.from(expectedName, "utf8")) ||
        buffer.subarray(offset + 9, offset + 4 + size).toString("utf8") !==
          expectedName)
    )
      invalidArchive();
    offset += 4 + size;
  }
}

function columnNumber(letters: string): number {
  let result = 0;
  for (const letter of letters.toUpperCase())
    result = result * 26 + letter.charCodeAt(0) - 64;
  return result;
}

/**
 * Validate bounded, actual decompression before ExcelJS builds cell objects.
 * No archive paths are extracted and no workbook instructions are executed.
 */
export async function guardBackupWorkbookArchive(
  buffer: Buffer,
): Promise<void> {
  if (buffer.length > BACKUP_WORKBOOK_LIMITS.maxFileBytes)
    throw new Error("El archivo de respaldo no puede superar 64 MB.");
  if (buffer.length < 22) invalidArchive();

  let directoryEnd = -1;
  for (
    let offset = buffer.length - 22;
    offset >= Math.max(0, buffer.length - 22 - 65_535);
    offset -= 1
  ) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      directoryEnd = offset;
      break;
    }
  }
  if (directoryEnd < 0) invalidArchive();

  const entries = buffer.readUInt16LE(directoryEnd + 10);
  const directorySize = buffer.readUInt32LE(directoryEnd + 12);
  const directoryStart = buffer.readUInt32LE(directoryEnd + 16);
  if (
    buffer.readUInt16LE(directoryEnd + 4) !== 0 ||
    buffer.readUInt16LE(directoryEnd + 6) !== 0 ||
    buffer.readUInt16LE(directoryEnd + 8) !== entries ||
    entries < 1 ||
    entries > BACKUP_WORKBOOK_LIMITS.maxZipEntries ||
    directoryStart + directorySize !== directoryEnd
  )
    invalidArchive();

  const names = new Set<string>();
  const localRanges: { start: number; end: number }[] = [];
  let offset = directoryStart;
  let expandedBytes = 0;
  let sheetCount = 0;
  let totalCells = 0;
  let totalRowAddresses = 0;
  let sharedStrings = 0;
  for (let index = 0; index < entries; index += 1) {
    if (
      offset + 46 > directoryEnd ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    )
      invalidArchive();

    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const expectedCrc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameSize + extraSize + commentSize;
    if (nextOffset > directoryEnd) invalidArchive();
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameSize)
      .toString("utf8");
    const unixMode = buffer.readUInt32LE(offset + 38) >>> 16;
    if (
      !ALLOWED_PART.test(name) ||
      names.has(name) ||
      flags & ~0x0808 ||
      ![0, 8].includes(method) ||
      buffer.readUInt16LE(offset + 34) !== 0 ||
      (unixMode & 0xf000) === 0xa000
    )
      invalidArchive();
    guardExtraFields(
      buffer.subarray(
        offset + 46 + nameSize,
        offset + 46 + nameSize + extraSize,
      ),
      name,
    );
    names.add(name);

    expandedBytes += expandedSize;
    if (
      expandedSize > BACKUP_WORKBOOK_LIMITS.maxZipPartBytes ||
      expandedBytes > BACKUP_WORKBOOK_LIMITS.maxExpandedBytes
    )
      oversizedArchive();
    if (
      localOffset + 30 > directoryStart ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50 ||
      buffer.readUInt16LE(localOffset + 6) !== flags ||
      buffer.readUInt16LE(localOffset + 8) !== method
    )
      invalidArchive();

    const localNameSize = buffer.readUInt16LE(localOffset + 26);
    const localExtraSize = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameSize + localExtraSize;
    let dataEnd = dataStart + compressedSize;
    if (
      dataStart > directoryStart ||
      dataEnd > directoryStart ||
      buffer
        .subarray(localOffset + 30, localOffset + 30 + localNameSize)
        .toString("utf8") !== name
    )
      invalidArchive();
    guardExtraFields(
      buffer.subarray(localOffset + 30 + localNameSize, dataStart),
      name,
    );
    if (!(flags & 8)) {
      if (
        buffer.readUInt32LE(localOffset + 14) !== expectedCrc ||
        buffer.readUInt32LE(localOffset + 18) !== compressedSize ||
        buffer.readUInt32LE(localOffset + 22) !== expandedSize
      )
        invalidArchive();
    } else {
      // An optional signature precedes a non-ZIP64 data descriptor.
      if (dataEnd + 12 > directoryStart) invalidArchive();
      if (buffer.readUInt32LE(dataEnd) === 0x08074b50) dataEnd += 4;
      if (
        dataEnd + 12 > directoryStart ||
        buffer.readUInt32LE(dataEnd) !== expectedCrc ||
        buffer.readUInt32LE(dataEnd + 4) !== compressedSize ||
        buffer.readUInt32LE(dataEnd + 8) !== expandedSize
      )
        invalidArchive();
      dataEnd += 12;
    }
    localRanges.push({ start: localOffset, end: dataEnd });

    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let contents: Buffer;
    try {
      contents =
        method === 0
          ? compressed
          : await inflate(compressed, {
              maxOutputLength: Math.max(1, expandedSize),
            });
    } catch {
      invalidArchive();
    }
    if (contents.length !== expandedSize || crc32(contents) !== expectedCrc)
      invalidArchive();
    if (name.endsWith("/")) {
      if (contents.length !== 0) invalidArchive();
    } else {
      const xml = contents.toString("utf8");
      if (
        !Buffer.from(xml, "utf8").equals(contents) ||
        /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) ||
        /<(?:[\w-]+:)?(?:f|hyperlink|externalLink|oleObject|control)\b/i.test(
          xml,
        ) ||
        (/macroEnabled|vbaProject|externalLink/i.test(xml) &&
          name === "[Content_Types].xml") ||
        /\bTargetMode\s*=\s*["']External["']/i.test(xml)
      )
        invalidArchive();

      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
        sheetCount += 1;
        if (sheetCount > BACKUP_WORKBOOK_LIMITS.maxSheets) oversizedArchive();
        let rows = 0;
        let lastRowAddress = 0;
        for (const _ of xml.matchAll(/<(?:[\w-]+:)?row\b/g)) {
          rows += 1;
          if (rows > BACKUP_WORKBOOK_LIMITS.maxRows) oversizedArchive();
        }
        for (const _ of xml.matchAll(/<(?:[\w-]+:)?c\b/g)) {
          totalCells += 1;
          if (totalCells > BACKUP_WORKBOOK_LIMITS.maxCells) oversizedArchive();
        }
        for (const match of xml.matchAll(
          /<(?:[\w-]+:)?col\b[^>]*\bmax\s*=\s*["'](\d+)["']/g,
        )) {
          if (Number(match[1]) > BACKUP_WORKBOOK_LIMITS.maxColumns)
            invalidArchive();
        }
        for (const match of xml.matchAll(
          /<(?:[\w-]+:)?(?:row|c)\b[^>]*\br\s*=\s*["']([A-Za-z]*)(\d+)["']/g,
        )) {
          const row = Number(match[2]);
          if (
            !Number.isSafeInteger(row) ||
            row < 1 ||
            row > BACKUP_WORKBOOK_LIMITS.maxRows ||
            (match[1] &&
              columnNumber(match[1]) > BACKUP_WORKBOOK_LIMITS.maxColumns)
          )
            invalidArchive();
          lastRowAddress = Math.max(lastRowAddress, row);
        }
        // Sparse row addresses can allocate huge arrays despite few real cells.
        totalRowAddresses += lastRowAddress;
        if (totalRowAddresses > BACKUP_WORKBOOK_LIMITS.maxCells)
          oversizedArchive();
      }
      if (name === "xl/sharedStrings.xml") {
        for (const _ of xml.matchAll(/<(?:[\w-]+:)?si\b/g)) {
          sharedStrings += 1;
          if (sharedStrings > BACKUP_WORKBOOK_LIMITS.maxCells)
            oversizedArchive();
        }
      }
    }
    offset = nextOffset;
  }
  if (
    offset !== directoryEnd ||
    !names.has("[Content_Types].xml") ||
    !names.has("_rels/.rels") ||
    !names.has("xl/workbook.xml") ||
    !names.has("xl/_rels/workbook.xml.rels") ||
    sheetCount < 3
  )
    invalidArchive();
  localRanges.sort((left, right) => left.start - right.start);
  let localEnd = 0;
  for (const range of localRanges) {
    if (range.start !== localEnd) invalidArchive();
    localEnd = range.end;
  }
  if (localEnd !== directoryStart) invalidArchive();
}
