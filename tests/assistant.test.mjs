import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {conversationPayload,mountNysaAssistant} from '../dist/assistant.mjs';
test('assistant sends only explicit conversation, bounded to four turns; no workspace data',()=>{
 const result=conversationPayload(' Hola ',Array.from({length:8},()=>({role:'user',content:'x'.repeat(1500),ruc:'private',documents:['private']})));
 assert.equal(result.prompt,'Hola');assert.equal(result.history.length,4);assert.equal(result.history[0].content.length,1200);assert.deepEqual(Object.keys(result),['prompt','language','history']);assert.deepEqual(Object.keys(result.history[0]),['role','content']);
});
test('floating assistant opens, answers safely as text, resets and cancels requests',async()=>{
 const {document,window}=parseHTML('<html><body><main id="main" tabindex="-1"></main></body></html>');
 Object.assign(globalThis,{document,window,matchMedia:()=>({matches:true})});
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 let sent;globalThis.fetch=async(url,opts)=>{if(!opts?.method)return Response.json({enabled:true});sent=JSON.parse(opts.body);return Response.json({reply:'<b>Revisa tu RUC</b>',actions:[]});};
 const api=mountNysaAssistant({navigate:()=>{}});const panel=document.querySelector('#nysa-chat');document.querySelector('.nysa-launcher').click();assert.equal(panel.hidden,false);
 const input=document.querySelector('textarea');input.value='¿Cómo importo?';document.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));
 assert.equal(sent.prompt,'¿Cómo importo?');assert.equal(document.querySelector('.nysa-message-assistant p').textContent,'<b>Revisa tu RUC</b>');assert.equal(document.querySelector('.nysa-message-assistant b'),null);assert.equal(api.busy(),false);
 api.reset();assert.equal(document.querySelectorAll('.nysa-message').length,0);
 let signal;globalThis.fetch=(url,opts)=>new Promise((resolve,reject)=>{signal=opts.signal;signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));});
 input.value='Nueva pregunta';document.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));api.reset();await new Promise(r=>setTimeout(r,0));assert.equal(signal.aborted,true);assert.equal(document.querySelectorAll('.nysa-message').length,0);assert.equal(api.busy(),false);
});
