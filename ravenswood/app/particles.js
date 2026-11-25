// Particle effects: sparks, embers, ash, ink, feathers, smoke, wisps, flames, ravens and shockwaves.
// Everything is drawn with plain 2D canvas on one layer over the page. The loop only runs while something is playing,
// so it costs nothing when idle, and nothing here needs 3D or a graphics card, so it works on school computers.
// If frames start taking too long, effects automatically use fewer particles.
const MAX=600;
let canvas=null,ctx=null,parts=[],emitters=[],running=false,last=0,quality=1,ratio=1;
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
const LIGHT=new Set(['glow','spark','wisp','flame']);

// `fadeIn` and `hold` shape how a particle appears and disappears, as shares of its life.
function add(p){if(parts.length<MAX)parts.push({age:0,rot:0,vr:0,drag:0,ax:0,ay:0,grow:0,sway:0,fadeIn:.15,hold:.15,phase:Math.random()*6.28,...p});}
// Spawns something every `every` seconds for `dur` seconds, after `delay`.
function emit(dur,every,spawn,delay=0){emitters.push({t:-delay,dur,every,acc:0,spawn});}
function start(){if(running)return;running=true;last=performance.now();requestAnimationFrame(step);}
function step(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  // Keep the effects smooth on slow machines by spawning fewer particles.
  if(dt>.034)quality=Math.max(.35,quality-.05);else if(dt<.02)quality=Math.min(1,quality+.01);
  for(const e of emitters){e.t+=dt;if(e.t<0)continue;e.acc+=dt;while(e.acc>=e.every){e.acc-=e.every;if(Math.random()<quality)e.spawn(e.t);}}
  emitters=emitters.filter(e=>e.t<e.dur);
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  parts=parts.filter(p=>(p.age+=dt)<p.life);
  for(const p of parts){
    p.vx+=p.ax*dt;p.vy+=p.ay*dt;if(p.drag){const k=Math.max(0,1-p.drag*dt);p.vx*=k;p.vy*=k;}
    p.x+=(p.vx+(p.sway?Math.sin(p.age*3+p.phase)*p.sway:0))*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
    const t=p.age/p.life,fade=t<p.fadeIn?t/p.fadeIn:t<p.hold?1:1-(t-Math.max(p.fadeIn,p.hold))/(1-Math.max(p.fadeIn,p.hold));
    ctx.globalAlpha=Math.max(0,Math.min(1,fade))*(p.alpha??1);
    draw(p,p.size*(1+p.grow*t),t);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(parts.length||emitters.length)requestAnimationFrame(step);else{running=false;ctx.clearRect(0,0,canvas.width,canvas.height);}
}
function draw(p,s,t){
  ctx.globalCompositeOperation=p.blend||(LIGHT.has(p.kind)?'lighter':'source-over');
  if(p.kind==='glow'||p.kind==='puff'){ctx.drawImage(glow(p.color),p.x-s,p.y-s,s*2,s*2);return;}
  if(p.kind==='ring'){ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(.5,p.width*(1-t));ctx.beginPath();ctx.arc(p.x,p.y,s,0,6.283);ctx.stroke();return;}
  ctx.save();ctx.translate(p.x,p.y);
  if(p.kind==='spark'){const a=Math.atan2(p.vy,p.vx),len=Math.min(14,Math.hypot(p.vx,p.vy)*.035)+s;ctx.rotate(a);ctx.strokeStyle=p.color;ctx.lineWidth=s*.6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-len,0);ctx.lineTo(0,0);ctx.stroke();}
  else if(p.kind==='wisp'){ctx.rotate(Math.sin(p.age*3+p.phase)*.25);ctx.scale(.45,1.9);ctx.drawImage(glow(p.color),-s,-s,s*2,s*2);}
  else if(p.kind==='flake'){ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(-s,-s*.4);ctx.lineTo(s*.6,-s*.7);ctx.lineTo(s,s*.3);ctx.lineTo(-s*.3,s*.6);ctx.closePath();ctx.fill();}
  else if(p.kind==='drop'){ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,s*(1+Math.min(1.4,Math.hypot(p.vx,p.vy)/260)),s,0,0,6.283);ctx.fill();}
  else if(p.kind==='feather'){ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,s*.38,s,0,0,6.283);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s*1.25);ctx.stroke();}
  // An ink blot: one big drop and a ring of smaller splashes, landing almost at once.
  else if(p.kind==='stain'){const g=Math.min(1,t/.05);ctx.fillStyle=p.color;for(const [dx,dy,r] of p.blobs){ctx.beginPath();ctx.arc(dx*s*g,dy*s*g,r*s*g,0,6.283);ctx.fill();}}
  // A candle flame that flickers, then goes out.
  else if(p.kind==='flame'){
    const out=p.out??.6,f=t<out?1+Math.sin(p.age*31)*.1+Math.sin(p.age*47)*.07:Math.max(0,1-(t-out)/.1);
    ctx.strokeStyle='#2a2320';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,s*.5);ctx.lineTo(0,s*.15);ctx.stroke();
    if(f>0){const h=s*1.7*f,w=s*.62*f,gr=ctx.createRadialGradient(0,h*.15,0,0,0,h);gr.addColorStop(0,'#fffbe8');gr.addColorStop(.35,'#ffd27a');gr.addColorStop(.75,'#ff8a1f');gr.addColorStop(1,'rgba(255,90,20,0)');
      ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(0,-h);ctx.bezierCurveTo(w,-h*.3,w,h*.35,0,h*.42);ctx.bezierCurveTo(-w,h*.35,-w,-h*.3,0,-h);ctx.fill();}
  }
  // A raven in flight, side on, beating its wings.
  else if(p.kind==='raven'){
    ctx.scale(p.vx<0?-1:1,1);ctx.rotate(Math.max(-.5,Math.min(.5,Math.atan2(p.vy,Math.abs(p.vx))*.45)));
    const flap=Math.sin(p.age*15+p.phase),wy=-s*(.15+.85*flap);ctx.fillStyle=p.color;
    ctx.beginPath();ctx.ellipse(0,0,s*.55,s*.21,0,0,6.283);ctx.fill();
    ctx.beginPath();ctx.arc(s*.5,-s*.08,s*.17,0,6.283);ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.62,-s*.13);ctx.lineTo(s*.9,-s*.04);ctx.lineTo(s*.62,0);ctx.fill();
    ctx.beginPath();ctx.moveTo(-s*.42,0);ctx.lineTo(-s*.88,-s*.14);ctx.lineTo(-s*.82,s*.12);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(s*.22,-s*.06);ctx.quadraticCurveTo(-s*.05,wy*.55-s*.08,-s*.6,wy);ctx.quadraticCurveTo(-s*.22,wy*.25,-s*.28,0);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
