"""Repair only the old mouth crease and add the boy and girl reference-shaped static mouths.
Run with Blender --background --python; no scene imports or original-asset overwrites.
The original skin, clips, UVs, vertex weights and all non-face positions are retained.
New render meshes use the existing Head joint. Runtime does not resize the face.
"""
from pathlib import Path
import struct,json,math,tempfile
import bpy
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'art-source/student-mouth36';REPORT.mkdir(parents=True,exist_ok=True)
# The user owns the glasses-student replacement; never generate or edit it here.
SPECS=[('student-boy-v2','student-boy-v3','boy'),('student-girl-v2','student-girl-v3','girl')]
DTYPES={5126:np.dtype('<f4'),5125:np.dtype('<u4'),5123:np.dtype('<u2'),5121:np.dtype('u1')}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def feature(p):
 x=p[:,0];y=p[:,1]-.718;return np.column_stack((x*0+1,x,y,x*x,x*y,y*y,x*x*y,x**4))
def read_glb(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),bytearray(b[28+n:])
def write_glb(path,j,b):
 b.extend(b'\0'*((-len(b))%4));j['buffers'][0]['byteLength']=len(b);raw=json.dumps(j,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(b))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(b),0x004e4942)+b)
def read_acc(j,b,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];dt=DTYPES[a['componentType']];n=DIMS[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*n)
 return np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=off,strides=(stride,dt.itemsize)).copy()
def append_view(j,b,data,target=None):
 b.extend(b'\0'*((-len(b))%4));off=len(b);b.extend(data);v={'buffer':0,'byteOffset':off,'byteLength':len(data)}
 if target:v['target']=target
 j['bufferViews'].append(v);return len(j['bufferViews'])-1
def append_acc(j,b,a,kind,ctype=5126,target=34962):
 arr=np.asarray(a,dtype=DTYPES[ctype]);arr=arr.reshape((-1,DIMS[kind]));view=append_view(j,b,arr.tobytes(),target);v={'bufferView':view,'componentType':ctype,'count':len(arr),'type':kind}
 if kind=='VEC3':v.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
 j['accessors'].append(v);return len(j['accessors'])-1

def fix_image(j,b,imgindex,patches,tag):
 # Rasterize only UV triangles on the old smile. Sample clean skin immediately
 # above and below that smile, so warm baked cheek gradients remain continuous.
 img=j['images'][imgindex];view=j['bufferViews'][img['bufferView']];raw=bytes(b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);ext='.jpg' if img['mimeType']=='image/jpeg' else '.png'
 src=Path(tempfile.gettempdir())/(tag+'-source'+ext);src.write_bytes(raw);im=bpy.data.images.load(str(src),check_existing=False);w,h=im.size;pixels=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4);source=pixels.copy();changed=set()
 for positions,uv,triangles in patches:
  for inds in triangles:
   p=positions[inds];tuv=uv[inds];center=p.mean(axis=0)
   if not(abs(center[0])<.060 and .685<center[1]<.753 and center[2]>.100):continue
   # glTF UVs originate at the image top; bpy image.pixels starts at bottom.
   coords=np.column_stack((tuv[:,0]*w,(1-tuv[:,1])*h));lo=np.maximum(np.floor(coords.min(axis=0)).astype(int)-1,0);hi=np.minimum(np.ceil(coords.max(axis=0)).astype(int)+1,[w-1,h-1])
   if np.any(hi<lo) or (hi[0]-lo[0])*(hi[1]-lo[1])>w*h*.1:continue
   xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));points=np.column_stack((xx.ravel()+.5,yy.ravel()+.5));a,bp,c=coords;det=(bp[1]-c[1])*(a[0]-c[0])+(c[0]-bp[0])*(a[1]-c[1])
   if abs(det)<1e-8:continue
   u=((bp[1]-c[1])*(points[:,0]-c[0])+(c[0]-bp[0])*(points[:,1]-c[1]))/det;v=((c[1]-a[1])*(points[:,0]-c[0])+(a[0]-c[0])*(points[:,1]-c[1]))/det;q=1-u-v;inside=(u>=-.015)&(v>=-.015)&(q>=-.015);world=u[:,None]*p[0]+v[:,None]*p[1]+q[:,None]*p[2]
   rad=np.sqrt((world[:,0]/.038)**2+((world[:,1]-.719)/.016)**2);weight=1-smooth(.70,1,rad);mask=inside&(weight>0)&(world[:,2]>.100)
   if not mask.any():continue
   # Clean skin color is sampled by world-space projected coordinates from
   # the neighboring precomputed face, not a global uniform face recolour.
   coords2=points[mask].astype(int);wx=world[mask,0];wy=world[mask,1];weights=weight[mask]
   for (px,py),x,y,ww in zip(coords2,wx,wy,weights):
    target=skin_at(x,y);pixels[py,px,:3]=source[py,px,:3]*(1-ww)+target*ww;changed.add(py*w+px)
 im.pixels.foreach_set(pixels.ravel());im.update();out=Path(tempfile.gettempdir())/(tag+'-mouth-repaired'+ext);im.filepath_raw=str(out);im.file_format='JPEG' if ext=='.jpg' else 'PNG';im.save();data=out.read_bytes();img['bufferView']=append_view(j,b,data);bpy.data.images.remove(im);return len(changed)

