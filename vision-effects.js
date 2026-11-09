const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const x=clamp(n);return x*x*(3-2*x);};
const positive=(n,fallback)=>Number.isFinite(n)&&n>0?n:fallback;
const remaining=(n,duration)=>Number.isFinite(n)?clamp(n,0,duration):0;

// Timers belong to the simulation: pause, restart and low frame rates cannot
// run a second independent effect clock. Seven seconds is only the fallback.
export function visionEffectState(snapshot){
  const p=snapshot?.player||{},flashDuration=positive(p.flashDuration,7),inkDuration=positive(p.inkDuration,7);
  const flashLeft=remaining(p.flashLeft,flashDuration),inkLeft=remaining(p.inkLeft,inkDuration);
  const strength=Number.isFinite(p.flashStrength)?clamp(p.flashStrength):1;
  const bubbleLeft=Number.isFinite(p.bubbleLeft)?Math.max(0,p.bubbleLeft):0,bubbleSize=Number.isFinite(p.bubbleSize)?clamp(p.bubbleSize):0;
  return{
    flashAlpha:flashLeft>0&&strength>0?1:0,
    inkAlpha:inkLeft>0?smooth(inkLeft/Math.min(2,inkDuration)):0,
    inkAge:inkLeft>0?Math.max(0,inkDuration-inkLeft):0,
    gumAlpha:bubbleLeft>0?smooth(bubbleLeft/1.2):0,
    gumKind:p.bubbleKind==='orange'?'orange':'pink',
    gumSize:bubbleLeft>0?bubbleSize:0,
  };
}

const DRIPS=[
  {x:-.60,y:.22,length:.72,width:.021},
  {x:-.34,y:.44,length:.67,width:.033},
  {x:.07,y:.46,length:.77,width:.026},
  {x:.38,y:.29,length:.73,width:.038},
  {x:.62,y:.12,length:.59,width:.017},
];
const SPLASHES=[[-.94,-.52,.060,.030,-.65],[-1.02,.13,.032,.075,.3],[-.87,.62,.048,.035,.6],[-.54,-.96,.033,.060,.15],[-.27,-1.05,.019,.034,-.2],[.34,-.94,.052,.025,-.7],[.80,-.69,.076,.033,-.6],[.99,-.32,.038,.027,-.3],[1.06,.25,.023,.042,.2],[.89,.57,.044,.024,.8],[.70,.91,.024,.053,-.3],[-.74,.87,.015,.029,.1]];
const CONTOUR=Array.from({length:48},(_,i)=>{
  const a=i*Math.PI*2/48,r=.76+.13*Math.sin(a*3+.6)+.085*Math.sin(a*7+1.4)+.035*Math.sin(a*13+.7);
  return[Math.cos(a)*r,Math.sin(a)*r];
});
function closeCurve(c,points){
  const last=points.at(-1),first=points[0];c.beginPath();c.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  points.forEach((p,i)=>{const next=points[(i+1)%points.length];c.quadraticCurveTo(p[0],p[1],(p[0]+next[0])/2,(p[1]+next[1])/2);});c.closePath();
}
function inInkSpace(c,w,h){c.translate(w*.50,h*.45);c.scale(w*.36,h*.33);}
function paintInk(c,w,h){
  c.clearRect(0,0,w,h);c.save();inInkSpace(c,w,h);
  // The silhouette and satellite drops are authored once, not random particles
  // regenerated each frame. The outer 10%+ of the screen remains unobscured.
  const wet=c.createRadialGradient(-.22,-.28,.04,0,0,1.08);
  wet.addColorStop(0,'#172027');wet.addColorStop(.36,'#05080b');wet.addColorStop(.82,'#020405');wet.addColorStop(1,'#11191e');
  c.fillStyle=wet;closeCurve(c,CONTOUR);c.fill();
  c.strokeStyle='rgba(59,76,86,.52)';c.lineWidth=.009;c.stroke();
  c.fillStyle='#060a0d';
  // Broad, connected tongues give the impact a direction rather than a star.
  for(const [x,y,sx,sy,rotation]of SPLASHES){c.beginPath();c.ellipse(x,y,sx,sy,rotation,0,Math.PI*2);c.fill();}
  c.beginPath();c.moveTo(-.56,-.38);c.bezierCurveTo(-.73,-.42,-.89,-.65,-.99,-.71);c.bezierCurveTo(-.86,-.70,-.67,-.54,-.50,-.53);c.closePath();c.fill();
  c.beginPath();c.moveTo(.45,-.48);c.bezierCurveTo(.57,-.61,.72,-.67,.82,-.76);c.bezierCurveTo(.76,-.58,.64,-.42,.57,-.37);c.closePath();c.fill();
  c.beginPath();c.moveTo(.58,.24);c.bezierCurveTo(.77,.28,.87,.41,.98,.45);c.bezierCurveTo(.78,.43,.65,.36,.52,.33);c.closePath();c.fill();
  // Small interrupted specular traces read as wet ink, without a grey film.
  c.strokeStyle='rgba(156,177,187,.28)';c.lineWidth=.010;c.lineCap='round';
  c.beginPath();c.moveTo(-.62,-.25);c.bezierCurveTo(-.67,-.39,-.56,-.52,-.44,-.54);c.stroke();
  c.strokeStyle='rgba(143,167,179,.18)';c.lineWidth=.006;c.beginPath();c.moveTo(.16,-.70);c.bezierCurveTo(.28,-.74,.38,-.64,.42,-.56);c.stroke();
  c.beginPath();c.moveTo(.65,.02);c.bezierCurveTo(.72,.09,.70,.18,.65,.22);c.stroke();c.restore();
}
function paintDrips(c,w,h,age){
  const growth=.26+.74*(1-Math.exp(-age*1.35));c.save();inInkSpace(c,w,h);
  for(const d of DRIPS){
    const end=d.y+d.length*growth,sway=d.width*.30;
    c.fillStyle='#05090c';c.beginPath();c.moveTo(d.x-d.width,d.y);
    c.bezierCurveTo(d.x-d.width*.60,d.y+.16,d.x+sway-d.width*.34,end-.07,d.x+sway-d.width*.45,end);
    c.bezierCurveTo(d.x+sway-d.width*.8,end+.035,d.x+sway+d.width*.9,end+.04,d.x+sway+d.width*.55,end);
    c.bezierCurveTo(d.x+d.width*.28,end-.13,d.x+d.width*.55,d.y+.14,d.x+d.width,d.y);c.closePath();c.fill();
    c.strokeStyle='rgba(110,141,157,.25)';c.lineWidth=.004;c.beginPath();c.moveTo(d.x-d.width*.45,d.y+.05);c.bezierCurveTo(d.x-d.width*.35,d.y+.16,d.x+sway-d.width*.15,end-.13,d.x+sway-d.width*.15,end-.055);c.stroke();
  }
  c.restore();
}

