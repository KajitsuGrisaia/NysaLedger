import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile('dist/appearance-init.js','utf8');
test('los cuatro diseños y ambos modos se restauran antes de pintar, y la URL prevalece',()=>{
 for(const design of ['orbit','aurora','terminal','eclipse'])for(const mode of ['light','dark']){
  const document={documentElement:{dataset:{}}};
  vm.runInNewContext(script,{URL,document,location:{href:`https://nysaledger.example/?design=${design}&mode=${mode}`},localStorage:{getItem:()=> 'invalid'}});
  assert.equal(document.documentElement.dataset.design,design);assert.equal(document.documentElement.dataset.theme,mode);
 }
});
test('sin acceso a almacenamiento la apariencia conserva una alternativa válida',()=>{
 const document={documentElement:{dataset:{}}};
 vm.runInNewContext(script,{URL,document,location:{href:'https://nysaledger.example/?design=invalid&mode=invalid'},localStorage:{getItem(){throw Error('blocked');}}});
 assert.deepEqual(document.documentElement.dataset,{design:'orbit',theme:'dark'});
});