// A pale copy of the player's picture that rises out of the seat and fades.
function ghostRise(r,extra){
  const g=document.createElement('div');g.className='fx-ghost';
  g.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  if(extra?.avatar){const i=document.createElement('img');i.src=extra.avatar;i.alt='';g.appendChild(i);}else g.textContent=(extra?.name||'').slice(0,2).toUpperCase();
  document.body.appendChild(g);setTimeout(()=>g.remove(),2600);
}
const blot=()=>[[0,0,.62],...Array.from({length:11},()=>{const a=rnd(0,6.283),d=rnd(.55,1.25);return [Math.cos(a)*d,Math.sin(a)*d,rnd(.08,.26)];})];
// Effects, each spawned around the centre of something. `k` scales them to its size; `n` trims counts on slow machines.
const PRESETS={
  // Small, quick effects for votes and the plain death.
  sparks:(x,y,c,n,k)=>{for(let i=0;i<n(16);i++){const a=rnd(0,6.283),v=rnd(90,230)*k;add({kind:'spark',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40*k,ay:260*k,drag:1.2,life:rnd(.5,.9),size:rnd(1.6,2.6)*k,color:pick(c)});}
    for(let i=0;i<n(3);i++)add({kind:'glow',x,y,vx:0,vy:0,life:.45,size:16*k,grow:.6,color:c[0],alpha:.6});},
  embers:(x,y,c,n,k)=>{for(let i=0;i<n(14);i++)add({kind:'glow',x:x+rnd(-10,10)*k,y:y+rnd(-6,6)*k,vx:rnd(-20,20)*k,vy:rnd(-95,-40)*k,drag:.4,sway:22*k,life:rnd(1.1,1.9),size:rnd(2.5,4.5)*k,color:pick(c)});},
  ash:(x,y,c,n,k)=>{for(let i=0;i<n(16);i++){const a=rnd(-3.0,-.15);add({kind:'flake',x:x+rnd(-8,8)*k,y:y+rnd(-6,6)*k,vx:Math.cos(a)*rnd(20,70)*k,vy:Math.sin(a)*rnd(20,60)*k,ay:38*k,drag:1,sway:14*k,vr:rnd(-4,4),life:rnd(1.4,2.3),size:rnd(1.5,3)*k,color:pick(c)});}
    add({kind:'puff',x,y,vx:0,vy:-12*k,life:1.2,size:14*k,grow:1.4,color:c[0],alpha:.35});},
  dust:(x,y,c,n,k)=>{for(let i=0;i<n(14);i++){const a=rnd(0,6.283),v=rnd(25,70)*k;add({kind:'glow',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-15*k,drag:1.6,life:rnd(.8,1.4),size:rnd(2,3.2)*k,color:pick(c)});}},
  ink:(x,y,c,n,k)=>{for(let i=0;i<n(15);i++){const a=rnd(0,6.283),v=rnd(110,260)*k;add({kind:'drop',x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50*k,ay:420*k,drag:2.2,life:rnd(.55,.95),size:rnd(1.8,3.6)*k,color:pick(c)});}},
  wisps:(x,y,c,n,k)=>{for(let i=0;i<n(12);i++)add({kind:'wisp',x:x+rnd(-14,14)*k,y:y+rnd(-4,8)*k,vx:rnd(-6,6)*k,vy:rnd(-58,-26)*k,drag:.3,sway:18*k,life:rnd(1.3,2.1),size:rnd(2.4,4.2)*k,grow:.5,color:pick(c),alpha:.75});
    add({kind:'glow',x,y,vx:0,vy:-8*k,life:.9,size:18*k,grow:.5,color:c[c.length-1],alpha:.35});},
  crimson:(x,y,c,n,k)=>{add({kind:'ring',x,y,vx:0,vy:0,life:.55,size:10*k,grow:2.6,width:3*k,color:c[0]});PRESETS.ink(x,y,c,n,k*1.1);},
  // Death marks: each a short scene of two to three seconds.
  crumble:(x,y,c,n,k)=>{
    add({kind:'puff',x,y,vx:0,vy:-10*k,life:1.4,size:16*k,grow:1.2,color:c[0],alpha:.4});
    // Ash peels off the seat and streams away on the wind.
    emit(1.1,.018,()=>{const a=rnd(0,6.283),d=rnd(0,18)*k;add({kind:'flake',x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,vx:rnd(55,150)*k,vy:rnd(-55,10)*k,ay:-8*k,drag:.5,sway:24*k,vr:rnd(-5,5),life:rnd(1.4,2.3),size:rnd(1.3,3.1)*k,color:pick(c)});});
  },
  inkblot:(x,y,c,n,k)=>{
    add({kind:'stain',x,y,vx:0,vy:0,life:3.2,fadeIn:.02,hold:.62,size:24*k,blobs:blot(),color:c[0],alpha:.82});
    PRESETS.ink(x,y,c,m=>n(m*2),k*1.2);
    // Drips run down from the blot.
    emit(.5,.08,()=>add({kind:'drop',x:x+rnd(-16,16)*k,y:y+rnd(4,14)*k,vx:0,vy:rnd(10,30)*k,ay:rnd(140,240)*k,drag:.8,life:rnd(1.1,1.7),fadeIn:.05,hold:.6,size:rnd(1.6,2.6)*k,color:pick(c)}),.25);
  },
  snuff:(x,y,c,n,k)=>{
    add({kind:'glow',x,y:y-6*k,vx:0,vy:0,life:1.1,fadeIn:.1,hold:.6,size:26*k,color:'#ffb347',alpha:.35});
    add({kind:'flame',x,y:y-20*k,vx:0,vy:0,life:1.3,fadeIn:.05,hold:1,out:.62,size:11*k});
    // When the flame goes out, a long curl of smoke rises from the wick.
    emit(2,.05,tt=>add({kind:'puff',x:x+Math.sin(tt*5)*5*k,y:y-22*k,vx:rnd(-6,6)*k,vy:rnd(-48,-30)*k,sway:26*k,life:rnd(1.8,2.6),fadeIn:.1,size:rnd(2.5,4)*k,grow:3,color:pick(c),alpha:.5}),.82);
  },
  raven:(x,y,c,n,k)=>{
    add({kind:'ring',x,y,vx:0,vy:0,life:.7,size:12*k,grow:3,width:4*k,color:'#0b0c12',blend:'source-over'});
    add({kind:'puff',x,y,vx:0,vy:0,life:1,size:26*k,grow:.6,color:'#05060a',alpha:.55});
    // One big raven arcs up and away; two smaller ones scatter the other way. Feathers fall along the big one's path.
    const dir=Math.random()<.5?-1:1,vx=170*k*dir,vy=-250*k,ay=120*k;
    add({kind:'raven',x,y,vx,vy,ay,life:2.4,fadeIn:.04,hold:.7,size:26*k,color:c[0]});
    for(const [sx,sy,sz] of [[-120,-210,14],[-80,-260,12]])add({kind:'raven',x,y,vx:sx*k*dir,vy:sy*k,ay:90*k,life:2,fadeIn:.05,hold:.6,size:sz*k,color:pick(c)});
    for(let i=0;i<n(7);i++)add({kind:'feather',x:x+rnd(-8,8)*k,y,vx:rnd(-60,60)*k,vy:rnd(-120,-60)*k,ay:70*k,drag:1.6,sway:38*k,vr:rnd(-3,3),rot:rnd(0,6.28),life:rnd(1.8,2.6),size:rnd(6,9)*k,color:pick(c)});
    emit(1.5,.1,tt=>add({kind:'feather',x:x+vx*tt,y:y+vy*tt+ay*tt*tt/2,vx:rnd(-20,20)*k,vy:rnd(-10,20)*k,ay:60*k,drag:1.2,sway:30*k,vr:rnd(-3,3),rot:rnd(0,6.28),life:rnd(1.5,2.2),size:rnd(5,8)*k,color:pick(c)}),.15);
  },
  ignite:(x,y,c,n,k)=>{
    add({kind:'glow',x,y,vx:0,vy:0,life:.6,size:34*k,grow:.4,color:'#ff9d3a',alpha:.8});
    add({kind:'ring',x,y,vx:0,vy:0,life:.6,size:12*k,grow:2.8,width:3*k,color:'#ffb347'});
    PRESETS.sparks(x,y,['#ffe1a3','#ff9d3a','#ff6a14'],n,k*1.2);
    // Embers keep rising from the seat for a while after.
    emit(1.5,.03,()=>{const a=rnd(0,6.283),d=rnd(0,16)*k;add({kind:'glow',x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,vx:rnd(-15,15)*k,vy:rnd(-140,-60)*k,drag:.4,sway:24*k,life:rnd(1.2,2),size:rnd(2,4)*k,color:pick(c)});},.1);
  },
  depart:(x,y,c,n,k,r,extra)=>{
    ghostRise(r,extra);
    add({kind:'ring',x,y,vx:0,vy:0,life:.8,size:12*k,grow:2.2,width:2*k,color:c[0]});
    emit(1.4,.06,()=>add({kind:'wisp',x:x+rnd(-14,14)*k,y:y+rnd(-6,8)*k,vx:rnd(-6,6)*k,vy:rnd(-60,-28)*k,drag:.3,sway:18*k,life:rnd(1.3,2),size:rnd(2.4,4)*k,grow:.5,color:pick(c),alpha:.7}));
  },
};
// Plays an effect centred on an element. Colours come from the decoration that caused it; `extra` carries the
// player's picture or name for the effects that show it.
export function playOn(el,preset,colors,scale,extra){
  if(!el||!PRESETS[preset]||!layer())return;
  const r=el.getBoundingClientRect();if(!r.width)return;
  const k=scale??Math.max(.6,Math.min(1.4,r.width/48)),n=count=>Math.max(1,Math.round(count*quality));
  PRESETS[preset](r.left+r.width/2,r.top+r.height/2,colors,n,k,r,extra);start();
}
// Light motes rising through an area, for dawn.
export function motes(el,colors=['#ffe7b0','#f6cf7a']){
  if(!el||!layer())return;const r=el.getBoundingClientRect();if(!r.width)return;
  for(let i=0;i<Math.round(34*quality);i++){const a=rnd(0,6.283),d=Math.sqrt(Math.random())*r.width*.42;
    add({kind:'glow',x:r.left+r.width/2+Math.cos(a)*d,y:r.top+r.height/2+Math.sin(a)*d,vx:rnd(-6,6),vy:rnd(-38,-14),sway:10,life:rnd(1.2,2.2),size:rnd(1.8,3.4),color:pick(colors),alpha:.85});}
  start();
}
