import { app, nativeImage } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { join } from "node:path";

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const MAX_CACHED_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const DOWNLOAD_TIMEOUT_MS = 25_000;
const MAX_DOWNLOADS = 4;
const MAX_WAITERS = 256;
const inFlight = new Map<string, Promise<string>>();
const waiters: Array<() => void> = [];
let activeDownloads = 0;

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv6");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");

function publicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? !blockedAddresses.check(address, "ipv4")
    : family === 6 &&
        globalIPv6.check(address, "ipv6") &&
        !blockedAddresses.check(address, "ipv6");
}

function remoteUrl(value: string): URL {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("El enlace de la imagen no es válido.");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("El enlace de la imagen no es válido.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(
      "Usa un enlace HTTP o HTTPS a una imagen, sin credenciales.",
    );
  url.hash = "";
  return url;
}

async function downloadSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeDownloads >= MAX_DOWNLOADS) {
    if (waiters.length >= MAX_WAITERS)
      throw new Error(
        "Hay demasiadas imágenes en proceso. Vuelve a intentarlo.",
      );
    await new Promise<void>((resolve) => waiters.push(resolve));
  } else activeDownloads++;
  try {
    return await operation();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else activeDownloads--;
  }
}

async function checkedAddresses(url: URL, signal: AbortSignal) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const resolve = isIP(host)
    ? Promise.resolve([{ address: host, family: isIP(host) }])
    : lookup(host, { all: true, verbatim: true });
  let stop: (() => void) | undefined;
  try {
    const addresses = await Promise.race([
      resolve,
      new Promise<never>((_resolve, reject) => {
        stop = () =>
          reject(
            new Error(
              "La descarga tardó demasiado. Revisa tu conexión e inténtalo otra vez.",
            ),
          );
        if (signal.aborted) stop();
        else signal.addEventListener("abort", stop, { once: true });
      }),
    ]);
    if (
      !addresses.length ||
      addresses.some(({ address }) => !publicAddress(address))
    )
      throw new Error(
        "El enlace debe apuntar a una imagen pública en internet.",
      );
    return addresses.find(({ family }) => family === 4) ?? addresses[0];
  } finally {
    if (stop) signal.removeEventListener("abort", stop);
  }
}

async function responseFor(
  url: URL,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  const address = await checkedAddresses(url, signal);
  return new Promise((resolve, reject) => {
    // Pin the checked DNS address while preserving the original Host and TLS hostname.
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        agent: false,
        family: address.family,
        lookup: (_host, _options, done) =>
          done(null, address.address, address.family),
        signal,
        maxHeaderSize: 16 * 1024,
        headers: {
          Accept: "image/*",
          "Accept-Encoding": "identity",
          "User-Agent": "SUMA-POS/1.0",
        },
      },
      resolve,
    );
    request.once("error", reject);
    request.end();
  });
}

async function download(url: URL): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await responseFor(url, controller.signal);
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || redirects === 5)
          throw new Error("El enlace tiene demasiadas redirecciones.");
        url = remoteUrl(new URL(location, url).href);
        continue;
      }
      if (response.statusCode !== 200) {
        response.destroy();
        throw new Error(
          `El servidor de la imagen respondió con error ${response.statusCode ?? "desconocido"}.`,
        );
      }
      const type = response.headers["content-type"]
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      const encoding = response.headers["content-encoding"];
      if (
        (type &&
          !type.startsWith("image/") &&
          type !== "application/octet-stream") ||
        (encoding && encoding !== "identity")
      ) {
        response.destroy();
        throw new Error(
          "El enlace no devuelve un archivo de imagen compatible.",
        );
      }
      if (Number(response.headers["content-length"]) > MAX_DOWNLOAD_BYTES) {
        response.destroy();
        throw new Error("La imagen supera el límite de 10 MB.");
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of response) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_DOWNLOAD_BYTES) {
          response.destroy();
          throw new Error("La imagen supera el límite de 10 MB.");
        }
        chunks.push(bytes);
      }
      if (!size || !response.complete)
        throw new Error(
          "No se recibió la imagen completa. Vuelve a intentarlo.",
        );
      return Buffer.concat(chunks, size);
    }
    throw new Error("No se pudo descargar la imagen.");
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "La descarga tardó demasiado. Revisa tu conexión e inténtalo otra vez.",
      );
    if (error instanceof Error && /^(El |La |No |Usa )/.test(error.message))
      throw error;
    throw new Error(
      "No se pudo descargar la imagen. Revisa la conexión y que el enlace sea público.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function imageDimensions(bytes: Buffer): { width: number; height: number } {
  if (
    bytes.length >= 24 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  )
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6)))
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (bytes.length >= 30 && bytes.toString("ascii", 0, 2) === "BM") {
    const dib = bytes.readUInt32LE(14);
    if (dib === 12)
      return { width: bytes.readUInt16LE(18), height: bytes.readUInt16LE(20) };
    if (dib >= 40)
      return {
        width: Math.abs(bytes.readInt32LE(18)),
        height: Math.abs(bytes.readInt32LE(22)),
      };
  }
  if (
    bytes.length >= 25 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const kind = bytes.toString("ascii", 12, 16);
    if (kind === "VP8X" && bytes.length >= 30)
      return {
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    if (
      kind === "VP8 " &&
      bytes.length >= 30 &&
      bytes.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))
    )
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 7
      )
        return {
          width: bytes.readUInt16BE(offset + 5),
          height: bytes.readUInt16BE(offset + 3),
        };
      offset += length;
    }
  }
  throw new Error(
    "Usa un enlace directo a una imagen PNG, JPG, WEBP, GIF o BMP.",
  );
}

