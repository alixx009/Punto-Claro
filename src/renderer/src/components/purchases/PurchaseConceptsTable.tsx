import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/components/sales-history/format";
import {
  evaluatePurchaseLine,
  purchaseUnitLabel,
  type PurchaseDraftLine,
} from "./purchaseUtils";

export function PurchaseConceptsTable({
  lines,
  locked,
  onEdit,
  onRemove,
}: {
  lines: PurchaseDraftLine[];
  locked: boolean;
  onEdit: (id: number, field: "quantity" | "unitCost", value: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <Table
      className="block md:table md:min-w-175"
      aria-label="Conceptos de la compra manual"
    >
      <TableCaption className="sr-only">
        Productos de la compra manual. Cantidades y costos editables.
      </TableCaption>
      <TableHeader className="hidden md:table-header-group">
        <TableRow>
          <TableHead>Descripción del concepto</TableHead>
          <TableHead className="w-44">Cantidad</TableHead>
          <TableHead className="w-48">Costo unitario</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
          <TableHead>
            <span className="sr-only">Quitar producto</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="block md:table-row-group">
        {!lines.length ? (
          <TableRow className="block md:table-row">
            <TableCell
              colSpan={5}
              className="block min-h-32 whitespace-normal px-4 py-8 text-center text-muted-foreground md:table-cell md:h-32"
            >
              <p className="italic">
                No hay conceptos agregados. Busca un producto arriba para
                añadirlo a la compra.
              </p>
            </TableCell>
          </TableRow>
        ) : (
          lines.map((line) => {
            const values = evaluatePurchaseLine(line);
            const id = line.product.id;
            return (
              <TableRow
                key={id}
                className="grid grid-cols-2 gap-x-3 p-3 md:table-row md:p-0"
              >
                <TableCell className="col-span-2 block min-w-0 whitespace-normal px-0 align-top md:table-cell md:max-w-80 md:px-2">
                  <p className="break-words font-medium">{line.product.name}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    SKU: {line.product.sku || "Sin SKU"}
                  </p>
                </TableCell>
                <TableCell className="block min-w-0 px-0 align-top whitespace-normal md:table-cell md:px-2">
                  <Field
                    data-invalid={Boolean(values.quantityError)}
                    data-disabled={locked}
                  >
                    <FieldLabel
                      htmlFor={`purchase-quantity-${id}`}
                      className="md:sr-only"
                    >
                      <span className="md:hidden">Cantidad</span>
                      <span className="hidden md:inline">
                        Cantidad de {line.product.name}
                      </span>
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={`purchase-quantity-${id}`}
                        aria-label={`Cantidad de ${line.product.name}`}
                        inputMode={
                          line.product.unit === "KG" ? "decimal" : "numeric"
                        }
                        value={line.quantity}
                        onChange={(event) =>
                          onEdit(id, "quantity", event.target.value)
                        }
                        disabled={locked}
                        autoComplete="off"
                        maxLength={12}
                        aria-invalid={Boolean(values.quantityError)}
                        aria-describedby={
                          values.quantityError
                            ? `purchase-quantity-error-${id}`
                            : undefined
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>
                          {purchaseUnitLabel[line.product.unit]}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {values.quantityError ? (
                      <FieldError id={`purchase-quantity-error-${id}`}>
                        {values.quantityError}
                      </FieldError>
                    ) : null}
                  </Field>
                </TableCell>
                <TableCell className="block min-w-0 px-0 align-top whitespace-normal md:table-cell md:px-2">
                  <Field
                    data-invalid={Boolean(values.costError)}
                    data-disabled={locked}
                  >
                    <FieldLabel
                      htmlFor={`purchase-cost-${id}`}
                      className="md:sr-only"
                    >
                      <span className="md:hidden">Costo unitario</span>
                      <span className="hidden md:inline">
                        Costo unitario de {line.product.name}
                      </span>
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`purchase-cost-${id}`}
                        aria-label={`Costo unitario de ${line.product.name}`}
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(event) =>
                          onEdit(id, "unitCost", event.target.value)
                        }
                        disabled={locked}
                        autoComplete="off"
                        maxLength={12}
                        aria-invalid={Boolean(values.costError)}
                        aria-describedby={
                          values.costError
                            ? `purchase-cost-error-${id}`
                            : undefined
                        }
                      />
                    </InputGroup>
                    {values.costError ? (
                      <FieldError id={`purchase-cost-error-${id}`}>
                        {values.costError}
                      </FieldError>
                    ) : null}
                  </Field>
                </TableCell>
                <TableCell className="block min-w-0 px-0 text-left align-top font-semibold tabular-nums md:table-cell md:px-2 md:text-right">
                  <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                    Subtotal
                  </span>
                  {values.lineTotal === null
                    ? "—"
                    : formatMoney(values.lineTotal)}
                </TableCell>
                <TableCell className="block px-0 text-right align-top md:table-cell md:px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locked}
                    onClick={() => onRemove(id)}
                    aria-label={`Quitar ${line.product.name} de la compra`}
                  >
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
