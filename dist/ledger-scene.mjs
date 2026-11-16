import {orbitalPose} from './orbits.mjs';
import {settle,create as createGeometry} from './logo-geometry.mjs';
// Bevelled Nysasoft geometry with the approved NysaLedger interior artwork.
// Everything stays on-device; no 3D library or network service is required.
export function projectPoint(point, rotation, width, height) {
  const [x,y,z]=point,cy=Math.cos(rotation.y),sy=Math.sin(rotation.y),cx=Math.cos(rotation.x),sx=Math.sin(rotation.x);
  const rx=x*cy+z*sy,rz=-x*sy+z*cy,ry=y*cx-rz*sx,depth=y*sx+rz*cx;
  const scale=Math.min(width,height)/700*900/(900-depth);
  return {x:width/2+rx*scale,y:height/2+ry*scale,z:depth};
}

export function mountLedgerScene(container) {
  const hero=container.querySelector('.project-hero'),figure=hero?.querySelector('.ledger-model');
  if(!figure)return ()=>{};
  const canvas=figure.querySelector('canvas'),background=hero.querySelector('.project-starfield'),ctx=canvas.getContext('2d'),bg=background.getContext('2d');
  if(!ctx||!bg)return ()=>{};
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];
  const geometryLayer=document.createElement('canvas'),geometryContext=geometryLayer.getContext('2d');
  const abort=new AbortController();
  let model=null;
  let disposed=false,visible=false,loaded=false,paused=false,frame=0,last=0,elapsed=0,dirty=true,starTime=0,physicsTime=0;
  let width=0,height=0,bw=0,bh=0,drag=null,returnAt=0,resetMotion=null;
  const rotation={x:0,y:0},pointer={x:-1000,y:-1000},stars=[];
  let ink='#bd93f9',light=false;
  const listen=(el,event,fn,options)=>{el.addEventListener(event,fn,options);listeners.push(()=>el.removeEventListener(event,fn,options));};
  const pause=figure.querySelector('[data-logo-pause]'),reset=figure.querySelector('[data-logo-reset]');
  function schedule(){if(!disposed&&!frame&&visible&&!document.hidden&&(dirty||drag||returnAt||resetMotion||(!motion.matches)))frame=requestAnimationFrame(tick);}
  function invalidate(){dirty=true;schedule();}
  function palette(){light=document.documentElement.dataset.theme==='light';ink=getComputedStyle(document.documentElement).getPropertyValue('--art-primary').trim()||(light?'#7549ac':'#bd93f9');invalidate();}
  function resize(){
    const box=canvas.getBoundingClientRect(),area=hero.getBoundingClientRect();
    width=box.width;height=box.height;
    const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(550000/Math.max(1,width*height)));
    const cw=Math.max(1,Math.round(width*dpr)),ch=Math.max(1,Math.round(height*dpr));
    if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;if(geometryLayer.width!==cw)geometryLayer.width=cw;if(geometryLayer.height!==ch)geometryLayer.height=ch;geometryContext.setTransform(dpr,0,0,dpr,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const oldW=bw,oldH=bh;bw=area.width;bh=area.height;
    const bd=Math.min(devicePixelRatio||1,1.25,Math.sqrt(650000/Math.max(1,bw*bh)));
    const pw=Math.max(1,Math.round(bw*bd)),ph=Math.max(1,Math.round(bh*bd));
    if(background.width!==pw)background.width=pw;if(background.height!==ph)background.height=ph;bg.setTransform(bd,0,0,bd,0,0);
    if(oldW&&oldH)for(const star of stars){star.x*=bw/oldW;star.y*=bh/oldH;star.homeX*=bw/oldW;star.homeY*=bh/oldH;}
    const count=Math.min(56,Math.max(16,Math.round(bw*bh/15000)));stars.length=Math.min(stars.length,count);while(stars.length<count){const x=Math.random()*bw,y=Math.random()*bh;stars.push({x,y,homeX:x,homeY:y,vx:0,vy:0,phase:Math.random()*Math.PI*2});}
    invalidate();
  }
  function starfield(steps){
    bg.clearRect(0,0,bw,bh);bg.fillStyle=ink;bg.strokeStyle=ink;
    // Match Nysasoft's 60 Hz spring response, independent of display refresh rate.
    for(let step=0;step<steps;step++){
      physicsTime+=1000/60;
      for(const s of stars){
        const dx=s.x-pointer.x,dy=s.y-pointer.y,d=Math.hypot(dx,dy);
        if(d>0&&d<140){s.vx+=dx/d*(1-d/140)*.22;s.vy+=dy/d*(1-d/140)*.22;}
        s.vx+=(s.homeX+Math.sin(physicsTime*.0003+s.phase)*16-s.x)*.003;
        s.vy+=(s.homeY+Math.cos(physicsTime*.0002+s.phase)*12-s.y)*.003;
        s.vx*=.94;s.vy*=.94;s.x+=s.vx;s.y+=s.vy;
      }
    }
    bg.globalAlpha=1;bg.beginPath();
    for(const s of stars){bg.moveTo(s.x+1.4,s.y);bg.arc(s.x,s.y,1.4,0,Math.PI*2);}bg.fill();
    bg.lineWidth=.8;
    for(let i=0;i<stars.length;i++)for(let j=i+1;j<stars.length;j++){
      const a=stars[i],b=stars[j],d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d<110){bg.globalAlpha=(1-d/110)*.34;bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.stroke();}
    }
    bg.globalAlpha=1;
  }
  function draw(){
    ctx.clearRect(0,0,width,height);
    // Orbital paths and electrons remain separate from the drag rotation.
    for(let k=0;k<3;k++){
      const {angle,tilt,electron:electronAngle}=orbitalPose(k,elapsed);
      const orbit=a=>{const x=Math.cos(a)*290,y=Math.sin(a)*290*Math.cos(tilt),z=Math.sin(a)*290*Math.sin(tilt);return projectPoint([x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z],{x:0,y:0},width,height);};
      const colors=globalThis.NysaVisualPalette?.get();const color=colors?[colors.primary,colors.secondary,colors.tertiary][k]:['#bd93f9','#8be9fd','#ef8fd0'][k];ctx.strokeStyle=color;ctx.globalAlpha=light?.4:.3;ctx.lineWidth=.8;ctx.beginPath();
      for(let i=0;i<=140;i++){const p=orbit(i/140*Math.PI*2);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();ctx.globalAlpha=1;
      const electron=orbit(electronAngle);ctx.fillStyle=color;ctx.beginPath();ctx.arc(electron.x,electron.y,2.1,0,Math.PI*2);ctx.fill();
    }
    if(!loaded)return;
    // The same lit, bevelled bracket geometry as the Nysasoft banner.
    model.draw(geometryContext,width,height,rotation,motion.matches?0:elapsed);
    ctx.drawImage(geometryLayer,0,0,width,height);

  }
  function tick(now){
    frame=0;if(disposed||!visible||document.hidden)return;
    const dt=Math.min(50,last?now-last:16);last=now;
    if(!paused&&!motion.matches)elapsed+=dt;
    if(resetMotion){
      resetMotion.time=Math.min(1000,resetMotion.time+dt);
      const t=resetMotion.time/1000,e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      rotation.x=resetMotion.x*(1-e);rotation.y=resetMotion.y*(1-e);
      if(t===1)resetMotion=null;
    }else if(!drag&&returnAt&&now>=returnAt&&!paused){
      if(!settle(rotation,dt/1000))returnAt=0;
    }else if(!drag&&!returnAt&&!paused&&!motion.matches){
      rotation.y+=dt/1000*.17;
      rotation.y=Math.atan2(Math.sin(rotation.y),Math.cos(rotation.y));
      rotation.x+=(.1-rotation.x)*(1-Math.exp(-dt/1000*2));
    }
    draw();if(!motion.matches)starTime+=dt;const steps=Math.min(3,Math.floor(starTime/(1000/60)));starTime-=steps*(1000/60);starfield(steps);dirty=false;schedule();
  }
  function release(){resetMotion=null;const id=drag?.id;drag=null;canvas.classList.remove('is-dragging');try{if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}if(!paused&&!motion.matches)returnAt=performance.now()+3000;invalidate();}
  function restore(){release();returnAt=0;if(motion.matches){rotation.x=rotation.y=0;resetMotion=null;}else resetMotion={x:Math.atan2(Math.sin(rotation.x),Math.cos(rotation.x)),y:Math.atan2(Math.sin(rotation.y),Math.cos(rotation.y)),time:0};invalidate();}
  function toggle(){release();paused=!paused;pause.textContent=paused?'▶ Reanudar':'Ⅱ Pausar';pause.setAttribute('aria-pressed',String(paused));returnAt=0;resetMotion=null;invalidate();}
  listen(canvas,'pointerdown',event=>{if(event.button!==0)return;resetMotion=null;drag={id:event.pointerId,x:event.clientX,y:event.clientY};returnAt=0;canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');invalidate();});
  listen(canvas,'pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;rotation.y+=(event.clientX-drag.x)*.012;rotation.y=Math.atan2(Math.sin(rotation.y),Math.cos(rotation.y));rotation.x=Math.max(-1.25,Math.min(1.25,rotation.x+(event.clientY-drag.y)*.012));drag.x=event.clientX;drag.y=event.clientY;invalidate();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,()=>{if(drag)release();});
  listen(canvas,'keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home',' '].includes(event.key))return;event.preventDefault();if(event.key==='Home')restore();else if(event.key===' ')toggle();else{resetMotion=null;rotation.y+=(event.key==='ArrowLeft'?-.22:event.key==='ArrowRight'?.22:0);rotation.x=Math.max(-1.25,Math.min(1.25,rotation.x+(event.key==='ArrowUp'?-.22:event.key==='ArrowDown'?.22:0)));returnAt=paused||motion.matches?0:performance.now()+3000;invalidate();}});
  listen(pause,'click',toggle);listen(reset,'click',restore);
  listen(hero,'pointermove',event=>{if(event.pointerType==='touch'||motion.matches)return;const box=hero.getBoundingClientRect();pointer.x=event.clientX-box.left;pointer.y=event.clientY-box.top;});
  const clearPointer=()=>{pointer.x=pointer.y=-1000;};
  listen(hero,'pointerleave',clearPointer);listen(hero,'pointercancel',clearPointer);listen(window,'blur',clearPointer);
  listen(window,'blur',()=>{if(drag)release();});
  listen(document,'visibilitychange',()=>{if(document.hidden){clearPointer();cancelAnimationFrame(frame);frame=0;last=0;if(drag)release();}else invalidate();});
  listen(motion,'change',()=>{if(motion.matches)restore();invalidate();});
  const size=new ResizeObserver(resize);size.observe(canvas);size.observe(hero);
  const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else invalidate();});visibility.observe(hero);
  const theme=new MutationObserver(palette);theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-design']});
  const ready=()=>{if(disposed||!model)return;loaded=true;figure.classList.add('is-ready');invalidate();};
  const fail=()=>{if(disposed)return;paused=true;pause.disabled=true;reset.disabled=true;figure.querySelector('figcaption').textContent='Logo de NysaLedger';invalidate();};
  fetch(new URL('./assets/symbol-geometry.svg',import.meta.url),{signal:abort.signal}).then(response=>{if(!response.ok)throw Error('Logo unavailable');return response.text();}).then(source=>{if(disposed)return;model=createGeometry(source);ready();}).catch(fail);
  palette();resize();
  return ()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);size.disconnect();visibility.disconnect();theme.disconnect();listeners.forEach(remove=>remove());};
}
