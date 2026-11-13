import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from 'linkedom';
import {parseSriXml,classify,cents,isoDate} from '../dist/xml.mjs';
import {emptyState,monthlySummary,documentBalance,mergeDocuments,addMovement,csv} from '../dist/ledger.mjs';
import {encryptBackup,decryptBackup,validateRestoredState} from '../dist/storage.mjs';
import {demoFiles,demoRuc,demoInvoice,demoRetention} from '../dist/demo.mjs';
const parse=(s,name='test.xml')=>parseSriXml(s,name,DOMParser);
const fixture=()=>({...emptyState(),profile:{name:'Negocio ficticio',ruc:demoRuc,regime:'General'},documents:demoFiles().map(f=>parse(f.text,f.name))});

test('rechaza importes obligatorios ausentes en vez de registrar cero silenciosamente',()=>{
  assert.throws(()=>parse(demoInvoice().replace('<importeTotal>172.50</importeTotal>','')),/Falta importeTotal/);
  assert.throws(()=>parse(demoInvoice().replace('<totalSinImpuestos>150.00</totalSinImpuestos>','')),/Falta totalSinImpuestos/);
  assert.throws(()=>parse(demoRetention().replace(/<valorRetenido>[^<]+<\/valorRetenido>/g,'')),/Falta valorRetenido/);
});

