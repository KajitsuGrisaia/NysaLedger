import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const files=await readdir('dist');
for(const file of files.filter(f=>f.endsWith('.mjs'))){const r=spawnSync(process.execPath,['--check',path.join('dist',file)],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const html=await readFile('dist/index.html','utf8');
for(const link of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^https?:\/\//.test(link[1]))continue;
  await readFile(path.join('dist',link[1]));
}
for(const f of files.filter(f=>/\.(mjs|html|css)$/.test(f))){const source=await readFile(path.join('dist',f),'utf8');if(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----|sk-proj-[A-Za-z0-9]{20}/.test(source))throw Error('Credencial detectada: '+f);}
if(!html.includes("connect-src 'self'"))throw Error('Solo se permiten conexiones al mismo origen para preparar la app sin conexión.');
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
if(manifest.name!=='NysaLedger'||manifest.display!=='standalone'||manifest.scope!=='./')throw Error('Manifest de instalación incorrecto.');
for(const icon of manifest.icons){const bytes=await readFile(path.join('dist',icon.src));const size=Number(icon.sizes.split('x')[0]);if(bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size)throw Error('Icono de instalación de tamaño incorrecto.');}
console.log('Sintaxis, recursos locales y separación de datos privados: correctos.');
