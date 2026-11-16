export const VERSION='0.3.0';
export const RELEASES=[{version:VERSION,date:'2026-11-16',changes:[
 'Varias compañías: RUC, comprobantes, cobros, retenciones y respaldos separados por espacio.',
 'Órbitas animadas con los mismos tiempos y sentidos de giro que Nysasoft.',
 'Actualizaciones automáticas cuando no hay trabajo en curso y notificaciones con historial.',
 'Guía Nysa para encontrar las funciones y entender el flujo de revisión local.'
]}];
export function canAutoUpdate({saving=false,importing=false,modalOpen=false,dirty=false,demo=false}={}){return !saving&&!importing&&!modalOpen&&!dirty&&!demo;}