test('importa autorización CDATA y conserva el XML original sin convertir dólares a coma flotante',()=>{
  const source=demoInvoice(),d=parse(source);assert.equal(d.total,17250);assert.equal(d.base,15000);assert.equal(d.vat,2250);assert.equal(d.raw,source);assert.equal(d.date,'2026-11-12');assert.equal(d.reviewed,true);assert.equal(classify(d,demoRuc),'income');
});
test('clasifica compras, retenciones recibidas y retenciones emitidas por contribuyente',()=>{
  const s=fixture();assert.deepEqual(s.documents.map(d=>classify(d,demoRuc)),['income','expense','retention-received']);
  const ret=s.documents[2];assert.equal(classify(ret,ret.issuerId),'retention-issued');assert.equal(classify(ret,'0199999999001'),'unassigned');
});
test('retenciones de renta e IVA se separan; el IVA de compras requiere elegibilidad explícita',()=>{
  const s=fixture(),m=monthlySummary(s,'2026-11');assert.equal(m.sales,15000);assert.equal(m.expenses,4000);assert.equal(m.outputVat,2250);assert.equal(m.inputVat,0);assert.equal(m.receivedVat,2250);assert.equal(m.receivedIncome,1500);assert.equal(m.vatDue,0);
  s.documents[1].vatEligible=true;assert.equal(monthlySummary(s,'2026-11').nextCredit,600);
  s.documents[2].excluded=true;const without=monthlySummary(s,'2026-11');assert.equal(without.vatDue,1650);assert.equal(without.receivedIncome,0);
});
test('retenciones usan el período fiscal y no automáticamente el mes de emisión',()=>{
  const s=fixture();s.documents[2]=parse(demoRetention().replace('<fechaEmision>12/11/2026','<fechaEmision>02/12/2026'));
  assert.equal(monthlySummary(s,'2026-11').receivedVat,2250);assert.equal(monthlySummary(s,'2026-12').receivedVat,0);
});
test('se descuentan retenciones vinculadas y se registran cobros parciales sin exceder saldo',()=>{
  let s=fixture();const invoice=s.documents[0];assert.equal(documentBalance(invoice,s),13500);
  s=addMovement(s,{date:'2026-11-12',amount:3500,kind:'income',documentId:invoice.id,description:'Parcial ficticio'});assert.equal(documentBalance(invoice,s),10000);
  assert.throws(()=>addMovement(s,{date:'2026-11-13',amount:10001,kind:'income',documentId:invoice.id}),/supera/);
  assert.throws(()=>addMovement(s,{date:'2026-11-13',amount:1,kind:'expense',documentId:invoice.id}),/no corresponde/);
  s=addMovement(s,{date:'2026-12-01',amount:10000,kind:'income',documentId:invoice.id});assert.equal(documentBalance(invoice,s),0);assert.equal(monthlySummary(s,'2026-11').collected,3500);assert.equal(monthlySummary(s,'2026-12').collected,10000);
});
test('retenciones emitidas reducen el saldo de la compra, pero no se convierten en crédito de IVA recibido',()=>{
  const s=fixture(),purchase=s.documents[1];
  const ret={...s.documents[2],id:'issued',key:'8'.repeat(49),issuerId:demoRuc,recipientId:purchase.issuerId,retentions:[{tax:'2',amount:600,supportNumber:purchase.number}]};
  s.documents=[purchase,ret];assert.equal(classify(ret,demoRuc),'retention-issued');assert.equal(documentBalance(purchase,s),4000);assert.equal(monthlySummary(s,'2026-11').receivedVat,0);assert.equal(monthlySummary(s,'2026-11').issuedVat,600);
});
test('notas de crédito reducen las ventas y el IVA y concilian la factura de sustento',()=>{
  let xml=demoInvoice({seq:'3',base:'50.00',vat:'7.50',total:'57.50'}).replaceAll('<factura','<notaCredito').replaceAll('</factura>','</notaCredito>').replaceAll('infoFactura','infoNotaCredito').replace('<codDoc>01','<codDoc>04').replaceAll('importeTotal','valorModificacion').replace('</infoNotaCredito>','<numDocModificado>001-100-000000001</numDocModificado></infoNotaCredito>');
  const credit=parse(xml),s=fixture();s.documents=[s.documents[0],credit];
  const m=monthlySummary(s,'2026-11');assert.equal(m.sales,10000);assert.equal(m.outputVat,1500);assert.equal(documentBalance(s.documents[0],s),11500);
});
test('acepta retención 1.0 sin mezclar su desglose con el de 2.0',()=>{
  const s=demoRetention();const start=s.indexOf('<docsSustento>'),end=s.indexOf('</docsSustento>')+'</docsSustento>'.length;
  const v1=s.slice(0,start)+'<impuestos><impuesto><codigo>1</codigo><codigoRetencion>303</codigoRetencion><baseImponible>150</baseImponible><porcentajeRetener>10</porcentajeRetener><valorRetenido>15</valorRetenido><numDocSustento>001100000000001</numDocSustento></impuesto></impuestos>'+s.slice(end);
  const d=parse(v1);assert.equal(d.retentions.length,1);assert.equal(d.total,1500);assert.equal(d.retentions[0].supportNumber,'001-100-000000001');
});
test('XML directos y de pruebas requieren revisión; pruebas no suman aunque se marquen revisados',()=>{
  const wrapped=demoInvoice(),raw=wrapped.match(/<!\[CDATA\[([\s\S]*)\]\]>/)[1];
  const d=parse(raw);assert.equal(d.reviewed,false);assert.equal(d.authorizationStatus,'SIN_ENVOLTURA');
  const trial=parse(wrapped.replace('<ambiente>2','<ambiente>1'));trial.reviewed=true;
  const s={...emptyState(),profile:{ruc:demoRuc},documents:[trial]};assert.equal(monthlySummary(s,'2026-11').sales,0);
});
test('duplicados se omiten y contradicciones no reemplazan documentos existentes',()=>{
  const d=parse(demoInvoice());assert.equal(mergeDocuments([d],[d]).duplicates.length,1);
  const conflict={...d,recipientId:'0199999999001'};const r=mergeDocuments([d],[conflict]);assert.equal(r.conflicts.length,1);assert.equal(r.added,0);assert.equal(r.documents[0].recipientId,d.recipientId);
});
test('rechaza XML no autorizado, DTD, clave inválida, fecha imposible e importes inválidos',()=>{
  assert.throws(()=>parse(demoInvoice().replace('AUTORIZADO','NO AUTORIZADO')),/no autorizado/);
  assert.throws(()=>parse('<!DOCTYPE factura [<!ENTITY x SYSTEM "file:///secret">]><factura/>'),/DTD/);
  assert.throws(()=>parse(demoInvoice().replace(/<claveAcceso>\d+/, '<claveAcceso>123')),/49 dígitos/);
  assert.throws(()=>parse(demoInvoice({date:'31/02/2026'})),/Fecha inválida/);
  for(const amount of ['NaN','-1','1e3','1,50','Infinity'])assert.throws(()=>cents(amount));
  assert.equal(cents('1.005'),101);assert.equal(cents('150.00'),15000);assert.throws(()=>isoDate('2026-11-12'));
});
test('crédito previo no se arrastra automáticamente y renta nunca reduce IVA',()=>{
  const s=fixture();s.documents=s.documents.filter(d=>d.type!=='07');s.balances['2026-11']=1000;
  assert.equal(monthlySummary(s,'2026-11').vatDue,1250);assert.equal(monthlySummary(s,'2026-12').prior,0);
});
test('movimientos manuales no alteran bases e IVA, y fechas imposibles se rechazan',()=>{
  const s=addMovement(fixture(),{kind:'income',date:'2026-11-13',amount:1000,documentId:'',description:'Ingreso manual'});
  assert.equal(monthlySummary(s,'2026-11').sales,15000);assert.equal(monthlySummary(s,'2026-11').collected,1000);
  assert.throws(()=>addMovement(s,{kind:'income',date:'2026-02-31',amount:1000}),/Fecha/);
});
test('CSV protege las celdas que podrían interpretarse como fórmulas',()=>{
  const text=csv([['=WEBSERVICE("https://example.test")','Normal','@cmd','-2']]);assert.match(text,/'=WEBSERVICE/);assert.match(text,/'@cmd/);assert.match(text,/'-2/);
});
test('respaldo cifrado recupera XML y configuración; clave incorrecta o contenido alterado no restaura',async()=>{
  const s=fixture();const encrypted=await encryptBackup(s,'una-frase-de-prueba-2026');
  assert.ok(!encrypted.includes('Cliente Ficticio'));assert.ok(!encrypted.includes(demoRuc));
  const decrypted=await decryptBackup(encrypted,'una-frase-de-prueba-2026');const restored=validateRestoredState(decrypted,DOMParser);assert.equal(restored.documents.length,3);assert.equal(restored.documents[0].raw,s.documents[0].raw);assert.deepEqual(monthlySummary(restored,'2026-11'),monthlySummary(s,'2026-11'));
  await assert.rejects(()=>decryptBackup(encrypted,'otra-clave-incorrecta'),/incorrecta/);
  const broken=JSON.parse(encrypted);broken.data=broken.data.slice(0,-4)+'AAAA';await assert.rejects(()=>decryptBackup(JSON.stringify(broken),'una-frase-de-prueba-2026'));
  const bad=structuredClone(decrypted);bad.documents[0].id='otra-id';assert.throws(()=>validateRestoredState(bad,DOMParser),/inconsistentes/);
});
