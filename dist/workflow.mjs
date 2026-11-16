import {classify,normalizeNumber} from './xml.mjs';
import {included,monthlySummary,documentSettlement as settlement} from './ledger.mjs';
export function periodReview(state,period){
  const docs=state.documents.filter(d=>(d.type==='07'?d.taxPeriod:d.period)===period),issues=[];
  for(const d of docs){const kind=classify(d,state.profile.ruc);if(!included(d)||kind==='unassigned')continue;
    if(kind==='expense'&&d.vat>0&&!d.vatEligible)issues.push({id:d.id,code:'purchase-vat',message:'Confirma si el IVA de esta compra puede usarse como crédito. Por ahora no se descuenta.'});
    if(d.type==='07')for(const t of d.retentions){
      if(!['1','2'].includes(t.tax))issues.push({id:d.id,code:'other-tax',message:'Esta retención contiene otro impuesto; revisa su tratamiento por separado.'});
      const matches=state.documents.filter(i=>['01','03','05'].includes(i.type)&&included(i)&&normalizeNumber(i.number)===normalizeNumber(t.supportNumber)&&(kind==='retention-received'?classify(i,state.profile.ruc)==='income'&&i.recipientId===d.issuerId:classify(i,state.profile.ruc)==='expense'&&(i.type==='03'?i.recipientId:i.issuerId)===d.recipientId));
      if(matches.length!==1)issues.push({id:d.id,code:matches.length?'ambiguous':'missing-invoice',message:matches.length?'Hay más de una factura candidata. Revisa el sustento.':`No se encontró una factura incluida para el sustento ${t.supportNumber||'sin número'}. Importa el XML de esa factura; no se vincula por aproximación.`});
      const rate=Number(t.rate);if(t.rate!==''&&Number.isFinite(rate)&&Math.abs(Math.round(t.base*rate/100)-t.amount)>1)issues.push({id:d.id,code:'retention-math',message:'La base, el porcentaje y el importe retenido no cuadran. Revisa el documento.'});
    }
    if(['01','03','05'].includes(d.type)&&['income','expense'].includes(kind)&&settlement(d,state).overpaid)issues.push({id:d.id,code:'overpaid',message:'Los pagos, retenciones y notas de crédito superan el total. Revisa la conciliación.'});
  }
  const unique=[...new Map(issues.map(i=>[i.id+'|'+i.code,i])).values()];
  return {summary:monthlySummary(state,period),issues:unique,documents:docs,unreviewed:docs.filter(d=>!included(d)||classify(d,state.profile.ruc)==='unassigned').length};
}
export function importOverview(documents,ruc){
  const totals={income:0,expense:0,vatRetention:0,incomeRetention:0,review:0},periods=[...new Set(documents.map(d=>d.type==='07'?d.taxPeriod:d.period))].sort().reverse();
  for(const d of documents){const kind=classify(d,ruc);if(!included(d)||kind==='unassigned'){totals.review++;continue;}if(d.type==='07'){if(kind==='retention-received')for(const t of d.retentions){if(t.tax==='2')totals.vatRetention+=t.amount;if(t.tax==='1')totals.incomeRetention+=t.amount;}}else{const sign=d.type==='04'?-1:1;if(kind==='income')totals.income+=sign*d.base;if(kind==='expense')totals.expense+=sign*d.base;}}
  return {...totals,periods};
}
export {settlement};
