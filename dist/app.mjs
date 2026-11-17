import {mountNysaAssistant} from './assistant.mjs';
import {VERSION,RELEASES,canAutoUpdate} from './releases.mjs';
import './visual-palette.mjs';
import {settlement,periodReview,importOverview} from './workflow.mjs';
import {mountLedgerScene} from './ledger-scene.mjs';
import {parseSriXml,classify,TYPES,cents,MAX_XML_BYTES} from './xml.mjs';
import {emptyState,monthlySummary,documentBalance,mergeDocuments,addMovement,money,csv,included,signed} from './ledger.mjs';
import {loadState,saveState,listCompanies,createCompany,switchCompany,encryptBackup,decryptBackup,validateRestoredState} from './storage.mjs';
import {demoFiles,demoRuc} from './demo.mjs';
import {communityMarkup,supportMarkup,installationMarkup} from './community.mjs';
import {preparePwa,requestInstall,applyUpdate} from './pwa.mjs';
import {revealView,revealDialog,dismissDialog,changeTheme,syncTheme} from './motion.mjs';

const $=selector=>document.querySelector(selector);
// Keep the preview round trip local; published installs return to the public site.
const websiteReturn=document.querySelector('.nysasoft-return');
if(websiteReturn && ['localhost','127.0.0.1'].includes(location.hostname) && location.port==='4185')
  websiteReturn.href='http://'+location.hostname+':4186/index.html?lang=es';

await import('./appearance.mjs');

const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const labels={overview:'Vista general',documents:'Comprobantes',movements:'Cobros y pagos',retentions:'Retenciones',summary:'Resumen mensual',settings:'Perfil y respaldos',project:'Proyecto y comunidad'};
const kindNames={income:'Ingreso',expense:'Gasto','retention-received':'Retención recibida','retention-issued':'Retención emitida',unassigned:'Sin asignar'};

