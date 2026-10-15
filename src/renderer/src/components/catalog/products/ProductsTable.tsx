import { Box, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKg } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import type { Product } from "../../../../../shared/ipc";
import { mxn } from "./model";

interface ProductsTableProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  onAskDelete: (product: Product) => void;
}

export function ProductsTable({
  products,
  loading,
  onEdit,
  onAdjustStock,
  onAskDelete,
}: ProductsTableProps) {
  const { isAdmin, hasPermission } = useAuth();
  const canViewCosts = hasPermission("costs.view");
  const columns = 4 + Number(canViewCosts) + Number(isAdmin);
  return (
    <div className="min-h-72 min-w-0 flex-1 overflow-auto overscroll-contain lg:min-h-0">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Imagen</TableHead>
            <TableHead>Detalles del producto</TableHead>
            {canViewCosts ? <TableHead>Precio compra</TableHead> : null}
            <TableHead>Precio venta</TableHead>
            <TableHead>Stock</TableHead>
            {isAdmin ? (
              <TableHead className="text-right">Acciones</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                {loading
                  ? "Cargando productos..."
                  : "No hay productos para mostrar."}
              </TableCell>
            </TableRow>
          )}
          {products.map((product) => (
            <TableRow key={product.id} className="group">
              <TableCell>
                <ProductImage
                  source={product.imageUrl}
                  alt={product.name}
                  className="size-10 rounded-md border border-border object-contain"
                />
              </TableCell>
              <TableCell className="max-w-80 whitespace-normal">
                <p className="font-medium">{product.name}</p>
                <p className="break-words text-xs text-muted-foreground">
                  SKU: {product.sku} | Prov: {product.providerCode} |{" "}
                  {product.brand}
                </p>
              </TableCell>
              {canViewCosts ? (
                <TableCell className="text-muted-foreground">
                  {product.purchasePrice === null
                    ? "—"
                    : mxn.format(product.purchasePrice)}
                </TableCell>
              ) : null}
              <TableCell className="font-semibold">
                {mxn.format(product.salePrice)}
              </TableCell>
              <TableCell>
                <Badge className="bg-green-500/10 text-green-500">
                  {product.unit === "KG"
                    ? formatKg(product.stock)
                    : product.stock}{" "}
                  {product.unit.charAt(0).toUpperCase() + product.unit.slice(1)}
                </Badge>
              </TableCell>
              {isAdmin ? (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => onEdit(product)}
                    >
                      <Edit />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ajustar existencias"
                      title="Ajustar existencias"
                      onClick={() => onAdjustStock(product)}
                    >
                      <Box />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      className="text-red-500 hover:text-red-500"
                      onClick={() => onAskDelete(product)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
