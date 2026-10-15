import {
  Mail,
  PackageSearch,
  Pencil,
  Phone,
  Plus,
  SearchX,
  Trash2,
} from "lucide-react";
import type { Supplier } from "../../../../../shared/suppliers";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supplierInitials } from "./supplierUtils";

interface SuppliersTableProps {
  suppliers: Supplier[];
  loading: boolean;
  busy: boolean;
  hasSearch: boolean;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onCreate: () => void;
  onClearSearch: () => void;
}

const LOADING_ROWS = [0, 1, 2, 3];

export function SuppliersTable({
  suppliers,
  loading,
  busy,
  hasSearch,
  onEdit,
  onDelete,
  onCreate,
  onClearSearch,
}: SuppliersTableProps) {
  if (!loading && suppliers.length === 0) {
    return (
      <Empty className="min-h-72">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {hasSearch ? (
              <SearchX aria-hidden />
            ) : (
              <PackageSearch aria-hidden />
            )}
          </EmptyMedia>
          <EmptyTitle>
            {hasSearch
              ? "No se encontraron proveedores"
              : "Tu catálogo de proveedores está vacío"}
          </EmptyTitle>
          <EmptyDescription>
            {hasSearch
              ? "Prueba con otro nombre, RFC o agente, o limpia la búsqueda para ver todos los registros."
              : "Registra tu primer proveedor para tener a mano sus contactos y datos comerciales."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {hasSearch ? (
            <Button variant="outline" onClick={onClearSearch}>
              Limpiar búsqueda
            </Button>
          ) : (
            <Button variant="info" onClick={onCreate} disabled={busy}>
              <Plus data-icon="inline-start" aria-hidden />
              Nuevo proveedor
            </Button>
          )}
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div aria-busy={loading}>
      {loading ? (
        <span className="sr-only" role="status">
          Cargando proveedores…
        </span>
      ) : null}
      <Table className="min-w-[850px]">
        <TableCaption className="sr-only">
          Catálogo de proveedores, contactos y datos fiscales
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Proveedor</TableHead>
            <TableHead>Agente de contacto</TableHead>
            <TableHead>Datos fiscales y dirección</TableHead>
            <TableHead className="pr-5 text-right">Gestión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? LOADING_ROWS.map((index) => (
                <TableRow key={index} aria-hidden>
                  <TableCell className="py-5 pl-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="size-8" />
                      <Skeleton className="size-8" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            : suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="py-5 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar size="lg" aria-hidden>
                        <AvatarFallback>
                          {supplierInitials(supplier.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex max-w-72 min-w-0 flex-col gap-1">
                        <span className="font-semibold whitespace-normal break-words">
                          {supplier.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ID #{String(supplier.id).padStart(4, "0")}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-64 flex-col gap-1.5">
                      <span className="font-medium whitespace-normal break-words">
                        {supplier.contactName ||
                          (supplier.phone
                            ? "Contacto sin nombre"
                            : "Automático CFDI")}
                      </span>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Phone
                            aria-hidden
                            className="size-3.5 shrink-0 text-destructive"
                          />
                          {supplier.phone}
                        </span>
                      ) : supplier.contactName ? (
                        <span className="text-xs text-muted-foreground">
                          Sin teléfono registrado
                        </span>
                      ) : null}
                      {supplier.email ? (
                        <span className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Mail
                            aria-hidden
                            className="mt-0.5 size-3.5 shrink-0"
                          />
                          <span className="whitespace-normal break-all">
                            {supplier.email}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-80 flex-col items-start gap-2">
                      {supplier.rfc ? (
                        <Badge variant="secondary">{supplier.rfc}</Badge>
                      ) : (
                        <Badge variant="warning">SIN RFC</Badge>
                      )}
                      {supplier.address ? (
                        <span className="text-sm whitespace-pre-line break-words text-muted-foreground">
                          {supplier.address}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          Dirección no registrada
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onEdit(supplier)}
                        disabled={busy}
                        aria-label={`Editar ${supplier.name}`}
                        title="Editar proveedor"
                      >
                        <Pencil data-icon="inline-start" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(supplier)}
                        disabled={busy}
                        aria-label={`Eliminar ${supplier.name}`}
                        title="Eliminar proveedor"
                      >
                        <Trash2 data-icon="inline-start" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
