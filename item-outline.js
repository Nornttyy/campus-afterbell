import * as T from './vendor/three.module.js';

// Render only the selected object's silhouette, then draw a constant-width edge.
// The object geometry, materials and dimensions are never modified.
export function createItemOutline(renderer){
  const maskScene=new T.Scene(),screenScene=new T.Scene(),screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const mask=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
  const white=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,toneMapped:false});
  const material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{mask:{value:mask.texture},pixel:{value:new T.Vector2(1,1)}},vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`uniform sampler2D mask;uniform vec2 pixel;varying vec2 uv0;void main(){float center=texture2D(mask,uv0).r;float rim=0.;for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){rim=max(rim,texture2D(mask,uv0+vec2(float(x),float(y))*pixel).r);}}float alpha=(1.-center)*rim;if(alpha<.01)discard;gl_FragColor=vec4(.61,.86,1.,alpha*.95);}`});
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);screenScene.add(quad);
  let selected=null,pairs=[];const size=new T.Vector2(),clearColor=new T.Color();
  function select(object){
    if(selected===object)return;selected=object;maskScene.clear();pairs=[];
    if(object)object.traverse(o=>{let excluded=false;for(let p=o;p&&p!==object;p=p.parent)if(p.name==='player-drawer-items'||(!p.visible&&!p.userData.rigidInstanceSource))excluded=true;if(o.isMesh&&(o.visible||o.userData.rigidInstanceSource)&&!excluded){const proxy=new T.Mesh(o.geometry,white);proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;maskScene.add(proxy);pairs.push([o,proxy]);}});
  }
  function render(camera){
    if(!selected||!pairs.length)return;
    renderer.getSize(size);if(mask.width!==size.x||mask.height!==size.y){mask.setSize(size.x,size.y);material.uniforms.pixel.value.set(1/size.x,1/size.y);}
    for(const [source,proxy] of pairs){source.updateWorldMatrix(true,false);proxy.matrix.copy(source.matrixWorld);}
    const previous=renderer.getRenderTarget(),auto=renderer.autoClear,alpha=renderer.getClearAlpha();renderer.getClearColor(clearColor);
    renderer.setRenderTarget(mask);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(maskScene,camera);
    renderer.setRenderTarget(previous);renderer.setClearColor(clearColor,alpha);renderer.autoClear=false;renderer.render(screenScene,screenCamera);renderer.autoClear=auto;
  }
  return{select,render,dispose(){mask.dispose();white.dispose();material.dispose();quad.geometry.dispose();}};
}
