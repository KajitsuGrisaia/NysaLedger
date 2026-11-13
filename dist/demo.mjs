// Todos los identificadores e importes son ficticios. Nunca contiene documentos del usuario.
const own='1799999999001',client='0999999999001',supplier='1799999998001';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function key(type,seq){return ('12112026'+type+own+'2'+'001100'+seq.padStart(9,'0')+'1234567811').slice(0,49);}
function wrap(xml,k){return `<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${k}</numeroAutorizacion><comprobante><![CDATA[${xml}]]></comprobante></autorizacion>`;}
export function demoInvoice({issuer=own,buyer=client,seq='1',base='150.00',vat='22.50',total='172.50',description='Diseño y desarrollo web — ejemplo ficticio',date='12/11/2026'}={}) {
  const k=key('01',seq);
  return wrap(`<factura version="2.1.0"><infoTributaria><ambiente>2</ambiente><razonSocial>${issuer===own?'Nysasoft Demo':'Proveedor Ficticio'}</razonSocial><ruc>${issuer}</ruc><claveAcceso>${k}</claveAcceso><codDoc>01</codDoc><estab>001</estab><ptoEmi>100</ptoEmi><secuencial>${seq.padStart(9,'0')}</secuencial></infoTributaria><infoFactura><fechaEmision>${date}</fechaEmision><razonSocialComprador>${buyer===own?'Nysasoft Demo':'Cliente Ficticio'}</razonSocialComprador><identificacionComprador>${buyer}</identificacionComprador><totalSinImpuestos>${base}</totalSinImpuestos><totalDescuento>0</totalDescuento><totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje><baseImponible>${base}</baseImponible><valor>${vat}</valor></totalImpuesto></totalConImpuestos><importeTotal>${total}</importeTotal><moneda>DOLAR</moneda></infoFactura><detalles><detalle><descripcion>${escape(description)}</descripcion></detalle></detalles></factura>`,k);
}
export function demoRetention() {
  const k=key('07','1');
  return wrap(`<comprobanteRetencion version="2.0.0"><infoTributaria><ambiente>2</ambiente><razonSocial>Cliente Ficticio</razonSocial><ruc>${client}</ruc><claveAcceso>${k}</claveAcceso><codDoc>07</codDoc><estab>001</estab><ptoEmi>100</ptoEmi><secuencial>000000001</secuencial></infoTributaria><infoCompRetencion><fechaEmision>12/11/2026</fechaEmision><razonSocialSujetoRetenido>Nysasoft Demo</razonSocialSujetoRetenido><identificacionSujetoRetenido>${own}</identificacionSujetoRetenido><periodoFiscal>11/2026</periodoFiscal></infoCompRetencion><docsSustento><docSustento><numDocSustento>001100000000001</numDocSustento><retenciones><retencion><codigo>1</codigo><codigoRetencion>303</codigoRetencion><baseImponible>150.00</baseImponible><porcentajeRetener>10</porcentajeRetener><valorRetenido>15.00</valorRetenido></retencion><retencion><codigo>2</codigo><codigoRetencion>3</codigoRetencion><baseImponible>22.50</baseImponible><porcentajeRetener>100</porcentajeRetener><valorRetenido>22.50</valorRetenido></retencion></retenciones></docSustento></docsSustento></comprobanteRetencion>`,k);
}
export function demoFiles(){return [
  {name:'venta-ficticia.xml',text:demoInvoice()},
  {name:'compra-ficticia.xml',text:demoInvoice({issuer:supplier,buyer:own,seq:'2',base:'40.00',vat:'6.00',total:'46.00',description:'Herramientas de trabajo — ejemplo ficticio'})},
  {name:'retencion-ficticia.xml',text:demoRetention()},
];}
export const demoRuc=own;