const IMAGE_EXTENSIONS = ["png", "jpg", "webp", "gif", "bmp"] as const;
type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

function imageExtension(bytes: Buffer): ImageExtension {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.toString("ascii", 1, 4) === "PNG") return "png";
  if (bytes.toString("ascii", 0, 3) === "GIF") return "gif";
  if (bytes.toString("ascii", 0, 2) === "BM") return "bmp";
  if (bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new Error("El archivo no es una imagen compatible.");
}

function localImage(bytes: Buffer): {
  bytes: Buffer;
  extension: ImageExtension;
} {
  const { width, height } = imageDimensions(bytes);
  if (
    !width ||
    !height ||
    width > 16_384 ||
    height > 16_384 ||
    width * height > MAX_PIXELS
  )
    throw new Error(
      "La imagen es demasiado grande. Usa una fotografía de hasta 24 megapíxeles.",
    );
  const extension = imageExtension(bytes);
  // Electron's native decoder supports PNG/JPEG. Keep other raster formats as files
  // so Chromium can display them offline, without requiring another image library.
  if (extension !== "png" && extension !== "jpg") return { bytes, extension };
  const image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty())
    throw new Error("No se pudo abrir la imagen. Usa un archivo PNG o JPG.");
  const size = image.getSize();
  if (size.width * size.height > MAX_PIXELS)
    throw new Error("La imagen es demasiado grande.");
  const scale = Math.min(1, 800 / Math.max(size.width, size.height));
  const png = image
    .resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
      quality: "good",
    })
    .toPNG();
  if (!png.length || png.length > MAX_CACHED_BYTES)
    throw new Error("No se pudo preparar la imagen para guardarla.");
  return { bytes: png, extension: "png" };
}

async function cachedFile(
  path: string,
  extension: ImageExtension,
): Promise<boolean> {
  try {
    const info = await stat(path);
    if (!info.isFile() || !info.size || info.size > MAX_CACHED_BYTES)
      return false;
    const bytes = await readFile(path);
    const { width, height } = imageDimensions(bytes);
    return (
      bytes.length <= MAX_CACHED_BYTES &&
      imageExtension(bytes) === extension &&
      width > 0 &&
      height > 0 &&
      width <= 16_384 &&
      height <= 16_384 &&
      width * height <= MAX_PIXELS
    );
  } catch {
    return false;
  }
}

/** Stable URL-based files are reusable across products, imports and offline app restarts. */
export async function cacheRemoteImage(source: string): Promise<string> {
  const url = remoteUrl(source);
  const key = url.href;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const operation = (async () => {
    const dir = join(app.getPath("userData"), "images");
    const hash = createHash("sha256").update(key).digest("hex");
    for (const extension of IMAGE_EXTENSIONS) {
      const stored = join(dir, `remote-${hash}.${extension}`);
      if (await cachedFile(stored, extension)) return stored;
    }
    return downloadSlot(async () => {
      const { bytes, extension } = localImage(await download(url));
      const target = join(dir, `remote-${hash}.${extension}`);
      await mkdir(dir, { recursive: true });
      const temporary = join(dir, `remote-${hash}-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, bytes, { flag: "wx" });
        await rename(temporary, target);
        return target;
      } catch {
        // A second app process may have finished the same URL while this one downloaded.
        if (await cachedFile(target, extension)) return target;
        throw new Error(
          "No se pudo guardar la imagen localmente. Revisa el espacio disponible y los permisos de la app.",
        );
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    });
  })();
  inFlight.set(key, operation);
  try {
    return await operation;
  } finally {
    inFlight.delete(key);
  }
}
