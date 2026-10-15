# Respaldo integral y restauración

Disponible para administradores en **Administración → Ajustes → Conexión y datos**.

## Descargar

**Descargar respaldo Excel** permite elegir dónde guardar un archivo `.xlsx`.
Incluye una copia coherente de SQLite, con los datos todavía presentes en WAL:
productos, clientes, proveedores, compras, ventas, pagos, devoluciones, caja,
movimientos, usuarios, contraseñas protegidas, roles, permisos, migraciones y
consecutivos. También incluye los ajustes de negocio, categorías, apariencia,
impresora y tickets.

Los archivos de fotografías y logotipos locales no se incluyen. No se copian
contraseñas en texto: se conserva el hash que ya utiliza la aplicación.

## Contenido del Excel

- **Respaldo:** identifica el formato, fecha, tamaños, índice de tablas y SHA-256.
- **Datos:** copia SQLite en bloques de texto base64, sin pérdida de precisión.
- **Configuracion:** ajustes en bloques base64.
- **T…:** hojas legibles de consulta de las tablas. Los textos demasiado largos
  para una celda se señalan; sus valores completos permanecen en Datos.

Conserva el archivo original. Las hojas de consulta no se utilizan para modificar
la base al restaurar. Este formato es distinto del Excel para importar productos.

## Importar y reemplazar

1. Selecciona **Importar y reemplazar datos** y el respaldo `.xlsx`.
2. La app verifica el contenedor, los tamaños, la suma de comprobación, los ajustes,
   la estructura SQLite, las relaciones, los tipos, los usuarios, los consecutivos
   y los documentos asociados a las ventas.
3. Revisa el resumen y confirma que deseas reemplazar los datos y conoces las
   credenciales de una cuenta del respaldo.
4. Se bloquean las operaciones mientras se prepara una copia de recuperación
   `.xlsx` en la carpeta `backups` del directorio de datos de la aplicación.
5. Los datos se sustituyen dentro de una transacción. Cualquier fallo durante la
   carga revierte el reemplazo. Los disparadores se restauran sin generar entradas
   duplicadas de Kardex.
6. Se eliminan las sesiones importadas y se invalidan las sesiones actuales. El
   diálogo de éxito muestra la ruta del respaldo de recuperación y permite volver
   al login con las cuentas del archivo importado.

Los ajustes quedan pendientes dentro de SQLite hasta que se guardan en la
configuración local. Si la app se cierra antes, vuelve a aplicarlos al iniciar.
Las ventas en espera y las revisiones locales pendientes de compras/importación
se descartan porque sus identificadores pertenecen a la base reemplazada.

No se reinicializa la base después de restaurar. Los folios y secuencias conservan
los valores del respaldo. Las instalaciones nuevas comienzan sin productos,
clientes, ventas ni pagos de demostración; la cuenta administradora se crea
mediante la configuración inicial.

Si se elimina `pos.db` y la app vuelve a pedir crear su primer administrador,
antes de mostrar esa pantalla también se reinician los ajustes locales y se
descartan los borradores de ventas, compras e importaciones anteriores. Los
datos del negocio quedan vacíos y se recuperan los parámetros iniciales de
apariencia, impresora y ticket. Esta limpieza no se ejecuta al iniciar sesión
con cuentas existentes ni al restaurar un respaldo con usuarios.

## Compatibilidad y límites

El respaldo debe proceder de esta app y tener una estructura compatible con la
instalación receptora. Una estructura desconocida se rechaza antes del reemplazo.

Se admiten las variantes históricas de los valores predeterminados para fechas
(`datetime('now')`, `datetime('now', 'localtime')` y `CURRENT_TIMESTAMP`) frente a
`app_now()`. Cada fecha guardada se copia sin modificarla; las operaciones futuras
utilizan la estructura actual de la instalación. No se flexibilizan los tipos,
las restricciones, las claves ni los valores predeterminados de otros campos.
El marcador local `_migration_round_quantities` se conserva para no repetir la
migración que redondea las cantidades.

- Archivo Excel: hasta 64 MiB.
- Copia SQLite: hasta 64 MiB.
- Configuración: hasta 512 KiB.
- Contenido descomprimido: hasta 128 MiB; hasta 128 hojas y 2 millones de celdas.
- La revisión previa vence después de 15 minutos o al cambiar de sesión.

La copia consistente se obtiene mediante `serialize()`, en lugar de copiar el
archivo físico y omitir cambios del WAL. Para abrir las copias en memoria se
normalizan los bytes de versión de diario en una copia del buffer, según la
[documentación de SQLite](https://www.sqlite.org/c3ref/deserialize.html).

## Comprobaciones realizadas durante el desarrollo

El respaldo `Respaldo-POS-2026-10-07.xlsx` se restauró en una instalación temporal
creada con las migraciones reales. Se compararon todos los datos de negocio,
usuarios y hashes de contraseñas, secuencias, ajustes y disparadores. También se
comprobaron el inicio de sesión por usuario/correo, el rechazo de contraseñas
incorrectas, la reversión ante un fallo durante la escritura y el rechazo de
tablas, restricciones y valores predeterminados incompatibles.

La comprobación se puede repetir con:

```text
node scripts/check-backup-restore.cjs <ruta-del-respaldo.xlsx>
```

Este comando utiliza un perfil temporal y lo elimina al terminar. No modifica
el archivo Excel ni la base de datos real de la aplicación.

También se completaron la comprobación de tipos del proceso principal y de la
interfaz, y la compilación de Electron.
