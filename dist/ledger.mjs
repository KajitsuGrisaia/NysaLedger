import { classify, normalizeNumber } from './xml.mjs';
export const moneyFormat = new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' });
export const money = value => moneyFormat.format((value || 0) / 100);
export const emptyState = () => ({ schema:1, profile:{name:'Nysasoft', ruc:'', regime:'General'}, documents:[], movements:[], balances:{}, updatedAt:null });
export const signed = doc => doc.type === '04' ? -1 : 1;
export const included = doc => !doc.excluded && doc.reviewed && doc.environment === '2';
export function documentBalance(doc, state) {
  if (doc.type !== '01' && doc.type !== '03' && doc.type !== '05') return 0;
  const direction = classify(doc, state.profile.ruc);
  if (!['income','expense'].includes(direction)) return 0;
  const paid = state.movements.filter(m => m.documentId === doc.id).reduce((sum,m) => sum + m.amount, 0);
  const supplier = doc.type === '03' ? doc.recipientId : doc.issuerId;
  const retained = state.documents.filter(r => r.type === '07' && included(r) && classify(r,state.profile.ruc) === (direction === 'income' ? 'retention-received' : 'retention-issued')).reduce((sum,r) => sum + r.retentions.filter(t => normalizeNumber(t.supportNumber) === normalizeNumber(doc.number) && (direction === 'income' ? r.issuerId === doc.recipientId : r.recipientId === supplier)).reduce((n,t) => n+t.amount,0),0);
  const credited = state.documents.filter(c => c.type === '04' && included(c) && c.issuerId === doc.issuerId && c.recipientId === doc.recipientId && normalizeNumber(c.supportNumber) === normalizeNumber(doc.number)).reduce((sum,c) => sum+c.total,0);
  return Math.max(0,doc.total-paid-retained-credited);
}
export function monthlySummary(state, period) {
  const result = {sales:0, expenses:0, outputVat:0, inputVat:0, receivedVat:0, receivedIncome:0, issuedVat:0, issuedIncome:0, collected:0, paid:0, receivable:0, payable:0, review:0, documents:0, prior:state.balances[period] || 0, vatDue:0, nextCredit:0};
  for(const doc of state.documents) {
    const kind = classify(doc,state.profile.ruc);
    if ((!included(doc) || kind === 'unassigned') && (doc.period === period || doc.taxPeriod === period)) result.review++;
    if(!included(doc)) continue;
    if(['income','expense'].includes(kind) && doc.period === period) {
      result.documents++;
      const sign = signed(doc);
      if(kind==='income') {result.sales+=sign*doc.base;result.outputVat+=sign*doc.vat;result.receivable+=documentBalance(doc,state);}
      else {result.expenses+=sign*doc.base;if(doc.vatEligible)result.inputVat+=sign*doc.vat;result.payable+=documentBalance(doc,state);}
    }
    if(doc.type === '07' && doc.taxPeriod === period) {
      for(const t of doc.retentions) {
        if(kind==='retention-received' && t.tax==='2')result.receivedVat+=t.amount;
        if(kind==='retention-received' && t.tax==='1')result.receivedIncome+=t.amount;
        if(kind==='retention-issued' && t.tax==='2')result.issuedVat+=t.amount;
        if(kind==='retention-issued' && t.tax==='1')result.issuedIncome+=t.amount;
      }
    }
  }
  for(const m of state.movements.filter(m=>m.date.slice(0,7)===period)) {
    if(m.kind==='income')result.collected+=m.amount;else result.paid+=m.amount;
  }
  const vat = result.outputVat-result.inputVat-result.receivedVat-result.prior;
  result.vatDue=Math.max(0,vat); result.nextCredit=Math.max(0,-vat);
  return result;
}
export function addMovement(state, movement) {
  if(!Number.isSafeInteger(movement.amount)||movement.amount<=0)throw Error('Ingresa un importe mayor a cero.');
  if(!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(movement.date))throw Error('Fecha de movimiento inválida.');
  const date = new Date(movement.date+'T12:00:00Z');
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==movement.date)throw Error('Fecha de movimiento inválida.');
  if(!['income','expense'].includes(movement.kind))throw Error('Tipo de movimiento inválido.');
  if(movement.documentId) {
    const doc=state.documents.find(d=>d.id===movement.documentId);
    if(!doc||!included(doc)||classify(doc,state.profile.ruc)!==movement.kind||!['01','03','05'].includes(doc.type))throw Error('El documento no corresponde al movimiento.');
    if(movement.amount>documentBalance(doc,state))throw Error('El cobro o pago supera el saldo pendiente del documento.');
  }
  return {...state,movements:[...state.movements,{id:crypto.randomUUID(),...movement,description:String(movement.description||'').slice(0,500)}]};
}
export function mergeDocuments(existing, incoming) {
  const documents=[...existing], duplicates=[], conflicts=[];
  for(const doc of incoming) {
    const prev=documents.find(d=>d.id===doc.id||d.key===doc.key);
    if(prev) {
      const fingerprint = d => JSON.stringify([d.type,d.number,d.issuerId,d.recipientId,d.total,d.base,d.vat,d.key,d.date,d.taxPeriod,d.environment,d.taxes,d.retentions]);
      if(fingerprint(prev)!==fingerprint(doc)) conflicts.push(doc);
      else duplicates.push(doc);
    } else documents.push(doc);
  }
  return {documents,duplicates,conflicts,added:documents.length-existing.length};
}
export function csv(rows) {
  return '\uFEFF'+rows.map(row=>row.map(v=>{
    let text=String(v??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
