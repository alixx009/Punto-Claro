import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import { PRODUCT_IMPORT_LIMITS } from "../../shared/product-import";

const inflate = promisify(inflateRaw);

function invalidArchive(): never {
  throw new Error(
    "El archivo no es un libro XLSX válido. Guarda una copia en formato .xlsx e intenta de nuevo.",
  );
}

function guardExtraFields(buffer: Buffer, expectedName: string): void {
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) invalidArchive();
    const kind = buffer.readUInt16LE(offset);
    const size = buffer.readUInt16LE(offset + 2);
    if (kind === 0x0001 || offset + 4 + size > buffer.length) invalidArchive();
    // JSZip can use this field instead of the filename from the directory.
    if (
      kind === 0x7075 &&
      (size < 5 ||
        buffer.subarray(offset + 9, offset + 4 + size).toString("utf8") !==
          expectedName)
    )
      invalidArchive();
    offset += 4 + size;
  }
}

/** Bound actual decompression before ExcelJS expands the archive into its workbook model. */
export async function guardProductWorkbookArchive(
  buffer: Buffer,
  maxRows: number,
): Promise<void> {
  if (buffer.length > PRODUCT_IMPORT_LIMITS.maxFileBytes)
    throw new Error("El archivo de Excel no puede superar 25 MB.");
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
  const disk = buffer.readUInt16LE(directoryEnd + 4);
  const directoryDisk = buffer.readUInt16LE(directoryEnd + 6);
  const entriesOnDisk = buffer.readUInt16LE(directoryEnd + 8);
  const entryCount = buffer.readUInt16LE(directoryEnd + 10);
  const directorySize = buffer.readUInt32LE(directoryEnd + 12);
  const directoryStart = buffer.readUInt32LE(directoryEnd + 16);
  if (
    disk !== 0 ||
    directoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0 ||
    entryCount > PRODUCT_IMPORT_LIMITS.maxZipEntries ||
    directoryStart + directorySize !== directoryEnd
  )
    invalidArchive();

  const names = new Set<string>();
  let offset = directoryStart;
  let expandedBytes = 0;
  let worksheetCount = 0;
  let worksheetCells = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > directoryEnd ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    )
      invalidArchive();
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const localDisk = buffer.readUInt16LE(offset + 34);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameSize + extraSize + commentSize;
    if (nextOffset > directoryEnd || localDisk !== 0) invalidArchive();
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameSize)
      .toString("utf8");
    if (
      !name ||
      names.has(name) ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").some((part) => part === "..") ||
      flags & 1 ||
      ![0, 8].includes(method)
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
      expandedSize > PRODUCT_IMPORT_LIMITS.maxZipPartBytes ||
      expandedBytes > PRODUCT_IMPORT_LIMITS.maxUncompressedBytes
    )
      throw new Error(
        "El contenido de este Excel es demasiado grande. Usa la plantilla y elimina hojas o imágenes que no necesites.",
      );
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
    if (
      dataStart > directoryStart ||
      dataStart + compressedSize > directoryStart ||
      buffer
        .subarray(localOffset + 30, localOffset + 30 + localNameSize)
        .toString("utf8") !== name
    )
      invalidArchive();
    guardExtraFields(
      buffer.subarray(localOffset + 30 + localNameSize, dataStart),
      name,
    );
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
    if (contents.length !== expandedSize) invalidArchive();
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) {
      worksheetCount += 1;
      if (worksheetCount > 8)
        throw new Error("Usa un libro con un máximo de ocho hojas.");
      const xml = contents.toString("utf8");
      let worksheetRows = 0;
      for (const _ of xml.matchAll(/<(?:[\w-]+:)?row\b/gi)) {
        worksheetRows += 1;
        if (worksheetRows > maxRows + 1)
          throw new Error(
            `El libro supera el máximo de ${maxRows} filas de productos.`,
          );
      }
      for (const match of xml.matchAll(
        /<(?:[\w-]+:)?col\b[^>]*\bmax\s*=\s*["'](\d+)["']/gi,
      )) {
        if (Number(match[1]) > 16_384) invalidArchive();
      }
      for (const match of xml.matchAll(
        /<(?:[\w-]+:)?(?:row|c)\b[^>]*\br\s*=\s*["']([A-Z]*)(\d+)["']/gi,
      )) {
        const row = Number(match[2]);
        if (!Number.isSafeInteger(row) || row < 1 || row > maxRows + 1)
          throw new Error(
            `El libro debe contener como máximo ${maxRows.toLocaleString("es-MX")} filas de productos después del encabezado. Elimina las filas adicionales y guarda una copia.`,
          );
        if (match[1]) {
          worksheetCells += 1;
          let column = 0;
          for (const character of match[1].toUpperCase())
            column = column * 26 + character.charCodeAt(0) - 64;
          if (column > 100 || worksheetCells > (maxRows + 1) * 20)
            throw new Error(
              "El libro contiene demasiadas celdas. Conserva únicamente las columnas de la plantilla.",
            );
        }
      }
    }
    offset = nextOffset;
  }
  if (
    offset !== directoryEnd ||
    !names.has("[Content_Types].xml") ||
    !names.has("xl/workbook.xml") ||
    worksheetCount === 0
  )
    invalidArchive();
  if (names.has("xl/vbaProject.bin"))
    throw new Error("Usa un archivo .xlsx sin macros.");
}
