import type { HelpGuide } from "./types";

export const settingsGuides = {
  "settings.business": {
    title: "Negocio y caja",
    description:
      "Define la identidad del negocio que aparecerá en los comprobantes.",
    steps: [
      {
        title: "Completa los datos generales",
        description:
          "Escribe el nombre comercial, dirección y teléfono de atención. Una instalación nueva empieza con estos datos vacíos. México es la configuración regional disponible.",
      },
      {
        title: "Elige un logotipo",
        description:
          "Carga una imagen desde tu equipo y revisa la vista previa. Puedes quitarla con el botón de eliminar; el nombre comercial es obligatorio para guardar esta sección.",
      },
      {
        title: "Configura y guarda",
        description:
          "Activa Autoimpresión de comprobantes si quieres enviar el ticket al terminar cada venta. Pulsa Guardar configuración para conservar los cambios y revisa también la impresora seleccionada.",
      },
    ],
    notes: [
      {
        text: "Estos datos se utilizan en los nuevos comprobantes. Los tickets históricos conservan la identidad guardada cuando se emitieron.",
      },
    ],
  },
  "settings.appearance": {
    title: "Apariencia",
    description: "Elige el tema que te resulte más cómodo para trabajar.",
    steps: [
      {
        title: "Cambia el tema",
        description:
          "Activa el interruptor de modo oscuro o desactívalo para usar el modo claro.",
      },
      {
        title: "Continúa trabajando",
        description:
          "El cambio se aplica al instante en las pantallas y se guarda automáticamente en este equipo. No necesitas un botón adicional para guardar.",
      },
    ],
  },
  "settings.ticket": {
    title: "Diseño de ticket",
    description:
      "Ajusta el formato de los tickets y observa cómo se verá su contenido.",
    steps: [
      {
        title: "Elige el formato",
        description:
          "Selecciona la plantilla y el ancho de papel que corresponda a tu impresora. Ajusta el tamaño de fuente y las opciones para mostrar logotipo, cajero e importe.",
      },
      {
        title: "Personaliza los mensajes",
        description:
          "Escribe el agradecimiento final, mensaje de facturación y términos y condiciones. La vista previa usa datos de ejemplo para mostrar el resultado.",
      },
      {
        title: "Aplica los cambios",
        description:
          "Pulsa Aplicar parámetros de ticket para guardarlos. La vista previa cambia al editar, pero los nuevos valores solo se conservan al aplicar.",
      },
      {
        title: "Comprueba la impresión",
        description:
          "Los márgenes superior, inferior y laterales se ajustan en Configuración de impresora. Prueba un ticket para revisar el resultado en el papel.",
      },
    ],
  },
  "settings.printer": {
    title: "Configuración de impresora",
    description:
      "Selecciona la impresora de tickets instalada en Windows y ajusta sus márgenes.",
    steps: [
      {
        title: "Busca la impresora",
        description:
          "Conecta y enciende la impresora. Pulsa Actualizar para consultar los dispositivos instalados en Windows y elige el nombre correcto, por ejemplo POS-58.",
      },
      {
        title: "Ajusta el papel y los márgenes",
        description:
          "El ancho de papel se configura en Diseño de ticket. Aquí introduce los márgenes en mm: izquierdo, derecho, superior e inferior. Respeta los límites que muestra cada campo.",
      },
      {
        title: "Haz una prueba",
        description:
          "Imprime un ticket de prueba con la impresora y los márgenes que aparecen en pantalla. Si el texto se corta, aumenta el margen del lado afectado; si sobra papel al final, revisa el margen inferior.",
      },
      {
        title: "Guarda la selección",
        description:
          "Pulsa Guardar para conservar la impresora y los márgenes en este equipo. Después las ventas y reimpresiones utilizarán esta configuración.",
      },
    ],
    notes: [
      {
        text: "Si la impresora no aparece, comprueba su conexión y la cola de Windows y vuelve a actualizar. La app utiliza las impresoras que Windows reconoce.",
      },
    ],
  },
  "settings.staff": {
    title: "Personal y roles",
    description:
      "Crea cuentas de acceso y decide qué puede hacer cada operador.",
    steps: [
      {
        title: "Crea o encuentra una cuenta",
        description:
          "Busca un operador existente o pulsa Nuevo operador. Indica nombre completo, nombre de usuario y contraseña; el correo es opcional. Se puede iniciar sesión por usuario o correo.",
      },
      {
        title: "Asigna el rol",
        description:
          "Elige Cajero o Administrador. Los administradores tienen todos los permisos. Para un cajero, activa únicamente los permisos que necesita y guarda la cuenta.",
      },
      {
        title: "Restablece una contraseña",
        description:
          "Edita la cuenta y escribe una contraseña nueva en Restablecer contraseña. Si dejas el campo vacío se conserva la actual. Los cajeros solo pueden cambiar su contraseña con ayuda de un administrador.",
      },
      {
        title: "Controla el acceso",
        description:
          "Puedes activar o desactivar cuentas desde el editor. La cuenta administradora principal conserva su rol y no puede desactivarse; solo su titular puede editarla.",
      },
    ],
    notes: [
      {
        text: "Los cajeros pueden acceder a los ajustes de impresora y diseño de ticket. Las otras secciones de Ajustes están reservadas a administradores.",
      },
    ],
  },
  "settings.catalog": {
    title: "Catálogos base",
    description:
      "Mantén las categorías que se ofrecen al registrar e importar productos.",
    steps: [
      {
        title: "Agrega una categoría",
        description:
          "Escribe su nombre en Nueva categoría y pulsa Cargar o Enter. No se permiten nombres vacíos ni categorías repetidas.",
      },
      {
        title: "Ajusta la lista",
        description:
          "Usa la papelera de una categoría para quitarla de la lista. Los cambios se guardan al instante en este equipo; no necesitas otro botón para guardar.",
      },
      {
        title: "Utiliza las categorías",
        description:
          "Las opciones se ofrecen al registrar productos y al descargar una nueva plantilla Excel. Quitar una opción de la lista no reclasifica los productos que ya existen.",
      },
    ],
    notes: [
      {
        text: "Cajas registradoras es una vista de referencia; la gestión de varias terminales todavía no está disponible.",
      },
    ],
  },
  "settings.connection": {
    title: "Conexión y datos",
    description:
      "Respalda tu información y restaura una copia completa cuando lo necesites.",
    steps: [
      {
        title: "Descarga el respaldo",
        description:
          "En Respaldo integral pulsa Descargar respaldo Excel y elige dónde guardarlo. Incluye los datos de la base, usuarios, credenciales protegidas, permisos, folios y ajustes.",
      },
      {
        title: "Verifica un archivo",
        description:
          "Pulsa Importar y reemplazar datos y selecciona un respaldo creado por esta app. Se comprueba el archivo y su contenido antes de mostrar el resumen para confirmar.",
      },
      {
        title: "Confirma el reemplazo",
        description:
          "Revisa el resumen y confirma que conoces las credenciales de una cuenta del respaldo. La importación sustituye los datos actuales y crea una copia de recuperación de la base anterior.",
      },
      {
        title: "Vuelve a iniciar sesión",
        description:
          "Después del mensaje de éxito, vuelve al login y utiliza una cuenta del archivo importado. Los ajustes del respaldo se aplican al terminar la restauración.",
      },
    ],
    notes: [
      {
        text: "Conserva el Excel sin editar. No incluye archivos de fotografías ni logotipos. La conexión entre estaciones todavía no está disponible.",
      },
    ],
  },
} satisfies Record<string, HelpGuide>;

export const settingsHelpTopics = {
  business: "settings.business",
  appearance: "settings.appearance",
  ticket: "settings.ticket",
  printer: "settings.printer",
  staff: "settings.staff",
  catalog: "settings.catalog",
  connection: "settings.connection",
} as const;
