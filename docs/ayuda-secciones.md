# Guías rápidas de la aplicación

El botón **Ayuda** con el icono Info abre un tutorial breve de la pantalla.
En Ventas está junto al buscador en escritorio y junto a Catálogo / Orden
en pantallas pequeñas. El icono Info del menú superior explica la caja.

## Cobertura

- Ventas, Productos, Clientes, Proveedores, Compras y Abasto, Notas de venta y Mi cuenta.
- Caja: apertura, ajustes de efectivo, consulta de saldo y cierre de turno.
- Ajustes: Negocio y caja, Apariencia, Diseño de ticket, Configuración de impresora,
  Personal y roles, Catálogos base y Conexión y datos.
- Reportes: Ventas y Devoluciones, Historial de Cortes, Auditoría,
  Reabastecimiento, Inventario y Movimientos (Kardex).

En Ajustes y Reportes el tutorial corresponde a la pestaña activa.
Cada guía tiene pasos numerados y, cuando corresponde, recordatorios y atajos.
Las instrucciones de acciones exclusivas de administradores o que requieren
un permiso se filtran según la cuenta actual. Las rutas y permisos existentes
siguen controlando el acceso a las pantallas.

## Interacción

Se puede abrir la ayuda con teclado, recorrerla con Tab y cerrarla con Esc,
la X o Entendido. El diálogo recupera el foco en el botón que lo abrió.
Mientras hay una guía abierta, Ventas pausa sus atajos y el lector de códigos,
incluyendo lecturas que estaban pendientes de completar. F9 sigue abriendo
el panel de atajos de ventas existente.

## Mantenimiento

- `src/renderer/src/components/help/SectionHelp.tsx`: botón y diálogo reutilizables.
- `operation-guides.ts`: catálogo, ventas, clientes, compras, cuenta y caja.
- `settings-guides.ts`: guías y correspondencia de subsecciones de Ajustes.
- `report-guides.ts`: guías y correspondencia de pestañas de Reportes.
- `types.ts`: pasos, notas y atajos con permisos opcionales.
- `visibility.ts`: detección de ayuda abierta para pausar la entrada de ventas.

Las guías describen las operaciones disponibles. La carga XML, conectividad
multicaja y Kardex de demostración se identifican como tales. Abrir o cerrar
un tutorial no modifica datos ni preferencias y no se abre automáticamente.
