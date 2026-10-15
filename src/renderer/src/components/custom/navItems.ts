import type { LucideIcon } from "lucide-react";
import { storeName } from "@/config/store";
import {
  Banknote,
  ChartColumn,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Van,
} from "lucide-react";

export { storeName };

interface NavLinkItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface NavDropdown {
  label: string;
  items: NavLinkItem[];
}

export const ventaItem: NavLinkItem = {
  label: "Venta",
  icon: ShoppingCart,
  path: "/ventas",
};

export const dropdowns: NavDropdown[] = [
  {
    label: "Operaciones",
    items: [
      { label: "Notas de venta", icon: Banknote, path: "/operaciones/notas" },
    ],
  },
  {
    label: "Catalogos",
    items: [
      { label: "Productos", icon: Package, path: "/productos" },
      { label: "Clientes", icon: Users, path: "/clientes" },
      { label: "Proveedores", icon: Van, path: "/proveedores" },
    ],
  },
  {
    label: "Administracion",
    items: [
      { label: "Compras", icon: ShoppingBag, path: "/administracion/compras" },
      {
        label: "Reportes",
        icon: ChartColumn,
        path: "/administracion/reportes",
      },
      { label: "Ajustes", icon: Settings, path: "/administracion/ajustes" },
    ],
  },
];
