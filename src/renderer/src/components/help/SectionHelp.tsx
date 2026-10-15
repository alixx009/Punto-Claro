import { useState } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { helpGuides, type HelpTopic } from "./guides";
import type { HelpAccess, HelpGuide } from "./types";

interface Props {
  topic: HelpTopic;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function SectionHelp({
  topic,
  label = "Ayuda",
  compact = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const { isAdmin, hasPermission } = useAuth();
  const guide: HelpGuide = helpGuides[topic];
  const canRead = (item: HelpAccess) =>
    (!item.adminOnly || isAdmin) &&
    (!item.permission || hasPermission(item.permission));
  const steps = guide.steps.filter(canRead);
  const notes = guide.notes?.filter(canRead) ?? [];
  const shortcuts = guide.shortcuts?.filter(canRead) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn("shrink-0", className)}
          title={`Ayuda: ${guide.title}`}
          aria-label={`Abrir tutorial de ${guide.title}`}
        >
          <Info data-icon="inline-start" aria-hidden="true" />
          {!compact && label}
        </Button>
      </DialogTrigger>
      <DialogContent
        data-section-help="true"
        className="flex flex-col overflow-hidden sm:max-w-xl sm:p-6"
      >
        <DialogHeader className="shrink-0 pr-6 text-left">
          <p className="text-xs font-medium text-muted-foreground">
            Guía rápida
          </p>
          <DialogTitle>{guide.title}</DialogTitle>
          <DialogDescription>{guide.description}</DialogDescription>
        </DialogHeader>
        <div
          role="region"
          aria-label={`Instrucciones de ${guide.title}`}
          tabIndex={0}
          className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto overscroll-contain pr-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ol className="flex list-decimal flex-col gap-4 pl-6 marker:font-semibold marker:text-muted-foreground">
            {steps.map((step) => (
              <li key={step.title} className="pl-1">
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
          {shortcuts.length > 0 && (
            <section
              className="flex flex-col gap-3"
              aria-label="Atajos de teclado"
            >
              <Separator />
              <h3 className="text-sm font-semibold">Atajos útiles</h3>
              <dl className="flex flex-col gap-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-start gap-3"
                  >
                    <dt className="flex w-24 shrink-0 flex-wrap gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">
                      {shortcut.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {notes.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Recordatorios">
              <Separator />
              <h3 className="text-sm font-semibold">Recuerda</h3>
              {notes.map((note) => (
                <p
                  key={note.text}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {note.text}
                </p>
              ))}
            </section>
          )}
        </div>
        <Separator className="shrink-0" />
        <DialogFooter className="shrink-0 items-center gap-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            También puedes cerrar con Esc.
          </p>
          <DialogClose asChild>
            <Button type="button" className="w-full sm:w-auto">
              Entendido
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
