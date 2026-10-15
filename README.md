# Punto Claro

Sistema de punto de venta para tiendas y comercios. Administra ventas, inventario, clientes, proveedores y compras; imprime tickets, registra devoluciones y cortes de caja, consulta reportes e importa o exporta productos con Excel. La información se almacena localmente.

## Funciones

- Registro de ventas, cobros y devoluciones.
- Administración de productos, existencias, clientes y proveedores.
- Control de caja, cortes y reportes.
- Impresión de tickets térmicos y notas de venta.
- Importación y exportación de productos en Excel.
- Usuarios con roles y permisos.
- Base de datos local SQLite.

## Desarrollo

Instala las dependencias:

```bash
npm install
```

Inicia la aplicación en modo desarrollo:

```bash
npm run dev
```

## Crear instalador

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Publicar una versión y actualizar la app

Las actualizaciones automáticas están habilitadas para el instalador de Windows. Al abrir Punto Claro, la aplicación comprueba si hay una versión nueva; el usuario elige cuándo descargarla y reiniciar para instalarla.

Para publicar una versión:

1. Cambia `version` en `package.json` y `package-lock.json`.
2. Crea y sube una etiqueta Git con el mismo número, por ejemplo `v1.0.1`.
3. GitHub Actions compila el instalador y adjunta explícitamente a **GitHub Releases** el instalador `.exe`, su `.blockmap` y `latest.yml`, que necesita el actualizador.

El repositorio debe ser público para que las instalaciones puedan consultar las releases sin credenciales. El flujo de GitHub Actions usa el token temporal de GitHub para publicar; no se incluye ningún token en la aplicación.

Para probar el actualizador, publica e instala primero `v1.0.0`; después incrementa la versión a `1.0.1`, publica `v1.0.1` y abre la instalación anterior. Las actualizaciones solo se consultan en la aplicación instalada, no en modo desarrollo.

Para crear y probar un instalador sin publicarlo, ejecuta `npm run build:win`. La publicación recomendada es subir una etiqueta `v*`; el flujo de GitHub Actions construye y adjunta los tres archivos necesarios a la Release.
