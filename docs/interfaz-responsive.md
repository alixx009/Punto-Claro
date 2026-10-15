# Interfaz responsive

## Alcance

La revisión parte de `src/renderer/src/router/app.router.tsx` e incluye las pantallas que se muestran antes de entrar al router, los diálogos de cada módulo y los componentes compartidos. Se conserva el lenguaje visual de la app y sus temas claro y oscuro.

| Ruta o acceso              | Pantalla                                               | Componentes y áreas revisadas                                                                      |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Todas las rutas            | `AppShell`, `CustomMenu`                               | Navegación, cuenta, estado de caja, apertura, cierre y ajuste de efectivo                          |
| `/ventas`                  | `SalesScreen`                                          | Buscador, catálogo, orden, cobro, selección de cliente, cantidad por peso, ticket y atajos         |
| `/productos`               | `ProductsScreen`                                       | Barra de herramientas, tabla, formulario, ajuste de existencias, Kardex e importación de Excel     |
| `/clientes`                | `CustomersScreen`                                      | Métricas, filtros, tabla, formulario, abonos, estado de cuenta y detalle de venta                  |
| `/proveedores`             | `SuppliersScreen`                                      | Resumen, búsqueda, tabla y formulario de proveedor                                                 |
| `/operaciones/notas`       | `SalesHistoryScreen`                                   | Métricas, filtros de fecha, tabla, ticket, nota de venta y devoluciones                            |
| `/administracion/compras`  | `PurchasesScreen`                                      | Resumen, historial, compra manual, buscador de productos, conceptos y detalle de compra            |
| `/administracion/reportes` | `ReportsScreen`                                        | Ventas, cortes, auditoría, reabastecimiento, inventario, Kardex, periodos y controles compartidos  |
| `/administracion/ajustes`  | `SettingsScreen`                                       | Negocio, apariencia, ticket, impresora, personal, catálogos y conexión                             |
| `/cuenta`                  | `AccountScreen`                                        | Datos de cuenta y formulario de contraseña                                                         |
| Rutas pendientes           | `ComingSoon`                                           | Mensaje y distribución del contenido                                                               |
| Antes del router           | `LoginScreen`, `PasswordChangeScreen`, `PlainDocument` | Documento HTML del acceso y su viewport; se conserva la presentación sin Tailwind ni CSS del login |

## Componentes con cambios de UI

Los archivos se encuentran bajo `src/renderer/src/components/`, salvo donde se indica otra ruta.

### Estructura y navegación

- `layout/AppShell.tsx`, `layout/ComingSoon.tsx`.
- `custom/CustomMenu.tsx`.
- `custom/dialogs/AperturaDialog.tsx`, `CloseRegisterDialog.tsx`, `CashAdjustDialog.tsx`.
- `auth/AccountScreen.tsx`, `auth/PlainDocument.tsx`.
- Estados de carga de `src/renderer/src/router/app.router.tsx`.

### Ventas

- `sales/SalesScreen.tsx`, `SalesCatalog.tsx`, `CurrentOrder.tsx`.
- `sales/PaymentDialog.tsx`, `CustomerPickerDialog.tsx`, `WeightQuantityDialog.tsx`.
- `sales/TicketDialog.tsx`, `KeyboardShortcutsDialog.tsx`.

### Catálogos

- `catalog/ProductsScreen.tsx`, `CustomersScreen.tsx`, `SuppliersScreen.tsx`.
- `catalog/products/ProductsToolbar.tsx`, `ProductsTable.tsx`, `ProductFormDialog.tsx`, `StockAdjustDialog.tsx`, `KardexDialog.tsx`.
- `catalog/products/import/ProductImportDialogs.tsx`, `ImportProductsTable.tsx`, `ImportIssuesTable.tsx`.
- `catalog/customers/MetricsHeader.tsx`, `Toolbar.tsx`, `CustomersTable.tsx`, `CustomerFormDialog.tsx`, `PaymentDialog.tsx`, `StatementDialog.tsx`, `SaleDetailDialog.tsx`, `Toast.tsx`.
- `catalog/suppliers/SuppliersSummary.tsx`, `SupplierFormDialog.tsx`.

### Notas de venta

- `sales-history/SalesHistoryScreen.tsx`, `SalesHistoryFilters.tsx`, `SalesHistoryMetrics.tsx`, `SalesHistoryTable.tsx`.
- `sales-history/SaleNoteDialog.tsx`, `SaleReturnDialog.tsx`.
- El ticket utiliza el diálogo compartido de ventas.

