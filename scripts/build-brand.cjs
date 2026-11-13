const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'dist/assets');
const {inner,svg}=require('./ledger-symbol.cjs');
const symbol=svg(false);
const square=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="#101119"/><g transform="translate(40 40) scale(.84375)">${inner}</g></svg>`;
fs.mkdirSync(assets,{recursive:true});fs.writeFileSync(path.join(assets,'symbol.svg'),symbol);fs.writeFileSync(path.join(assets,'symbol-animated.svg'),svg(true));
async function build(){for(const size of [180,192,512])await sharp(Buffer.from(square)).resize(size,size).png().toFile(path.join(assets,`icon-${size}.png`));await sharp(Buffer.from(square)).resize(48,48).png().toFile(path.join(assets,'favicon.png'));
for(const [name,ink] of [['wordmark','#f2f2f8'],['wordmark-light','#222537']])fs.writeFileSync(path.join(assets,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 150" role="img" aria-label="NysaLedger"><title>&gt;_NysaLedger</title><g transform="translate(0 5) scale(.27)">${inner}</g><text x="165" y="94" font-family="monospace" font-size="46" fill="#ef8fd0">&gt;_</text><text x="225" y="94" font-family="Arial,sans-serif" font-size="65" font-weight="700" letter-spacing="-2" fill="${ink}">Nysa<tspan fill="#df7dbc">Ledger</tspan></text></svg>`);
const target=path.resolve(root,'../nysasoft-preview/dist/assets/nysaledger');fs.mkdirSync(target,{recursive:true});for(const name of ['symbol.svg','symbol-animated.svg','wordmark.svg','wordmark-light.svg','icon-512.png'])fs.copyFileSync(path.join(assets,name),path.join(target,name));
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#101119"/><g transform="translate(70 100) scale(.75)">${inner}</g><text x="520" y="205" font-family="Arial,sans-serif" font-size="25" fill="#bd93f9">UN PROYECTO DE NYSASOFT</text><text x="520" y="300" font-family="Arial,sans-serif" font-size="70" font-weight="700" fill="#f2f2f8">Nysa<tspan fill="#ef8fd0">Ledger</tspan></text><text x="520" y="370" font-family="Arial,sans-serif" font-size="28" fill="#a4a8bd">Tu control tributario, en tu órbita.</text><text x="520" y="445" font-family="Arial,sans-serif" font-size="23" fill="#8be9fd">ECUADOR / ES · GRATIS · SIN REGISTRO</text></svg>`)).png().toFile(path.join(target,'social-card.png'));
console.log('NysaLedger vector identity and install icons generated.');}
build().catch(e=>{console.error(e);process.exitCode=1;});

require('./build-scene-assets.cjs');
