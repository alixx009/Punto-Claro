# Importación de productos desde Excel

En **Catálogos > Productos** hay dos acciones para administradores:

1. **Descargar plantilla**: guarda un archivo `.xlsx` con la hoja `Productos`, encabezados y filas vacías para completar.
2. **Importar Excel**: selecciona un archivo, revisa sus productos y confirma el registro en la base de datos local.

## Plantilla

Cada fila corresponde a un producto. Los encabezados con `*` son obligatorios:

| Columna                   | Obligatoria | Captura                                                                                       |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Código de barras / SKU    | Sí          | Texto único; conserva ceros iniciales y códigos largos.                                       |
| Código de catálogo        | No          | Texto.                                                                                        |
| Nombre comercial y medida | Sí          | Nombre del producto.                                                                          |
| Marca / línea             | No          | Texto.                                                                                        |
| Unidad de medida          | Sí          | Lista: PIEZA, KG o PAQUETE.                                                                   |
| Precio de compra          | Sí          | Número en pesos; permite 0 y hasta dos decimales.                                             |
| Precio de venta           | Sí          | Número en pesos; permite 0 y hasta dos decimales.                                             |
| Precio de mayoreo         | No          | Número; si queda vacío se guarda 0.                                                           |
| Familia / categoría       | Sí          | Lista de Ajustes > Catálogos base.                                                            |
| Existencias               | Sí          | Cantidad inicial; captura 0 cuando corresponda.                                               |
| Notas                     | No          | Texto.                                                                                        |
| Imagen (URL)              | No          | Enlace HTTP/HTTPS directo a una imagen pública; se descarga y guarda localmente al confirmar. |

Las categorías se toman de la configuración vigente al descargar. Si cambian, descarga una plantilla nueva. La unidad y categoría se eligen en listas dentro de la hoja; no vienen preseleccionadas. PAQUETE corresponde a `PAQ` en la base de datos.

La plantilla incluye 1,000 filas con validaciones. Puedes copiar una fila vacía con su formato y validaciones para ampliarla hasta 5,000 productos. La hoja `Instrucciones` contiene ayuda y la hoja interna `Catalogos` contiene las opciones de las listas.

PIEZA y PAQUETE requieren cantidades enteras. KG admite tres decimales. Los precios admiten hasta $1,000,000 y las existencias hasta 1,000,000,000.

## Archivos admitidos y revisión

- Se admite `.xlsx`, compatible con Excel y LibreOffice. Convierte un archivo antiguo `.xls` a `.xlsx` antes de seleccionarlo.
- Máximo 25 MB y 5,000 filas de productos. Las filas completamente vacías se omiten.
- Conserva la hoja `Productos` y los nombres de los encabezados. Puedes reordenar columnas; los encabezados opcionales pueden faltar.
- No se admiten fórmulas, macros ni errores de celdas. Pega valores cuando copies desde otra hoja.
- Los códigos se guardan como texto. Si Excel ya eliminó ceros iniciales o redondeó un código largo, corrígelo antes de importar.
- No se importan fotografías incrustadas ni rutas de archivos; la imagen es opcional y se puede agregar después desde Editar producto.

## Imágenes sin conexión

Al confirmar una nueva importación, la app descarga las imágenes de los productos nuevos antes de guardarlos. Las filas con SKU ya registrados se omiten y sus URL no se descargan durante la importación. Admite imágenes PNG, JPG, WEBP, GIF y BMP públicas, de hasta 10 MB y 24 megapíxeles. Si una descarga falla, se informa la fila: corrige el enlace o deja vacía esa celda y selecciona el archivo nuevamente. No se agrega ningún producto mientras falte una imagen solicitada.

Las copias se guardan en la carpeta `images` de los datos locales de la app, con un nombre derivado de la URL. La URL original permanece en la base de datos y permite localizar siempre la misma copia, incluso después de reiniciar y sin internet. Las URLs compartidas reutilizan el mismo archivo. PNG y JPG se optimizan hasta 800 píxeles en su lado mayor; los otros formatos conservan el archivo descargado.

Las imágenes de productos ya existentes también se guardan automáticamente la primera vez que se muestran con conexión. Deben haberse descargado antes de trabajar sin internet. La imagen predeterminada "Sin imagen" está incluida en la app y funciona sin conexión.

La descarga usa límites de tamaño, tiempo y concurrencia, verifica cada redirección y admite destinos públicos. Las copias locales ya disponibles se consultan antes de intentar acceder a internet. No se vuelven a descargar en cada apertura.

Antes de confirmar se muestran los productos nuevos y una lista de las filas omitidas, con su SKU y número de fila. La app comprueba los campos obligatorios, unidades, categorías vigentes y números de los productos nuevos. Si un SKU nuevo aparece más de una vez en el archivo, hay que corregirlo. Los datos de las filas con SKU ya registrados no se validan porque no se guardarán. Conserva los encabezados obligatorios de la plantilla incluso si algunas filas se van a omitir.

Si hay errores en los productos nuevos, corrige el archivo y selecciónalo otra vez. Si todos los SKU ya existen, se informa que no hay productos nuevos y no se solicita una confirmación.

## Registro y fiabilidad

La importación agrega solamente productos nuevos. Un SKU existente se omite sin bloquear los nuevos: no se reemplazan sus datos, precios, imágenes ni existencias. La coincidencia usa el SKU completo, respetando sus ceros iniciales.

Todos los productos nuevos se guardan en una única transacción: productos, existencias iniciales y seguimiento de la importación. Los triggers existentes registran las existencias iniciales en Kardex. La comprobación de SKU se repite al confirmar y dentro de la transacción, para omitir también los productos registrados después de la revisión. El resultado indica cuántos se agregaron y cuántas filas se omitieron.

Las tablas `product_import_batches`, `product_import_requests` y `product_import_items` conservan el archivo identificado por su hash, el administrador que lo importó y las solicitudes de confirmación. `product_import_batches.skipped_count` conserva el número de filas omitidas; las importaciones anteriores reciben 0 sin modificar sus productos. Reintentar una confirmación recupera el resultado guardado sin crear productos nuevamente. Si una respuesta se interrumpe, el registro pendiente local permite verificarla incluso después de reiniciar.

Una revisión sin confirmar dura 30 minutos y pertenece a la sesión que abrió el archivo. Si expira o se reinicia la app antes de confirmar, selecciona el archivo nuevamente. Una importación ya guardada se puede verificar aunque su revisión haya expirado.

La migración se aplica al iniciar Electron. Reinicia la aplicación después de actualizar el proyecto.

## Archivos principales

- `src/shared/product-import.ts`: columnas, límites y contratos entre procesos.
- `src/main/products-excel.ts`: plantilla, listas y lectura de Excel.
- `src/main/products-excel/archive-guard.ts`: límites del contenido XLSX antes de abrirlo.
- `src/main/files/remote-images.ts`: descarga y copias locales persistentes de imágenes.
- `src/main/product-import.ts`: revisiones y sesión autorizada.
- `src/main/db/product-import.ts`: validaciones y guardado del lote.
- `src/main/db/product-import-migration.ts`: tablas de seguimiento.
- `src/renderer/src/components/catalog/products/import/`: revisión, errores, confirmación y recuperación.
