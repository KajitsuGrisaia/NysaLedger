const root=document.documentElement;
const designs=['orbit','aurora','terminal','eclipse'];
const labels={orbit:'Orbit',aurora:'Aurora',terminal:'Studio',eclipse:'Eclipse'};
function sync(){
 if(!designs.includes(root.dataset.design))root.dataset.design="orbit";
 const select=document.querySelector('[data-design-picker]');if(select)select.value=root.dataset.design;const label=document.querySelector('[data-theme-label]');if(label)label.textContent='Tema · '+labels[root.dataset.design];
 const light=root.dataset.theme==='light';
 root.dataset.colorMode=light?'light':'dark';
 try{localStorage.setItem('nysasoft-theme',root.dataset.design);localStorage.setItem('nysasoft-appearance',light?'light':'dark');}catch{}
 const url=new URL(location.href);url.searchParams.set('design',root.dataset.design);url.searchParams.set('mode',light?'light':'dark');history.replaceState(history.state,'',url);
 const back=document.querySelector('.nysasoft-return');if(back){const target=new URL(back.href);target.searchParams.set('design',root.dataset.design);target.searchParams.set('mode',light?'light':'dark');back.href=target;}
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',getComputedStyle(root).getPropertyValue('--bg').trim());
}
document.querySelector('[data-design-picker]')?.addEventListener('change',e=>{const next=e.target.value;if(designs.includes(next)){const update=()=>root.dataset.design=next;if(window.NysaThemeTransition)window.NysaThemeTransition.run(update,e,e.target.closest('label'));else update();}});
new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-design','data-theme']});sync();
// Match the parent halo without lag; hide immediately when leaving the window.
const fine=matchMedia('(hover:hover) and (pointer:fine)'),motion=matchMedia('(prefers-reduced-motion:reduce)');
const halo=document.createElement('div');halo.className='cursor-halo';halo.setAttribute('aria-hidden','true');document.body.append(halo);
let frame=0,point=null;
function hide(){point=null;cancelAnimationFrame(frame);frame=0;halo.classList.remove('visible');}
addEventListener('pointermove',e=>{if(!fine.matches||motion.matches||e.pointerType==='touch'){hide();return;}point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!point||document.hidden)return;halo.style.transform=`translate3d(${point.x}px,${point.y}px,0)`;halo.classList.add('visible');});},{passive:true});
document.documentElement.addEventListener('pointerleave',hide);addEventListener('blur',hide);document.addEventListener('visibilitychange',hide);fine.addEventListener('change',hide);motion.addEventListener('change',hide);
export {designs,labels};
