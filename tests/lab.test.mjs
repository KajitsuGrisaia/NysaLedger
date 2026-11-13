import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from 'linkedom';
import {createLab,labMarkup} from '../demo/lab.mjs';

test('la selección del ejemplo se conserva al simular y se limpia al cargar un XML propio',()=>{
  const lab=createLab(DOMParser);lab.loadExample('0');lab.payment(5000);assert.equal(lab.example,'0');
  let markup=labMarkup(lab);assert.match(markup,/data-example="0" aria-pressed="true"/);
  lab.loadExample('all');assert.equal(lab.example,'all');
  lab.loadSource(demoInvoice(),'propio.xml');assert.equal(lab.example,'');
  markup=labMarkup(lab);assert.ok(!/lab-example" data-example="[^"]+" aria-pressed="true"/.test(markup));
});
import {demoInvoice,demoRuc} from '../dist/demo.mjs';
import {classify} from '../dist/xml.mjs';
import {documentBalance} from '../dist/ledger.mjs';

test('laboratorios independientes no comparten documentos ni movimientos',()=>{
  const first=createLab(DOMParser),second=createLab(DOMParser);
  first.loadExample('all');assert.equal(first.state.documents.length,3);assert.equal(second.state.documents.length,0);
  first.payment(3500);assert.equal(documentBalance(first.document,first.state),10000);
  first.payment(10000);assert.equal(first.state.movements.length,1);assert.equal(documentBalance(first.document,first.state),3500);
  assert.throws(()=>first.payment(13501),/supera/);assert.equal(first.state.movements[0].amount,10000);
  first.clear();assert.equal(first.state.documents.length,0);assert.equal(first.state.profile.ruc,'');
});
test('cambiar perspectiva reclasifica el XML y cambiar elegibilidad recalcula su impacto',()=>{
  const lab=createLab(DOMParser);lab.loadExample('1');assert.equal(lab.summary().inputVat,0);
  lab.eligibility(true);assert.equal(lab.summary().inputVat,600);
  lab.setRuc(lab.document.issuerId);assert.equal(classify(lab.document,lab.state.profile.ruc),'income');assert.equal(lab.summary().outputVat,600);assert.equal(lab.summary().inputVat,0);
});
test('archivo cargado queda temporal; un XML inválido conserva el escenario anterior',()=>{
  const lab=createLab(DOMParser);const xml=demoInvoice({description:'<script>alert(1)</script>'});lab.loadSource(xml,'local.xml');
  assert.equal(lab.source,'upload');assert.equal(lab.document.raw,xml);assert.equal(lab.state.profile.ruc,demoRuc);
  assert.throws(()=>lab.loadSource('<!DOCTYPE x><factura/>'),/DTD/);assert.equal(lab.document.raw,xml);
  assert.ok(labMarkup(lab).includes('&lt;script&gt;'));assert.ok(!labMarkup(lab).includes('<script>alert'));
});
test('XML sin envoltura requiere revisión explícita; el de pruebas nunca se suma',()=>{
  const xml=demoInvoice().match(/<!\[CDATA\[([\s\S]*)\]\]>/)[1],lab=createLab(DOMParser);
  lab.loadSource(xml);assert.equal(lab.summary().sales,0);lab.review(true);assert.equal(lab.summary().sales,15000);
  lab.loadSource(xml.replace('<ambiente>2','<ambiente>1'));lab.review(true);assert.equal(lab.summary().sales,0);
});
