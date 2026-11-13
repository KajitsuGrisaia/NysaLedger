export const MAX_XML_BYTES = 5 * 1024 * 1024;
export const TYPES = { '01': 'Factura', '03': 'Liquidación de compra', '04': 'Nota de crédito', '05': 'Nota de débito', '07': 'Retención' };
const clean = value => String(value ?? '').trim();
const children = (node, name) => Array.from(node?.childNodes || []).filter(n => n.nodeType === 1 && (n.localName || n.nodeName.split(':').at(-1)) === name);
const child = (node, name) => children(node, name)[0];
const text = (node, name, fallback = '') => clean(child(node, name)?.textContent || fallback);
const required = (node, name) => { const value = text(node, name); if (!value) throw Error(`Falta ${name} en el XML.`); return value; };
export function cents(value) {
  const s = clean(value);
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(s)) throw Error(`Importe inválido: ${s.slice(0, 40)}`);
  const [whole, fraction = ''] = s.split('.');
  const result = Number(whole) * 100 + Number((fraction + '00').slice(0, 2)) + (Number(fraction[2] || 0) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(result) || result > 100_000_000_000) throw Error('Importe fuera del límite de esta versión.');
  return result;
}
export function isoDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean(value));
  if (!match) throw Error(`Fecha inválida: ${value}`);
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (+y < 2000 || +y > 2100 || date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) throw Error(`Fecha inválida: ${value}`);
  return `${y}-${m}-${d}`;
}
export const normalizeNumber = value => clean(value).replace(/\D/g, '');
const numberOf = info => [required(info, 'estab'), required(info, 'ptoEmi'), required(info, 'secuencial')].join('-');
function money(node, field, fallback) { return cents(fallback === undefined ? required(node, field) : text(node, field, fallback)); }
function supportNumber(value) { const n = normalizeNumber(value); return n.length === 15 ? `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}` : clean(value); }
export function parseSriXml(source, filename = 'comprobante.xml', Parser = globalThis.DOMParser) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_XML_BYTES) throw Error('El XML supera 5 MB.');
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(source)) throw Error('No se permiten DTD ni entidades externas en los XML.');
  if (!Parser) throw Error('El navegador no dispone de un lector XML.');
  const parse = raw => {
    const doc = new Parser().parseFromString(raw, 'application/xml');
    if (!doc.documentElement || doc.getElementsByTagName('parsererror').length || doc.documentElement.localName === 'parsererror') throw Error('XML mal formado o incompleto.');
    return doc;
  };
  let root = parse(source).documentElement;
  let authorization = '', authorizationStatus = 'SIN_ENVOLTURA', authorizedAt = '';
  if ((root.localName || root.nodeName) === 'autorizaciones') {
    const entries = children(root, 'autorizacion');
    if (entries.length !== 1) throw Error('Importa un archivo por comprobante; esta respuesta contiene varias autorizaciones.');
    root = entries[0];
  }
  if ((root.localName || root.nodeName) === 'autorizacion') {
    authorizationStatus = required(root, 'estado').toUpperCase();
    if (authorizationStatus !== 'AUTORIZADO') throw Error(`Comprobante no autorizado: ${authorizationStatus}.`);
    authorization = required(root, 'numeroAutorizacion');
    authorizedAt = text(root, 'fechaAutorizacion');
    const envelope = child(root, 'comprobante');
    const nested = Array.from(envelope?.childNodes || []).find(n => n.nodeType === 1);
    if (nested) root = nested;
    else {
      const inner = clean(envelope?.textContent);
      if (!inner) throw Error('La autorización no contiene el comprobante.');
      if (/<!\s*(DOCTYPE|ENTITY)/i.test(inner)) throw Error('No se permiten DTD ni entidades externas.');
      root = parse(inner).documentElement;
    }
  }
  const rootName = root.localName || root.nodeName;
  const typeCodes = { factura: '01', liquidacionCompra: '03', notaCredito: '04', notaDebito: '05', comprobanteRetencion: '07' };
  const type = typeCodes[rootName];
  if (!type) throw Error(`Tipo de comprobante no soportado: ${rootName}.`);
  const info = child(root, 'infoTributaria');
  if (!info) throw Error('Falta infoTributaria.');
  if (required(info, 'codDoc') !== type) throw Error('El código de documento no coincide con el XML.');
  const issuerId = required(info, 'ruc');
  if (!/^\d{13}$/.test(issuerId)) throw Error('RUC del emisor inválido.');
  const number = numberOf(info);
  if (!/^\d{3}-\d{3}-\d{9}$/.test(number)) throw Error('La serie o el secuencial no tienen el formato esperado.');
  const key = required(info, 'claveAcceso');
  if (!/^\d{49}$/.test(key)) throw Error('La clave de acceso debe tener 49 dígitos.');
  if (authorization && authorization.length === 49 && authorization !== key) throw Error('La autorización no coincide con la clave de acceso.');
  const record = {
    id: `${issuerId}|${type}|${number}`, type, number, key, authorization, authorizationStatus, authorizedAt,
    issuerId, issuerName: required(info, 'razonSocial'), issuerTradeName: text(info, 'nombreComercial'),
    environment: text(info, 'ambiente'), filename: clean(filename).slice(0, 200), raw: source,
    importedAt: new Date().toISOString(), vatEligible: false, reviewed: authorizationStatus === 'AUTORIZADO',
    excluded: false, notes: '', taxes: [], retentions: [], supportNumber: '',
  };
  const dataTag = { '01':'infoFactura', '03':'infoLiquidacionCompra', '04':'infoNotaCredito', '05':'infoNotaDebito', '07':'infoCompRetencion' }[type];
  const data = child(root, dataTag);
  if (!data) throw Error(`Falta ${dataTag}.`);
  record.date = isoDate(required(data, 'fechaEmision'));
  record.period = record.date.slice(0, 7);
  record.taxPeriod = record.period;
  if (type === '07') {
    record.recipientId = required(data, 'identificacionSujetoRetenido');
    record.recipientName = required(data, 'razonSocialSujetoRetenido');
    const fiscal = required(data, 'periodoFiscal');
    if (!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(fiscal)) throw Error('Período fiscal de retención inválido.');
    record.taxPeriod = fiscal.slice(3) + '-' + fiscal.slice(0, 2);
    const parseRetention = (node, support = '') => ({ tax: required(node, 'codigo'), code: text(node, 'codigoRetencion'), base: money(node, 'baseImponible'), rate: text(node, 'porcentajeRetener'), amount: money(node, 'valorRetenido'), supportNumber: supportNumber(support || text(node, 'numDocSustento')) });
    const v1 = child(root, 'impuestos');
    if (v1) record.retentions = children(v1, 'impuesto').map(n => parseRetention(n));
    const sustento = child(root, 'docsSustento');
    for (const doc of children(sustento, 'docSustento')) {
      for (const retention of children(child(doc, 'retenciones'), 'retencion')) record.retentions.push(parseRetention(retention, text(doc, 'numDocSustento')));
    }
    if (!record.retentions.length) throw Error('No se encontraron valores de retención.');
    record.base = 0; record.vat = 0;
    record.total = record.retentions.reduce((sum, r) => sum + r.amount, 0);
    record.description = 'Comprobante de retención';
  } else {
    record.recipientId = required(data, type === '03' ? 'identificacionProveedor' : 'identificacionComprador');
    record.recipientName = required(data, type === '03' ? 'razonSocialProveedor' : 'razonSocialComprador');
    record.base = money(data, 'totalSinImpuestos');
    record.discount = money(data, 'totalDescuento', '0');
    const taxNode = type === '05' ? child(data, 'impuestos') : child(data, 'totalConImpuestos');
    record.taxes = children(taxNode, type === '05' ? 'impuesto' : 'totalImpuesto').map(n => ({ tax: required(n, 'codigo'), code: text(n, 'codigoPorcentaje'), base: money(n, 'baseImponible'), amount: money(n, 'valor'), rate: text(n, 'tarifa') }));
    record.vat = record.taxes.filter(t => t.tax === '2').reduce((sum, t) => sum + t.amount, 0);
    record.total = money(data, type === '04' ? 'valorModificacion' : type === '05' ? 'valorTotal' : 'importeTotal');
    record.supportNumber = supportNumber(text(data, 'numDocModificado'));
    record.description = children(child(root, 'detalles'), 'detalle').map(n => text(n, 'descripcion')).filter(Boolean).join(' · ').slice(0, 1200) || text(data, 'motivo') || TYPES[type];
    const currency = text(data, 'moneda', 'DOLAR').toUpperCase();
    if (!['DOLAR','DOLARES','USD','DÓLAR','DÓLARES'].includes(currency)) throw Error(`Moneda no soportada: ${currency}. Solo USD.`);
    if (!taxNode) { record.reviewed = false; record.notes = 'Falta el desglose de impuestos: revisar antes de incluir.'; }
    if (record.total < record.base) { record.reviewed = false; record.notes = 'El total es menor al subtotal: revisar el documento.'; }
  }
  if (record.environment !== '2') { record.reviewed = false; record.notes = 'Ambiente de pruebas: no se incluye en el resumen.'; }
  return record;
}
export function classify(doc, ownRuc) {
  if (!/^\d{13}$/.test(ownRuc || '')) return 'unassigned';
  const matches = id => id === ownRuc || (id?.length === 10 && ownRuc.startsWith(id));
  if (doc.type === '07') return matches(doc.recipientId) ? 'retention-received' : matches(doc.issuerId) ? 'retention-issued' : 'unassigned';
  if (doc.type === '03') return matches(doc.issuerId) ? 'expense' : matches(doc.recipientId) ? 'income' : 'unassigned';
  if (matches(doc.issuerId)) return 'income';
  if (matches(doc.recipientId)) return 'expense';
  return 'unassigned';
}