for source_name,out_name,variant in SPECS:
 j,buffer=read_glb(ROOT/'dist/assets/models'/f'{source_name}.glb');original_bytes=len(buffer);records=[];patches_by_image={};changed_vertices=0
 # Existing runtime-coordinate sample rays are generated afresh below from
 # geometry triangles, with no change to any skin or animation metadata.
 for mesh in j['meshes']:
  for prim in mesh['primitives']:
   if 'TEXCOORD_0' not in prim['attributes']:continue
   positions=read_acc(j,buffer,prim['attributes']['POSITION']);normals=read_acc(j,buffer,prim['attributes']['NORMAL']);uv=read_acc(j,buffer,prim['attributes']['TEXCOORD_0']);triangles=read_acc(j,buffer,prim['indices']).reshape(-1,3)
   face=(np.abs(positions[:,0])<.07)&(positions[:,1]>.685)&(positions[:,1]<.750)&(positions[:,2]>.100)
   if face.sum()<12:continue
   rad=np.sqrt((positions[:,0]/.043)**2+((positions[:,1]-.719)/.024)**2);fit=face&(rad>.85)&(normals[:,2]>.5)
   if fit.sum()<12:continue
   coef=np.linalg.lstsq(feature(positions[fit]),positions[fit,2],rcond=None)[0]
   mask=face&(rad<1);weights=1-smooth(.65,1,rad[mask]);fixed=positions.copy();fixed[mask,2]=positions[mask,2]*(1-weights)+feature(positions[mask])@coef*weights
   # Recompute the normals only for vertices touching the edited region. UV
   # seams are unified by position for this local normal calculation.
   sums=np.zeros_like(fixed);a,bp,c=(fixed[triangles[:,k]] for k in range(3));fn=np.cross(bp-a,c-a)
   for k in range(3):np.add.at(sums,triangles[:,k],fn)
   touched=set(np.where(face&(rad<1.12))[0].tolist());groups={}
   for ix in touched:groups.setdefault(tuple(np.round(fixed[ix],6)),[]).append(ix)
   nn=normals.copy()
   for ids in groups.values():
    n=sums[ids].sum(axis=0);length=np.linalg.norm(n)
    if length>1e-10:nn[ids]=n/length
   prim['attributes']['POSITION']=append_acc(j,buffer,fixed,'VEC3');prim['attributes']['NORMAL']=append_acc(j,buffer,nn,'VEC3');changed_vertices+=int(mask.sum())
   mat=j['materials'][prim.get('material',0)];tex=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture')
   if tex:patches_by_image.setdefault(j['textures'][tex['index']]['source'],[]).append((positions,uv,triangles))
   records.append((positions,uv,triangles,prim.get('material',0),fixed,coef))
 assert records,'No mouth geometry found'
 # Gather surrounding source-skin colors using a BVH (world coordinates are
 # exactly glTF positions at rest for these preserved, normalized assets).
 from mathutils import Vector
 from mathutils.bvhtree import BVHTree
 from mathutils.geometry import barycentric_transform
 verts=[];faces=[];triuv=[];trimat=[];texture_arrays={}
 for positions,uv,triangles,mat,fixed,coef in records:
  off=len(verts);verts.extend([Vector(p) for p in positions]);faces.extend([tuple(off+int(i) for i in tri) for tri in triangles]);triuv.extend([[Vector((*uv[i],0)) for i in tri] for tri in triangles]);trimat.extend([mat]*len(triangles))
 for mat in set(trimat):
  tx=j['materials'][mat].get('pbrMetallicRoughness',{}).get('baseColorTexture')
  if not tx:continue
  imeta=j['images'][j['textures'][tx['index']]['source']];v=j['bufferViews'][imeta['bufferView']];raw=bytes(buffer[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);p=Path(tempfile.gettempdir())/f'{out_name}-{mat}.img';p.write_bytes(raw);im=bpy.data.images.load(str(p),check_existing=False);texture_arrays[mat]=(tuple(im.size),np.array(im.pixels[:],dtype=np.float32).reshape(im.size[1],im.size[0],4));bpy.data.images.remove(im)
 tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
 def sample(x,y):
  hit,n,ix,d=tree.ray_cast(Vector((float(x),float(y),1)),Vector((0,0,-1)),2)
  if hit is None:return np.array([.96,.71,.59])
  v=barycentric_transform(hit,*[verts[i] for i in faces[ix]],*triuv[ix]);(w,h),tex=texture_arrays[trimat[ix]];return tex[min(h-1,max(0,int((1-v.y)*h))),min(w-1,max(0,int(v.x*w))),:3]
 skin_cache={}
 def skin_at(x,y):
  key=round(float(x),3)
  if key not in skin_cache:
   def clean_samples(heights):
    samples=[sample(key,yy) for yy in heights]
    # Bulging eyes overlap some upper rays. Never copy white/black eye
    # texels into the original skin; preserve the nearby baked colour.
    return [c for c in samples if c[0]>c[1]*1.10 and c[0]>c[2]*1.22 and c[1]>.18]
   lows=clean_samples([.695,.698,.700,.702,.704]);low=np.mean(lows,axis=0) if lows else np.array([.96,.71,.59])
   highs=clean_samples([.731,.733,.735,.737]);high=np.mean(highs,axis=0) if highs else low
   skin_cache[key]=(low,high)
  low,high=skin_cache[key];a=float(np.clip((y-.700)/.034,0,1));return low*(1-a)+high*a
 pixel_count=sum(fix_image(j,buffer,image,patches,out_name+'-'+str(image)) for image,patches in patches_by_image.items())
 # The mouth follows the repaired surface, not an arbitrary flat billboard.
 repaired_vertices=[];repaired_faces=[]
 for positions,uv,triangles,mat,fixed,coef in records:
  start=len(repaired_vertices);repaired_vertices.extend([Vector(p) for p in fixed]);repaired_faces.extend([tuple(start+int(i) for i in tri) for tri in triangles])
 repaired_tree=BVHTree.FromPolygons(repaired_vertices,repaired_faces,all_triangles=True)
 def depth(x,y):
  p,n,index,distance=repaired_tree.ray_cast(Vector((float(x),float(y),1)),Vector((0,0,-1)),2)
  if p is None:raise ValueError('Mouth point does not meet repaired facial surface')
  return float(p.z)
 head=next(i for i,n in enumerate(j['skins'][0]['joints']) if j['nodes'][n].get('name','').endswith('Head'))
 def material(name,color):
  j['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':0,'roughnessFactor':.85},'doubleSided':True});return len(j['materials'])-1
 dark=material('Mouth warm interior' if variant=='boy' else 'Mouth warm line',[.11,.030,.022] if variant=='boy' else [.19,.045,.027])
 def add_mesh(name,coords,indices,mat):
  pos=np.array([[x,y,depth(x,y)+z] for x,y,z in coords],dtype=np.float32);idx=np.array(indices,dtype=np.uint16).reshape(-1,3);normal=np.zeros_like(pos)
  for tri in idx:
   a,bp,c=pos[tri];n=np.cross(bp-a,c-a)
   if n[2]<0:n=-n
   normal[tri]+=n
  normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-9)
  joints=np.zeros((len(pos),4),dtype=np.uint16);joints[:,0]=head;weights=np.zeros((len(pos),4),dtype=np.float32);weights[:,0]=1
  attrs={'POSITION':append_acc(j,buffer,pos,'VEC3'),'NORMAL':append_acc(j,buffer,normal,'VEC3'),'JOINTS_0':append_acc(j,buffer,joints,'VEC4',5123),'WEIGHTS_0':append_acc(j,buffer,weights,'VEC4')}
  mi=len(j['meshes']);j['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':append_acc(j,buffer,idx.ravel(),'SCALAR',5123,34963),'material':mat}]});ni=len(j['nodes']);j['nodes'].append({'name':name,'mesh':mi,'skin':0});root=j['scenes'][j.get('scene',0)]['nodes'][0];j['nodes'][root].setdefault('children',[]).append(ni);return {'name':name,'vertices':len(pos),'width':float(np.ptp(pos[:,0])),'height':float(np.ptp(pos[:,1])),'bounds':[pos.min(axis=0).tolist(),pos.max(axis=0).tolist()]}
 def ribbon(name,width,center,curve,thickness,mat,offset=.0012,segments=40):
  coords=[];indices=[]
  for i in range(segments+1):
   u=i/segments*2-1;x=u*width/2;cy=center+curve*(u*u);half=thickness/2*max(.08,math.sqrt(max(0,1-u*u)))
   coords.extend([(x,cy-half,offset),(x,cy+half,offset)])
   if i:indices.extend([(2*i-2,2*i,2*i-1),(2*i-1,2*i,2*i+1)])
  return add_mesh(name,coords,indices,mat)
 mouths=[]
 if variant=='boy':
  # Compact horizontal rounded opening. Most of the upper edge is level;
  # the corners turn downward only within their small rounded end caps.
  width=.052;height=.0115;center=.7185;coords=[];idx=[];N=48;ROWS=6
  radius=height/2;straight=width/2-radius
  def mouth_edges(x):
   edge=math.sqrt(max(0,radius*radius-max(0,abs(x)-straight)**2))
   return center-edge,center+edge
  for i in range(N+1):
   x=(i/N*2-1)*width/2;lower,upper=mouth_edges(x)
   for k in range(ROWS+1):coords.append((x,lower+(upper-lower)*k/ROWS,.0012))
   if i:
    for k in range(ROWS):
     a=(i-1)*(ROWS+1)+k;b=i*(ROWS+1)+k;idx.extend([(a,b,a+1),(a+1,b,b+1)])
  mouths.append(add_mesh('StudentMouth',coords,idx,dark));tooth=material('Small upper teeth',[.93,.89,.80]);coords=[];idx=[];N=32
  for i in range(N+1):
   x=(i/N*2-1)*width*.39;upper=mouth_edges(x)[1]-.0008;lower=upper-.0024;coords.extend([(x,lower,.00155),(x,upper,.00155)])
   if i:idx.extend([(i*2-2,i*2,i*2-1),(i*2-1,i*2,i*2+1)])
  mouths.append(add_mesh('StudentUpperTeeth',coords,idx,tooth))
 elif variant=='girl':mouths.append(ribbon('StudentMouth',.044,.721,-.0032,.0019,dark))

 j.setdefault('asset',{}).setdefault('extras',{})['mouthRevision']={'revision':36,'source':source_name,'profile':variant,'mouths':mouths,'changedVertices':changed_vertices,'changedTexels':pixel_count,'preservedClips':[a['name'] for a in j.get('animations',[])]}
 out=ROOT/'dist/assets/models'/f'{out_name}.glb';write_glb(out,j,buffer);report={'source':source_name,'output':out_name,'bytes':out.stat().st_size,'sourceBufferBytes':original_bytes,**j['asset']['extras']['mouthRevision']};(REPORT/(out_name+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
