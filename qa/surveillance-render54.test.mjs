import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createSurveillanceView} from '../dist/surveillance-view54.js';

const snapshot=(smokes=[])=>({map:'classroom',status:'playing',stage:'class',role:'teacher',smokes,surveillance:{viewing:'front',devices:[{id:'front'}]}});
function fixture(options={}){
 const priorDocument=globalThis.document,elements=[],scene=new T.Scene();
 globalThis.document={body:{append(){}},createElement(tag){const element={tag,style:{},setAttribute(){},append(){},remove(){this.removed=true;},getContext(){return{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){element.painted=true;}};}};elements.push(element);return element;}};
 const oldTarget=new T.WebGLRenderTarget(100,80);oldTarget.viewport.set(4,8,88,66);oldTarget.scissor.set(6,9,60,50);oldTarget.scissorTest=true;
 const renderer={target:oldTarget,face:2,mip:1,autoClear:false,xr:{enabled:true},toneMappingExposure:1.08,clearColor:new T.Color('#123456'),clearAlpha:.37,passes:[],viewportCalls:0,bufferQueries:0,
  getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},setRenderTarget(t,f=0,m=0){this.target=t;this.face=f;this.mip=m;},
  getDrawingBufferSize(v){this.bufferQueries++;return v.set(1920,1080);},setViewport(){this.viewportCalls++;throw Error('DPR-dependent viewport');},
  getClearColor(c){return c.copy(this.clearColor);},getClearAlpha(){return this.clearAlpha;},setClearColor(c,a=1){this.clearColor.set(c);this.clearAlpha=a;},clear(){},
  render(s,c){this.passes.push({scene:s,camera:c,target:this.target,w:this.target?.width,h:this.target?.height});if(this.failAt===this.passes.length)throw Error('render failed');},
  readRenderTargetPixels(t,x,y,w,h,p){assert.equal(w,384);assert.equal(h,216);p.fill(128);}
 };
 const view=createSurveillanceView(scene,renderer,options);
 return{scene,renderer,view,oldTarget,elements,dispose(){view.dispose();oldTarget.dispose();globalThis.document=priorDocument;}};
}

test('monitor frustum participates before the actor update, only on its 8fps frames',()=>{
 const f=fixture();try{
  const pupil=new T.Sphere(new T.Vector3(0,1,-2),.7),behind=new T.Sphere(new T.Vector3(-9,2,12),.1);
  f.view.prepare(snapshot(),0);assert.equal(f.view.intersectsSphere(pupil),true);assert.equal(f.view.intersectsSphere(behind),false);
  f.view.render(0);f.view.prepare(snapshot(),16);assert.equal(f.view.intersectsSphere(pupil),false);f.view.render(16);assert.equal(f.renderer.passes.length,2);
  f.view.prepare(snapshot(),125);assert.equal(f.view.intersectsSphere(pupil),true);f.view.render(125);assert.equal(f.renderer.passes.length,4);
  f.view.prepare({...snapshot(),role:'student'},250);assert.equal(f.view.intersectsSphere(pupil),false);
 }finally{f.dispose();}
});

test('physical low-resolution target preserves Retina framing, target viewport and renderer state',()=>{
 let active=false;const f=fixture({beforeRender(){active=true;return()=>{active=false;};}});try{
  f.view.prepare(snapshot(),0);f.view.render(0);
  assert.equal(f.renderer.viewportCalls,0);assert.equal(f.renderer.bufferQueries,0);
  assert.ok(f.renderer.passes.every(p=>p.w===384&&p.h===216));
  assert.equal(f.renderer.target,f.oldTarget);assert.equal(f.renderer.face,2);assert.equal(f.renderer.mip,1);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.xr.enabled,true);assert.equal(active,false);
  assert.deepEqual(f.oldTarget.viewport.toArray(),[4,8,88,66]);assert.deepEqual(f.oldTarget.scissor.toArray(),[6,9,60,50]);assert.equal(f.oldTarget.scissorTest,true);
  assert.equal(f.renderer.passes[0].target.texture.type,T.HalfFloatType,'scene must retain HDR before display encoding');
  assert.equal(f.renderer.passes[1].scene.children[0].material.uniforms.exposure.value,1.08);assert.ok(f.elements.find(e=>e.tag==='canvas').painted);
 }finally{f.dispose();}
});

test('monitor renders the actual depth-clipped smoke volumes using small dedicated buffers',()=>{
 const f=fixture();try{
  f.view.prepare(snapshot([{id:1,x:0,y:0,z:0,age:2,remaining:7,radius:2,density:1}]),0);f.view.render(0);
  const volumePass=f.renderer.passes.find(p=>p.scene.children.some(o=>o.material?.uniforms?.noiseField));assert.ok(volumePass,'raw scene pass alone would see through smoke');
  assert.deepEqual([volumePass.w,volumePass.h],[134,75]);assert.equal(f.renderer.bufferQueries,0);assert.ok(f.renderer.passes.every(p=>p.w<=384&&p.h<=216));
  const volume=volumePass.scene.children[0],depth=volume.material.uniforms.sceneDepth.value;assert.ok(depth.isDepthTexture);assert.equal(volume.material.uniforms.density.value,1);
  assert.equal(f.renderer.target,f.oldTarget);assert.equal(f.renderer.clearColor.getHexString(),'123456');assert.equal(f.renderer.clearAlpha,.37);
 }finally{f.dispose();}
});

test('failed smoke pass restores visibility, clear state, target and render hooks',()=>{
 let restored=false;const f=fixture({beforeRender:()=>()=>{restored=true;}});try{
  f.renderer.failAt=2;f.view.prepare(snapshot([{id:1,x:0,y:0,z:0,age:2,remaining:7,radius:2,density:1}]),0);
  assert.throws(()=>f.view.render(0),/render failed/);assert.ok(restored);assert.equal(f.renderer.target,f.oldTarget);assert.equal(f.renderer.face,2);assert.equal(f.renderer.mip,1);assert.equal(f.renderer.xr.enabled,true);assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.clearAlpha,.37);assert.equal(f.renderer.clearColor.getHexString(),'123456');
  assert.equal(f.scene.getObjectByName('classroom-surveillance').children[0].visible,true);
 }finally{f.dispose();}
});
