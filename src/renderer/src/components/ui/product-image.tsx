import { useEffect, useState } from "react";

const MAX_CACHE_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let cacheBytes = 0;

function cachedImage(source: string): string | undefined {
  const value = cache.get(source);
  if (value) {
    cache.delete(source);
    cache.set(source, value);
  }
  return value;
}

function rememberImage(source: string, dataUrl: string): void {
  const bytes = dataUrl.length * 2;
  if (bytes > MAX_CACHE_BYTES) return;
  const previous = cache.get(source);
  if (previous) cacheBytes -= previous.length * 2;
  cache.delete(source);
  cache.set(source, dataUrl);
  cacheBytes += bytes;
  while (cacheBytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cacheBytes -= cache.get(oldest)!.length * 2;
    cache.delete(oldest);
  }
}

function loadStoredImage(source: string): Promise<string | null> {
  const existing = pending.get(source);
  if (existing) return existing;
  const request = window.api.images
    .read(source)
    .then((dataUrl) => {
      if (dataUrl) rememberImage(source, dataUrl);
      return dataUrl;
    })
    .finally(() => pending.delete(source));
  pending.set(source, request);
  return request;
}

// Embedded placeholder works without a network request or a persisted file path.
export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f4f4f5"/><g fill="none" stroke="#a1a1aa" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><rect x="132" y="117" width="136" height="128" rx="12"/><circle cx="170" cy="153" r="12"/><path d="m140 225 43-47 31 32 21-22 25 31"/></g><text x="200" y="290" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#71717a">Sin imagen</text></svg>')}`;

function isEmbedded(source: string): boolean {
  return source.startsWith("data:");
}

export function ProductImage({
  source,
  alt,
  className,
}: {
  source: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string>(() => {
    if (!source) return PLACEHOLDER_IMAGE;
    if (isEmbedded(source)) return source;
    return cache.get(source) ?? PLACEHOLDER_IMAGE;
  });

  useEffect(() => {
    if (!source) {
      setSrc(PLACEHOLDER_IMAGE);
      return;
    }

    if (isEmbedded(source)) {
      setSrc(source);
      return;
    }

    const cached = cachedImage(source);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    setSrc(PLACEHOLDER_IMAGE);
    void loadStoredImage(source)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl ?? PLACEHOLDER_IMAGE);
      })
      .catch(() => {
        if (!cancelled) setSrc(PLACEHOLDER_IMAGE);
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => {
        if (src !== PLACEHOLDER_IMAGE) setSrc(PLACEHOLDER_IMAGE);
      }}
    />
  );
}
