import { cn } from "@/lib/utils";
import type { TicketTemplate } from "@/config/settings";

export function TicketDivider({ template }: { template: TicketTemplate }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("block w-full shrink-0", template === "compact" ? "my-2" : "my-3")}
      height="8"
      xmlns="http://www.w3.org/2000/svg"
    >
      {template === "classic" && (
        <line x1="0" y1="4" x2="100%" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" />
      )}
      {template === "modern" && (
        <line x1="0" y1="4" x2="100%" y2="4" stroke="currentColor" strokeWidth="2" />
      )}
      {template === "compact" && (
        <line x1="0" y1="4" x2="100%" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 3" strokeLinecap="round" />
      )}
      {template === "framed" && (
        <>
          <line x1="0" y1="2" x2="100%" y2="2" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="6" x2="100%" y2="6" stroke="currentColor" strokeWidth="1" />
        </>
      )}
      {template === "multiline" && (
        <line x1="0" y1="4" x2="100%" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="12 3 2 3" />
      )}
    </svg>
  );
}
