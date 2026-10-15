import { useEffect, useState } from "react";
import { Dot, Eye, EyeClosed, Lock, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLink,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "../ui/navigation-menu";
import { Button } from "../ui/button";
import { SectionHelp } from "@/components/help/SectionHelp";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useCashRegister } from "@/hooks/useCashRegister";
import { dropdowns, ventaItem } from "./navItems";
import { getSettings, SETTINGS_CHANGED_EVENT } from "@/config/settings";
import { AperturaDialog } from "./dialogs/AperturaDialog";
import { CloseRegisterDialog } from "./dialogs/CloseRegisterDialog";
import { CashAdjustDialog } from "./dialogs/CashAdjustDialog";
import { NavLink, useLocation } from "react-router";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export const CustomMenu = () => {
  const { user, hasPermission, isAdmin, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const {
    session,
    shift,
    openingMoney,
    currentCash,
    cashMovements,
    expectedByMethod,
    openingInput,
    setOpeningInput,
    openRegister,
    closeRegister,
  } = useCashRegister();
  const [visibleSessionId, setVisibleSessionId] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState(
    () => getSettings().business.name,
  );
  const cashVisible = isAdmin && shift && visibleSessionId === session?.id;
  const canManageRegister =
    isAdmin || (!!session?.cashierId && session.cashierId === user?.id);
  const navigation = dropdowns
    .map((dropdown) => ({
      ...dropdown,
      items: dropdown.items.filter((item) => {
        if (item.path === "/productos") return hasPermission("stock.inspect");
        if (item.path === "/proveedores") return isAdmin;
        if (item.path === "/administracion/reportes")
          return hasPermission("reports.view");
        if (item.path === "/administracion/ajustes") return true;
        if (item.path.startsWith("/administracion/")) return isAdmin;
        return true;
      }),
    }))
    .filter((dropdown) => dropdown.items.length > 0);

  async function closeSession() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (cause) {
      setLogoutError(
        cause instanceof Error ? cause.message : "No se pudo cerrar la sesión.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  useEffect(() => {
    const updateName = () => setBusinessName(getSettings().business.name);
    window.addEventListener(SETTINGS_CHANGED_EVENT, updateName);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, updateName);
  }, []);

  const location = useLocation();
  const routeIsActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  useEffect(() => {
    setNavigationOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-navbar shrink-0 bg-card text-card-foreground">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex w-full min-w-0 items-center justify-between gap-3 xl:w-auto xl:justify-start">
          <span
            className="min-w-0 truncate text-sm font-semibold xl:max-w-44"
            title={businessName}
          >
            {businessName}
          </span>
          <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="xl:hidden"
                aria-label="Abrir menú de navegación"
              >
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Menú</DialogTitle>
                <DialogDescription className="break-words">
                  {businessName} · {user?.displayName}
                </DialogDescription>
              </DialogHeader>
              <nav
                className="flex min-w-0 flex-col gap-5"
                aria-label="Navegación principal"
              >
                <Button
                  asChild
                  variant={
                    routeIsActive(ventaItem.path) ? "secondary" : "ghost"
                  }
                  className="min-h-11 justify-start"
                >
                  <NavLink
                    to={ventaItem.path}
                    onClick={() => setNavigationOpen(false)}
                  >
                    <ventaItem.icon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />{" "}
                    {ventaItem.label}
                  </NavLink>
                </Button>
                {navigation.map((dropdown) => (
                  <section
                    key={dropdown.label}
                    aria-label={dropdown.label}
                    className="flex flex-col gap-1"
                  >
                    <h2 className="px-3 text-xs font-semibold text-muted-foreground">
                      {dropdown.label}
                    </h2>
                    {dropdown.items.map((item) => (
                      <Button
                        key={item.path}
                        asChild
                        variant={
                          routeIsActive(item.path) ? "secondary" : "ghost"
                        }
                        className="min-h-11 justify-start"
                      >
                        <NavLink
                          to={item.path}
                          onClick={() => setNavigationOpen(false)}
                        >
                          <item.icon
                            data-icon="inline-start"
                            aria-hidden="true"
                          />{" "}
                          {item.label}
                        </NavLink>
                      </Button>
                    ))}
                  </section>
                ))}
              </nav>
              <Separator />
              <div className="flex flex-col gap-2">
                {isAdmin ? (
                  <Button asChild variant="outline" className="min-h-11">
                    <NavLink
                      to="/cuenta"
                      onClick={() => setNavigationOpen(false)}
                    >
                      Mi cuenta
                    </NavLink>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={loggingOut}
                  onClick={() => void closeSession()}
                >
                  <LogOut data-icon="inline-start" aria-hidden="true" />{" "}
                  {loggingOut ? "Cerrando…" : "Cerrar sesión"}
                </Button>
                {logoutError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {logoutError}
                  </p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
          <NavigationMenu viewport={false} className="hidden xl:flex">
            <NavigationMenuList className="flex-wrap justify-start">
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  active={routeIsActive(ventaItem.path)}
                  className="h-9 flex-row items-center justify-center gap-2 px-3"
                >
                  <NavLink to={ventaItem.path}>
                    <ventaItem.icon aria-hidden="true" /> {ventaItem.label}
                  </NavLink>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {navigation.map((dropdown) => {
                const isDropdownActive = dropdown.items.some((item) =>
                  routeIsActive(item.path),
                );
                return (
                  <NavigationMenuItem key={dropdown.label}>
                    <NavigationMenuTrigger data-active={isDropdownActive}>
                      {dropdown.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-52 gap-1">
                        {dropdown.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <li key={item.path}>
                              <NavigationMenuLink
                                asChild
                                active={routeIsActive(item.path)}
                                className="w-full flex-row items-center justify-start gap-2"
                              >
                                <NavLink to={item.path}>
                                  <Icon aria-hidden="true" /> {item.label}
                                </NavLink>
                              </NavigationMenuLink>
                            </li>
                          );
                        })}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
          {isAdmin ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden xl:inline-flex"
              asChild
            >
              <NavLink to="/cuenta" title="Mi cuenta">
                <span className="max-w-28 truncate">{user?.displayName}</span>
              </NavLink>
            </Button>
          ) : (
            <span
              className="hidden max-w-28 truncate text-sm text-muted-foreground xl:inline"
              title={user?.displayName}
            >
              {user?.displayName}
            </span>
          )}
          <Separator
            orientation="vertical"
            className="hidden data-[orientation=vertical]:h-5 xl:block"
          />
          <Badge
            variant="outline"
            className="app-navbar-status"
            data-state={shift ? "open" : "closed"}
            aria-label={shift ? "Caja abierta" : "Caja cerrada"}
          >
            <Dot aria-hidden="true" />
            <span className="sm:hidden">{shift ? "Abierta" : "Cerrada"}</span>
            <span className="hidden sm:inline">
              {shift ? "Caja abierta" : "Caja cerrada"}
            </span>
          </Badge>

          <SectionHelp topic="register" compact />
          {!shift ? (
            <AperturaDialog
              openingInput={openingInput}
              onOpeningInput={setOpeningInput}
              onConfirm={openRegister}
            />
          ) : (
            <>
              <div className="flex min-h-8 items-center gap-1 rounded-md border border-border bg-card pl-2">
                <span
                  className="min-w-20 text-right font-mono text-sm tabular-nums xl:min-w-24"
                  aria-label={
                    cashVisible
                      ? `Efectivo en caja: ${mxn.format(currentCash)}`
                      : "Efectivo en caja oculto"
                  }
                >
                  {cashVisible ? mxn.format(currentCash) : "••••••"}
                </span>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      cashVisible
                        ? "Ocultar efectivo en caja"
                        : "Mostrar efectivo en caja"
                    }
                    aria-pressed={cashVisible}
                    title={
                      cashVisible
                        ? "Ocultar efectivo en caja"
                        : "Mostrar efectivo en caja"
                    }
                    onClick={() =>
                      setVisibleSessionId(
                        cashVisible ? null : (session?.id ?? null),
                      )
                    }
                  >
                    {cashVisible ? (
                      <Eye aria-hidden="true" />
                    ) : (
                      <EyeClosed aria-hidden="true" />
                    )}
                  </Button>
                ) : null}
              </div>
              {canManageRegister && hasPermission("cash.adjust") ? (
                <CashAdjustDialog />
              ) : null}
              {canManageRegister ? (
                <CloseRegisterDialog
                  openingMoney={openingMoney}
                  cashMovements={cashMovements}
                  expectedByMethod={expectedByMethod}
                  onClose={closeRegister}
                />
              ) : (
                <span className="min-w-0 break-words text-xs text-muted-foreground">
                  Caja de {session?.cashierName}
                </span>
              )}
            </>
          )}

          {!shift && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Cierre de caja"
              disabled
            >
              <Lock data-icon="inline-start" aria-hidden="true" />
              <span className="hidden sm:inline">Cierre de caja</span>
            </Button>
          )}
          <Separator
            orientation="vertical"
            className="hidden data-[orientation=vertical]:h-5 xl:block"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden xl:inline-flex"
            disabled={loggingOut}
            onClick={() => void closeSession()}
          >
            <LogOut data-icon="inline-start" />
            {loggingOut ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </div>
      </header>
      {logoutError ? (
        <p role="alert" className="px-4 pb-2 text-sm text-destructive">
          {logoutError}
        </p>
      ) : null}
    </div>
  );
};
