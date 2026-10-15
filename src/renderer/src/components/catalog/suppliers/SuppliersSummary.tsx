import { Boxes, ContactRound, FileCheck2 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SuppliersSummaryProps {
  metrics: { total: number; directContact: number; fiscalRegistration: number };
  loading: boolean;
  unavailable: boolean;
}

export function SuppliersSummary({
  metrics,
  loading,
  unavailable,
}: SuppliersSummaryProps) {
  const cards = [
    {
      title: "Total proveedores",
      count: metrics.total,
      caption: "registros en el catálogo",
      icon: Boxes,
    },
    {
      title: "Con enlace directo",
      count: metrics.directContact,
      caption: "vendedores dados de alta",
      icon: ContactRound,
    },
    {
      title: "Con registro fiscal",
      count: metrics.fiscalRegistration,
      caption: "con RFC válidos",
      icon: FileCheck2,
    },
  ];

  return (
    <section
      aria-label="Resumen de proveedores"
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
    >
      {cards.map(({ title, count, caption, icon: Icon }) => (
        <Card key={title} className="min-w-0 gap-3 py-4 sm:gap-4 sm:py-5">
          <CardHeader className="gap-1 px-4 sm:px-5">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{caption}</CardDescription>
            <CardAction>
              <Icon aria-hidden className="size-5 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="px-4 sm:px-5">
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {unavailable ? "—" : count.toLocaleString("es-MX")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
