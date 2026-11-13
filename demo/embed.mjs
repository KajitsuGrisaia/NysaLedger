import {createLab,labMarkup} from './lab.mjs';
import {cents,MAX_XML_BYTES} from './xml.mjs';
const lab=createLab(),main=document.querySelector('main'),input=document.querySelector('#lab-input');
let error='',revision=0;
function render(){main.innerHTML=labMarkup(lab,error);}
function act(fn){try{fn();error='';}catch(e){error=e.message;}render();}
async function upload(files){const token=++revision;try{if(files.length!==1)throw Error('Carga un XML a la vez.');const f=files[0];if(!f.name.toLowerCase().endsWith('.xml'))throw Error('Selecciona un archivo .xml.');if(f.size>MAX_XML_BYTES)throw Error('El XML supera 5 MB.');const xml=await f.text();if(token!==revision)return;lab.loadSource(xml,f.name);error='';}catch(e){if(token!==revision)return;error=e.message;}render();}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
if(a==='lab-upload')input.click();
else if(a==='lab-example')act(()=>{revision++;lab.loadExample(b.dataset.example);});
else if(a==='lab-party')act(()=>lab.setRuc(b.dataset.ruc));
else if(a==='lab-select')act(()=>lab.select(b.dataset.id));
else if(a==='lab-reset')act(()=>{revision++;lab.clear();});
else if(a==='lab-download'){const d=lab.document;if(!d)return;const url=URL.createObjectURL(new Blob([d.raw],{type:'application/xml'})),a=document.createElement('a');a.href=url;a.download=d.filename||'ejemplo.xml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,d=new FormData(f);act(()=>{if(f.id==='lab-ruc-form')lab.setRuc(String(d.get('ruc')).trim());if(f.id==='lab-payment-form')lab.payment(cents(d.get('amount')));});});
document.addEventListener('change',e=>{if(e.target.id==='lab-reviewed')act(()=>lab.review(e.target.checked));if(e.target.id==='lab-eligible')act(()=>lab.eligibility(e.target.checked));});
input.addEventListener('change',()=>{const files=Array.from(input.files);input.value='';if(files.length)upload(files);});
document.addEventListener('dragover',e=>{if(e.target.closest('#lab-dropzone')){e.preventDefault();e.target.closest('#lab-dropzone').classList.add('dragover');}});
document.addEventListener('dragleave',e=>e.target.closest('#lab-dropzone')?.classList.remove('dragover'));
document.addEventListener('drop',e=>{if(e.target.closest('#lab-dropzone')){e.preventDefault();upload(Array.from(e.dataTransfer.files));}});
// Only theme and dimensions cross the iframe boundary. XML stays in this frame.
addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='nysaledger-theme')return;if(['dark','light'].includes(e.data.mode))document.documentElement.dataset.theme=e.data.mode;});
new ResizeObserver(()=>parent.postMessage({type:'nysaledger-height',height:Math.ceil(document.body.getBoundingClientRect().height)},location.origin)).observe(document.body);
render();
