import type { HelpGuide } from "./types";

export const operationGuides = {
  sales: {
    title: "Ventas",
    description: "Arma una orden, registra el cobro y entrega su comprobante.",
    steps: [
      {
        title: "Prepara la caja",
        description:
          "Abre la caja desde el menú superior e indica el fondo inicial. Para cobrar, debes operar tu propia caja o tener una cuenta administradora.",
      },
      {
        title: "Agrega productos",
        description:
          "Busca por nombre o SKU. Haz clic en el producto o pulsa Enter si hay un SKU exacto o un único resultado. Si se vende por kg, escribe el peso y elige kg o gramos.",
      },
      {
        title: "Revisa la orden",
        description:
          "Ajusta las cantidades y selecciona un cliente si lo necesitas. Puedes guardar la orden en espera y retomarla después; todavía no se registra como venta.",
      },
      {
        title: "Registra el cobro",
        description:
          "Pulsa Registrar cobro, elige efectivo, tarjeta o transferencia y completa los importes. Para fiar, selecciona un cliente con crédito disponible. Revisa el cambio antes de confirmar.",
      },
      {
        title: "Entrega el ticket",
        description:
          "Al completar la venta aparece su ticket. Puedes imprimirlo con la impresora configurada. Para consultar o reimprimir una venta anterior, abre Operaciones > Notas de venta.",
      },
    ],
    shortcuts: [
      { keys: ["F1"], description: "Buscar productos" },
      { keys: ["F2"], description: "Seleccionar cliente" },
      {
        keys: ["Enter"],
        description: "Agregar un SKU exacto o el único resultado",
      },
      {
        keys: ["G", "K"],
        description: "Elegir gramos o kg en el diálogo de peso",
      },
      {
        keys: ["F6"],
        description:
          "Abrir el cobro; dentro del cobro, confirmar cuando esté listo",
      },
      { keys: ["F7"], description: "Imprimir el ticket que está abierto" },
      { keys: ["F9"], description: "Ver todos los atajos de ventas" },
    ],
  },
  products: {
    title: "Productos",
    description: "Consulta tu catálogo y administra precios y existencias.",
    steps: [
      {
        title: "Encuentra un producto",
        description:
          "Busca por nombre, SKU, código de catálogo o marca. La búsqueda no incluye categorías. Usa Anterior y Siguiente para recorrer los resultados.",
      },
      {
        title: "Registra o edita",
        description:
          "Pulsa Nuevo Producto para darlo de alta o el lápiz de una fila para editarlo. Completa los campos obligatorios y guarda los cambios.",
        adminOnly: true,
      },
      {
        title: "Corrige existencias",
        description:
          "Puedes modificar las existencias al editar el producto o usar Ajustar stock. Introduce la cantidad real; el cambio queda registrado como un movimiento de inventario.",
        adminOnly: true,
      },
      {
        title: "Importa desde Excel",
        description:
          "Descarga la plantilla, completa los campos con * y usa las listas de unidad y categoría. En Importar Excel revisa la vista previa antes de confirmar. Los SKU ya registrados se omiten y los nuevos se agregan.",
        adminOnly: true,
      },
      {
        title: "Exporta el catálogo",
        description:
          "Exportar Excel genera un archivo de productos que puedes volver a importar en otra instalación. Para respaldar ventas, usuarios y todos los datos, usa el respaldo integral de Ajustes.",
        adminOnly: true,
      },
    ],
    notes: [
      {
        text: "El botón Kardex de esta pantalla muestra datos de ejemplo.",
      },
      {
        text: "Los movimientos reales están en Reportes > Movimientos (Kardex).",
        permission: "reports.view",
      },
    ],
  },
  customers: {
    title: "Clientes",
    description: "Administra clientes, consulta sus deudas y registra abonos.",
    steps: [
      {
        title: "Busca y filtra",
        description:
          "Busca por nombre, código o teléfono. Activa el filtro de deudores para consultar clientes con saldo pendiente; las tarjetas superiores resumen la cartera completa.",
      },
      {
        title: "Completa el perfil",
        description:
          "Usa Nuevo cliente o el botón de editar para guardar sus datos y límite de crédito. Después podrás seleccionarlo en Ventas para registrar compras a su nombre.",
      },
      {
        title: "Consulta el estado de cuenta",
        description:
          "Abre los movimientos del cliente para revisar cargos, abonos y devoluciones. Pulsa un cargo para ver sus artículos. Puedes elegir A4 o carta e imprimir el estado de cuenta.",
      },
      {
        title: "Registra un abono",
        description:
          "Con la caja abierta que te corresponde, usa el botón de abono, indica el importe y la forma de pago y confirma. El abono reduce la deuda y queda vinculado al turno de caja.",
      },
    ],
    notes: [
      {
        text: "La eliminación de clientes está reservada a administradores y conserva sus operaciones históricas.",
        adminOnly: true,
      },
    ],
  },
  suppliers: {
    title: "Proveedores",
    description:
      "Guarda contactos comerciales para utilizarlos al registrar compras.",
    steps: [
      {
        title: "Consulta el directorio",
        description:
          "Busca por empresa, RFC o agente. Las tarjetas muestran el total de proveedores y cuántos tienen contacto o RFC válido.",
      },
      {
        title: "Registra un proveedor",
        description:
          "Pulsa Nuevo proveedor y escribe la empresa o razón social. Es el único campo obligatorio; RFC, teléfono, contacto, correo y dirección pueden quedar vacíos.",
      },
      {
        title: "Mantén los datos actualizados",
        description:
          "Usa el lápiz para editar o la papelera para solicitar la eliminación. El proveedor guardado aparece en el selector de Compras y Abasto.",
      },
    ],
    notes: [
      {
        text: "Si cambian los datos del directorio, pulsa Actualizar para volver a consultarlos.",
      },
    ],
  },
  purchases: {
    title: "Compras y Abasto",
    description:
      "Registra mercancía recibida y conserva el historial de abastecimiento.",
    steps: [
      {
        title: "Prepara el proveedor",
        description:
          "Registra primero al proveedor en Catálogos > Proveedores. Los productos que vas a recibir también deben estar dados de alta en el catálogo.",
      },
      {
        title: "Arma una compra manual",
        description:
          "Pulsa Compra manual, selecciona el proveedor y busca los productos por nombre o SKU. Agrega cada concepto e indica la cantidad recibida y su costo unitario.",
      },
      {
        title: "Revisa y procesa",
        description:
          "Comprueba cantidades, costos y subtotales. Procesar compra manual guarda la compra, suma las existencias y actualiza el costo de compra de los productos; no cambia su precio de venta.",
      },
      {
        title: "Consulta o retoma",
        description:
          "Busca por folio o proveedor en el historial y abre el detalle de la compra. Si hay una operación pendiente, usa Retomar compra pendiente y revisa su estado antes de intentar registrarla nuevamente.",
      },
    ],
    notes: [
      {
        text: "Cargar factura CFDI (XML) todavía está pendiente de implementación; por ahora las entradas se registran con Compra manual.",
      },
    ],
  },
  "sales-history": {
    title: "Notas de venta",
    description:
      "Encuentra ventas guardadas, reimprime comprobantes y gestiona devoluciones.",
    steps: [
      {
        title: "Encuentra la venta",
        description:
          "Al abrir se muestra la semana actual, desde el lunes hasta hoy. Busca por folio o cliente y filtra por pago o fechas. Registro histórico quita los filtros y consulta todas las ventas.",
      },
      {
        title: "Abre su comprobante",
        description:
          "Ticket Térmico muestra el ticket y permite reimprimirlo con la impresora configurada. Nota de Venta (A4) abre un documento amplio y permite imprimirlo en una impresora de documentos.",
      },
      {
        title: "Selecciona una devolución",
        description:
          "Pulsa el botón de la caja, Devolución. Usa + para aumentar y × para disminuir la cantidad a devolver; en productos por kg puedes escribir el peso. Nunca puede superar lo que queda pendiente.",
      },
      {
        title: "Confirma el resultado",
        description:
          "Revisa el importe y elige efectivo, tarjeta o transferencia para el reembolso. Necesitas una caja abierta que puedas operar. La devolución repone stock y ajusta la venta; si había deuda, primero reduce el saldo pendiente.",
      },
    ],
    notes: [
      {
        text: "Devolución completa selecciona todos los artículos pendientes. Revisa la selección antes de confirmar; abrir el diálogo o cambiar cantidades todavía no guarda la devolución.",
      },
    ],
    shortcuts: [
      {
        keys: ["F7"],
        description: "Imprimir mientras está abierto el ticket térmico",
      },
    ],
  },
  account: {
    title: "Mi cuenta",
    description: "Cambia la contraseña de tu cuenta administradora.",
    steps: [
      {
        title: "Comprueba tu identidad",
        description:
          "Revisa el nombre, usuario y correo mostrados en el encabezado. Escribe la contraseña actual de esta cuenta.",
      },
      {
        title: "Elige una contraseña nueva",
        description:
          "Escribe al menos seis caracteres y repite exactamente la misma contraseña en la confirmación.",
      },
      {
        title: "Guarda y conserva tus credenciales",
        description:
          "Pulsa Guardar contraseña. Tu sesión actual continúa abierta y se cierran las otras sesiones de tu cuenta. En el siguiente inicio de sesión utiliza la nueva contraseña.",
      },
    ],
    notes: [
      {
        text: "Para restablecer la contraseña de un cajero, abre Ajustes > Personal y roles y edita su cuenta.",
      },
    ],
  },
  register: {
    title: "Caja y turnos",
    description:
      "Abre un turno, registra ajustes de efectivo y realiza el corte.",
    steps: [
      {
        title: "Abre la caja",
        description:
          "Pulsa Abrir en el menú superior, escribe el efectivo que hay al comenzar y confirma. La caja queda asociada al usuario que inicia el turno.",
      },
      {
        title: "Registra movimientos de efectivo",
        description:
          "Usa Ajuste de efectivo para un ingreso o egreso ajeno a una venta. Indica el importe y su motivo. Debes poder operar la caja actual; estos movimientos cambian el efectivo esperado.",
        permission: "cash.adjust",
      },
      {
        title: "Consulta el efectivo",
        description:
          "El icono del ojo muestra u oculta el efectivo esperado de la caja. El fondo inicial, cobros, reembolsos y ajustes de efectivo intervienen en ese importe.",
        adminOnly: true,
      },
      {
        title: "Realiza el corte",
        description:
          "Al terminar, pulsa Cierre de caja. Cuenta el efectivo y revisa los cobros por tarjeta y transferencia. Introduce los tres importes, incluso cero, compara la diferencia y confirma el cierre.",
      },
      {
        title: "Revisa los turnos anteriores",
        description:
          "En Reportes > Historial de Cortes puedes consultar el monto declarado y la diferencia. Auditoría resume los faltantes y sobrantes por cajero.",
        permission: "reports.view",
      },
    ],
    notes: [
      {
        text: "Cerrar sesión y cerrar caja son acciones diferentes. Un cajero solo puede cobrar o cerrar su propio turno; una cuenta administradora también puede operar la caja abierta.",
      },
    ],
  },
} satisfies Record<string, HelpGuide>;
