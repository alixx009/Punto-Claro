import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import type { ProductImportRow } from "../../../../../../shared/product-import";
import { mxn } from "../model";

const PAGE_SIZE = 25;
const quantities = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const units = { PIEZA: "Pieza", KG: "kg", PAQ: "Paquete" };

export function ImportProductsTable({ rows }: { rows: ProductImportRow[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;

  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      aria-labelledby="import-products-title"
    >
      <h3 id="import-products-title" className="font-semibold">
        Productos revisados
      </h3>
      <div className="min-w-0 overflow-hidden rounded-lg border">
        <Table className="min-w-240">
          <TableCaption className="sr-only">
            Productos válidos del archivo seleccionado. Cada fila indica su
            posición original en Excel.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Fila</TableHead>
              <TableHead scope="col">Código / SKU</TableHead>
              <TableHead scope="col">Producto</TableHead>
              <TableHead scope="col">Familia / categoría</TableHead>
              <TableHead scope="col">Unidad</TableHead>
              <TableHead scope="col" className="text-right">
                Existencias
              </TableHead>
              <TableHead scope="col" className="text-right">
                Compra
              </TableHead>
              <TableHead scope="col" className="text-right">
                Venta
              </TableHead>
              <TableHead scope="col" className="text-right">
                Mayoreo
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows
              .slice(start, start + PAGE_SIZE)
              .map(({ sourceRow, input }) => (
                <TableRow key={sourceRow}>
                  <TableCell className="align-top font-mono text-muted-foreground">
                    {sourceRow}
                  </TableCell>
                  <TableCell className="max-w-52 whitespace-normal break-all align-top font-mono">
                    {input.sku}
                  </TableCell>
                  <TableCell className="min-w-48 max-w-72 whitespace-normal align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{input.name}</span>
                      {input.brand ? (
                        <span className="text-xs text-muted-foreground">
                          {input.brand}
                        </span>
                      ) : null}
                      {input.providerCode ? (
                        <span className="text-xs text-muted-foreground">
                          Catálogo: {input.providerCode}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-48 whitespace-normal align-top">
                    {input.category}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="secondary">{units[input.unit]}</Badge>
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {quantities.format(input.stock)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {mxn.format(input.purchasePrice ?? 0)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {mxn.format(input.salePrice)}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">
                    {mxn.format(input.wholesalePrice ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          Mostrando {rows.length ? start + 1 : 0}–
          {Math.min(start + PAGE_SIZE, rows.length)} de {rows.length} productos
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
