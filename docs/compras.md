# Compras y Abasto

Pantalla de **Administración → Compras**, disponible para administradores. Usa la misma base SQLite local del POS y canales IPC autenticados; no requiere un servicio externo.

## Registro manual

1. Seleccionar un proveedor activo del catálogo de Proveedores.
2. Buscar productos existentes por nombre o SKU y agregarlos a los conceptos.
3. Capturar cantidad y costo unitario. PIEZA y PAQ admiten cantidades enteras; KG admite hasta tres decimales. El costo admite dos decimales y puede ser cero para mercancía bonificada.
4. Procesar la compra. El servidor vuelve a validar productos, proveedor, unidades, cantidades y costos.

La operación se confirma en una única transacción: encabezado, conceptos, incremento de stock, actualización del último costo de compra y movimientos de entrada en Kardex. Si algún concepto falla, no se guarda ninguno.

**El precio público y el precio de mayoreo no cambian.** Tampoco se descuenta efectivo de caja ni se registra un pago al proveedor; este módulo registra la recepción y su inversión. No requiere una caja abierta.

El botón **Cargar Factura CFDI (XML)** es visual y está deshabilitado con la indicación de que estará disponible próximamente. No lee archivos ni procesa facturas.

## Historial y métricas

- Historial con búsqueda por folio o proveedor y páginas de 25 compras.
- Detalle con conceptos, costos, cantidades, total, fecha y nombre del administrador que registró la compra.
- Métricas globales de compras registradas, inversión y cantidades separadas por unidad: no se suman kilogramos con piezas o paquetes.
- El nombre del proveedor y los datos del producto se conservan como estaban al registrar la compra, aunque después se edite el catálogo.
- Los movimientos de Kardex muestran el tipo **Entrada por compra** y el folio de compra.

## Tablas y migración

La migración se aplica al arrancar completamente Electron. Añade:

| Tabla                        | Datos principales                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `purchases`                  | Folio general `C-000001`, proveedor, origen manual, inversión, usuario responsable, fecha e identificador único del intento. |
| `purchase_items`             | Compra, producto, nombre/SKU/unidad históricos, cantidad, costo unitario e importe.                                          |
| `purchase_schema_migrations` | Versiones aplicadas del módulo.                                                                                              |

Los importes se guardan en centavos enteros. El importe de cada concepto se redondea a centavos a partir de la cantidad y el costo; el total es la suma de esos importes.

Se amplía `product_movements` con el tipo `PURCHASE` y la relación `purchase_id`. La reconstrucción conserva los movimientos existentes y sus identificadores. Las compras no crean entradas ficticias al iniciar el módulo.

El proveedor queda relacionado al historial y su eliminación lógica del catálogo no borra compras. Si se elimina un producto permitido por las reglas existentes, el concepto de compra conserva su información histórica y su referencia de producto queda vacía.

## Reintentos y datos de sesión

Cada envío lleva un `requestId` UUID. El servidor vincula ese identificador con el usuario y el contenido del intento. Repetir el mismo intento devuelve la compra ya registrada sin incrementar nuevamente stock; reutilizarlo con otro contenido o usuario se rechaza.

La interfaz conserva un intento pendiente antes de enviarlo. Si se pierde la respuesta, permite recuperar y reintentar ese mismo envío. Un rechazo que garantiza que no hubo confirmación permite corregir el formulario. Las respuestas de otra sesión no actualizan los datos visibles.

Tras una compra confirmada se actualiza la caché de productos de la sesión, para que Ventas y Productos vean las existencias y costos nuevos. Las ventas previas conservan su costo histórico.

## Archivos principales

- Contratos y límites: `src/shared/purchases.ts`.
- Migración: `src/main/db/purchases-migration.ts`.
- Consultas y registro: `src/main/db/purchases.ts`.
- IPC y permisos: `src/main/ipc-handlers.ts`.
- Interfaz: `src/renderer/src/components/purchases/`.
