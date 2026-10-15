import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastData {
  id: number;
  kind: "success" | "error";
  text: string;
}

interface ToastProps {
  toast: ToastData;
}

export const Toast = ({ toast }: ToastProps) => (
  <div
    key={toast.id}
    className={cn(
      "pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur",
      toast.kind === "success"
        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50"
        : "border-red-500/40 bg-red-500/15 text-red-50",
    )}
  >
    {toast.kind === "success" ? (
      <CheckCircle2 className="size-4" />
    ) : (
      <AlertCircle className="size-4" />
    )}
    <span className="text-sm font-medium">{toast.text}</span>
  </div>
);