let state=emptyState(),realState=state,view='overview',period=today().slice(0,7),demo=false,filter='all',search='',staged=[],modalSubmit=null,restoreFile=null,saving=false,importing=false;
const modal=$('#modal');
const nysaAssistant=mountNysaAssistant({navigate});
let companyList={activeId:'primary',companies:[]},workRelease=null,releaseTimer;
const dirtyInputs=new Set();
function hasDirtyForms(){for(const el of dirtyInputs){if(!el.isConnected){dirtyInputs.delete(el);continue;}const dialog=el.closest('dialog');if(!dialog||dialog.open)return true;}return false;}
function workBusy(){return saving||importing||modal.open||nysaAssistant.busy()||hasDirtyForms()||demo;}
function holdWork(){if(!workRelease&&navigator.locks)navigator.locks.request('nysaledger-work',{mode:'shared'},()=>new Promise(resolve=>{workRelease=resolve;if(!workBusy())releaseWork();}));}
function releaseWork(){if(!workBusy()&&workRelease){workRelease();workRelease=null;}document.dispatchEvent(new Event('nysa:idle'));}
function changelog(){openModal('NysaLedger · Historial de cambios',RELEASES.map(r=>`<section><h3>v${h(r.version)}</h3><p class="mini-note">${h(r.date)}</p><ul>${r.changes.map(c=>'<li>'+h(c)+'</li>').join('')}</ul></section>`).join('')+'<div class="form-buttons"><button class="button primary" data-action="close-modal">Listo</button></div>');try{localStorage.setItem('nysa-release-read',VERSION);}catch{}$('#release-notice').hidden=true;$('#release-history').classList.remove('unread');}
function releaseNotice(){
 $('#release-history').textContent='◷ v'+VERSION;
 try{const previous=localStorage.getItem('nysa-version')||(state.profile.ruc||state.documents.length?'0.2.0':null);localStorage.setItem('nysa-version',VERSION);if(previous&&previous!==VERSION)localStorage.setItem('nysa-release-pending',VERSION);if(localStorage.getItem('nysa-release-pending')===VERSION&&localStorage.getItem('nysa-release-read')!==VERSION){$('#release-history').classList.add('unread');$('#release-notice').innerHTML='<button data-action="changelog"><strong>NysaLedger se ha actualizado a v'+VERSION+'</strong><span>Clic para ver los cambios ↗</span></button>';$('#release-notice').hidden=false;releaseTimer=setTimeout(()=>$('#release-notice').hidden=true,8000);}}catch{}
}
async function refreshCompanies(){companyList=await listCompanies();const select=$('#company-picker');select.innerHTML=companyList.companies.map(c=>`<option value="${h(c.id)}">${h(c.name||'Mi negocio')}${c.ruc?' · '+h(c.ruc):''}</option>`).join('');select.value=companyList.activeId;select.disabled=demo;}
function companyDialog(){if(workBusy())throw Error('Termina el trabajo en curso antes de cambiar de compañía.');openModal('Agregar compañía',`<p>Cada compañía mantiene su propio RUC, XML, movimientos, retenciones y resumen mensual en este dispositivo.</p><form id="modal-form"><div class="form-field"><label for="company-name">Nombre de la compañía</label><input id="company-name" name="name" maxlength="100" required></div><div class="form-field"><label for="company-ruc">RUC de la compañía</label><input id="company-ruc" name="ruc" inputmode="numeric" pattern="[0-9]{13}" maxlength="13" required></div>${errorSlot}<div class="form-buttons">${cancel}<button class="button primary">Crear espacio</button></div></form>`,async form=>{const d=new FormData(form);state=await createCompany(d.get('name'),d.get('ruc'));realState=state;closeModal();await refreshCompanies();navigate('settings');toast('Compañía creada. Sus datos están separados.');});}
let toastTimer;
let disposeLedgerScene=()=>{};
function closeMobileMenu(){document.querySelector('.sidebar').classList.remove('menu-open');document.querySelector('[data-action="mobile-menu"]').setAttribute('aria-expanded','false');}
let modalRevision=0,modalClosing=false;
function toast(message,error=false){clearTimeout(toastTimer);const el=$('#toast');el.textContent=message;el.className='visible'+(error?' error':'');toastTimer=setTimeout(()=>el.className='',6500);}
function download(content,name,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function openModal(title,body,onSubmit=null){modalRevision++;modalClosing=false;modalSubmit=onSubmit;holdWork();$('#modal-content').innerHTML=`<div class="modal-head"><h2>${h(title)}</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="Cerrar">×</button></div><div class="modal-body">${body}</div>`;if(!modal.open)modal.showModal();revealDialog(modal);}
function closeModal(){if(!modal.open||modalClosing)return;modalClosing=true;const revision=++modalRevision;modalSubmit=null;dismissDialog(modal).then(()=>{if(revision===modalRevision){modal.close();releaseWork();}});}
function formError(error){const el=$('#modal-error');if(el){el.textContent=error.message||String(error);el.focus();}else toast(error.message||String(error),true);}
async function persist(next){
  if(saving)throw Error('Espera a que termine el guardado anterior.');
  saving=true;holdWork();
  try{state=demo?{...next,updatedAt:new Date().toISOString()}:await saveState(next);if(!demo)realState=state;}finally{saving=false;releaseWork();}
}
const errorSlot='<p id="modal-error" class="error" role="alert" tabindex="-1"></p>';
const cancel='<button type="button" class="button ghost" data-action="close-modal">Cancelar</button>';
function periodControl(){return `<input class="period" type="month" id="period" aria-label="Mes del resumen" value="${period}" min="2000-01" max="2100-12">`;}
function head(title,subtitle,actions=''){return `<div class="page-head"><div><p class="eyebrow">${demo?'ESPACIO DE DEMOSTRACIÓN':'ECUADOR / EN ESPAÑOL'}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="head-actions">${periodControl()}${actions}</div></div>`;}
const importButton='<button class="button primary" data-action="import">＋ Importar XML</button>';
function tag(kind){const color={income:'green',expense:'blue','retention-received':'amber','retention-issued':'purple',unassigned:'red'}[kind];return `<span class="tag ${color}">${kindNames[kind]}</span>`;}
function statusTag(doc){return doc.excluded?'<span class="tag red">Excluido</span>':!doc.reviewed||doc.environment!=='2'?'<span class="tag amber">Por revisar</span>':'<span class="tag green">Incluido</span>';}
function visibleDocuments(){return state.documents.filter(d=>(d.type==='07'?d.taxPeriod:d.period)===period).sort((a,b)=>b.date.localeCompare(a.date)||b.importedAt.localeCompare(a.importedAt));}
function reviewNotice(s){return s.review?`<div class="notice"><strong>${s.review} comprobante${s.review>1?'s':''} por revisar o sin asignar.</strong> Se excluyen del cálculo hasta que revises su estado y contribuyente. <button class="text-button" data-action="review-list">Revisar documentos ↗</button></div>`:'';}
function empty(title,description,action=''){return `<div class="empty"><div class="empty-icon" aria-hidden="true">▤</div><h3>${title}</h3><p>${description}</p>${action}</div>`;}
function kpi(title,value,note,color,icon){return `<article class="kpi ${color}"><div class="kpi-head"><span>${title}</span><span aria-hidden="true">${icon}</span></div><strong>${money(value)}</strong><p>${note}</p></article>`;}
function docTable(docs,compact=false){
  if(!docs.length)return empty('Aún no hay comprobantes en este mes','Importa tus XML emitidos y recibidos. Si ya importaste documentos, revisa el mes seleccionado.',importButton);
  return `<div class="table-wrap"><table><thead><tr><th>Comprobante / contraparte</th><th>Fecha</th>${compact?'':'<th>Clasificación</th>'}<th>Estado</th><th class="amount">Total</th></tr></thead><tbody>${docs.map(d=>{
    const kind=classify(d,state.profile.ruc),counterpart=['income','retention-issued'].includes(kind)?d.recipientName:d.issuerName;
    return `<tr><td><button class="doc-link" data-action="document" data-id="${h(d.id)}">${h(d.number)} ↗</button><small class="table-name" title="${h(counterpart)}">${h(TYPES[d.type])} · ${h(counterpart)}</small></td><td>${h(d.date)}</td>${compact?'':`<td>${tag(kind)}</td>`}<td>${statusTag(d)}</td><td class="amount">${d.type==='04'?'−':''}${money(d.total)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function vatLines(s){return `<div class="summary-list"><div class="summary-line"><span>IVA de ventas neto</span><strong>${money(s.outputVat)}</strong></div><div class="summary-line"><span>− IVA de compras elegibles</span><strong>${money(s.inputVat)}</strong></div><div class="summary-line"><span>− Retenciones de IVA recibidas</span><strong>${money(s.receivedVat)}</strong></div><div class="summary-line"><span>− Crédito anterior ingresado</span><strong>${money(s.prior)}</strong></div></div>`;}
function reviewPanel(){
  const r=periodReview(state,period);
  if(!r.documents.length)return '';
  return `<section class="panel workflow-review"><div class="panel-heading"><h2>Tu revisión del mes</h2><span class="tag">${period}</span></div><div class="panel-body"><p>${period>=today().slice(0,7)?'Mes en curso: el resumen se actualizará con cada XML que importes.':'Período cerrado: revisa los documentos y exporta el resumen para preparar tu declaración.'}</p><div class="workflow-stats"><span><strong>${r.documents.length}</strong> XML del período</span><span><strong>${r.unreviewed}</strong> sin incluir o sin asignar</span><span><strong>${r.issues.length}</strong> puntos para revisar</span></div>${r.issues.length?`<ul class="workflow-issues">${r.issues.map(i=>`<li><button class="doc-link" data-action="document" data-id="${h(i.id)}">${h(state.documents.find(d=>d.id===i.id)?.number)} ↗</button><p>${h(i.message)}</p></li>`).join('')}</ul>`:'<p class="mini-note">Sin alertas de conciliación detectadas. Confirma también anulaciones, crédito anterior y obligaciones en el SRI.</p>'}<p class="mini-note">La clasificación y los importes se calculan localmente. Este resumen no presenta una declaración ante el SRI.</p><button class="text-button" data-view="summary">Revisar resumen mensual ↗</button></div></section>`;
}
function importMetrics(docs){const s=importOverview(docs,state.profile.ruc);return `<div class="import-metrics">${[['Ingresos sin IVA',s.income],['Gastos sin IVA',s.expense],['IVA retenido recibido',s.vatRetention],['Renta retenida recibida',s.incomeRetention]].map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('')}</div><p class="form-hint">Totales del lote nuevo · ${s.periods.map(h).join(', ')}. ${s.review} XML pendiente(s) no incluidos en estos importes. Las retenciones emitidas se muestran por separado en el resumen mensual.</p>`;}
function overview(){
  const s=monthlySummary(state,period),docs=visibleDocuments();
  const max=Math.max(s.collected,s.paid,1);
  return head('El mes, bajo control.','Tus comprobantes del SRI, movimientos y resumen tributario para Ecuador.',`<button class="button ghost" data-action="export-summary">↓ Exportar</button>${importButton}`)+
    (!state.profile.ruc?`<section class="intro-strip"><span class="intro-mark" aria-hidden="true">✦</span><div><h2>Empieza por tu espacio.</h2><p>Configura tu RUC para distinguir automáticamente ventas, compras y retenciones.</p></div><button class="button primary" data-view="settings">Configurar mi perfil ↗</button></section>`:'')+
    reviewNotice(s)+`<section class="kpis" aria-label="Indicadores del mes">${kpi('Ingresos facturados',s.sales,'Neto sin IVA · incluye notas de crédito','green','↗')}${kpi('Gastos documentados',s.expenses,'Neto sin IVA · compras del mes','blue','↙')}${kpi('Retenciones recibidas',s.receivedVat+s.receivedIncome,'IVA y renta · período fiscal del XML','amber','◈')}${kpi('IVA estimado',s.vatDue,'Antes de ajustes de tu declaración','','▥')}</section>`+reviewPanel()+
    `<section class="two-col"><div class="panel"><div class="panel-heading"><h2>Últimos comprobantes</h2><button class="text-button" data-view="documents">Ver todos ↗</button></div>${docTable(docs.slice(0,4),true)}</div><div class="panel"><div class="panel-heading"><h2>Tu IVA, de un vistazo</h2><span class="tag purple">ESTIMACIÓN</span></div>${vatLines(s)}<div class="summary-total"><div><small>Saldo estimado del mes</small><p class="mini-note">Crédito resultante: ${money(s.nextCredit)}</p></div><strong>${money(s.vatDue)}</strong></div><div class="panel-body"><button class="text-button" data-view="summary">Revisar el cálculo completo ↗</button></div></div></section>`+
    `<section class="two-col"><div class="panel"><div class="panel-heading"><h2>Lo que efectivamente se movió</h2><span class="tag">FLUJO DE CAJA</span></div><div class="chart"><div class="bar-row"><span>Cobros registrados</span><progress max="${max}" value="${s.collected}" aria-label="Cobros registrados"></progress><strong>${money(s.collected)}</strong></div><div class="bar-row"><span>Pagos registrados</span><progress class="expense" max="${max}" value="${s.paid}" aria-label="Pagos registrados"></progress><strong>${money(s.paid)}</strong></div><p class="bar-zero">Facturado y cobrado son cosas distintas. Registra la transferencia cuando llegue.</p></div></div><div class="panel"><div class="panel-heading"><h2>Saldos de documentos del mes</h2><span aria-hidden="true" class="muted">⇄</span></div><div class="summary-list"><div class="summary-line"><span>Pendiente de cobrar</span><strong>${money(s.receivable)}</strong></div><div class="summary-line"><span>Pendiente de pagar</span><strong>${money(s.payable)}</strong></div></div><div class="panel-body"><button class="text-button" data-action="new-movement">＋ Registrar cobro o pago</button></div></div></section>`+
    (!state.documents.length?`<h2 class="section-label">Un flujo sencillo, de principio a fin.</h2><section class="step-grid"><div class="step"><span>01 / IMPORTA</span><h3>Trae tus XML del SRI</h3><p>Facturas, notas de crédito, notas de débito, liquidaciones y retenciones. Conservamos el XML original.</p></div><div class="step"><span>02 / REVISA</span><h3>Confirma lo que corresponde</h3><p>Clasifica el crédito de IVA de tus compras y registra cobros reales sin duplicar documentos.</p></div><div class="step"><span>03 / RESPALDA</span><h3>Llévate tus datos contigo</h3><p>Exporta un resumen CSV y un respaldo cifrado para tu disco externo.</p></div></section>`:'');
}
function documents(retentionOnly=false){
  const docs=visibleDocuments().filter(d=>!retentionOnly||d.type==='07');
  let filtered=docs.filter(d=>filter==='all'||filter==='review'?filter!=='review'||!included(d)||classify(d,state.profile.ruc)==='unassigned':filter==='retention'?d.type==='07':classify(d,state.profile.ruc)===filter);
  if(search){const q=search.toLowerCase();filtered=filtered.filter(d=>[d.number,d.issuerName,d.recipientName,d.description,d.issuerId,d.recipientId].join(' ').toLowerCase().includes(q));}
  return head(retentionOnly?'Cada retención, en su lugar.':'Un respaldo para cada movimiento.',retentionOnly?'Renta e IVA separados. Las recibidas se distinguen de las emitidas.':'XML originales, clasificación y revisión de tus documentos.',importButton)+
    (retentionOnly?'<p class="notice info">Este listado usa el <strong>período fiscal</strong> del XML de retención. Las retenciones de renta no se descuentan del IVA. Las emitidas son obligaciones separadas, no crédito recibido.</p>':`<section class="dropzone" id="dropzone"><span class="drop-icon" aria-hidden="true">⇧</span><div><h2>Arrastra aquí tus comprobantes XML</h2><p>Hasta 200 archivos · máximo 5 MB por archivo y 20 MB por lote. Todo se procesa en tu navegador.</p></div>${importButton}</section>`)+
    `<section class="panel"><div class="filters">${[['all','Todos'],['income','Ingresos'],['expense','Gastos'],['retention','Retenciones'],['review','Por revisar']].filter(([key])=>!retentionOnly||['all','review'].includes(key)).map(([key,label])=>`<button data-filter="${key}" class="${filter===key?'selected':''}">${label}</button>`).join('')}<form id="search-form" class="search-form"><input name="search" aria-label="Buscar comprobantes" placeholder="Buscar nombre o número" value="${h(search)}"><button class="icon-button" aria-label="Buscar">⌕</button></form></div>${docTable(filtered)}</section><p class="mini-note">${filtered.length} documento(s) en el período. Importar un XML no consulta al SRI ni valida criptográficamente su firma. Si un comprobante fue anulado, exclúyelo aquí tras verificarlo en el SRI.</p>`;
}
function movements(){
  const list=state.movements.filter(m=>m.date.slice(0,7)===period).sort((a,b)=>b.date.localeCompare(a.date));
  const s=monthlySummary(state,period);
  return head('Del comprobante al cobro.','Registra ingresos y pagos efectivos. El XML por sí solo no significa que ya cobraste.',`<button class="button primary" data-action="new-movement">＋ Registrar movimiento</button>`)+
    `<section class="kpis">${kpi('Cobros del mes',s.collected,'Entradas efectivas registradas','green','↗')}${kpi('Pagos del mes',s.paid,'Salidas efectivas registradas','blue','↙')}${kpi('Flujo neto',s.collected-s.paid,'Cobros menos pagos','','⇄')}${kpi('Pendiente de cobrar',s.receivable,'Documentos emitidos en este mes','amber','◷')}</section>`+
    `<section class="panel"><div class="panel-heading"><h2>Movimientos registrados</h2><span class="tag">${list.length} MOVIMIENTOS</span></div>${list.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto / documento</th><th>Tipo</th><th class="amount">Importe</th><th></th></tr></thead><tbody>${list.map(m=>{const doc=state.documents.find(d=>d.id===m.documentId);return `<tr><td>${h(m.date)}</td><td><span class="table-name" title="${h(m.description)}">${h(m.description||'Movimiento')}</span><small>${doc?h(doc.number):'Sin documento vinculado · no modifica el IVA'}</small></td><td>${tag(m.kind)}</td><td class="amount">${money(m.amount)}</td><td><button class="text-button" data-action="delete-movement" data-id="${h(m.id)}">Eliminar</button></td></tr>`;}).join('')}</tbody></table></div>`:empty('Aún no registraste cobros o pagos','Cuando recibas una transferencia, vincúlala a su factura. También puedes registrar movimientos sin XML.','<button class="button ghost" data-action="new-movement">Registrar el primero ↗</button>')}</section>`;
}
function summary(){
  const s=monthlySummary(state,period);
  return head('Del mes a tu declaración.','Una conciliación transparente para revisar antes de declarar.',`<button class="button primary" data-action="export-summary">↓ Exportar resumen CSV</button>`)+
    `<div class="notice info">Este es un <strong>resumen de apoyo</strong>, no una declaración ni una determinación definitiva de impuestos. No cubre prorrata, ajustes especiales, exportaciones ni liquidación anual de renta. Revisa tu régimen y obligación mensual o semestral en el SRI.</div>`+reviewNotice(s)+
    `<section class="two-col"><div class="panel"><div class="panel-heading"><h2>Conciliación de IVA</h2><span class="tag purple">${period}</span></div>${vatLines(s)}<div class="summary-total"><div><small>IVA estimado a pagar</small><p class="mini-note">Crédito resultante: ${money(s.nextCredit)} · no se arrastra automáticamente.</p></div><strong>${money(s.vatDue)}</strong></div><div class="panel-body"><form id="balance-form"><label for="prior-credit">Crédito de IVA anterior, según tu última declaración</label><div class="split"><input id="prior-credit" name="amount" type="number" min="0" step="0.01" value="${(s.prior/100).toFixed(2)}" required><button class="button ghost">Guardar saldo</button></div><p class="form-hint">Ingresa el crédito tributario aplicable de tu declaración previa. La app no lo obtiene del SRI.</p></form></div></div><div class="panel"><div class="panel-heading"><h2>Renta y retenciones emitidas</h2><span class="tag amber">POR SEPARADO</span></div><div class="summary-list"><div class="summary-line"><span>Retenciones de renta recibidas</span><strong>${money(s.receivedIncome)}</strong></div><div class="summary-line"><span>Retenciones de IVA emitidas</span><strong>${money(s.issuedVat)}</strong></div><div class="summary-line"><span>Retenciones de renta emitidas</span><strong>${money(s.issuedIncome)}</strong></div><div class="summary-line"><span>Ventas netas sin IVA</span><strong>${money(s.sales)}</strong></div><div class="summary-line"><span>Compras netas sin IVA</span><strong>${money(s.expenses)}</strong></div></div><div class="panel-body"><p class="mini-note">Las retenciones emitidas no se restan de tu IVA de ventas. Las obligaciones de agente de retención y la renta anual requieren una revisión independiente.</p></div></div></section>`+
    `<section class="panel"><div class="panel-heading"><h2>Compras: revisa el crédito tributario</h2><small>Elegibilidad manual por documento</small></div>${docTable(visibleDocuments().filter(d=>classify(d,state.profile.ruc)==='expense'))}</section><p class="mini-note">No se toma automáticamente el IVA de todas tus compras como crédito. Abre cada documento y confirma su elegibilidad. Las notas de crédito reducen las bases e impuestos del período de emisión; revisa casos de otros períodos con tu contador.</p>`;
}
function settings(){return head('Un espacio que se adapta a ti.','Tu perfil, tus datos y tus copias de seguridad.')+
  `<section class="settings-grid"><div class="panel"><div class="panel-heading"><h2>Perfil del contribuyente</h2><span class="tag">UN RUC POR ESPACIO</span></div><div class="panel-body"><form id="profile-form"><div class="form-field"><label for="profile-name">Nombre del negocio</label><input id="profile-name" name="name" maxlength="100" value="${h(state.profile.name)}" required></div><div class="form-field"><label for="profile-ruc">Tu RUC</label><input id="profile-ruc" name="ruc" inputmode="numeric" pattern="[0-9]{13}" minlength="13" maxlength="13" value="${h(state.profile.ruc)}" ${state.documents.length?'readonly':''} required><p class="form-hint">Necesario para clasificar documentos. No se consulta ni verifica tu inscripción con el SRI.${state.documents.length?' El RUC queda fijo mientras haya documentos para evitar reclasificarlos por error.':''}</p></div><div class="form-field"><label for="profile-regime">Régimen (referencia)</label><select id="profile-regime" name="regime">${['General','RIMPE emprendedor','RIMPE negocio popular','Otro / por revisar'].map(r=>`<option ${state.profile.regime===r?'selected':''}>${r}</option>`).join('')}</select><p class="form-hint">El régimen no cambia automáticamente la elegibilidad ni determina tu periodicidad tributaria.</p></div><button class="button primary" ${demo?'disabled':''}>Guardar perfil</button></form></div></div><div class="panel"><div class="panel-heading"><h2>Tus datos, bajo tu control</h2><span class="tag green">LOCAL</span></div><div class="panel-body"><div class="backup-action"><h3>Respaldo cifrado</h3><p>Incluye únicamente la compañía activa: perfil, XML originales, revisiones, cobros y saldos previos. Se descarga protegido con una contraseña que solo tú conoces.</p><button class="button primary" data-action="backup">↓ Crear respaldo .nysa</button></div><div class="backup-action"><h3>Restaurar desde tu disco</h3><p>Reemplaza este espacio con un respaldo cifrado, después de validar su contraseña y contenido.</p><button class="button ghost" data-action="restore" ${demo?'disabled':''}>↥ Restaurar respaldo</button></div><div class="backup-action"><h3>Resumen de este mes</h3><p>Un CSV legible en Excel con el desglose de IVA y el detalle de comprobantes incluidos.</p><button class="text-button" data-action="export-summary">Exportar ${period} ↗</button></div></div></div></section><div class="notice info settings-note">Los datos se guardan en este navegador y dispositivo. Borrar datos del navegador o cambiar de dirección web puede dejar este espacio vacío. Guarda una copia cifrada en tu disco externo y otra en una ubicación distinta. La app no guarda tu firma electrónica ni requiere tu clave del SRI.</div><section class="panel"><div class="panel-body split"><div><h2>Explora sin tocar tus datos</h2><p class="mini-note">Prueba una venta, una compra y una retención con identificadores ficticios, en un espacio temporal separado.</p></div><button class="button ghost" data-action="demo">Abrir demo ↗</button></div></section>`;}
function render(){
  const changedView=$('#main').dataset.view!==view;
  disposeLedgerScene();
  $('#main').innerHTML=({overview,documents,movements,retentions:()=>documents(true),summary,settings,project:communityMarkup}[view]||overview)();
  $('#page-label').textContent=labels[view];$('#mobile-nav-label').textContent=labels[view];$('#workspace-name').textContent=state.profile.name||'Mi negocio';$('#workspace-status').textContent=demo?'Demo temporal':state.profile.ruc?'RUC configurado · local':'Configura tu RUC';$('#doc-count').textContent=state.documents.length;$('#demo-banner').hidden=!demo;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $('#main').dataset.view=view;
  releaseWork();refreshCompanies().catch(()=>{});
  document.querySelector('.version').textContent='NysaLedger '+VERSION+' · por Nysasoft';
  if(changedView)revealView($('#main'));
  disposeLedgerScene=mountLedgerScene($('#main'));
}
function navigate(next){closeMobileMenu();view=labels[next]?next:'overview';filter='all';search='';history.replaceState(null,'',`#${view}`);render();window.scrollTo({top:0,behavior:'instant'});}
function openDocument(id){
  const doc=state.documents.find(d=>d.id===id);if(!doc)return;
  const kind=classify(doc,state.profile.ruc);
  const retentionDetails=doc.type==='07'?`<h3>Desglose de retenciones</h3><div class="table-wrap"><table><thead><tr><th>Impuesto / código</th><th>Sustento</th><th class="amount">Retenido</th></tr></thead><tbody>${doc.retentions.map(t=>`<tr><td>${t.tax==='1'?'Renta':t.tax==='2'?'IVA':'Otro ('+h(t.tax)+')'}<small>${h(t.code)} · ${h(t.rate)}%</small></td><td>${h(t.supportNumber||'No consta')}</td><td class="amount">${money(t.amount)}</td></tr>`).join('')}</tbody></table></div>`:'';
  openModal(`${TYPES[doc.type]} ${doc.number}`,`${tag(kind)} ${statusTag(doc)}<dl class="detail-grid"><div><dt>Emisor</dt><dd>${h(doc.issuerName)}<br>${h(doc.issuerId)}</dd></div><div><dt>Receptor</dt><dd>${h(doc.recipientName)}<br>${h(doc.recipientId)}</dd></div><div><dt>Emisión / período fiscal</dt><dd>${h(doc.date)} · ${h(doc.taxPeriod)}</dd></div><div><dt>Total / IVA</dt><dd>${money(doc.total)} / ${money(doc.vat)}</dd></div></dl><p class="detail-description">${h(doc.description)}</p>${doc.notes?`<p class="notice">${h(doc.notes)}</p>`:''}<p class="detail-key">Clave de acceso: ${h(doc.key)}<br>Estado declarado por el XML: ${h(doc.authorizationStatus)}. No se ha consultado al SRI ni validado la firma criptográfica.</p>${retentionDetails}${['01','03','05'].includes(doc.type)&&['income','expense'].includes(kind)?(()=>{const s=settlement(doc,state);return `<h3>Del total al saldo pendiente</h3><div class="summary-list">${[['Total con IVA',doc.total],['− IVA retenido',s.vat],['− Renta retenida',s.income],['− Otras retenciones',s.retained-s.vat-s.income],['− Notas de crédito',s.credits],['Neto después de retenciones y notas',s.net],['− Cobros o pagos registrados',s.paid],['Saldo pendiente',s.pending]].map(([label,value])=>`<div class="summary-line"><span>${label}</span><strong>${money(value)}</strong></div>`).join('')}</div><p class="form-hint">Las retenciones se vinculan por número de sustento y contraparte. Importar una factura no registra automáticamente una transferencia.</p>${[...new Map(s.retentions.map(t=>[t.documentId,t])).values()].map(t=>`<button type="button" class="text-button" data-action="document" data-id="${h(t.documentId)}">Retención ${h(t.number)} ↗</button>`).join('')}${included(doc)&&s.pending>0?`<p><button type="button" class="button ghost" data-action="new-movement" data-id="${h(doc.id)}">Registrar ${kind==='income'?'cobro':'pago'} ↗</button></p>`:''}`;})():''}<form id="modal-form"><label class="checkbox-label"><input type="checkbox" name="reviewed" ${doc.reviewed?'checked':''} ${doc.environment!=='2'?'disabled':''}><span>He revisado el documento para incluirlo en mi control. Esto no verifica su autorización ante el SRI.</span></label>${kind==='expense'?`<label class="checkbox-label"><input type="checkbox" name="vatEligible" ${doc.vatEligible?'checked':''}><span>El IVA de esta compra es elegible como crédito tributario, según mi revisión.</span></label>`:''}<label class="checkbox-label"><input type="checkbox" name="excluded" ${doc.excluded?'checked':''}><span>Excluir de cálculos (por ejemplo, anulado o no corresponde).</span></label><div class="form-field"><label for="doc-note">Nota interna</label><textarea id="doc-note" name="notes" maxlength="1000">${h(doc.notes)}</textarea></div>${errorSlot}<div class="form-buttons"><button type="button" class="button ghost" data-action="download-xml" data-id="${h(id)}">↓ XML original</button>${cancel}<button class="button primary">Guardar revisión</button></div></form>`,async form=>{
    const data=new FormData(form);await persist({...state,documents:state.documents.map(d=>d.id===id?{...d,reviewed:doc.environment==='2'&&data.has('reviewed'),excluded:data.has('excluded'),vatEligible:kind==='expense'&&data.has('vatEligible'),notes:String(data.get('notes')||'').slice(0,1000)}:d)});closeModal();render();toast('Revisión guardada en este navegador.');
  });
}
async function importFiles(files){
  if(importing){toast('Espera a que termine la lectura del lote actual.');return;}
  importing=true;holdWork();try{await readImportFiles(files);}finally{importing=false;releaseWork();}
}
async function readImportFiles(files){
  if(!state.profile.ruc){navigate('settings');toast('Configura tu RUC antes de importar para distinguir ventas y compras.');return;}
  if(demo){toast('Sal de la demo para importar tus documentos reales.');return;}
  if(files.length>200)throw Error('Selecciona hasta 200 XML por lote.');
  if(files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw Error('El lote supera 20 MB. Divide la importación.');
  openModal('Leyendo tus XML',`<p role="status" id="import-progress">Preparando ${files.length} archivo(s)…</p><p>La lectura y clasificación se realizan en este dispositivo.</p>`);
  const importRevision=modalRevision;
  const results=[];let incoming=[...state.documents];staged=[];
  for(const file of files){try{
    if(!file.name.toLowerCase().endsWith('.xml'))throw Error('Selecciona un archivo .xml.');
    if(file.size>MAX_XML_BYTES)throw Error('Supera el máximo de 5 MB.');
    const doc=parseSriXml(await file.text(),file.name);const merged=mergeDocuments(incoming,[doc]);const status=merged.conflicts.length?'conflict':merged.duplicates.length?'duplicate':'new';incoming=merged.documents;if(status==='new')staged.push(doc);results.push({file:file.name,doc,status});
  }catch(error){results.push({file:file.name,error:error.message});}if(results.length%8===0){const progress=$('#import-progress');if(progress)progress.textContent=`Leídos ${results.length} de ${files.length} archivos`;await new Promise(resolve=>setTimeout(resolve,0));}if(modalRevision!==importRevision){staged=[];return;}}
  const merged={duplicates:results.filter(r=>r.status==='duplicate'),conflicts:results.filter(r=>r.status==='conflict')};
  openModal('Revisar importación',`<p><strong>${staged.length}</strong> nuevo(s) · ${merged.duplicates.length} duplicado(s) omitido(s) · ${results.filter(r=>r.error).length+merged.conflicts.length} error(es) o conflicto(s).</p>${importMetrics(staged)}<p class="form-hint">Los XML sin envoltura de autorización y los de pruebas quedan pendientes de revisión. El resto se clasifica según tu RUC; no se consulta su vigencia en el SRI.</p><div class="import-results">${results.map(r=>`<div class="import-result"><div><strong>${h(r.file)}</strong><small>${r.error?`<span class="import-error">${h(r.error)}</span>`:h(TYPES[r.doc.type]+' '+r.doc.number)+' · '+money(r.doc.total)}</small></div>${r.error?'<span class="tag red">Error</span>':r.status==='conflict'?'<span class="tag red">Conflicto: no reemplaza</span>':r.status==='duplicate'?'<span class="tag">Duplicado</span>':tag(classify(r.doc,state.profile.ruc))}</div>`).join('')}</div><div class="form-buttons">${cancel}<button class="button primary" data-action="confirm-import" ${staged.length?'':'disabled'}>Importar ${staged.length} documento(s)</button></div>`);
}
function movementDialog(documentId){
  const docs=state.documents.filter(d=>included(d)&&['income','expense'].includes(classify(d,state.profile.ruc))&&documentBalance(d,state)>0);
  openModal('Registrar cobro o pago',`<p>Registra el dinero realmente recibido o pagado. Vincula una factura para controlar su saldo; se consideran retenciones y notas de crédito importadas.</p><form id="modal-form"><div class="form-grid"><div class="form-field"><label for="move-kind">Tipo</label><select name="kind" id="move-kind"><option value="income">Cobro / ingreso</option><option value="expense">Pago / gasto</option></select></div><div class="form-field"><label for="move-date">Fecha del movimiento</label><input name="date" id="move-date" type="date" value="${today()}" required></div></div><div class="form-field"><label for="move-document">Documento vinculado</label><select name="documentId" id="move-document"><option value="">Sin documento vinculado</option>${docs.map(d=>`<option value="${h(d.id)}">${h(kindNames[classify(d,state.profile.ruc)])} · ${h(d.number)} · saldo ${money(documentBalance(d,state))}</option>`).join('')}</select><p class="form-hint">Un movimiento sin documento afecta el flujo de caja, pero no las bases ni el IVA del resumen.</p></div><div class="form-field"><label for="move-amount">Importe efectivo (USD)</label><input name="amount" id="move-amount" type="number" min="0.01" step="0.01" required></div><div class="form-field"><label for="move-description">Concepto o referencia</label><input name="description" id="move-description" maxlength="500" placeholder="Transferencia recibida, pago a proveedor…" required></div>${errorSlot}<div class="form-buttons">${cancel}<button class="button primary">Guardar movimiento</button></div></form>`,async form=>{
    const data=new FormData(form);await persist(addMovement(state,{kind:data.get('kind'),date:data.get('date'),documentId:data.get('documentId'),amount:cents(data.get('amount')),description:data.get('description')}));closeModal();render();toast('Movimiento guardado.');
  });
  if(documentId){const doc=docs.find(d=>d.id===documentId);if(doc){$('#move-document').value=documentId;$('#move-kind').value=classify(doc,state.profile.ruc);$('#move-amount').value=(documentBalance(doc,state)/100).toFixed(2);$('#move-description').value=`${classify(doc,state.profile.ruc)==='income'?'Cobro':'Pago'} ${doc.number}`;}}
}
function backupDialog(){openModal('Crear respaldo cifrado',`<p>Guardaremos los XML originales y todo tu control en un archivo <strong>.nysa</strong>. Usa una contraseña distinta de tu clave del SRI. Si la pierdes, no podremos recuperarla.</p><form id="modal-form"><div class="form-field"><label for="backup-password">Contraseña del respaldo (mínimo 10 caracteres)</label><input id="backup-password" name="password" type="password" autocomplete="new-password" minlength="10" required></div><div class="form-field"><label for="backup-repeat">Repetir contraseña</label><input id="backup-repeat" name="repeat" type="password" autocomplete="new-password" minlength="10" required></div>${errorSlot}<div class="form-buttons">${cancel}<button class="button primary">Cifrar y descargar</button></div></form>`,async form=>{
    const data=new FormData(form);if(data.get('password')!==data.get('repeat'))throw Error('Las contraseñas no coinciden.');
    const encrypted=await encryptBackup(state,data.get('password'));download(encrypted,`nysa-ledger-${today()}.nysa`,'application/json');closeModal();toast('Respaldo descargado. Copia el archivo a tu disco externo.');
  });}
function restoreDialog(){openModal('Restaurar tu espacio',`<p>Archivo: <strong>${h(restoreFile.name)}</strong>. Se validará el contenido antes de reemplazar tus datos.</p><form id="modal-form"><div class="form-field"><label for="restore-password">Contraseña del respaldo</label><input id="restore-password" name="password" type="password" minlength="10" autocomplete="off" required></div><label class="checkbox-label"><input type="checkbox" name="replace" required><span>Entiendo que se reemplazará este espacio. Ya guardé un respaldo de los datos actuales si necesito conservarlos.</span></label>${errorSlot}<div class="form-buttons">${cancel}<button class="button primary">Validar y restaurar</button></div></form>`,async form=>{
    const data=new FormData(form);if(!data.has('replace'))throw Error('Confirma el reemplazo.');const raw=await decryptBackup(await restoreFile.text(),data.get('password'));const restored=validateRestoredState(raw);await persist(restored);closeModal();navigate('overview');toast('Respaldo validado y restaurado.');restoreFile=null;
  });}
function exportSummary(){
  const s=monthlySummary(state,period);
  const rows=[['Nysa Ledger — resumen de apoyo, no declaración'],['Período',period],['Contribuyente',state.profile.name],['RUC',state.profile.ruc],['Concepto','USD'],['Ventas netas sin IVA',(s.sales/100).toFixed(2)],['Compras netas sin IVA',(s.expenses/100).toFixed(2)],['IVA de ventas',(s.outputVat/100).toFixed(2)],['IVA compras elegibles revisadas',(s.inputVat/100).toFixed(2)],['Retenciones IVA recibidas',(s.receivedVat/100).toFixed(2)],['Crédito anterior ingresado',(s.prior/100).toFixed(2)],['IVA estimado a pagar',(s.vatDue/100).toFixed(2)],['Crédito resultante estimado',(s.nextCredit/100).toFixed(2)],['Retenciones renta recibidas — NO descontadas de IVA',(s.receivedIncome/100).toFixed(2)],['Retenciones IVA emitidas',(s.issuedVat/100).toFixed(2)],['Retenciones renta emitidas',(s.issuedIncome/100).toFixed(2)],['Pendientes de revisión / sin asignar',s.review],[],['Fecha','Tipo','Número','Clasificación','Emisor','Receptor','Base USD','IVA USD','Total USD','Incluido','IVA compra elegible']];
  for(const d of visibleDocuments())rows.push([d.date,TYPES[d.type],d.number,kindNames[classify(d,state.profile.ruc)],d.issuerName,d.recipientName,(signed(d)*d.base/100).toFixed(2),(signed(d)*d.vat/100).toFixed(2),(signed(d)*d.total/100).toFixed(2),included(d)&&classify(d,state.profile.ruc)!=='unassigned'?'Sí':'No',d.vatEligible?'Sí':'No']);
  rows.push([],['Retención','Período fiscal','Sustento','Impuesto','Código','Base USD','Porcentaje','Retenido USD']);
  for(const d of visibleDocuments().filter(d=>d.type==='07'))for(const t of d.retentions)rows.push([d.number,d.taxPeriod,t.supportNumber,t.tax==='1'?'Renta':t.tax==='2'?'IVA':'Otro',t.code,(t.base/100).toFixed(2),t.rate,(t.amount/100).toFixed(2)]);
  download(csv(rows),`nysa-resumen-${period}.csv`,'text/csv;charset=utf-8');toast('Resumen CSV exportado. Revisa sus importes antes de declarar.');
}
async function startDemo(){
  if(!demo)realState=state;demo=true;
  state={...emptyState(),profile:{name:'Nysasoft · Demo',ruc:demoRuc,regime:'General'},documents:demoFiles().map(f=>parseSriXml(f.text,f.name))};
  state.documents.find(d=>classify(d,demoRuc)==='expense').vatEligible=true;
  state=addMovement(state,{date:'2026-11-12',amount:13500,kind:'income',documentId:state.documents.find(d=>d.type==='01'&&d.issuerId===demoRuc).id,description:'Transferencia ficticia neta de retenciones'});
  period='2026-11';navigate('overview');toast('Demo temporal abierta. Tus datos reales no cambiaron.');
}
function help(){openModal('Tu control, paso a paso',`<h3>1. Configura tu RUC</h3><p>La app compara el emisor y receptor del XML con tu RUC. Cada espacio admite un contribuyente. Usa el selector de compañía o Agregar compañía para mantener varios RUC separados.</p><h3>2. Importa y revisa</h3><p>Admite facturas, liquidaciones de compra, notas de crédito/débito y retenciones 1.0 y 2.0. Lee XML directos y comprobantes dentro de autorizaciones con CDATA. Los no autorizados se rechazan; los XML sin envoltura requieren revisión.</p><h3>3. Registra el dinero efectivo</h3><p>Una factura no significa que ya cobraste. Las retenciones vinculadas por documento de sustento reducen el saldo pendiente. Si falta el sustento o no se encuentra la factura, revisa la conciliación.</p><h3>4. Revisa tu resumen</h3><p>El IVA de compras se incorpora solo cuando marcas su elegibilidad. La renta retenida se muestra aparte. No se calculan renta anual, multas, prorrata ni regímenes especiales; no se emite ni presenta nada ante el SRI.</p><h3>5. Guarda tus respaldos</h3><p>Datos en IndexedDB de este navegador. Los respaldos usan AES-GCM de 256 bits con contraseña y PBKDF2-SHA256. Conserva una copia en tu disco externo y otra en una ubicación diferente. El SRI exige conservar comprobantes electrónicos durante 7 años.</p><p><a href="https://www.sri.gob.ec/facturacion-electronica" target="_blank" rel="noopener noreferrer">Información oficial del SRI ↗</a></p><p>El código puede compartirse; tus XML, respaldos y firma electrónica no deben formar parte del repositorio público.</p><div class="form-buttons"><button class="button primary" data-action="close-modal">Entendido</button></div>`);}

document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  try {
    if(b.dataset.view){if(b.dataset.view!==view||$('#main').dataset.view!==view)navigate(b.dataset.view);else closeMobileMenu();return;}
    if(b.dataset.filter){filter=b.dataset.filter;render();return;}
    const action=b.dataset.action;
    if(action==='mobile-menu'){const open=document.querySelector('.sidebar').classList.toggle('menu-open');b.setAttribute('aria-expanded',String(open));}
    else if(action==='close-modal')closeModal();
    else if(action==='import')$('#xml-input').click();
    else if(action==='document')openDocument(b.dataset.id);
    else if(action==='download-xml'){const doc=state.documents.find(d=>d.id===b.dataset.id);if(doc)download(doc.raw,`${doc.number}.xml`,'application/xml');}
    else if(action==='review-list'){view='documents';filter='review';render();}
    else if(action==='confirm-import'){
      b.disabled=true;try{const result=mergeDocuments(state.documents,staged);await persist({...state,documents:result.documents});if(staged.length)period=importOverview(staged,state.profile.ruc).periods[0];closeModal();navigate('overview');toast(`${result.added} documento(s) importados. Revisa compras y documentos pendientes.`);staged=[];}catch(error){b.disabled=false;throw error;}
    }
    else if(action==='new-movement')movementDialog(b.dataset.id);
    else if(action==='delete-movement'){
      const id=b.dataset.id;openModal('Eliminar movimiento',`<p>Se eliminará el cobro o pago registrado y se recalculará el saldo. El XML de la factura se conserva.</p>${errorSlot}<form id="modal-form"><div class="form-buttons">${cancel}<button class="button primary">Eliminar movimiento</button></div></form>`,async()=>{await persist({...state,movements:state.movements.filter(m=>m.id!==id)});closeModal();render();toast('Movimiento eliminado.');});
    }
    else if(action==='backup')backupDialog();
    else if(action==='restore')$('#backup-input').click();
    else if(action==='export-summary')exportSummary();
    else if(action==='demo')await startDemo();
    else if(action==='leave-demo'){demo=false;state=realState;period=today().slice(0,7);navigate('overview');}
    else if(action==='help')help();
    else if(action==='add-company')companyDialog();
    else if(action==='changelog')changelog();

    else if(action==='support')openModal('Apoyar NysaLedger',supportMarkup());
    else if(action==='github-preview')openModal('Una comunidad por construir',`<p>El repositorio público de NysaLedger se habilitará después de revisar esta versión local. Desde aquí podrás acceder al código, estrellas, issues y pull requests.</p><p>No se publican XML, respaldos ni datos personales. Los reportes deben usar ejemplos ficticios.</p><div class="form-buttons"><button class="button primary" data-action="close-modal">Entendido</button></div>`);
    else if(action==='install')openModal('Instalar NysaLedger',installationMarkup());
    else if(action==='install-now'){await requestInstall();closeModal();}
    else if(action==='update-app')openModal('Actualizar NysaLedger',`<p>La actualización conserva tus datos guardados. Los formularios sin guardar y la demo temporal se cerrarán. Guarda lo pendiente antes de continuar.</p><div class="form-buttons">${cancel}<button class="button primary" data-action="confirm-update">Actualizar y recargar</button></div>`);
    else if(action==='confirm-update'){if(saving)throw Error('Espera a que termine el guardado.');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});applyUpdate();}
    else if(action==='theme')await changeTheme(event,b);
  }catch(error){if(modal.open)formError(error);else toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  const submit=form.querySelector('button[type="submit"],button:not([type])');
  try {
    if(form.id==='modal-form'&&modalSubmit){if(submit)submit.disabled=true;await modalSubmit(form);}
    else if(form.id==='search-form'){search=String(new FormData(form).get('search')||'').trim();render();}
    else if(form.id==='profile-form'){
      if(demo)return;const d=new FormData(form),ruc=String(d.get('ruc')).trim();if(!/^\d{13}$/.test(ruc))throw Error('Ingresa tu RUC de 13 dígitos.');
      if(state.documents.length&&ruc!==state.profile.ruc)throw Error('No se puede cambiar el RUC mientras haya documentos.');
      await persist({...state,profile:{name:String(d.get('name')).trim().slice(0,100),ruc,regime:String(d.get('regime'))}});render();toast('Perfil guardado. Ya puedes importar tus XML.');
    }else if(form.id==='balance-form'){
      await persist({...state,balances:{...state.balances,[period]:cents(new FormData(form).get('amount'))}});render();toast('Crédito anterior guardado para este mes.');
    }
  }catch(error){if(modal.open)formError(error);else toast(error.message,true);}finally{if(submit)submit.disabled=false;}
});
document.addEventListener('input',event=>{if(event.target.closest('form')){dirtyInputs.add(event.target);holdWork();}});
document.addEventListener('change',async event=>{
  if(event.target.id==='company-picker'){try{if(workBusy())throw Error('Guarda o termina el formulario antes de cambiar de compañía.');nysaAssistant.reset();state=await switchCompany(event.target.value);realState=state;period=today().slice(0,7);navigate('overview');toast('Compañía activa: '+state.profile.name);}catch(e){event.target.value=companyList.activeId;toast(e.message,true);}return;}
  if(event.target.id==='period'){if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(event.target.value)){period=event.target.value;render();}}
  if(event.target.id==='move-document'){
    const d=state.documents.find(d=>d.id===event.target.value);if(d){$('#move-kind').value=classify(d,state.profile.ruc);$('#move-amount').value=(documentBalance(d,state)/100).toFixed(2);$('#move-description').value=`${classify(d,state.profile.ruc)==='income'?'Cobro':'Pago'} ${d.number}`;}
  }
});
$('#xml-input').addEventListener('change',async event=>{const files=Array.from(event.target.files);event.target.value='';if(files.length)try{await importFiles(files);}catch(error){toast(error.message,true);}});
$('#backup-input').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file){if(file.size>40*1024*1024){toast('El respaldo supera el límite de 40 MB de esta versión.',true);return;}restoreFile=file;restoreDialog();}});
document.addEventListener('dragover',event=>{if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.add('dragover');}});
document.addEventListener('dragleave',event=>{if(event.target.closest('#dropzone'))$('#dropzone')?.classList.remove('dragover');});
document.addEventListener('drop',async event=>{if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.remove('dragover');try{await importFiles(Array.from(event.dataTransfer.files));}catch(error){toast(error.message,true);}}});
modal.addEventListener('close',()=>{modalSubmit=null;modalClosing=false;releaseWork();});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});

