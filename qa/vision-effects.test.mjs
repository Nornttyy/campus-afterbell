import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionEffects,visionEffectState} from '../dist/vision-effects.js';

test('any confirmed flash is fully opaque until its authoritative timer expires',()=>{
 const sample=(left,duration=7,strength=1)=>visionEffectState({player:{flashLeft:left,flashDuration:duration,flashStrength:strength}}).flashAlpha;
 for(const left of [7,2.5,1.25,.01])assert.equal(sample(left),1);
 assert.equal(sample(0),0);assert.equal(sample(7,7,.4),1);assert.equal(sample(7,7,0),0);
});
test('ink keeps its full mask until the final two seconds, including nondefault durations',()=>{
  const sample=(left,duration=7)=>visionEffectState({player:{inkLeft:left,inkDuration:duration}});
  assert.equal(sample(7).inkAlpha,1);assert.equal(sample(2).inkAlpha,1);assert.equal(sample(1).inkAlpha,.5);assert.equal(sample(0).inkAlpha,0);
  assert.equal(sample(2,10).inkAlpha,1);assert.equal(sample(1,10).inkAlpha,.5);assert.equal(sample(.5,1).inkAlpha,.5);assert.equal(sample(3).inkAge,4);
});
test('empty, expired and malformed snapshots cannot produce invalid opacity or a permanent mask',()=>{
  assert.deepEqual(visionEffectState(null),{flashAlpha:0,inkAlpha:0,inkAge:0,gumAlpha:0,gumKind:'pink',gumSize:0});
  for(const player of [{},{flashLeft:NaN,inkLeft:Infinity},{flashLeft:-1,inkLeft:-2},{flashLeft:100,flashDuration:0,flashStrength:2,inkLeft:100,inkDuration:-2},{bubbleLeft:5,bubbleSize:'broken',bubbleKind:'broken'},{bubbleLeft:Infinity,bubbleSize:NaN}]){
    const s=visionEffectState({player});assert.ok(['pink','orange'].includes(s.gumKind));for(const [key,n] of Object.entries(s))if(key!=='gumKind')assert.ok(Number.isFinite(n));assert.ok(s.flashAlpha>=0&&s.flashAlpha<=1&&s.inkAlpha>=0&&s.inkAlpha<=1&&s.gumAlpha>=0&&s.gumAlpha<=1);
  }
});

function fixture({observe=true}={}){
  const canvases=[],observers=[],events=new Map();let w=1280,h=720;
  const win={devicePixelRatio:2,addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)};
  if(observe)win.ResizeObserver=class{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
  const doc={defaultView:win,createElement(){const calls=[],ctx=new Proxy({calls,globalAlpha:1,createRadialGradient:()=>({addColorStop(){}})},{get(target,key){if(key in target)return target[key];return(...args)=>calls.push({name:key,args,fill:target.fillStyle,alpha:target.globalAlpha});}});const canvas={style:{},attrs:{},hidden:false,width:0,height:0,getContext:()=>ctx,setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;},ctx};canvases.push(canvas);return canvas;}};
  const host={ownerDocument:doc,children:[],appendChild:c=>host.children.push(c),getBoundingClientRect:()=>({width:w,height:h})};
  return{host,canvases,observers,events,resize(x,y){w=x;h=y;if(observers.length)observers[0].fn();else events.get('resize')?.();}};
}
test('overlay stays below HUD, ignores input, caches its ink shape and freezes with snapshot time',()=>{
  const f=fixture(),effect=createVisionEffects(f.host),[canvas,ink]=f.canvases;
  assert.equal(f.host.children.length,1);assert.equal(canvas.style.zIndex,'7');assert.equal(canvas.style.pointerEvents,'none');assert.equal(canvas.tabIndex,-1);assert.equal(canvas.attrs['aria-hidden'],'true');assert.ok(canvas.width<=1600);
  const snapshot={player:{inkLeft:6,inkDuration:7}},inkCalls=ink.ctx.calls.length;
  effect.update(snapshot);assert.equal(canvas.hidden,false);const drawCalls=canvas.ctx.calls.length;
  effect.update(snapshot);assert.equal(canvas.ctx.calls.length,drawCalls,'same paused time repainted or animated');
  effect.update({player:{inkLeft:5,inkDuration:7}});assert.equal(ink.ctx.calls.length,inkCalls,'ink silhouette was rebuilt each frame');
  assert.ok(!canvas.ctx.calls.some(c=>c.name==='fillRect'),'ink painted a full-screen solid rectangle');
  effect.update(null);assert.equal(canvas.hidden,true);effect.dispose();assert.equal(canvas.removed,true);assert.equal(f.observers[0].disconnected,true);assert.equal(ink.width,1);
  const afterDispose=canvas.ctx.calls.length;effect.update(snapshot);effect.dispose();assert.equal(canvas.ctx.calls.length,afterDispose);
});
test('white flash composes over ink, resizing redraws only once and fallback listeners are removed',()=>{
  const f=fixture({observe:false}),effect=createVisionEffects(f.host),[canvas,ink]=f.canvases;
  effect.update({player:{flashLeft:7,flashDuration:7,inkLeft:7,inkDuration:7}});
  const painted=canvas.ctx.calls.filter(c=>['drawImage','fillRect'].includes(c.name));assert.deepEqual(painted.map(c=>c.name),['drawImage','fillRect']);assert.equal(painted[1].fill,'#ffffff');assert.equal(painted[1].alpha,1);assert.equal(canvas.style.zIndex,'2147483646');effect.update({player:{inkLeft:7,inkDuration:7}});assert.equal(canvas.style.zIndex,'7');
  const count=ink.ctx.calls.length;f.resize(640,800);assert.ok(ink.ctx.calls.length>count);const resizedCount=ink.ctx.calls.length;f.resize(640,800);assert.equal(ink.ctx.calls.length,resizedCount);
  assert.equal(f.events.size,1);effect.dispose();assert.equal(f.events.size,0);
});

// Head-attached bubbles have a fixed size; the server timer determines duration.
test('attached gum uses the server remaining time and expires cleanly',()=>{
 const small=visionEffectState({player:{bubbleLeft:3,bubbleSize:.2}}),large=visionEffectState({player:{bubbleLeft:9,bubbleSize:1}});assert.equal(small.gumAlpha,1);assert.equal(large.gumAlpha,1);assert.ok(large.gumSize>small.gumSize);assert.equal(visionEffectState({player:{bubbleLeft:0,bubbleSize:1}}).gumAlpha,0);
 const f=fixture(),effect=createVisionEffects(f.host),[canvas]=f.canvases;const snapshot={player:{bubbleLeft:5,bubbleSize:.7}};effect.update(snapshot);assert.equal(canvas.hidden,false);assert.ok(canvas.ctx.calls.some(c=>c.name==='ellipse'));const count=canvas.ctx.calls.length;effect.update(snapshot);assert.equal(canvas.ctx.calls.length,count);effect.update(null);assert.equal(canvas.hidden,true);effect.dispose();
});

test('head-attached gum has a fixed screen footprint regardless of charge',()=>{
 const f=fixture(),effect=createVisionEffects(f.host),[canvas]=f.canvases;effect.update({player:{bubbleLeft:3,bubbleSize:.1}});const small=canvas.ctx.calls.filter(c=>c.name==='scale').at(-1).args;
 effect.update({player:{bubbleLeft:9,bubbleSize:1}});const large=canvas.ctx.calls.filter(c=>c.name==='scale').at(-1).args;assert.deepEqual(large,small);effect.dispose();
});
