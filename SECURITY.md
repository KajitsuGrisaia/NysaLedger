# Reportar un problema de seguridad

No publiques XML, respaldos, firmas, credenciales ni datos personales para demostrar una vulnerabilidad. Prepara un caso ficticio mínimo y descríbelo sin exponer información real.

Al publicar el repositorio se habilitará el reporte privado de vulnerabilidades de GitHub. Usa esa función cuando esté disponible; no abras un issue público con detalles explotables de una vulnerabilidad aún no corregida. No se ofrece por ahora un programa de recompensas ni un plazo garantizado de respuesta.

La versión actual procesa comprobantes localmente. IndexedDB no tiene cifrado propio de la aplicación. Los archivos exportados como CSV/XML no están cifrados; los respaldos `.nysa` sí requieren contraseña. No se valida la firma digital ni la autorización del XML mediante una consulta al SRI.
