import { useEffect, useRef } from "react";
import { isSectionHelpOpen } from "@/components/help/visibility";

const SCAN_INTERVAL_MS = 35;
const SCAN_FLUSH_MS = 120;

export function useScanner({
  enabled,
  onScan,
  onError,
}: {
  enabled: boolean;
  onScan: (code: string) => void;
  onError: () => void;
}) {
  const bufferRef = useRef<string>("");
  const lastKeyAtRef = useRef<number>(0);
  const flushTimerRef = useRef<number | null>(null);
  const scanRef = useRef(onScan);
  const errorRef = useRef(onError);
  scanRef.current = onScan;
  errorRef.current = onError;

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (isSectionHelpOpen()) {
        bufferRef.current = "";
        lastKeyAtRef.current = 0;
        if (flushTimerRef.current !== null) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Enter") {
        if (
          bufferRef.current.length >= 4 &&
          Date.now() - lastKeyAtRef.current < 500
        ) {
          e.preventDefault();
          e.stopPropagation();
          scanRef.current(bufferRef.current);
          bufferRef.current = "";
          return;
        }
        bufferRef.current = "";
        return;
      }

      if (isTyping) return;

      if (e.key.length === 1 && /\S/.test(e.key)) {
        const now = Date.now();
        const delta = now - lastKeyAtRef.current;
        if (delta > SCAN_INTERVAL_MS * 4) {
          bufferRef.current = "";
        }
        bufferRef.current += e.key;
        lastKeyAtRef.current = now;
        if (flushTimerRef.current !== null) {
          window.clearTimeout(flushTimerRef.current);
        }
        flushTimerRef.current = window.setTimeout(() => {
          if (
            !isSectionHelpOpen() &&
            bufferRef.current.length >= 6 &&
            Date.now() - lastKeyAtRef.current < SCAN_FLUSH_MS
          ) {
            scanRef.current(bufferRef.current);
          }
          bufferRef.current = "";
        }, SCAN_FLUSH_MS);
      } else {
        errorRef.current();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      bufferRef.current = "";
    };
  }, [enabled]);
}
