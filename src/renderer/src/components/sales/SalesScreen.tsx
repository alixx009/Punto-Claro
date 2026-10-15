import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import { isSectionHelpOpen } from "@/components/help/visibility";
import { SectionHelp } from "@/components/help/SectionHelp";
import {
  assertSessionDataEpoch,
  getSessionDataEpoch,
} from "@/data/sessionEpoch";
import { subscribe, loadProducts, refreshProducts } from "@/data/productStore";
import {
  subscribeCustomers,
  loadCustomers,
  refreshCustomers,
} from "@/data/customersStore";
import {
  getRegisterSession,
  subscribeRegisterSession,
  loadRegisterSession,
} from "@/data/registerStore";
import { createTicket } from "@/data/ticketStore";
import { getSettings } from "@/config/settings";
import { TicketDialog, buildTicketPayload } from "./TicketDialog";
import { CurrentOrder } from "./CurrentOrder";
import { PaymentDialog } from "./PaymentDialog";
import { SearchToolbar, ProductCard } from "./SalesCatalog";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { CustomerPickerDialog } from "./CustomerPickerDialog";
import { WeightQuantityDialog } from "./WeightQuantityDialog";
import { useScanner } from "./useScanner";
import type {
  CustomerWithBalance,
  Product,
  SalePaymentInput,
  TicketPayload,
} from "../../../../shared/ipc";
import { roundMoney } from "../../../../shared/money";
import {
  cartItemFromProduct,
  loadHeldOrders,
  restoreOrder,
  saveHeldOrders,
} from "./heldOrders";
import type { CartItem, HeldOrder } from "./heldOrders";

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

interface ToastMessage {
  id: number;
  kind: "success" | "error";
  text: string;
}

