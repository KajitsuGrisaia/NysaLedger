# NysaAI en NysaLedger

La versión 0.3.0 incluye una guía local y la distingue explícitamente de IA generativa. No envía preguntas, RUC ni XML a terceros.

## Integración propuesta

1. Endpoint propio /api/assistant en el Worker de Ledger, con proveedor y credenciales solo en servidor. Reutilizar el proveedor y controles de Nysasoft, sin copiar claves al cliente ni incrustar la web en un iframe.
2. Primera fase: preguntas sobre la interfaz y el flujo de importación, respaldos y conciliación. Respuestas en español con enlaces a vistas existentes; ninguna modificación ni declaración automática.
3. Envío por acción explícita del usuario. Mostrar qué texto/contexto saldrá del dispositivo. Por defecto solo pregunta y documentación pública. No enviar XML, RUC, nombres, importes ni historial de otras compañías.
4. Contexto financiero opcional: vista previa y consentimiento específicos antes de cada envío. Separación por compañía y eliminación de la conversación al cambiar de espacio. No reutilizar consultas entre compañías.
5. Límites de longitud, frecuencia y coste, timeout, cancelación, salida escapada, errores claros y retorno a la guía local. No registrar preguntas o XML en logs.
6. Validar contra instrucciones incrustadas en documentos: XML y contexto son datos no confiables. La IA no puede firmar, presentar declaraciones, mover dinero ni solicitar clave SRI o firma electrónica.

## Antes de activar

Configurar proveedor y política de privacidad, evaluar con ejemplos ficticios, probar indisponibilidad y límites. La integración automática con el SRI y el asesoramiento tributario requieren un trabajo separado con fuentes oficiales y revisión humana.
