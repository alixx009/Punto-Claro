# Usuarios y autenticación local

El proceso principal de Electron conserva la sesión y consulta los roles y permisos en SQLite antes de cada operación. React recibe datos públicos del usuario para presentar las opciones disponibles; nunca recibe contraseñas ni sus hashes.

## Tablas

| Tabla                    | Función                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_users`             | UID UUID, nombre de usuario obligatorio y único, correo opcional y único, teléfono opcional y fechas UTC de creación, actualización y último acceso correcto. |
| `profiles`               | Nombre visible, cuenta activa y condición de administrador principal.                                                                                         |
| `auth_credentials`       | Hash bcrypt con costo 12, fecha de cambio y obligación de cambiar la contraseña.                                                                              |
| `auth_sessions`          | UUID de sesión, usuario, creación, última actividad, vencimiento y revocación.                                                                                |
| `roles`                  | Administrador global y Cajero principal.                                                                                                                      |
| `permissions`            | Los cinco permisos establecidos en Ajustes → Personal y roles.                                                                                                |
| `role_permissions`       | Permisos comunes de un rol; el administrador dispone de todos.                                                                                                |
| `user_roles`             | Un rol por usuario.                                                                                                                                           |
| `user_permissions`       | Decisiones individuales de permitir o denegar cada uno de los cinco permisos.                                                                                 |
| `auth_login_attempts`    | Intentos fallidos y bloqueo temporal por resumen SHA-256 de la cuenta o del identificador desconocido (`identifier_key`).                                     |
| `auth_schema_migrations` | Versiones y fechas de las migraciones de autenticación.                                                                                                       |

Los UUID se guardan como `TEXT` en SQLite y pueden convertirse a `uuid` en PostgreSQL. Los usuarios se desactivan; no se borran desde la aplicación. El administrador principal permanece activo y conserva su rol.

## Nombre de usuario y correo

- El nombre de usuario es obligatorio, único y distinto del campo de nombre completo. Tiene de 3 a 30 caracteres, empieza con una letra o número y permite letras ASCII, números, puntos, guiones y guion bajo. Se guarda en minúsculas; el acceso y la unicidad no distinguen mayúsculas.
- El nombre completo sigue identificando al cajero en la interfaz, los tickets y las copias históricas de las operaciones. Cambiar el nombre de usuario no cambia el UUID ni los vínculos con ventas y cortes.
- El correo es opcional y se guarda como `NULL` cuando está vacío. Si se proporciona, debe ser válido y único sin distinguir mayúsculas. Varias cuentas pueden no tener correo.
- El login permite usar el nombre de usuario o el correo, con la misma contraseña. Un identificador con `@` se busca como correo; los demás se buscan como nombre de usuario.
- Personal y roles permite editar ambos datos y buscar cuentas por nombre completo, usuario, correo o teléfono.

## Permisos

| Clave             | Opción de la interfaz         |
| ----------------- | ----------------------------- |
| `stock.inspect`   | Inspeccionar stock de almacén |
| `costs.view`      | Ver precios de costo          |
| `discounts.apply` | Aplicar descuentos            |
| `reports.view`    | Consultar reportes            |
| `cash.adjust`     | Realizar ajustes de caja      |

Los cajeros tienen una selección individual explícita. El rol de administrador siempre recibe los cinco permisos. La administración de usuarios está reservada a administradores.

## Sesiones y contraseñas

- Las contraseñas tienen al menos seis caracteres y un máximo de 72 bytes UTF-8; se rechazan valores más largos para evitar el truncamiento de bcrypt.
- Cinco intentos fallidos bloquean esa cuenta durante cinco minutos, acumulando los intentos por nombre de usuario y por correo. El bloqueo permanece al reiniciar la aplicación y al cambiar los identificadores. Los identificadores inexistentes siguen el mismo cálculo bcrypt y mensaje de error, con su propio contador.
- La sesión dura doce horas y está vinculada al identificador de la ventana en el proceso principal. No hay un token de autenticación que React pueda proporcionar para asumir otra identidad.
- Las sesiones persistidas se revocan al reiniciar; se requiere iniciar sesión nuevamente.
- Desactivar una cuenta o restablecer su contraseña revoca sus sesiones. Los cambios de rol y permisos se leen nuevamente en cada operación.
- Solo los administradores pueden cambiar contraseñas. Los cajeros solicitan el cambio a un administrador, que establece una contraseña nueva desde Personal y roles sin necesitar la anterior.
- El cambio obligatorio al ingresar solo se permite para cuentas de administrador. La migración 2 elimina esa obligación de las cuentas de cajero existentes, conservando sus contraseñas.
- Cuando se exige un cambio de contraseña a un administrador, la sesión solo puede consultar su estado, cerrar sesión o cambiar su contraseña hasta completar ese paso.
- El cambio de contraseña del propio administrador verifica la contraseña actual y conserva esa sesión, revocando las demás. Esta operación vuelve a comprobar su rol antes de guardar.

La cuenta inicial Alain se crea solamente cuando `auth_users` está vacía, con el nombre de usuario `alain`. El código de inicialización contiene un hash precomputado, nunca la contraseña original. No restablece credenciales en cada arranque.

## Interfaz y operaciones

El login y el cambio obligatorio de contraseña se renderizan con elementos HTML nativos de React dentro de un documento `iframe` aislado. Ese documento no carga CSS, Tailwind, shadcn ni el tema de la aplicación. Después de iniciar sesión, el resto de la interfaz conserva sus estilos habituales.

Personal y roles permite crear, editar, activar y desactivar usuarios y restablecer contraseñas. La cuenta principal solo puede ser editada por su propietario. El nombre del administrador en el menú abre Mi cuenta, donde puede cambiar su propia contraseña. Los cajeros no tienen acceso a esa pantalla ni a la operación de cambio de contraseña.

Las rutas y las operaciones IPC requieren una sesión válida. Los cajeros tienen acceso a Ajustes únicamente para Diseño de ticket y Configuración de impresora: selección del dispositivo, márgenes, actualización de la lista de impresoras e impresión de prueba. Las otras secciones, la gestión de usuarios, modificaciones del catálogo y eliminación de clientes están reservadas a administradores. Inspeccionar stock abre la consulta del catálogo; la disponibilidad necesaria para vender sigue disponible. Consultar reportes habilita el módulo; sus secciones de inventario también requieren inspeccionar stock. Sin permiso para costos, Electron envía `null` en los costos y rentabilidad y omite las columnas de costos en Excel. El descuento se valida al registrar la venta; la interfaz actual todavía no incluye un control para introducir descuentos.

Se vinculan estas operaciones mediante UUID y una copia del nombre al momento de realizarse:

| Tabla                     | Columnas añadidas                                                             |
| ------------------------- | ----------------------------------------------------------------------------- |
| `register_sessions`       | `cashier_id`, `closed_by_user_id`, `closed_by_name` (conserva `cashier_name`) |
| `register_cash_movements` | `performed_by_user_id`, `performed_by_name`                                   |
| `sales`                   | `cashier_id`, `cashier_name`                                                  |
| `payments`                | `performed_by_user_id`, `performed_by_name`                                   |
| `sale_returns`            | `performed_by_user_id`, `performed_by_name`                                   |

Los registros antiguos mantienen sus nombres históricos y un UUID desconocido (`NULL`). Una caja histórica sin usuario asignado solo puede ser operada por un administrador. Los cajeros operan su propia caja; un administrador puede gestionar cualquier turno. Cerrar sesión conserva el turno abierto y exige identificarse de nuevo; no realiza un corte de caja automáticamente.

Los tickets nuevos toman el cajero de la venta guardada por Electron. Los pedidos retenidos se separan por UUID; solo el propietario importa los pedidos antiguos compartidos. Al cambiar usuario o permisos, se invalidan respuestas pendientes, se vacían las cachés y se vuelven a montar las pantallas para descartar datos de la sesión anterior.

Las altas y restablecimientos de contraseña pendientes vuelven a comprobar la sesión que inició la operación antes de guardar. Un cierre de sesión o un cambio de sesión mientras se calcula el hash cancela la escritura.

## Migraciones y recuperación

La migración inicial es aditiva y transaccional: crea las tablas de autenticación y no elimina ventas, inventario ni movimientos. Una reversión completa debe hacerse restaurando una copia de seguridad anterior al cambio, sin borrar manualmente tablas que ya estén referenciadas por operaciones posteriores.

La migración 3 se aplica automáticamente al reiniciar completamente Electron. Genera un nombre de usuario para cada cuenta existente a partir de su nombre completo, sin acentos y usando puntos entre palabras; si no hay un nombre utilizable, usa el prefijo del correo o `usuario`. Resuelve coincidencias con sufijos `.2`, `.3`, etc.; procesa primero al propietario. Los nombres pueden cambiarse posteriormente en Personal y roles.

Para permitir un correo nulo, esa migración reconstruye únicamente `auth_users` dentro de una transacción. Suspende las claves foráneas antes de empezar para impedir borrados en cascada, copia los mismos UUID y datos, comprueba las referencias antes de confirmar y restaura la configuración de claves foráneas al terminar. Conserva perfiles, hashes, roles, permisos y operaciones. Renombra la clave de intentos fallidos a `identifier_key` y traslada los bloqueos de los correos existentes al contador de su cuenta.

## Una futura migración a Supabase

Esta separación de identidad, perfil, credenciales, roles y permisos facilita preparar una migración. No reproduce internamente Supabase Auth ni implica una importación automática. Habrá que migrar las identidades, convertir las referencias UUID, adaptar el acceso a Supabase Auth y definir políticas RLS y autorización del servidor para las tablas operativas. Los roles `admin` y `cashier` de la aplicación son distintos del rol PostgreSQL `authenticated`. No se implementan proveedores externos.

El acceso local presupone que Windows protege los archivos del perfil. SQLite sigue siendo un archivo local; una persona con acceso directo de escritura al archivo puede modificarlo al margen de la aplicación.
