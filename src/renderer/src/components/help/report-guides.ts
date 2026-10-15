import type { HelpGuide } from "./types";

export const reportGuides = {
  "reports.sales": {
    title: "Ventas y Devoluciones",
    description:
      "Consulta los resultados de ventas del periodo y sus comprobantes.",
    steps: [
      {
        title: "Elige el periodo",
        description:
          "Se abre con HOY. Puedes cambiar a HISTÓRICO, 7 DÍAS, 30 DÍAS, MES o AÑO. En RANGO PERSONALIZADO indica las fechas Desde y Hasta.",
      },
      {
        title: "Refina la consulta",
        description:
          "Busca por folio, cliente o notas y filtra por pago, estado, cajero o una fecha concreta. La fecha se combina con el periodo elegido. La X limpia los filtros y vuelve al periodo HOY.",
      },
      {
        title: "Lee los resultados",
        description:
          "Las tarjetas resumen cobros, ventas procesadas y volumen por unidad de medida. La gráfica muestra cobros acumulados día a día para la consulta actual.",
      },
      {
        title: "Revisa la rentabilidad",
        description:
          "La rentabilidad utiliza el costo que tenía el producto al venderlo. Si hay ventas sin costo histórico, no se puede calcular un beneficio completo y la pantalla lo indica.",
        permission: "costs.view",
      },
      {
        title: "Consulta o exporta",
        description:
          "Documento abre el ticket de la venta. Exportar Excel guarda los resultados con los filtros actuales. Para devolver productos, abre Operaciones > Notas de venta.",
      },
    ],
  },
  "reports.cuts": {
    title: "Historial de Cortes",
    description:
      "Compara lo registrado en caja con lo declarado al cerrar cada turno.",
    steps: [
      {
        title: "Encuentra el turno",
        description:
          "Busca por cajero o caja y elige una fecha de apertura. Usa la paginación para consultar otros registros.",
      },
      {
        title: "Revisa los importes",
        description:
          "La tabla muestra fecha de apertura, terminal, cajero, fondo inicial, ingresos en efectivo, monto declarado y diferencia del cierre.",
      },
      {
        title: "Interpreta el cuadre",
        description:
          "Faltante indica que se declaró menos de lo esperado; Sobrante, que se declaró más. Cuadre exacto significa que coinciden. Un turno abierto todavía no tiene corte final.",
      },
    ],
    notes: [
      {
        text: "La diferencia procede del cierre de caja. Esta pantalla sirve para consultar turnos, no para modificar un corte ya registrado.",
      },
    ],
  },
  "reports.audit": {
    title: "Auditoría de Cajeros",
    description:
      "Revisa las diferencias acumuladas de los turnos cerrados por cada cajero.",
    steps: [
      {
        title: "Identifica al operador",
        description:
          "Cada tarjeta agrupa los cortes por el nombre del cajero registrado y muestra cuántos turnos cerrados se auditaron.",
      },
      {
        title: "Compara faltantes y sobrantes",
        description:
          "Faltante total suma las diferencias negativas; Sobrante total suma las positivas. Balance de cuadre representa su resultado combinado.",
      },
      {
        title: "Consulta el origen",
        description:
          "Para revisar un turno particular, abre Historial de Cortes y busca al mismo cajero. Auditoría resume los registros; no cambia sus importes.",
      },
    ],
  },
  "reports.restock": {
    title: "Reabastecimiento",
    description:
      "Identifica qué productos necesitan mercancía antes de quedarse sin stock.",
    steps: [
      {
        title: "Consulta los productos críticos",
        description:
          "Se muestran productos con cinco o menos unidades de su medida registrada: piezas, paquetes o kg. La búsqueda permite acotar la lista por producto.",
      },
      {
        title: "Revisa la existencia",
        description:
          "Cada tarjeta indica el producto, su SKU y la cantidad disponible. Sin existencia corresponde a stock igual o menor que cero; Stock bajo indica que queda mercancía.",
      },
      {
        title: "Consulta el costo",
        description:
          "El costo mostrado es el costo unitario de compra guardado en el catálogo. Úsalo como referencia al preparar el siguiente pedido.",
        permission: "costs.view",
      },
      {
        title: "Registra el abastecimiento",
        description:
          "Cuando recibas el pedido, usa Administración > Compras para ingresar cantidades y costos; al procesar la compra se actualizan las existencias.",
        adminOnly: true,
      },
    ],
    notes: [
      {
        text: "Esta sección ofrece sugerencias; consultar un producto no genera una compra ni cambia su inventario.",
      },
    ],
  },
  "reports.inventory": {
    title: "Inventario",
    description:
      "Consulta existencias actuales y su valor a precio público y de costo.",
    steps: [
      {
        title: "Busca en el catálogo",
        description:
          "Escribe un producto en la búsqueda. La tabla y los indicadores se calculan sobre los productos que coinciden con la consulta.",
      },
      {
        title: "Interpreta los indicadores",
        description:
          "Total catálogo cuenta productos y Existencia física separa las cantidades por kg, piezas y paquetes. Venta esperada suma precio público por existencia; no representa ventas ya cobradas.",
      },
      {
        title: "Consulta la valoración de costo",
        description:
          "Costo total stock y Valuación costo multiplican el costo unitario actual por la existencia. Estos importes se muestran cuando tu cuenta puede consultar costos.",
        permission: "costs.view",
      },
      {
        title: "Consulta o exporta",
        description:
          "Usa Anterior y Siguiente: la tabla muestra hasta 25 productos por página. Exportar Excel guarda toda la valoración que coincide con tu búsqueda.",
      },
    ],
    notes: [
      {
        text: "Para exportar productos con el formato que se puede importar, usa Exportar Excel en Catálogos > Productos. La exportación de esta sección es un reporte de valoración.",
        adminOnly: true,
      },
    ],
  },
  "reports.movements": {
    title: "Movimientos (Kardex)",
    description:
      "Sigue entradas, salidas y ajustes del inventario por producto.",
    steps: [
      {
        title: "Encuentra un movimiento",
        description:
          "Busca por producto, SKU, folio o motivo. Puedes elegir una fecha y avanzar por el historial, con un máximo de 25 movimientos por página.",
      },
      {
        title: "Lee la variación",
        description:
          "Las cantidades positivas son entradas y las negativas son salidas. El tipo identifica altas, ventas, compras, devoluciones, bajas y ajustes de existencias.",
      },
      {
        title: "Revisa el saldo",
        description:
          "Compara las existencias antes y después del movimiento. En registros históricos puede aparecer No registrado cuando ese saldo no se conservaba.",
      },
      {
        title: "Abre el comprobante",
        description:
          "Pulsa el ojo de la fila. Si el movimiento tiene una venta asociada, se abre su ticket; en otros movimientos se muestra el detalle de inventario correspondiente.",
      },
    ],
    notes: [
      {
        text: "El Kardex se genera a partir de las operaciones guardadas. Consultarlo no modifica las existencias.",
      },
    ],
  },
} satisfies Record<string, HelpGuide>;

export const reportHelpTopics = {
  sales: "reports.sales",
  cuts: "reports.cuts",
  audit: "reports.audit",
  restock: "reports.restock",
  inventory: "reports.inventory",
  movements: "reports.movements",
} as const;
