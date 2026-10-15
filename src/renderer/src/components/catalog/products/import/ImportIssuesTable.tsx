import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductImportIssue } from "../../../../../../shared/product-import";

const PAGE_SIZE = 25;

export function ImportIssuesTable({
  issues,
  total,
  variant = "errors",
}: {
  issues: ProductImportIssue[];
  total: number;
  variant?: "errors" | "skipped";
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(issues.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const skipped = variant === "skipped";
  const titleId = skipped ? "import-skipped-title" : "import-issues-title";

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={titleId}>
      <h3 id={titleId} className="font-semibold">
        {skipped ? "Registros omitidos" : "Datos por corregir"}
      </h3>
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <Table className="min-w-96">
          <TableCaption className="sr-only">
            {skipped
              ? "Filas omitidas porque su SKU ya está registrado en el catálogo."
              : "Errores del archivo, indicando fila de Excel y columna."}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Fila</TableHead>
              <TableHead scope="col">{skipped ? "SKU" : "Columna"}</TableHead>
              <TableHead scope="col">
                {skipped ? "Motivo" : "Qué corregir"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.slice(start, start + PAGE_SIZE).map((issue, index) => (
              <TableRow key={`${start + index}-${issue.row}-${issue.column}`}>
                <TableCell className="align-top font-mono">
                  {issue.row ?? "Archivo"}
                </TableCell>
                <TableCell className="max-w-52 whitespace-normal align-top font-medium">
                  {issue.column}
                </TableCell>
                <TableCell className="min-w-56 whitespace-normal align-top">
                  {issue.message}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {issues.length ? start + 1 : 0}–
          {Math.min(start + PAGE_SIZE, issues.length)} de {issues.length}{" "}
          {skipped ? "registros" : "avisos"}
          {!skipped && total > issues.length
            ? ` · Hay ${total} errores en total; corrige estos y vuelve a cargar el archivo.`
            : ""}
        </p>
        {pageCount > 1 ? (
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
