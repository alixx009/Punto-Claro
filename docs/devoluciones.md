# Devoluciones de ventas

## Interfaz

Ruta: **Operaciones > Notas de venta > Devolución** (icono `Box`).

- `+` aumenta y `×` disminuye la selección. No puede bajar de cero ni superar lo vendido menos lo ya devuelto.
- Piezas y paquetes requieren cantidades enteras. Kilogramos admiten hasta tres decimales y captura manual; los botones avanzan 0.1 kg. Las flechas arriba/abajo también ajustan la cantidad.
- **Devolución completa** selecciona todas las cantidades restantes. **Confirmar seleccionados** registra la operación.
- Se necesita una caja abierta. El efectivo es el método predeterminado; también pueden elegirse tarjeta o transferencia.
- La app registra el reembolso y ajusta caja. La devolución bancaria se efectúa por los medios del negocio; no hay integración con terminal o banco.

## Importes y crédito

Se usa el precio original de venta, no el precio actual del catálogo. El descuento se distribuye proporcionalmente por artículo en centavos. Las devoluciones parciales usan diferencias entre cantidades acumuladas para evitar errores de redondeo; al devolver todo, el total restante es cero.

En ventas a crédito primero se reduce la deuda pendiente del cliente. Si esa parte del crédito ya se abonó, se reembolsa su excedente y se registra un pago negativo sin `sale_id`, que revierte los abonos correspondientes. El estado de cuenta lo identifica como **Reembolso**. Los abonos actuales son generales a la cuenta del cliente, no están asignados a un ticket específico.

La parte cobrada originalmente en la venta se devuelve mediante un pago negativo con `sale_id`. Ambos tipos de reembolso se asocian a la caja abierta en el momento de la devolución y al método elegido. No se cambian los cortes cerrados. El efectivo no puede superar lo disponible en caja.

## Base de datos y comprobantes

- `sale_items.quantity` y `line_total` conservan lo vendido originalmente; `returned_quantity` guarda el acumulado devuelto. Las consultas de artículos y los comprobantes muestran solo lo restante.
- `sale_return_origins` conserva los importes y el documento anteriores a la primera devolución.
- `sale_returns` y `sale_return_items` conservan cada devolución y su distribución financiera.
- `sales` conserva el folio, acumula `returned_amount` y actualiza subtotal, descuento, total y distribución entre cobro inicial y crédito.
- El ticket guardado se actualiza. La vista previa, la reimpresión térmica y la nota de venta reflejan las cantidades restantes y un aviso de devolución parcial o completa. Una devolución completa puede reimprimirse como constancia con total cero.
- Cada producto se reintegra al stock y genera una entrada `RETURN` en Kardex, vinculada a la venta.

Toda la confirmación ocurre en una transacción inmediata de SQLite. La selección se vuelve a validar en el proceso principal, se detectan cambios de saldo o devoluciones concurrentes y un identificador de intento impide registrar dos veces el mismo reembolso. Las ventas antiguas sin artículos o con importes inconsistentes no permiten devolución automática.

Las migraciones se aplican al reiniciar Electron. La lógica financiera compartida está en `src/shared/sale-returns.ts`; la operación de base de datos en `src/main/db/sale-returns.ts`; el diálogo en `src/renderer/src/components/sales-history/SaleReturnDialog.tsx`.
