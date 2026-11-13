# Colaborar con NysaLedger

Gracias por ayudar a mantener una herramienta gratuita y sin registro.

## Ideas, errores y revisiones

Cuando se publique el repositorio, usa Issues para errores y propuestas. Un issue no es una reseña verificada ni una consulta tributaria. Las revisiones del código ocurren en los pull requests. Puedes apoyar dando una estrella y compartiendo el proyecto.

Explica qué ocurrió, qué esperabas, navegador, dispositivo y pasos para reproducir. Usa exclusivamente comprobantes ficticios. No adjuntes XML reales, RUC de personas, claves de acceso, firmas electrónicas, contraseñas ni respaldos; tampoco los pegues en capturas.

## Desarrollo

1. Crea un fork y una rama para un cambio concreto.
2. Ejecuta `npm ci` y `npm run dev` con Node.js 22 o superior.
3. Ejecuta `npm test` y `npm run check`.
4. Si cambias la interfaz, revisa escritorio, móvil y ambos temas, con movimiento reducido cuando corresponda.
5. Si cambias archivos de ejecución, incrementa la versión de la caché en `dist/sw.mjs` y confirma que su lista incluye todas las dependencias.
6. Envía un pull request con el problema, la solución, las pruebas y las limitaciones.

Mantén los importes en centavos enteros. No incluyas credenciales ni conexiones que envíen datos contables fuera del dispositivo. Los cambios tributarios necesitan una fuente oficial con fecha y pruebas ficticias; no deben aplicar una regla universal sin considerar su alcance.

Las contribuciones de código se realizan bajo MIT. Consulta `NOTICE.md` para los gráficos y la marca.
