import { useLocation } from "react-router";
import { Hammer } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { dropdowns, ventaItem } from "@/components/custom/navItems";

const allNavItems = [
  ventaItem,
  ...dropdowns.flatMap((dropdown) => dropdown.items),
];

const findNavItemByPath = (pathname: string) =>
  allNavItems.find((item) => item.path === pathname) ?? null;

export const ComingSoon = () => {
  const location = useLocation();
  const item = findNavItemByPath(location.pathname);
  const Icon = item?.icon ?? Hammer;
  const label = item?.label;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto bg-canvas p-4 sm:p-8">
      <Card className="my-auto w-full max-w-md text-center">
        <CardHeader className="items-center gap-3 px-4 sm:px-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Icon className="size-7 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">
            {label ? `Sección "${label}" próximamente` : "Sección próximamente"}
          </CardTitle>
          <CardDescription>
            Esta área está en desarrollo y aún no está disponible.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground px-4 sm:px-6">
          Estamos trabajando para traerla pronto. Por ahora puedes seguir usando
          las pantallas de Venta, Productos y Clientes.
        </CardContent>
      </Card>
    </div>
  );
};