syncTheme();
function openRoute(){const route=location.hash.slice(1);if(route==='support'||route==='install'){navigate('project');openModal(route==='support'?'Apoyar NysaLedger':'Instalar NysaLedger',route==='support'?supportMarkup():installationMarkup());}else navigate(route);}
window.addEventListener('hashchange',openRoute);
try{state=await loadState();realState=state;await refreshCompanies();openRoute();releaseNotice();}
catch(error){$('#main').innerHTML=`<div class="notice"><strong>No se pudo abrir el almacenamiento.</strong> ${h(error.message)}</div><p>Usa un navegador con IndexedDB habilitado. Los XML se guardan solo después de confirmar una importación.</p>`;}
document.addEventListener('nysa:pwa-state',()=>{if(view==='project'&&!modal.open)render();});
preparePwa({canUpdate:()=>canAutoUpdate({saving,importing,modalOpen:modal.open,dirty:hasDirtyForms(),demo}),onUpdate:()=>{try{localStorage.setItem('nysa-version',VERSION);}catch{}location.reload();}});


document.addEventListener('click',event=>{if(!event.target.closest('.sidebar'))closeMobileMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.sidebar').classList.contains('menu-open')){closeMobileMenu();document.querySelector('[data-action="mobile-menu"]').focus();}});
matchMedia('(min-width: 761px)').addEventListener('change',closeMobileMenu);
