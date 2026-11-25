// Small particle effects: sparks, embers, ash, ink, feathers, smoke, wisps and drifting motes.
// Everything is drawn with plain 2D canvas on one layer over the page. The loop only runs while particles are alive,
// so it costs nothing when idle, and nothing here needs 3D or a graphics card, so it works on school computers.
// If frames start taking too long, effects automatically use fewer particles.
const MAX=450;
let canvas=null,ctx=null,parts=[],running=false,last=0,quality=1,ratio=1;
const sprites=new Map();

function layer(){
  if(typeof document==='undefined')return false;
  if(canvas?.isConnected)return true;
  canvas=document.createElement('canvas');canvas.className='fx-layer';canvas.setAttribute('aria-hidden','true');
  document.body.appendChild(canvas);ctx=canvas.getContext('2d');fit();
  window.addEventListener('resize',fit);
  return true;
}
function fit(){
  ratio=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(window.innerWidth*ratio);canvas.height=Math.round(window.innerHeight*ratio);
  canvas.style.width=`${window.innerWidth}px`;canvas.style.height=`${window.innerHeight}px`;
}
// A soft round glow, drawn once per colour and reused.
function glow(color){
  if(sprites.has(color))return sprites.get(color);
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,color);r.addColorStop(.35,color);r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);
  sprites.set(color,c);return c;
}
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];

