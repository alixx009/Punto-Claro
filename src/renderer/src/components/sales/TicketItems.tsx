import type { TicketLineItem } from "../../../../shared/ipc";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const quantity = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

export function TicketItems({ items, showAmount, compact }: {
  items: TicketLineItem[];
  showAmount: boolean;
  compact: boolean;
}) {
  const gridTemplateColumns = showAmount
    ? "4ch minmax(0, 1fr) minmax(0, 1fr)"
    : "4ch minmax(0, 1fr)";

  return (
    <div>
      <p className="text-center font-bold">Concepto / Producto</p>
      <div className="grid gap-x-[3px] text-[0.9em] font-bold" style={{ gridTemplateColumns }}>
        <span>Cant.</span>
        <span className="text-center">Precio</span>
        {showAmount && <span className="text-right">Importe</span>}
      </div>
      {items.map((item, index) => {
        const name = `${item.productName}${item.unit === "KG" ? " (kg)" : ""}`;
        return (
          <div
            key={index}
            className="grid gap-x-[3px] tabular-nums"
            style={{ gridTemplateColumns, marginTop: compact ? 1 : 3 }}
          >
            <span className="col-span-full min-w-0 truncate text-center" title={name}>{name}</span>
            <span>{quantity.format(item.quantity)}</span>
            <span className="text-center whitespace-nowrap">{money.format(item.unitPrice)}</span>
            {showAmount && <span className="text-right whitespace-nowrap">{money.format(item.lineTotal)}</span>}
          </div>
        );
      })}
    </div>
  );
}
