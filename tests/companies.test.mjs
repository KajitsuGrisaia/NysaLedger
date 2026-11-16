import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {emptyState} from '../dist/ledger.mjs';
import {orbitalPose} from '../dist/orbits.mjs';
import {canAutoUpdate,VERSION} from '../dist/releases.mjs';
test('migra el espacio original sin perderlo y aísla XML, cobros y saldos por compañía',async()=>{
 globalThis.indexedDB=new IDBFactory();
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nysa-ledger',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
 const original={...emptyState(),profile:{name:'Empresa A',ruc:'1799999999001',regime:'General'},documents:[{id:'fictional-a'}],movements:[{id:'cash-a'}],balances:{'2026-11':1500}};
 await new Promise(resolve=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(original,'current');tx.oncomplete=resolve;});
 const storage=await import('../dist/storage.mjs');
 assert.deepEqual(await storage.loadState(),original);
 const second=await storage.createCompany('Empresa B','1799999998001');
 assert.deepEqual(second.documents,[]);assert.deepEqual(second.movements,[]);assert.deepEqual(second.balances,{});
 await storage.saveState({...second,balances:{'2026-11':200},documents:[{id:'fictional-b'}]});
 const registry=await storage.listCompanies(),secondId=registry.activeId;
 assert.equal(registry.companies.length,2);
 await assert.rejects(storage.createCompany('Duplicada','1799999999001'),/ya tiene un espacio/);
 assert.deepEqual(await storage.switchCompany('primary'),original);
 assert.equal((await storage.switchCompany(secondId)).balances['2026-11'],200);
 assert.equal((await storage.loadState()).documents[0].id,'fictional-b');
 await assert.rejects(storage.switchCompany('does-not-exist'),/no encontrada/);
 await assert.rejects(storage.createCompany('','123'),/13 dígitos/);
 assert.equal((await storage.listCompanies()).activeId,secondId);
});
test('actualización automática espera formularios, guardados, importaciones y demo',()=>{
 assert.match(VERSION,/^\d+\.\d+\.\d+$/);assert.equal(canAutoUpdate(),true);
 for(const flag of ['saving','importing','modalOpen','dirty','demo'])assert.equal(canAutoUpdate({[flag]:true}),false);
});
test('planos y electrones tienen los mismos períodos y sentidos que el banner',()=>{
 for(const [k,duration] of [48000,58000,67000].entries()){
 const a=orbitalPose(k,0),b=orbitalPose(k,duration),delta=b.angle-a.angle;
 assert.ok(Math.abs(delta-(k===1?-1:1)*Math.PI*2)<1e-10);
 assert.notEqual(orbitalPose(k,1000).angle,a.angle);
 }
 assert.ok(orbitalPose(0,1000).electron>orbitalPose(0,0).electron);
 assert.ok(orbitalPose(1,1000).electron<orbitalPose(1,0).electron);
});
