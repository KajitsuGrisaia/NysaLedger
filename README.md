# NysaLedger · un proyecto de Nysasoft

Control gratuito de comprobantes electrónicos de Ecuador, sin registro: importación de XML, ingresos y gastos documentados, cobros y pagos, retenciones de IVA y renta, y resumen mensual exportable. Aplicación web instalable (PWA). Esta versión no emite facturas, no firma comprobantes y no presenta declaraciones.

Código: [GitHub](https://github.com/KajitsuGrisaia/NysaLedger) · [Reportar un problema](https://github.com/KajitsuGrisaia/NysaLedger/issues)

## Abrir en tu equipo

Requiere Node.js 22 o superior. Desde esta carpeta:

```powershell
npm ci
npm run dev
```

Abre http://127.0.0.1:4184. Si ese puerto está ocupado:

```powershell
$env:PORT='4185'
npm run dev
```

La vista previa actual usa http://127.0.0.1:4185. Mantén la misma dirección y navegador para acceder a tus datos locales.

## Recorrido de prueba

1. Abre el avatar **N** y selecciona **Abrir demo**. Los documentos son ficticios y están separados de tus datos.
2. Revisa Vista general, Comprobantes, Retenciones y Resumen mensual.
3. Abre una compra y cambia la elegibilidad de su IVA para comprobar el resumen.
4. Registra cobros o pagos parciales; las retenciones vinculadas y notas de crédito reducen el saldo del documento.
5. Sal de la demo y configura tu perfil antes de importar XML reales.
6. Crea un respaldo cifrado desde Perfil y respaldos. Conserva su contraseña: no existe recuperación.

## Comprobantes admitidos

Factura, nota de crédito, nota de débito, liquidación de compra y retención (versiones 1 y 2). Admite XML directo o autorización que contiene el comprobante. Conserva el original y evita duplicados por documento o clave; un conflicto no sobrescribe el registro anterior. Máximo 5 MB por archivo, 200 archivos y 20 MB por lote.

El estado AUTORIZADO se lee del archivo: **no se consulta el SRI ni se valida criptográficamente su firma**. Un XML puede haber sido alterado. Revisa documentos y anulaciones con las fuentes oficiales. Los documentos de pruebas quedan fuera de los cálculos.

## Datos y respaldos

Los XML y movimientos se guardan en IndexedDB del navegador, sin cifrado propio en ese almacenamiento. No se envían a un servidor. Protege tu cuenta de Windows y tu disco. Borrar datos del navegador, cambiar de navegador o cambiar de dirección web puede dejar el espacio vacío.

Los respaldos `.nysa` usan AES-GCM de 256 bits y una clave derivada con PBKDF2-SHA256 (250.000 iteraciones), sal e IV aleatorios. Contienen los XML originales y la configuración. Guarda una copia en el disco externo y otra en una ubicación distinta; comprueba periódicamente que puedes restaurarlas. Restaurar reemplaza el espacio local después de confirmarlo en la aplicación. El CSV es legible y no está cifrado.

Nunca añadas facturas reales, respaldos, firmas `.p12`/`.pfx`, contraseñas ni datos personales al repositorio. La aplicación no necesita tu firma ni tu clave del SRI.

## Límites del resumen

Las tarifas e importes se leen del XML; no se presupone una tarifa universal. La elegibilidad del IVA de compras es manual. El crédito anterior se ingresa desde la declaración previa y no se arrastra automáticamente. Las retenciones recibidas de renta se muestran separadas del IVA; las emitidas también se separan.

El resumen usa el mes de emisión para facturas y notas, y el período fiscal del XML para retenciones. Los cobros y pagos usan su fecha real y no vuelven a sumar bases ni IVA. No cubre prorrata, regímenes especiales, exportaciones, ajustes entre períodos, todas las reglas de crédito tributario ni la liquidación anual de renta. El régimen del perfil es informativo. Confirma tu periodicidad y obligaciones con el SRI y revisa los resultados antes de declarar.

## Comprobaciones

```powershell
npm test
npm run check
```

Las pruebas usan únicamente datos ficticios: importación, clasificación, cálculos en centavos, retenciones, pagos parciales, notas de crédito, duplicados, protección de CSV y restauración cifrada.

## Demo interactiva en Nysasoft

Abre `http://127.0.0.1:4186/projects.html?lang=es#nysaledger-demo` en **Nysasoft → Proyectos → NysaLedger**. La app no incluye esta demo en su menú. El laboratorio usa un estado separado en memoria: no modifica el perfil, los documentos ni los movimientos guardados. Puedes cargar un XML de hasta 5 MB, descargar el original, inspeccionar sus importes y probar ejemplos ficticios de venta, compra, retención o un escenario completo.

Elige emisor o receptor como perspectiva, o ingresa un RUC de referencia. Revisa el documento para simular su inclusión, cambia la elegibilidad de IVA de compras y prueba cobros/pagos. Cada importe simulado reemplaza el anterior; 0 lo elimina. Un archivo inválido conserva el escenario anterior. Reiniciar o recargar descarta todos los datos del laboratorio. Leer AUTORIZADO del XML no valida su firma ni consulta al SRI.

## Instalación

En Android, abre el futuro enlace HTTPS público en Chrome y elige **Instalar aplicación** o **Añadir a pantalla de inicio**. En Chrome/Edge de escritorio, usa la opción de instalación del navegador. La app también ofrece un botón si el navegador proporciona la solicitud de instalación. No hay APK ni publicación en Google Play en esta versión.

La primera carga prepara los archivos públicos de la app en una caché local. El service worker no almacena XML ni respaldos; estos siguen en IndexedDB o en los archivos que exportas. Las actualizaciones se ofrecen sin recargar automáticamente ni borrar los datos. Guarda formularios pendientes antes de actualizar. La instalación no sincroniza dispositivos: usa un respaldo cifrado para trasladar datos.

El enlace `127.0.0.1` solo sirve en la computadora que ejecuta el servidor; no permite probar la instalación desde otro teléfono. La prueba real en Android queda pendiente del origen HTTPS autorizado por el propietario.

## Comunidad y apoyo

La sección **Proyecto y comunidad** explica cómo contribuir y apoyar voluntariamente, sin funciones de pago. `dist/project.mjs` contiene el repositorio público y el enlace de aportes voluntarios a https://ko-fi.com/nysasoft. Los pagos se gestionan fuera de la aplicación, sin enviar XML ni datos del perfil. No se crean reseñas, estrellas ni enlaces de pago ficticios. El repositorio público debe habilitar Issues, pull requests y reportes privados de seguridad; Discussions es opcional para ideas y preguntas. GitHub no proporciona una puntuación de reseñas del producto: los comentarios y revisiones se realizan en issues, discusiones y pull requests.

Incluye plantillas de issues y pull requests, guía de contribución y CI de comprobaciones sin despliegue automático. El código está bajo licencia MIT; consulta `NOTICE.md` para los logotipos y las marcas.

## Publicación futura

La configuración por RUC permite reutilizar la herramienta para otros contribuyentes, dentro de sus límites. La revisión local precede a cualquier subida a GitHub o despliegue público. Mantén las facturas, firmas y datos del contribuyente fuera del código. Las funciones de emisión y firma requieren un desarrollo y revisión normativa independientes.

La presentación del proyecto en la web de Nysasoft se revisa por separado en `http://127.0.0.1:4186/projects.html?lang=es`. La copia de integración está en la carpeta hermana `nysasoft-preview`. Antes de publicar, reemplaza sus enlaces locales por el dominio definitivo de NysaLedger, configura el repositorio y el medio de apoyo, e incrementa la versión de caché al cambiar archivos de ejecución.

Referencias: [Facturación electrónica del SRI](https://www.sri.gob.ec/facturacion-electronica).

## Identidad de NysaLedger

El símbolo propio combina los ángulos de Nysasoft con un comprobante, una calculadora y una gráfica. La esfera superior conserva la proporción del logo de Nysasoft. `symbol-animated.svg` añade un brillo suave y respeta la preferencia de movimiento reducido. Los SVG transparentes están en `dist/assets/symbol.svg`, `wordmark.svg` (fondos oscuros) y `wordmark-light.svg` (fondos claros). Los iconos de instalación llevan fondo oscuro. `scripts/build-brand.cjs` genera estos archivos y copia la identidad a la vista previa de Nysasoft; requiere Sharp como herramienta de desarrollo. La identidad no representa aprobación del SRI.

## Apariencia y publicación

Orbit, Aurora, Studio y Eclipse usan el cursor y la identidad de Nysasoft, con modo claro u oscuro. Los enlaces intercambian únicamente `design` y `mode`; los datos contables nunca se comparten entre sitios.

La app usa un origen independiente: `nysaledger.nysasoft.io`. El perfil y los documentos de localhost no se migran automáticamente: crea un respaldo cifrado y restáuralo en la dirección pública.

Para Cloudflare Workers Static Assets: ejecuta `npm run check`, `npm test` y `npx wrangler deploy` con una sesión autorizada. `wrangler.jsonc` conecta el subdominio. Sites conserva una publicación adicional a partir de `dist/`. Nunca empaquetes `.audit`, XML reales, respaldos o firmas.
