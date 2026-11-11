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
test('sustained load, background stalls and recovery never silently reduce resolution',()=>{
 for(const mobile of [false,true]){const b=createRenderBudget({mobile});for(const frameMs of [16.67,33.3,50,3000])for(let i=0;i<2000;i++){assert.equal(b.sample(frameMs),false);assert.equal(b.scale,1);}b.reset();assert.equal(b.scale,1);}
});
