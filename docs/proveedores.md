# Catálogo de proveedores

La pantalla está disponible en **Catálogos → Proveedores**, en la ruta `/proveedores`. El catálogo usa la base SQLite existente y no necesita una segunda base ni un servicio externo.

## Datos

La migración `supplier_schema_migrations`, versión 1, crea la tabla `suppliers` al reiniciar completamente Electron. No carga proveedores de ejemplo.

| Columna                    | Uso                                                                  |
| -------------------------- | -------------------------------------------------------------------- |
| `id`                       | Identificador consecutivo del registro; no se reutiliza al eliminar. |
| `name`                     | Empresa o razón social, obligatoria, hasta 180 caracteres.           |
| `rfc`                      | RFC opcional, guardado en mayúsculas, hasta 20 caracteres.           |
| `phone`                    | Teléfono de enlace opcional, hasta 40 caracteres.                    |
| `contact_name`             | Contacto comercial opcional, hasta 120 caracteres.                   |
| `email`                    | Correo de ventas opcional, hasta 254 caracteres.                     |
| `address`                  | Dirección física opcional, hasta 500 caracteres.                     |
| `created_at`, `updated_at` | Fechas de alta y actualización con la zona horaria de la aplicación. |
| `deleted_at`               | Fecha de eliminación lógica; `NULL` identifica proveedores visibles. |

Solo la empresa es obligatoria. Los demás campos vacíos se normalizan a `NULL`. Si se escribe un correo, se comprueba su formato. Un RFC incompleto puede guardarse y corregirse después; no cuenta en la métrica fiscal hasta cumplir el formato local.

El índice parcial `idx_suppliers_active_name` mantiene el orden del catálogo activo por empresa e identificador. Las escrituras reciben parámetros, validan valores en el proceso principal y las altas/ediciones se ejecutan dentro de una transacción. Los errores internos de SQLite no se presentan en la interfaz.

## Interfaz

- Formulario con `react-hook-form` y componentes shadcn: crear o editar sin perder los datos si falla el guardado.
- Búsqueda por empresa, RFC o agente y contador de resultados.
- Métricas del catálogo activo: total; proveedores con teléfono o nombre de contacto; proveedores con RFC de formato válido.
- Eliminación confirmada con `AlertDialog`, que retira el registro de la tabla y las métricas conservándolo en la base.
- Los administradores pueden consultar y gestionar el catálogo. La ruta, el menú y todas las operaciones IPC aplican ese acceso.
- La pantalla usa datos locales y descarta respuestas pendientes cuando cambia la sesión o se desmonta la vista.

## Métrica fiscal

`isValidSupplierRfc`, en `src/shared/suppliers.ts`, verifica la estructura de 12 o 13 caracteres, las letras iniciales, una fecha posible y tres caracteres alfanuméricos finales. La estructura corresponde a la [documentación del SAT sobre el RFC](https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175750583&ssbinary=true).

Esta comprobación no consulta la inscripción en el SAT ni confirma la homoclave asignada. Su finalidad es contar registros con el formato correcto dentro del catálogo.
