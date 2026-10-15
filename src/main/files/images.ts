import { app, nativeImage } from "electron";
import { mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
} from "path";
import { cacheRemoteImage } from "./remote-images";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function imagesDir(): string {
  const dir = join(app.getPath("userData"), "images");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function saveImage(dataUrl: string): Promise<string> {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error(
      "Formato de imagen no válido: se esperaba un data URL base64",
    );
  }

  const mime = match[1];
  const base64 = match[2];
  if (base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
    throw new Error("La imagen supera el límite de 10 MB.");
  }
  const imageBuffer = Buffer.from(base64, "base64");
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera el límite de 10 MB.");
  }
  const ext = MIME_TO_EXT[mime] ?? "png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const target = join(imagesDir(), filename);

  await writeFile(target, imageBuffer);
  return target;
}

export async function readImage(localPath: string): Promise<string | null> {
  if (typeof localPath !== "string") return null;
  if (/^https?:\/\//i.test(localPath)) {
    try {
      localPath = await cacheRemoteImage(localPath);
    } catch {
      return null;
    }
  }
  const dir = normalize(imagesDir());
  const normalized = normalize(localPath);

  const rel = relative(dir, normalized);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;

  try {
    const thumbnailPath = join(
      dirname(normalized),
      `${basename(normalized, extname(normalized))}.thumb.png`,
    );
    try {
      const thumbnail = await readFile(thumbnailPath);
      return `data:image/png;base64,${thumbnail.toString("base64")}`;
    } catch {
      // Las imágenes existentes todavía pueden no tener miniatura.
    }

    const original = await readFile(normalized);
    try {
      const image = nativeImage.createFromBuffer(original);
      if (!image.isEmpty()) {
        const { width, height } = image.getSize();
        const scale = Math.min(1, 160 / Math.max(width, height));
        const thumbnail = image
          .resize({
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
            quality: "good",
          })
          .toPNG();
        await writeFile(thumbnailPath, thumbnail).catch(() => undefined);
        return `data:image/png;base64,${thumbnail.toString("base64")}`;
      }
    } catch {
      // Si Electron no puede crear una miniatura, conserva el formato original.
    }

    const mime =
      EXT_TO_MIME[extname(normalized).toLowerCase()] ??
      "application/octet-stream";
    return `data:${mime};base64,${original.toString("base64")}`;
  } catch {
    return null;
  }
}
