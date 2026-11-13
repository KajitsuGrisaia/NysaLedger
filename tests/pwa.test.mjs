import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
import {project,externalUrl} from '../dist/project.mjs';

async function worker() {
  const events={}, resources=new Map(), deleted=[], cachesByName=new Map();
  let network=0,activated=false,claimed=false;
  const scope='https://ledger.example.test/';
  const caches={
    async open(name){if(!cachesByName.has(name))cachesByName.set(name,{async addAll(files){for(const file of files){await access(new URL('../dist/'+(file==='./'?'index.html':file.slice(2)),import.meta.url));resources.set(new URL(file,scope).href,new Response('offline:'+file));}},async match(url){return resources.get(url)?.clone();}});return cachesByName.get(name);},
    async keys(){return ['another-app-v1','nysaledger-shell-v1',...cachesByName.keys()];},
    async delete(name){deleted.push(name);return true;}
  };
  const self={registration:{scope},clients:{async claim(){claimed=true;}},addEventListener(name,handler){events[name]=handler;},skipWaiting(){activated=true;}};
  vm.runInNewContext(await readFile(new URL('../dist/sw.mjs',import.meta.url),'utf8'),{self,caches,URL,fetch:async()=>{network++;return new Response('network');}});
  const dispatch=async(name,extra={})=>{let pending;events[name]({...extra,waitUntil(p){pending=p;},respondWith(p){pending=p;}});return pending;};
  return {dispatch,deleted,get network(){return network;},get activated(){return activated;},get claimed(){return claimed;}};
}

test('cache precarga todos los módulos de la app y permite abrir sin conexión',async()=>{
  const w=await worker();await w.dispatch('install');
  for(const file of ['index.html','app.mjs','community.mjs','pwa.mjs','project.mjs','manifest.webmanifest']){
    const response=await w.dispatch('fetch',{request:new Request('https://ledger.example.test/'+file)});
    assert.match(await response.text(),/^offline:/);
  }
  const themed=await w.dispatch('fetch',{request:new Request('https://ledger.example.test/?design=aurora&mode=light')});assert.match(await themed.text(),/^offline:/);
  assert.equal(w.network,0);
});

test('no intercepta XML, respaldos, consultas ni terceros; solo limpia sus propias cachés',async()=>{
  const w=await worker();await w.dispatch('install');
  for(const url of ['https://ledger.example.test/factura.xml','https://ledger.example.test/respaldo.nysa','https://ledger.example.test/?dato=privado','https://example.test/app.mjs'])assert.equal(await w.dispatch('fetch',{request:new Request(url)}),undefined);
  await w.dispatch('activate');assert.deepEqual(w.deleted,['nysaledger-shell-v1']);assert.equal(w.claimed,true);
  assert.equal(w.activated,false);await w.dispatch('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.activated,true);
});

test('solo se activa el repositorio público real y los cobros siguen deshabilitados',()=>{
  assert.equal(project.repositoryUrl,'https://github.com/KajitsuGrisaia/NysaLedger');assert.equal(project.supportUrl,null);
  for(const url of ['javascript:alert(1)','http://example.test','https://user:pass@example.test','invalid'])assert.equal(externalUrl(url),null);
  assert.equal(externalUrl('https://github.com/example/project'),'https://github.com/example/project');
});
