import test from 'node:test';
import assert from 'node:assert/strict';
const preference={matches:false,addEventListener(){}};
const classes=new Set(),attributes=new Map(),calls=[];
const control={setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),getBoundingClientRect:()=>({left:20,top:30,width:40,height:40})};
const root={dataset:{theme:'dark'},classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x))},animate(frames,options){calls.push({frames,options});return {finished:Promise.resolve(),finish(){},cancel(){}};}};
globalThis.document={documentElement:root,hidden:false,addEventListener(){},querySelector:()=>control,createElement:()=>({setAttribute(){},remove(){},animate:root.animate}),body:{append(){}}};
globalThis.matchMedia=()=>preference;
globalThis.localStorage={setItem(){}};
globalThis.innerWidth=390;globalThis.innerHeight=844;
const {changeTheme,revealView}=await import('../dist/motion.mjs');

test('tema circular usa el centro del control con teclado y libera el estado ocupado',async()=>{
  document.startViewTransition=callback=>{callback();return {ready:Promise.resolve(),finished:Promise.resolve(),skipTransition(){}};};
  await changeTheme({detail:0},control);
  assert.equal(root.dataset.theme,'light');assert.equal(attributes.has('aria-busy'),false);assert.equal(classes.size,0);
  assert.equal(calls.at(-1).options.pseudoElement,'::view-transition-new(root)');
  assert.match(calls.at(-1).frames.clipPath[0],/40px 50px/);
});
test('un fallo al capturar la transición no bloquea el cambio de tema ni el siguiente clic',async()=>{
  document.startViewTransition=callback=>{callback();return {ready:Promise.reject(Error('snapshot unavailable')),finished:Promise.resolve(),skipTransition(){}};};
  await changeTheme({detail:0},control);assert.equal(root.dataset.theme,'dark');assert.equal(attributes.has('aria-busy'),false);
  delete document.startViewTransition;
  await changeTheme({detail:0},control);assert.equal(root.dataset.theme,'light');assert.equal(classes.size,0);
});
test('movimiento reducido cambia el tema inmediatamente y omite las entradas animadas',async()=>{
  preference.matches=true;const previous=calls.length;
  await changeTheme({detail:0},control);revealView({querySelector(){throw Error('No debe preparar animaciones');}});
  assert.equal(root.dataset.theme,'dark');assert.equal(calls.length,previous);assert.equal(attributes.has('aria-busy'),false);
  preference.matches=false;
});
