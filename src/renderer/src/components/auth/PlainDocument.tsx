import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DOCUMENT =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Iniciar sesión</title></head><body></body></html>';

/** Separate document with browser defaults: no application CSS is imported. */
export function PlainDocument({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const resize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <iframe
      ref={frame}
      title="Acceso al punto de venta"
      srcDoc={DOCUMENT}
      sandbox="allow-same-origin allow-forms"
      width="100%"
      height={height}
      frameBorder="0"
      onLoad={() => setBody(frame.current?.contentDocument?.body ?? null)}
    >
      {body ? createPortal(children, body) : null}
    </iframe>
  );
}
