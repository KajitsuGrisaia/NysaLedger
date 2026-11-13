import { emptyState } from './ledger.mjs';
import { parseSriXml } from './xml.mjs';
let dbPromise;
function database() {
  dbPromise ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('nysa-ledger',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onerror=()=>reject(Error('No se pudo abrir el almacenamiento local. Revisa los permisos del navegador.'));
    request.onsuccess=()=>resolve(request.result);
  });
  return dbPromise;
}
export async function loadState() {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readonly');const r=tx.objectStore('state').get('current');
    r.onsuccess=()=>resolve(r.result||emptyState());r.onerror=()=>reject(Error('No se pudieron leer tus datos locales.'));
  });
}
export async function saveState(state) {
  const db=await database();const next={...state,updatedAt:new Date().toISOString()};
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite');tx.objectStore('state').put(next,'current');
    tx.oncomplete=resolve;tx.onerror=()=>reject(Error('No se pudo guardar. Comprueba el espacio disponible y exporta un respaldo.'));tx.onabort=tx.onerror;
  });
  return next;
}
const b64=bytes=>{
  let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);
};
const unb64=value=>{if(typeof value!=='string'||value.length>60_000_000)throw Error('Respaldo inválido.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));};
async function keyFor(password,salt,usage) {
  if(typeof password!=='string'||password.length<10)throw Error('Usa una contraseña de respaldo de al menos 10 caracteres.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250_000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usage);
}
export async function encryptBackup(state,password) {
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await keyFor(password,salt,['encrypt']);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));
  return JSON.stringify({format:'nysa-ledger-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:250_000,salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(encrypted))});
}
export async function decryptBackup(source,password) {
  let envelope;
  try {envelope=JSON.parse(source);}catch{throw Error('El archivo no es un respaldo Nysa válido.');}
  if(envelope.format!=='nysa-ledger-encrypted'||envelope.version!==1||envelope.iterations!==250_000||envelope.kdf!=='PBKDF2-SHA256')throw Error('Formato de respaldo no compatible.');
  const salt=unb64(envelope.salt),iv=unb64(envelope.iv),data=unb64(envelope.data);
  if(salt.length!==16||iv.length!==12)throw Error('Respaldo inválido.');
  const key=await keyFor(password,salt,['decrypt']);
  try {return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data)));}
  catch{throw Error('Contraseña incorrecta o respaldo dañado. No se cambiaron tus datos.');}
}
export function validateRestoredState(value,Parser=globalThis.DOMParser) {
  if(!value||value.schema!==1||!value.profile||!Array.isArray(value.documents)||!Array.isArray(value.movements)||value.documents.length>20_000||value.movements.length>50_000)throw Error('Estructura de respaldo inválida o demasiado grande.');
  const profile={name:String(value.profile.name||'').slice(0,100),ruc:String(value.profile.ruc||''),regime:String(value.profile.regime||'General').slice(0,60)};
  if(!/^\d{13}$/.test(profile.ruc)&&!(profile.ruc===''&&value.documents.length===0))throw Error('RUC del respaldo inválido.');
  const ids=new Set();
  const documents=value.documents.map(d=>{
    const parsed=parseSriXml(d.raw,d.filename,Parser);
    if(parsed.id!==d.id||ids.has(parsed.id))throw Error('Hay documentos inconsistentes o duplicados en el respaldo.');
    ids.add(parsed.id);
    return {...parsed,vatEligible:d.vatEligible===true,reviewed:parsed.environment==='2'&&d.reviewed===true,excluded:d.excluded===true,notes:String(d.notes||'').slice(0,1000),importedAt:parsed.importedAt};
  });
  const movementIds=new Set();
  const movements=value.movements.map(m=>{
    if(typeof m.id!=='string'||movementIds.has(m.id)||!['income','expense'].includes(m.kind)||!Number.isSafeInteger(m.amount)||m.amount<=0||m.amount>100_000_000_000||!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(m.date))throw Error('Movimiento inválido en el respaldo.');
    const date=new Date(m.date+'T12:00:00Z');if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==m.date)throw Error('Fecha inválida en el respaldo.');
    if(m.documentId&&!ids.has(m.documentId))throw Error('Movimiento sin documento de respaldo.');
    movementIds.add(m.id);
    return {id:m.id,kind:m.kind,amount:m.amount,date:m.date,documentId:m.documentId||'',description:String(m.description||'').slice(0,500)};
  });
  const balances={};
  for(const [period,amount] of Object.entries(value.balances||{})) {
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||!Number.isSafeInteger(amount)||amount<0||amount>100_000_000_000)throw Error('Saldo previo inválido.');balances[period]=amount;
  }
  return {schema:1,profile,documents,movements,balances,updatedAt:null};
}