### Compras

- `purchases/PurchasesScreen.tsx`, `PurchasesSummary.tsx`, `PurchasesHistory.tsx`.
- `purchases/ManualPurchaseDialog.tsx`, `PurchaseDetailDialog.tsx`, `PurchaseConceptsTable.tsx`, `PurchaseProductSearch.tsx`.

### Reportes

- `reports/ReportsScreen.tsx`, `ReportTimeRange.tsx`, `ReportPrimitives.tsx`.
- `reports/ReportSalesSection.tsx`, `ReportCutsSection.tsx`, `ReportAuditSection.tsx`, `ReportRestockSection.tsx`, `ReportInventorySection.tsx`, `ReportMovementsSection.tsx`.

### Ajustes

- `settings/SettingsScreen.tsx`, `BusinessSettingsSection.tsx`, `AppearanceSettingsSection.tsx`.
- `settings/PrinterSettingsSection.tsx`, `TicketSettingsSection.tsx`, `StaffSettingsSection.tsx`, `OtherSettingsSections.tsx`.

### Componentes compartidos e infraestructura

- `ui/dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`.
- `ui/table.tsx`, `scroll-area.tsx`, `tabs.tsx`, `field.tsx`, `card.tsx`.
- `src/renderer/src/assets/globals.css`: comportamiento del viewport, overlays y controles táctiles.
- `src/renderer/index.html`: viewport para pantallas móviles y áreas seguras.
- `src/main/index.ts`: tamaño mínimo de ventana de Electron de 360 × 480; el tamaño inicial continúa en 1366 × 768.

## Comportamiento por tamaño

| Ancho           | Distribución                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------- |
| Menos de 640 px | Formularios y filtros apilados, métricas compactas y acciones que ocupan el ancho disponible |
| Desde 640 px    | Más columnas en formularios y filtros que pueden organizarse en filas                        |
| Desde 768 px    | Más columnas en tarjetas; conceptos de compra y devoluciones vuelven a distribución de tabla |
| Desde 1024 px   | Ajustes muestra navegación lateral y los catálogos recuperan distribución de escritorio      |
| Desde 1280 px   | Navbar de escritorio y ventas con catálogo y orden visibles al mismo tiempo                  |

En móvil y tablet, ventas ofrece los botones **Catálogo** y **Orden**, con cantidad de productos y total. Los paneles permanecen montados para conservar su estado. El atajo F1 vuelve al catálogo antes de enfocar el buscador.

Las tablas extensas tienen desplazamiento horizontal dentro de su propio contenedor, accesible también con teclado. Los formularios caben dentro del viewport y los diálogos largos permiten desplazamiento vertical. En compra manual y devoluciones, cada concepto se presenta como una tarjeta en móvil utilizando los mismos controles y estado de la tabla.

La nota de venta conserva las proporciones del documento imprimible y se puede recorrer dentro de la vista previa. Los cambios responsive no modifican el contenido enviado a la impresora ni los cálculos de las operaciones.

Los controles de pantallas táctiles tienen un objetivo mínimo de 44 px; los campos usan texto de 16 px. El calendario ajusta sus celdas para que las siete columnas quepan en pantallas estrechas. La estructura principal utiliza altura dinámica y espacio para las áreas seguras del dispositivo.

## Revisión realizada

- Revisión visual en navegador a 320 × 740, 390 × 844, 768 × 1024 y 1366 × 768, con vistas de ambos temas.
- Se renderizaron los componentes reales con datos de ejemplo y una API temporal que bloqueaba las escrituras y la impresión. La base de datos de uso diario no se modificó durante esta revisión.
- Se inspeccionaron ventas y cobro, catálogos, compra manual, historial, devolución, documento, calendario, las seis secciones de reportes, ajustes, navegación, cuenta e inicio de sesión.
- Se corrigieron el recorte de productos en devoluciones, el ancho interno de las áreas de desplazamiento, el espacio extra del buscador de reabastecimiento y el inicio de la tira de pestañas de reportes.
- TypeScript de main/preload y renderer: sin errores.
- Compilación de producción de Electron: correcta. Permanece el aviso existente sobre la importación estática y dinámica de `customersStore`; no impide compilar.
- No se añadieron ni ejecutaron suites de pruebas. La revisión visual se hizo en navegador, sin dispositivos móviles físicos.

Esta implementación prepara la interfaz para distintos tamaños. Una futura distribución móvil también necesitará adaptar el acceso actual a Electron, SQLite e impresoras al entorno elegido.