function add(p){if(parts.length<MAX)parts.push({age:0,rot:0,vr:0,drag:0,ax:0,ay:0,grow:0,sway:0,phase:Math.random()*6.28,...p});}
function start(){if(running)return;running=true;last=performance.now();requestAnimationFrame(step);}
function step(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  // Keep the effects smooth on slow machines by spawning fewer particles next time.
  if(dt>.034)quality=Math.max(.35,quality-.05);else if(dt<.02)quality=Math.min(1,quality+.01);
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  parts=parts.filter(p=>(p.age+=dt)<p.life);
  for(const p of parts){
    p.vx+=p.ax*dt;p.vy+=p.ay*dt;if(p.drag){const k=Math.max(0,1-p.drag*dt);p.vx*=k;p.vy*=k;}
    p.x+=(p.vx+(p.sway?Math.sin(p.age*3+p.phase)*p.sway:0))*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
    const t=p.age/p.life,fade=t<.15?t/.15:1-(t-.15)/.85,size=p.size*(1+p.grow*t);
    ctx.globalAlpha=Math.max(0,fade)*(p.alpha??1);
    draw(p,size);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(parts.length)requestAnimationFrame(step);else{running=false;ctx.clearRect(0,0,canvas.width,canvas.height);}
}
function draw(p,s){
  ctx.globalCompositeOperation=p.kind==='glow'||p.kind==='spark'||p.kind==='wisp'?'lighter':'source-over';
  if(p.kind==='glow'||p.kind==='puff'){ctx.drawImage(glow(p.color),p.x-s,p.y-s,s*2,s*2);return;}
  if(p.kind==='wisp'){const lean=Math.sin(p.age*3+p.phase)*.25;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(lean);ctx.scale(.45,1.9);ctx.drawImage(glow(p.color),-s,-s,s*2,s*2);ctx.restore();return;}
  ctx.save();ctx.translate(p.x,p.y);
  if(p.kind==='spark'){const a=Math.atan2(p.vy,p.vx),len=Math.min(14,Math.hypot(p.vx,p.vy)*.035)+s;ctx.rotate(a);ctx.strokeStyle=p.color;ctx.lineWidth=s*.6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(0,0);ctx.stroke();}
  else if(p.kind==='flake'){ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(-s,-s*.4);ctx.lineTo(s*.6,-s*.7);ctx.lineTo(s,s*.3);ctx.lineTo(-s*.3,s*.6);ctx.closePath();ctx.fill();}
  else if(p.kind==='drop'){ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,s*(1+Math.min(1.2,Math.hypot(p.vx,p.vy)/300)),s,0,0,6.283);ctx.fill();}
  else if(p.kind==='feather'){ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,s*.38,s,0,0,6.283);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s*1.25);ctx.stroke();}
  ctx.restore();
}
// Effects, each spawned around a point. `scale` follows the size of the thing it plays on.
const PRESETS={
  sparks:(x,y,c,n,k)=>{for(let i=0;i<n(16);i++){const a=rnd(0,6.283),v=rnd(90,230)*k;add({kind:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40*k,ay:260*k,drag:1.2,life:rnd(.5,.9),size:rnd(1.6,2.6)*k,color:pick(c)});}
    for(let i=0;i<n(3);i++)add({kind:'glow',x,y,vx:0,vy:0,life:.45,size:16*k,grow:.6,color:c[0],alpha:.6});},
  embers:(x,y,c,n,k)=>{for(let i=0;i<n(14);i++)add({kind:'glow',x:x+rnd(-10,10)*k,y:y+rnd(-6,6)*k,vx:rnd(-20,20)*k,vy:rnd(-95,-40)*k,drag:.4,sway:22*k,life:rnd(1.1,1.9),size:rnd(2.5,4.5)*k,color:pick(c)});},
  ash:(x,y,c,n,k)=>{for(let i=0;i<n(16);i++){const a=rnd(-3.0,-.15);add({kind:'flake',x:x+rnd(-8,8)*k,y:y+rnd(-6,6)*k,vx:Math.cos(a)*rnd(20,70)*k,vy:Math.sin(a)*rnd(20,60)*k,ay:38*k,drag:1,sway:14*k,vr:rnd(-4,4),life:rnd(1.4,2.3),size:rnd(1.5,3)*k,color:pick(c)});}
    add({kind:'puff',x,y,vx:0,vy:-12*k,life:1.2,size:14*k,grow:1.4,color:c[0],alpha:.35});},
  dust:(x,y,c,n,k)=>{for(let i=0;i<n(14);i++){const a=rnd(0,6.283),v=rnd(25,70)*k;add({kind:'glow',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-15*k,drag:1.6,life:rnd(.8,1.4),size:rnd(2,3.2)*k,color:pick(c)});}},
  ink:(x,y,c,n,k)=>{for(let i=0;i<n(15);i++){const a=rnd(0,6.283),v=rnd(110,260)*k;add({kind:'drop',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50*k,ay:420*k,drag:2.2,life:rnd(.55,.95),size:rnd(1.8,3.6)*k,color:pick(c)});}},
  feathers:(x,y,c,n,k)=>{for(let i=0;i<n(6);i++)add({kind:'feather',x:x+rnd(-8,8)*k,y,vx:rnd(-50,50)*k,vy:rnd(-110,-60)*k,ay:70*k,drag:1.6,sway:38*k,vr:rnd(-3,3),rot:rnd(0,6.28),life:rnd(1.8,2.6),size:rnd(7,10)*k,color:pick(c)});},
  smoke:(x,y,c,n,k)=>{for(let i=0;i<n(9);i++)add({kind:'puff',x:x+rnd(-4,4)*k,y:y-4*k,vx:rnd(-8,8)*k,vy:rnd(-55,-30)*k,sway:12*k,life:rnd(1.6,2.4),size:rnd(4,6)*k,grow:2.4,color:pick(c),alpha:.55});},
  wisps:(x,y,c,n,k)=>{for(let i=0;i<n(12);i++)add({kind:'wisp',x:x+rnd(-14,14)*k,y:y+rnd(-4,8)*k,vx:rnd(-6,6)*k,vy:rnd(-58,-26)*k,drag:.3,sway:18*k,life:rnd(1.3,2.1),size:rnd(2.4,4.2)*k,grow:.5,color:pick(c),alpha:.75});
    add({kind:'glow',x,y,vx:0,vy:-8*k,life:.9,size:18*k,grow:.5,color:c[c.length-1],alpha:.35});},
};
// Plays an effect centred on an element. Colours come from the decoration that caused it.
export function playOn(el,preset,colors,scale){
  if(!el||!PRESETS[preset]||!layer())return;
  const r=el.getBoundingClientRect();if(!r.width)return;
  const k=scale??Math.max(.6,Math.min(1.4,r.width/48)),n=count=>Math.max(1,Math.round(count*quality));
  PRESETS[preset](r.left+r.width/2,r.top+r.height/2,colors,n,k);start();
}
// Light motes rising through an area, for dawn.
export function motes(el,colors=['#ffe7b0','#f6cf7a']){
  if(!el||!layer())return;const r=el.getBoundingClientRect();if(!r.width)return;
  for(let i=0;i<Math.round(34*quality);i++){const a=rnd(0,6.283),d=Math.sqrt(Math.random())*r.width*.42;
    add({kind:'glow',x:r.left+r.width/2+Math.cos(a)*d,y:r.top+r.height/2+Math.sin(a)*d,vx:rnd(-6,6),vy:rnd(-38,-14),sway:10,life:rnd(1.2,2.2),size:rnd(1.8,3.4),color:pick(colors),alpha:.85});}
  start();
}
