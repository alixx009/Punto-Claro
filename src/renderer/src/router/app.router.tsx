import { createHashRouter, Navigate } from "react-router";
import { lazy, Suspense, type ReactNode } from "react";
import type { PermissionKey } from "../../../shared/auth";
import { useAuth } from "@/auth/useAuth";
import { AccountScreen } from "@/components/auth/AccountScreen";
import { AppShell } from "@/components/layout/AppShell";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { SalesScreen } from "@/components/sales/SalesScreen";
import { ProductsScreen } from "@/components/catalog/products/ProductsScreen";
import { CustomersScreen } from "@/components/catalog/customers/CustomersScreen";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import SalesHistoryScreen from "@/components/sales-history/SalesHistoryScreen";
import { Skeleton } from "@/components/ui/skeleton";

const ReportsScreen = lazy(() => import("@/components/reports/ReportsScreen"));
const SuppliersScreen = lazy(
  () => import("@/components/catalog/suppliers/SuppliersScreen"),
);
const PurchasesScreen = lazy(
  () => import("@/components/purchases/PurchasesScreen"),
);

function AccessGuard({
  children,
  permission,
  adminOnly = false,
}: {
  children: ReactNode;
  permission?: PermissionKey;
  adminOnly?: boolean;
}) {
  const { isAdmin, hasPermission } = useAuth();
  if ((adminOnly && !isAdmin) || (permission && !hasPermission(permission)))
    return <Navigate to="/ventas" replace />;
  return children;
}

export const appRouter = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/ventas" replace /> },
      { path: "/ventas", element: <SalesScreen /> },
      {
        path: "/productos",
        element: (
          <AccessGuard permission="stock.inspect">
            <ProductsScreen />
          </AccessGuard>
        ),
      },
      { path: "/clientes", element: <CustomersScreen /> },
      {
        path: "/proveedores",
        element: (
          <AccessGuard adminOnly>
            <Suspense
              fallback={
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6"
                  role="status"
                  aria-label="Cargando proveedores"
                >
                  <Skeleton className="h-10 w-64 max-w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              <SuppliersScreen />
            </Suspense>
          </AccessGuard>
        ),
      },
      {
        path: "/cuenta",
        element: (
          <AccessGuard adminOnly>
            <AccountScreen />
          </AccessGuard>
        ),
      },
      {
        path: "/administracion/ajustes",
        element: <SettingsScreen />,
      },
      {
        path: "/administracion/compras",
        element: (
          <AccessGuard adminOnly>
            <Suspense
              fallback={
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6"
                  role="status"
                  aria-label="Cargando compras"
                >
                  <Skeleton className="h-10 w-64 max-w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              <PurchasesScreen />
            </Suspense>
          </AccessGuard>
        ),
      },
      {
        path: "/administracion/reportes",
        element: (
          <AccessGuard permission="reports.view">
            <Suspense
              fallback={
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6"
                  role="status"
                  aria-label="Cargando reportes"
                >
                  <Skeleton className="h-10 w-64 max-w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              }
            >
              <ReportsScreen />
            </Suspense>
          </AccessGuard>
        ),
      },
      { path: "/operaciones/notas", element: <SalesHistoryScreen /> },
      { path: "*", element: <ComingSoon /> },
    ],
  },
]);