function paintGum(c,w,h,size,alpha,kind='pink'){
  c.save();c.globalAlpha=alpha;c.translate(w*.5,h*.48);
  const radius=Math.min(w,h)*.63;c.scale(radius*1.18,radius);
  const body=c.createRadialGradient(-.28,-.35,.06,0,0,1.12);
  const colours=kind==='orange'?['rgba(255,221,141,.88)','rgba(255,173,64,.96)','rgba(241,139,35,.99)','rgba(255,211,123,.84)']:['rgba(255,201,227,.88)','rgba(246,140,190,.96)','rgba(235,110,171,.99)','rgba(255,183,216,.84)'];[0,.48,.82,1].forEach((stop,i)=>body.addColorStop(stop,colours[i]));
  c.fillStyle=body;c.beginPath();c.ellipse(0,0,1,1,0,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,218,238,.95)';c.lineWidth=.018;c.stroke();
  c.fillStyle='rgba(255,244,251,.7)';c.beginPath();c.ellipse(-.36,-.48,.14,.26,-.6,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(255,238,248,.5)';c.beginPath();c.ellipse(-.55,-.12,.045,.08,-.2,0,Math.PI*2);c.fill();c.restore();
}

export function createVisionEffects(host){
  const doc=host.ownerDocument||document,win=doc.defaultView||globalThis.window;
  const canvas=doc.createElement('canvas'),ink=doc.createElement('canvas'),c=canvas.getContext('2d'),inkContext=ink.getContext('2d');
  canvas.className='vision-effects';canvas.setAttribute('aria-hidden','true');canvas.tabIndex=-1;canvas.hidden=true;
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',userSelect:'none',zIndex:'7'});
  host.appendChild(canvas);
  let alive=true,width=0,height=0,ratio=1,lastKey='',state=visionEffectState(null);
  function resize(){
    if(!alive||!c||!inkContext)return false;
    const rect=host.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    const r=Math.min(1.5,positive(win?.devicePixelRatio,1),1600/Math.max(w,h));
    if(w===width&&h===height&&r===ratio)return false;
    width=w;height=h;ratio=r;canvas.width=ink.width=Math.max(1,Math.round(w*r));canvas.height=ink.height=Math.max(1,Math.round(h*r));
    c.setTransform(r,0,0,r,0,0);inkContext.setTransform(r,0,0,r,0,0);paintInk(inkContext,w,h);lastKey='';return true;
  }
  function draw(){
    if(!alive||!c||!inkContext)return;
    const dripAge=Math.floor(state.inkAge*24)/24,key=[width,height,state.flashAlpha.toFixed(4),state.inkAlpha.toFixed(4),state.gumAlpha.toFixed(4),state.gumSize.toFixed(4),state.gumKind,dripAge].join('|');
    if(key===lastKey)return;lastKey=key;c.clearRect(0,0,width,height);
    canvas.hidden=state.inkAlpha<=0&&state.flashAlpha<=0&&state.gumAlpha<=0;
    // A confirmed flash is opaque and covers the game HUD as well as the world.
    // Ink/gum retain their normal scene layer. Input and simulation keep running.
    canvas.style.zIndex=state.flashAlpha>0?'2147483646':'7';
    if(canvas.hidden)return;
    if(state.inkAlpha>0){c.globalAlpha=state.inkAlpha;c.drawImage(ink,0,0,width,height);paintDrips(c,width,height,dripAge);}
    if(state.gumAlpha>0){paintGum(c,width,height,state.gumSize,state.gumAlpha,state.gumKind);}
    if(state.flashAlpha>0){c.globalAlpha=state.flashAlpha;c.fillStyle='#ffffff';c.fillRect(0,0,width,height);}
    c.globalAlpha=1;
  }
  const onResize=()=>{if(resize())draw();};
  const Observer=win?.ResizeObserver||globalThis.ResizeObserver,observer=Observer?new Observer(onResize):null;
  if(observer)observer.observe(host);else win?.addEventListener('resize',onResize);
  resize();
  return{
    update(snapshot){if(!alive)return;state=visionEffectState(snapshot);resize();draw();},
    dispose(){if(!alive)return;alive=false;observer?.disconnect();if(!observer)win?.removeEventListener('resize',onResize);canvas.remove();canvas.width=canvas.height=ink.width=ink.height=1;},
  };
}
