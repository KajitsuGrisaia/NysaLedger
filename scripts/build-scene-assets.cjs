const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'dist/assets');
const symbol=fs.readFileSync(path.join(assets,'symbol.svg'),'utf8');
const paths=[...symbol.matchAll(/<path\b[^>]*\/>/g)].slice(0,2).map(m=>m[0]);
const defs=symbol.match(/<defs>[\s\S]*?<\/defs>/)[0];
const orb=symbol.match(/<circle class="ledger-orb"[^>]*\/>/)[0];
let geometry=symbol.replace(/<circle class="ledger-orb-aura"[^>]*\/>/,'');
geometry=geometry.replace(/<rect\b([^>]*)\/>/g,(_,attrs)=>{
 const get=name=>Number(attrs.match(new RegExp('\\b'+name+'="([^" ]+)"'))?.[1]||0);
 const x=get('x'),y=get('y'),w=get('width'),h=get('height');
 return '<path d="M'+x+' '+y+'h'+w+'v'+h+'h-'+w+'Z" '+attrs.replace(/\b(?:x|y|width|height|rx)="[^"]*"/g,'')+'/>';
});
geometry=geometry.replace(/<text x="233"[\s\S]*?<\/text>/,'<path d="M247 232h-12v9h12v10h-12 M254 253v-21h10v10h-10m5 0 7 11 M273 232v21" fill="none" stroke="#bda4ee" stroke-width="3.2"/>');
geometry=geometry.replace(/<text x="284"[\s\S]*?<\/text>/,'<path d="M296 291h-9v6h9v6h-9m5-15v18" fill="none" stroke="#c6a7ea" stroke-width="2.3"/>');
// Keep the financial icon open like the parent's circuitry. Solid plates
// caused painter-order occlusion of small raised strokes at oblique angles.
geometry=geometry.replace('fill="#22212c" stroke="url(#ledger)"','fill="none" stroke="url(#ledger)"');
geometry=geometry.replace('fill="#b69ae9"','fill="none" stroke="#b69ae9" stroke-width="4"');
geometry=geometry.replaceAll('fill="#22212c"','fill="#b69ae9"');
// The calculator display is an outlined recess, with separate raised keys.
geometry=geometry.replace(/(<path d="M180 252h38v15h-38Z"[^>]*?)fill="#b69ae9"/, '$1fill="none" stroke="#b69ae9" stroke-width="2.5"');
fs.writeFileSync(path.join(assets,'symbol-geometry.svg'),geometry);
let details=symbol;for(const p of paths)details=details.replace(p,'');details=details.replace(orb,'').replace(/<circle class="ledger-orb-aura"[^>]*\/>/,'');
fs.writeFileSync(path.join(assets,'symbol-details.svg'),details);
// Bundle the same renderer used by the parent brand, not a separate approximation.
const source=path.resolve(root,'../nysasoft-preview/dist/js/renderers/logo-model.js');
if(fs.existsSync(source)){
 let code=fs.readFileSync(source,'utf8').replace(/^'use strict';\s*\(\(root\) => \{/,"const root=globalThis;");
 code=code.slice(0,code.lastIndexOf('  const api ='))+'\nexport {create,settle,parsePath,inset,shadeColor};\n';
 code=code.replace('circuits.push(points);', 'if(!activeTransform)circuits.push(points);');
 code=code.replace('function extrude(points, material, depth) {', `function extrude(points, material, depth) {
      if(activeTransform)points=points.map(([x,y])=>[x*activeTransform.scale+activeTransform.x,y*activeTransform.scale+activeTransform.y]);`);
 code=code.replace("    for (const node of svg.querySelectorAll('path,circle')) {", `    let activeTransform=null;
    for (const node of svg.querySelectorAll('path,circle')) {
      const transform=node.closest('[transform]')?.getAttribute('transform')||'';
      const translate=transform.match(/translate\\(([-\\d.]+)[ ,]+([-\\d.]+)\\)/);
      const scale=transform.match(/scale\\(([-\\d.]+)\\)/);
      activeTransform=translate?{x:Number(translate[1]),y:Number(translate[2]),scale:Number(scale?.[1]||1)}:null;`);
 code=code.replace("node.getAttribute('fill')?.startsWith('url(') ? 32 : 9", "['url(#left)','url(#right)'].includes(node.getAttribute('fill')) && !activeTransform ? 32 : node.getAttribute('d')?.startsWith('M218 314') ? 2 : node.getAttribute('fill') === '#22212c' || node.parentElement?.getAttribute('fill') === '#22212c' ? 12 : 9");
 code=code.replace('/ 540','/ 700').replace(/\b950\b/g,'900');
 fs.writeFileSync(path.join(root,'dist/logo-geometry.mjs'),'// Generated from the Nysasoft logo renderer.\n'+code);
}
if(!fs.existsSync(path.join(root,'dist/logo-geometry.mjs')))throw Error('Missing bundled logo renderer');
