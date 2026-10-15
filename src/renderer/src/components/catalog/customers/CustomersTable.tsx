import { memo } from "react";
import { Banknote, Edit, Eye, Lock, Phone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mxn } from "./constants";
import { avatarColorFor, getInitial } from "./helpers";
import type { CustomerWithBalance } from "../../../../../shared/ipc";

interface CustomersTableProps {
  customers: CustomerWithBalance[];
  shift: boolean;
  canDelete: boolean;
  onOpenStatement: (customer: CustomerWithBalance) => void;
  onOpenPayment: (customer: CustomerWithBalance) => void;
  onEdit: (customer: CustomerWithBalance) => void;
  onAskDelete: (customer: CustomerWithBalance) => void;
}

export const CustomersTable = ({
  customers,
  shift,
  canDelete,
  onOpenStatement,
  onOpenPayment,
  onEdit,
  onAskDelete,
}: CustomersTableProps) => (
  <div className="min-h-72 min-w-0 flex-1 overflow-auto overscroll-contain lg:min-h-0">
    <Table className="min-w-[780px]">
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Contacto</TableHead>
          <TableHead>Saldo Deudor</TableHead>
          <TableHead className="text-right">Acciones y Gestión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={4}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              No hay clientes para mostrar.
            </TableCell>
          </TableRow>
        )}
        {customers.map((customer) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            shift={shift}
            canDelete={canDelete}
            onOpenStatement={onOpenStatement}
            onOpenPayment={onOpenPayment}
            onEdit={onEdit}
            onAskDelete={onAskDelete}
          />
        ))}
      </TableBody>
    </Table>
  </div>
);

interface CustomerRowProps {
  customer: CustomerWithBalance;
  shift: boolean;
  canDelete: boolean;
  onOpenStatement: (customer: CustomerWithBalance) => void;
  onOpenPayment: (customer: CustomerWithBalance) => void;
  onEdit: (customer: CustomerWithBalance) => void;
  onAskDelete: (customer: CustomerWithBalance) => void;
}

const CustomerRow = memo(
  ({
    customer,
    shift,
    canDelete,
    onOpenStatement,
    onOpenPayment,
    onEdit,
    onAskDelete,
  }: CustomerRowProps) => {
    const hasDebt = customer.balance > 0;
    return (
      <TableRow
        className="group cursor-pointer"
        onClick={() => onOpenStatement(customer)}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
                avatarColorFor(customer.name),
              )}
            >
              {getInitial(customer.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{customer.name}</p>
              <p className="text-xs text-muted-foreground">
                CUENTA: {customer.code}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {customer.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="size-3.5" />
              <span>{customer.phone}</span>
            </div>
          ) : (
            "Sin teléfono"
          )}
        </TableCell>
        <TableCell>
          {hasDebt ? (
            <Badge className="bg-red-500/10 text-red-500">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500" />
              {mxn.format(customer.balance)}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Al corriente</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1.5">
            <Button
              variant="default"
              size="sm"
              className="bg-green-600 text-white hover:cursor-pointer hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPayment(customer);
              }}
              disabled={!shift || !hasDebt}
              title={
                !shift
                  ? "Abre la caja para registrar abonos"
                  : hasDebt
                    ? "Registrar abono a la cuenta"
                    : "El cliente no tiene saldo pendiente"
              }
            >
              {shift ? <Banknote /> : <Lock />}
              Abonar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hover:cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStatement(customer);
              }}
            >
              <Eye />
              Detalles
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Editar"
              className="hover:cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(customer);
              }}
            >
              <Edit />
            </Button>
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar"
                className="text-destructive hover:cursor-pointer hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskDelete(customer);
                }}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

CustomerRow.displayName = "CustomerRow";