export function SalesScreen() {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [registerSession, setRegisterSession] = useState(() =>
    getRegisterSession(),
  );
  const canUseRegister =
    isAdmin ||
    (!!registerSession?.cashierId && registerSession.cashierId === user?.id);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerWithBalance | null>(null);

  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [weightRequest, setWeightRequest] = useState<{
    product: Product;
    clearSearch: boolean;
  } | null>(null);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() =>
    loadHeldOrders(user?.id ?? "", user?.isOwner ?? false),
  );
  const [ticketPayload, setTicketPayload] = useState<TicketPayload | null>(
    null,
  );
  const [ticketId, setTicketId] = useState<number | null>(null);
  const visibleTicketIdRef = useRef<number | null>(null);
  const printingTicketIdsRef = useRef(new Set<number>());
  const [printingTicketId, setPrintingTicketId] = useState<number | null>(null);
  const [printFeedback, setPrintFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [catalogPage, setCatalogPage] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<"catalog" | "order">(
    "catalog",
  );
  const saleSubmittingRef = useRef(false);
  const resumePendingRef = useRef(false);
  const cartRef = useRef(cart);
  const customerRef = useRef(selectedCustomer);
  const heldOrdersRef = useRef(heldOrders);
  cartRef.current = cart;
  customerRef.current = selectedCustomer;
  heldOrdersRef.current = heldOrders;

  const searchRef = useRef<HTMLInputElement | null>(null);

  const closeWeightDialog = () => {
    setWeightRequest(null);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastIdRef = useRef(0);

  const showToast = useCallback((kind: ToastMessage["kind"], text: string) => {
    const id = ++toastIdRef.current;
    setToast({ id, kind, text });
    window.setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      3000,
    );
  }, []);

  useEffect(() => {
    let active = true;
    const offProducts = subscribe(setProducts);
    const offCustomers = subscribeCustomers(setCustomers);
    const offRegister = subscribeRegisterSession(setRegisterSession);
    void Promise.allSettled([
      loadProducts(),
      loadCustomers(),
      loadRegisterSession(),
    ]).then((results) => {
      if (!active) return;
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        showToast(
          "error",
          failure.reason instanceof Error
            ? failure.reason.message
            : "No se pudieron cargar los datos de la venta.",
        );
      }
    });
    return () => {
      active = false;
      offProducts();
      offCustomers();
      offRegister();
    };
  }, [showToast]);

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (product.stock <= 0) {
        showToast("error", `${product.name} está agotado`);
        return false;
      }
      const current =
        cart.find((item) => item.productId === product.id)?.quantity ?? 0;
      const nextQuantity =
        product.unit === "KG"
          ? Math.round((current + quantity) * 1000) / 1000
          : current + quantity;
      if (nextQuantity > product.stock) {
        showToast(
          "error",
          `Solo hay ${product.stock} ${product.unit.toLowerCase()} disponibles de ${product.name}`,
        );
        return false;
      }
      setCart((prev) => {
        const idx = prev.findIndex((c) => c.productId === product.id);
        const latest = idx >= 0 ? prev[idx].quantity : 0;
        const nextQuantity =
          product.unit === "KG"
            ? Math.round((latest + quantity) * 1000) / 1000
            : latest + quantity;
        if (nextQuantity > product.stock) return prev;
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: nextQuantity };
          return next;
        }
        return [...prev, cartItemFromProduct(product, quantity)];
      });
      return true;
    },
    [cart, showToast],
  );

  const requestAddProduct = (product: Product, clearSearch = false) => {
    if (product.unit === "KG") {
      const inCart =
        cart.find((item) => item.productId === product.id)?.quantity ?? 0;
      if (Math.round((product.stock - inCart) * 1000) <= 0) {
        showToast("error", `${product.name} está agotado`);
        return;
      }
      setWeightRequest({ product, clearSearch });
      return;
    }
    if (addToCart(product) && clearSearch) {
      setSearch("");
      setCatalogPage(0);
    }
  };

  const findProductBySku = useCallback(
    (sku: string): Product | undefined =>
      products.find((p) => p.sku.toLowerCase() === sku.toLowerCase().trim()),
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term),
    );
  }, [search, products]);

  const catalogPageCount = Math.max(1, Math.ceil(filtered.length / 24));
  const visibleCatalogPage = Math.min(catalogPage, catalogPageCount - 1);
  const visibleProducts = useMemo(
    () =>
      filtered.slice(visibleCatalogPage * 24, (visibleCatalogPage + 1) * 24),
    [filtered, visibleCatalogPage],
  );

  const subtotal = roundMoney(
    cart.reduce((sum, c) => sum + roundMoney(c.unitPrice * c.quantity), 0),
  );
  const total = subtotal;

  const clearCart = () => setCart([]);

  useScanner({
    enabled:
      !paymentOpen &&
      !customerPickerOpen &&
      !helpOpen &&
      !weightRequest &&
      ticketPayload === null,
    onScan: (code) => {
      const product = findProductBySku(code);
      if (!product) {
        showToast("error", `SKU ${code} no encontrado`);
        return;
      }
      requestAddProduct(product);
    },
    onError: () => {
      // silently ignore non-scan keystrokes
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isSectionHelpOpen()) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (ticketPayload) return;
      if (paymentOpen) {
        if (e.key === "F6") {
          e.preventDefault();
          e.stopImmediatePropagation();
          window.dispatchEvent(new CustomEvent("sales:f6-complete"));
        }
        return;
      }
      if (customerPickerOpen || helpOpen || weightRequest) return;
      if (e.key === "F1") {
        e.preventDefault();
        setMobilePanel("catalog");
        window.requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setCustomerPickerOpen(true);
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!registerSession || !canUseRegister) {
          showToast(
            "error",
            registerSession
              ? "La caja pertenece a otro cajero."
              : "Abre la caja antes de cobrar.",
          );
          return;
        }
        if (cart.length === 0) {
          showToast("error", "Agrega productos antes de cobrar");
          return;
        }
        setPaymentOpen(true);
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          showToast("success", "Carrito vaciado");
        }
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
    };
  }, [
    cart.length,
    paymentOpen,
    ticketPayload,
    customerPickerOpen,
    helpOpen,
    weightRequest,
    showToast,
    canUseRegister,
    registerSession,
  ]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    const product =
      findProductBySku(term) ??
      (filtered.length === 1 ? filtered[0] : undefined);
    if (product) {
      requestAddProduct(product, true);
    }
  };

  const onClickProductCard = (product: Product) => requestAddProduct(product);

  const handleRemoveItem = (productId: number) =>
    setCart((prev) => prev.filter((c) => c.productId !== productId));

  const holdCurrentOrder = () => {
    if (cart.length === 0) {
      showToast("error", "Agrega productos antes de retener la orden");
      return;
    }
    if (heldOrders.length >= 50) {
      showToast("error", "Se alcanzó el límite de 50 órdenes en espera");
      return;
    }
    const newOrder: HeldOrder = {
      id: Math.max(Date.now(), ...heldOrders.map((order) => order.id + 1)),
      items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      customerId: selectedCustomer?.id ?? null,
      createdAt: new Date().toISOString(),
    };
    const next = [...heldOrders, newOrder];
    if (!saveHeldOrders(next, user?.id ?? "")) {
      showToast(
        "error",
        "No se pudo guardar la orden en espera. La venta actual sigue intacta.",
      );
      return;
    }
    setHeldOrders(next);
    setCart([]);
    setSelectedCustomer(null);
    showToast("success", "Orden retenida");
  };

  const resumeHeldOrder = async (id: number) => {
    if (resumePendingRef.current) return;
    const epoch = getSessionDataEpoch();
    const held = heldOrders.find((h) => h.id === id);
    if (!held) return;
    resumePendingRef.current = true;
    try {
      const [currentProducts, currentCustomers] = await Promise.all([
        refreshProducts(),
        refreshCustomers(),
      ]);
      assertSessionDataEpoch(epoch);
      const restored = restoreOrder(held, currentProducts, currentCustomers);
      if (!restored) {
        showToast(
          "error",
          "No se puede retomar: falta un producto, cliente o existencias suficientes.",
        );
        return;
      }
      const latestOrders = heldOrdersRef.current;
      if (!latestOrders.some((order) => order.id === id)) return;
      const latestCart = cartRef.current;
      const pending: HeldOrder | null =
        latestCart.length > 0
          ? {
              id: Math.max(
                Date.now(),
                ...latestOrders.map((order) => order.id + 1),
              ),
              items: latestCart.map(({ productId, quantity }) => ({
                productId,
                quantity,
              })),
              customerId: customerRef.current?.id ?? null,
              createdAt: new Date().toISOString(),
            }
          : null;
      const next = latestOrders.filter((order) => order.id !== id);
      if (pending) next.push(pending);
      if (!saveHeldOrders(next, user?.id ?? "")) {
        showToast(
          "error",
          "No se pudo preservar la orden actual. No se cambió el carrito.",
        );
        return;
      }
      setCart(restored.items);
      setSelectedCustomer(restored.customer);
      setHeldOrders(next);
      showToast(
        "success",
        pending
          ? "Orden retomada; la venta anterior quedó en espera"
          : "Orden retomada",
      );
    } catch {
      showToast(
        "error",
        "No se pudo cargar el catálogo o los clientes. Intenta de nuevo.",
      );
    } finally {
      resumePendingRef.current = false;
    }
  };

  const discardHeldOrder = (id: number) => {
    const next = heldOrders.filter((order) => order.id !== id);
    if (!saveHeldOrders(next, user?.id ?? "")) {
      showToast("error", "No se pudo actualizar la lista de órdenes en espera");
      return;
    }
    setHeldOrders(next);
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    const product = products.find((item) => item.id === productId);
    const item = cart.find((entry) => entry.productId === productId);
    if (
      delta > 0 &&
      (!product || !item || item.quantity + delta > product.stock)
    ) {
      showToast(
        "error",
        "No hay existencias suficientes para aumentar la cantidad.",
      );
      return;
    }
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const handleSetQuantity = (productId: number, next: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product || next > product.stock) {
      showToast("error", "No hay existencias suficientes para esa cantidad.");
      return false;
    }
    setCart((prev) =>
      prev
        .map((c) => (c.productId === productId ? { ...c, quantity: next } : c))
        .filter((c) => c.quantity > 0),
    );
    return true;
  };

  const handleSelectCustomer = (customer: CustomerWithBalance | null) => {
    setSelectedCustomer(customer);
    setCustomerPickerOpen(false);
  };

  const printTicket = async (id: number) => {
    if (printingTicketIdsRef.current.has(id)) return;
    const settings = getSettings();
    if (!settings.printerName.trim()) {
      if (visibleTicketIdRef.current === id) {
        setPrintFeedback({
          kind: "error",
          text: "Selecciona una impresora en Administración > Ajustes antes de imprimir.",
        });
      }
      return;
    }

    printingTicketIdsRef.current.add(id);
    if (visibleTicketIdRef.current === id) {
      setPrintingTicketId(id);
      setPrintFeedback(null);
    }
    try {
      await window.api.printers.printSale({
        ticketId: id,
        printerName: settings.printerName,
        settings: settings.ticket,
        margins: settings.printerMargins,
        logoPath: settings.business.logoPath,
      });
      if (visibleTicketIdRef.current === id) {
        setPrintFeedback({
          kind: "success",
          text: "Ticket enviado a la cola de impresión.",
        });
      }
    } catch (error) {
      if (visibleTicketIdRef.current === id) {
        setPrintFeedback({
          kind: "error",
          text:
            error instanceof Error
              ? error.message
              : "No se pudo imprimir el ticket.",
        });
      }
    } finally {
      printingTicketIdsRef.current.delete(id);
      if (visibleTicketIdRef.current === id) setPrintingTicketId(null);
    }
  };

  const confirmSale = async (
    payments: SalePaymentInput[],
    creditAmount: number,
    tenderedCash: number,
    notes: string,
  ) => {
    if (saleSubmittingRef.current) return;
    const epoch = getSessionDataEpoch();
    saleSubmittingRef.current = true;
    try {
      const currentSession = await loadRegisterSession();
      assertSessionDataEpoch(epoch);
      if (!currentSession)
        throw new Error(
          "La caja está cerrada. Ábrela antes de registrar ventas.",
        );
      const customerForTicket = selectedCustomer;
      const sale = await window.api.sales.create({
        registerSessionId: currentSession.id,
        customerId: selectedCustomer?.id ?? null,
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
        })),
        payments,
        discount: 0,
        creditAmount,
        notes: notes.trim() || null,
      });
      assertSessionDataEpoch(epoch);
      const saleSummary =
        cart.length > 0 ? `Venta con ${cart.length} producto(s)` : "";
      showToast(
        "success",
        `Venta ${sale.folio} guardada exitosamente${selectedCustomer ? "" : " (público)"}${
          creditAmount > 0 ? ` · fiado ${mxn.format(creditAmount)}` : ""
        }${saleSummary ? ` · ${saleSummary}` : ""}`,
      );
      setCart([]);
      setPaymentOpen(false);
      void refreshProducts().catch(() =>
        showToast(
          "error",
          "Venta guardada; no se pudo actualizar el catálogo.",
        ),
      );
      void refreshCustomers().catch(() =>
        showToast(
          "error",
          "Venta guardada; no se pudo actualizar la lista de clientes.",
        ),
      );
      void loadRegisterSession().catch(() => undefined);

      try {
        const ticketItems = await window.api.sales.items(sale.id);
        assertSessionDataEpoch(epoch);
        const nonCashPaid = payments.reduce(
          (sum, line) => sum + (line.method === "CASH" ? 0 : line.amount),
          0,
        );
        const change = Math.max(
          0,
          roundMoney(tenderedCash + nonCashPaid + creditAmount - sale.total),
        );
        const ticketPayments = payments.filter(
          (line) => line.method !== "CASH",
        );
        if (tenderedCash > 0)
          ticketPayments.push({
            method: "CASH",
            amount: Math.round(tenderedCash * 100) / 100,
          });
        const payload = buildTicketPayload({
          sale: {
            id: sale.id,
            folio: sale.folio,
            createdAt: sale.createdAt,
            status: sale.status,
          },
          items: ticketItems,
          payments: ticketPayments,
          subtotal: roundMoney(
            ticketItems.reduce((sum, item) => sum + item.lineTotal, 0),
          ),
          total: sale.total,
          discount: 0,
          creditAmount,
          change,
          customer: customerForTicket
            ? { name: customerForTicket.name, code: customerForTicket.code }
            : null,
          attendedBy: user?.displayName ?? null,
        });
        const ticket = await createTicket({ saleId: sale.id, payload });
        assertSessionDataEpoch(epoch);
        visibleTicketIdRef.current = ticket.id;
        setTicketId(ticket.id);
        setPrintFeedback(null);
        setTicketPayload(ticket.payload);
        if (getSettings().business.autoPrint) void printTicket(ticket.id);
      } catch (ticketErr) {
        console.error("[sales] no se pudo generar el ticket", ticketErr);
        showToast(
          "error",
          "Venta guardada, pero no se pudo generar el ticket.",
        );
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error al guardar la venta",
      );
    } finally {
      saleSubmittingRef.current = false;
    }
  };

  const canCharge =
    registerSession !== null && canUseRegister && cart.length > 0;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <div
        className="grid shrink-0 grid-cols-[1fr_1fr_auto] gap-2 border-b p-3 xl:hidden"
        aria-label="Vista de ventas"
      >
        <Button
          variant={mobilePanel === "catalog" ? "default" : "outline"}
          onClick={() => setMobilePanel("catalog")}
          aria-pressed={mobilePanel === "catalog"}
          aria-controls="sales-catalog-panel"
        >
          Catálogo
        </Button>
        <Button
          className="h-auto min-h-11 min-w-0 flex-col gap-0.5 whitespace-normal"
          variant={mobilePanel === "order" ? "default" : "outline"}
          onClick={() => setMobilePanel("order")}
          aria-pressed={mobilePanel === "order"}
          aria-controls="sales-order-panel"
        >
          <span>Orden ({cart.length})</span>
          <span className="text-xs tabular-nums">{mxn.format(total)}</span>
        </Button>
        <SectionHelp topic="sales" compact className="self-center" />
      </div>
      <section
        id="sales-catalog-panel"
        aria-label="Catálogo de productos"
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col xl:flex",
          mobilePanel === "catalog" ? "flex" : "hidden",
        )}
      >
        <SearchToolbar
          search={search}
          setSearch={(value) => {
            setSearch(value);
            setCatalogPage(0);
          }}
          total={filtered.length}
          onKeyDown={handleSearchKeyDown}
          inputRef={searchRef}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onClickProductCard(product)}
                disabled={product.stock <= 0}
                aria-label={`${product.name}, ${product.stock <= 0 ? "agotado" : `disponible: ${product.stock} ${product.unit.toLowerCase()}`}`}
                className="text-left disabled:cursor-not-allowed"
              >
                <ProductCard product={product} />
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-8 py-16 text-center">
              <Search
                className="size-8 text-muted-foreground/40"
                strokeWidth={1.5}
              />
              <p className="text-sm font-semibold uppercase text-foreground">
                Sin resultados
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Ningún producto coincide con "{search}". Escanea un código o
                selecciona uno del catálogo.
              </p>
            </div>
          )}
        </ScrollArea>
        {catalogPageCount > 1 && (
          <div className="flex items-center justify-between border-t bg-background/60 px-4 py-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogPage((page) => Math.max(0, page - 1))}
              disabled={visibleCatalogPage === 0}
            >
              Anterior
            </Button>
            <span className="tabular-nums">
              {visibleCatalogPage + 1} de {catalogPageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCatalogPage((page) =>
                  Math.min(catalogPageCount - 1, page + 1),
                )
              }
              disabled={visibleCatalogPage >= catalogPageCount - 1}
            >
              Siguiente
            </Button>
          </div>
        )}
      </section>

      <div
        id="sales-order-panel"
        aria-label="Orden actual"
        className={cn(
          "min-h-0 min-w-0 flex-1 xl:flex",
          mobilePanel === "order" ? "flex" : "hidden",
        )}
      >
        <CurrentOrder
          cart={cart}
          subtotal={subtotal}
          total={total}
          selectedCustomer={selectedCustomer}
          canCharge={canCharge}
          heldOrders={heldOrders}
          onClear={clearCart}
          onUpdateQuantity={handleUpdateQuantity}
          onSetQuantity={handleSetQuantity}
          onRemoveItem={handleRemoveItem}
          onHold={holdCurrentOrder}
          onResumeHeld={resumeHeldOrder}
          onDiscardHeld={discardHeldOrder}
          onPickCustomer={() => setCustomerPickerOpen(true)}
          onRemoveCustomer={() => setSelectedCustomer(null)}
          onCharge={() => setPaymentOpen(true)}
        />
      </div>

      {weightRequest && (
        <WeightQuantityDialog
          product={
            products.find(
              (product) => product.id === weightRequest.product.id,
            ) ?? weightRequest.product
          }
          inCart={
            cart.find((item) => item.productId === weightRequest.product.id)
              ?.quantity ?? 0
          }
          onClose={closeWeightDialog}
          onAdd={(quantityKg) => {
            const product = products.find(
              (item) => item.id === weightRequest.product.id,
            );
            if (!product || product.unit !== "KG") {
              showToast("error", "El producto ya no está disponible por peso.");
              closeWeightDialog();
              return false;
            }
            const added = addToCart(product, quantityKg);
            if (added && weightRequest.clearSearch) {
              setSearch("");
              setCatalogPage(0);
            }
            return added;
          }}
        />
      )}

      <CustomerPickerDialog
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        customers={customers}
        selectedId={selectedCustomer?.id ?? null}
        onSelect={handleSelectCustomer}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={total}
        customer={selectedCustomer}
        canFiar={selectedCustomer !== null}
        onComplete={confirmSale}
      />

      {toast && <ToastItem toast={toast} />}

      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <TicketDialog
        open={ticketPayload !== null}
        payload={ticketPayload}
        printing={printingTicketId === ticketId && ticketId !== null}
        printFeedback={printFeedback}
        onOpenChange={(o) => {
          if (!o) {
            visibleTicketIdRef.current = null;
            setTicketId(null);
            setTicketPayload(null);
            setPrintFeedback(null);
          }
        }}
        onPrint={() => {
          if (ticketId !== null) void printTicket(ticketId);
        }}
      />
    </main>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur",
          toast.kind === "success"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
            : "border-red-500/40 bg-red-500/10 text-red-600",
        )}
      >
        {toast.kind === "success" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
        {toast.text}
      </div>
    </div>
  );
}
