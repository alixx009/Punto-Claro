# Reportes

Ruta: **Administración > Reportes** (`/administracion/reportes`).

## Origen y cálculos

- **Ventas:** datos de `sales`, `sale_items`, `payments` y los tickets guardados. El identificador visible es el folio original y el ID numérico de la venta.
- **Cobros totales:** suma del importe cobrado al registrar las ventas filtradas (`sales.paid_amount`), descontando la parte reembolsada de esos cobros. Los abonos posteriores de clientes se consultan en su módulo. Es una métrica de las ventas seleccionadas, no de los movimientos de caja del periodo.
- **Rentabilidad:** importe neto de la venta, después de descuentos y devoluciones, menos costo de los artículos que no fueron devueltos. Cada venta nueva conserva el costo unitario en `sale_items.purchase_cost`. Las ventas anteriores sin costo guardado muestran rentabilidad no disponible.
- **Volumen e inventario:** las cantidades se separan por piezas, paquetes y kilogramos. La valoración multiplica el stock actual por el costo o precio público actual.
- **Reabastecimiento:** productos con existencias de 5 o menos de su unidad registrada. El umbral está en `src/main/db/reports.ts`.
- **Cortes:** sesiones cerradas de `register_sessions`. El cajero se guarda en `cashier_name`, con valor inicial y predeterminado `ADMIN`. La auditoría suma las diferencias guardadas de esos cortes.
- **Fechas:** los límites incluyen todo el primer y último día; las consultas usan fechas locales compatibles con las fechas guardadas de la app.

## Kardex

Los movimientos se guardan en `product_movements`, dentro de la misma base SQLite. Se conservan el nombre, SKU, unidad, variación, saldos y referencia a la venta.

Al activar el módulo se recuperan las salidas de ventas antiguas que tengan artículos guardados; sus saldos anteriores y posteriores quedan como no registrados. Después se guarda la existencia actual como punto de partida (`INITIAL`). Los ajustes previos no se pueden reconstruir porque no se registraban.

Los movimientos nuevos incluyen altas, ventas, devoluciones (`RETURN`), ajustes manuales y bajas de productos. La operación de stock y su movimiento se guardan juntos. Las bajas conservan el historial aunque el producto deje de formar parte del catálogo.

El botón de ojo abre el ticket de la venta asociada o el comprobante de inventario cuando no hay una venta. Inventario y Kardex muestran 25 filas por página.

## Exportación y devoluciones

Ventas e inventario exportan archivos `.xlsx` con todos los registros que coincidan con los filtros, mediante el diálogo de guardar de Windows.

Las devoluciones se gestionan en **Operaciones > Notas de venta**, mediante el botón de caja. En Reportes se consultan las ventas activas, con devolución parcial y completamente devueltas; el filtro de devueltas incluye las parciales. Excel conserva el estado y el importe devuelto. El flujo está descrito en [devoluciones.md](devoluciones.md).

Las migraciones y el punto de partida del Kardex se aplican al reiniciar la aplicación.
