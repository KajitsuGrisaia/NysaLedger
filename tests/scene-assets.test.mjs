import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOMParser} from 'linkedom';
test('the complete 3D logo retains each outline once and converts flat primitives to geometry',async()=>{
 const parser=new DOMParser();
 const original=parser.parseFromString(await readFile('dist/assets/symbol.svg','utf8'),'image/svg+xml');
 const geometry=parser.parseFromString(await readFile('dist/assets/symbol-geometry.svg','utf8'),'image/svg+xml');
 const details=parser.parseFromString(await readFile('dist/assets/symbol-details.svg','utf8'),'image/svg+xml');
 const outlines=[...original.querySelectorAll('svg > path')].slice(0,2).map(p=>p.getAttribute('d'));
 for(const outline of outlines)assert.equal([...geometry.querySelectorAll('path')].filter(p=>p.getAttribute('d')===outline).length,1);
 assert.equal(geometry.querySelectorAll('rect,text,.ledger-orb-aura').length,0);
 assert.ok(geometry.querySelectorAll('path').length>15);
 assert.equal(geometry.querySelectorAll('.ledger-orb').length,1);
 // The full financial icon's bounding box must clear both inner bracket edges.
 const transform=geometry.querySelector('.ledger-finance').getAttribute('transform');
 const [,tx,ty,scale]=transform.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/).map(Number);
 for(const x of [174,371])for(const y of [205,315]){
  const px=x*scale+tx,py=y*scale+ty;
  const left=py<256?108+(256-py)*102/112:108+(py-256)*96/112;
  const right=py<256?404-(256-py)*102/112:404-(py-256)*96/112;
  assert.ok(px-left>=12&&right-px>=12,'financial details need breathing room inside the brackets');
 }
 for(const path of details.querySelectorAll('path'))assert.ok(!outlines.includes(path.getAttribute('d')));
 assert.match(details.documentElement.textContent,/SRI/);
 assert.equal(details.querySelectorAll('.ledger-orb,.ledger-orb-aura').length,0);
});
