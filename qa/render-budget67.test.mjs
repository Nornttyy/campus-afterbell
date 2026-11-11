import test from 'node:test';
import assert from 'node:assert/strict';
import {prefersMobileRendering,initialQuality,renderPixelRatio,createRenderBudget} from '../dist/render-budget67.js';
test('touch phones default to smooth mode while explicit choices and mouse desktops survive',()=>{
 const mobile=prefersMobileRendering({coarse:true,hover:false,touchPoints:5});
 assert.equal(mobile,true);assert.equal(initialQuality(undefined,mobile),'low');
 assert.equal(initialQuality('high',mobile),'high');assert.equal(initialQuality('low',false),'low');
 assert.equal(prefersMobileRendering({coarse:false,hover:true,touchPoints:10}),false);
 assert.equal(initialQuality(undefined,false),'high');
});
test('portrait, landscape and high-DPI displays stay within pixel budgets',()=>{
 for(const mobile of [true,false])for(const [width,height]of[[390,844],[844,390],[2560,1440],[3840,2160]])for(const quality of ['low','high']){
  const ratio=renderPixelRatio({width,height,dpr:3,quality,mobile});
  assert.ok(width*height*ratio*ratio<=(mobile?1100000:3600000)+1);
  assert.ok(ratio<=(quality==='low'?1:1.6));
 }
});
test('sustained load adapts gradually; brief stalls, background and fast desktops do not',()=>{
 const b=createRenderBudget({mobile:true});
 for(let i=0;i<200;i++)b.sample(16.67);
 b.sample(3000);assert.equal(b.scale,1);
 for(let i=0;i<50;i++)b.sample(50,{active:false});assert.equal(b.scale,1);
 for(let i=0;i<70;i++)b.sample(33.3);assert.equal(b.scale,.92);
 for(let i=0;i<2000;i++)b.sample(33.3);assert.equal(b.scale,.72);
 for(let i=0;i<100;i++)b.sample(16.67);assert.equal(b.scale,.72,'must not bounce resolution every second');
 for(let i=0;i<4000;i++)b.sample(16.67);assert.equal(b.scale,.96);
 for(let i=0;i<1000;i++)b.sample(16.67);assert.equal(b.scale,1);
 const desktop=createRenderBudget();for(let i=0;i<2000;i++)desktop.sample(50);assert.equal(desktop.scale,1);
});
