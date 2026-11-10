"""Reduce shipping GLB primitives only; preserve original rigs, animation and image bytes.
Blender --background --factory-startup --python scripts/models/reduce_runtime64.py
Zero-weight boundary/hand/eye vertices are locked by Blender's collapse decimator.
The glTF coordinate system is not converted: only mesh attribute buffers are grafted.
"""
import bpy, bmesh, json, struct, math, hashlib, copy, argparse, sys
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'dist/assets/models'; WORK=ROOT/'art-source/mesh-budget64'; WORK.mkdir(exist_ok=True)
FILES=['student-boy-v4','student-girl-v4','student-glasses-v2','student-ponytail-v1','teacher-v2','hand-left-v3','hand-right-v3','teacher-hand-left-v1','teacher-hand-right-v1','snack-v1','drink-v1','burger-v1','ink-v1','banana-v1','garlic-v1','desk-v2','chair-v2']
COMP={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
def sha(b):return hashlib.sha256(b).hexdigest()
def values(j,b,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];fmt,size=COMP[a['componentType']];width=WIDTH[a['type']];stride=v.get('byteStride',width*size);start=v.get('byteOffset',0)+a.get('byteOffset',0)
 rows=[struct.unpack_from('<'+fmt*width,b,start+i*stride)for i in range(a['count'])]
 if a.get('normalized'):
  d={5120:127,5121:255,5122:32767,5123:65535}[a['componentType']];rows=[tuple(max(-1,x/d)for x in row)for row in rows]
 return rows

def append(j,b,rows,kind,component=5126,bounds=False):
 width=WIDTH[kind];fmt,size=COMP[component];pad=(-len(b))%4;b.extend(bytes(pad));off=len(b)
 flat=[c for row in rows for c in row];b.extend(struct.pack('<'+fmt*len(flat),*flat));vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(flat)*size})
 a={'bufferView':vi,'componentType':component,'count':len(rows),'type':kind}
 if bounds:a.update(min=[min(row[k]for row in rows)for k in range(width)],max=[max(row[k]for row in rows)for k in range(width)])
 ai=len(j['accessors']);j['accessors'].append(a);return ai

def write(path,j,b):
 b.extend(bytes((-len(b))%4));j['buffers'][0]['byteLength']=len(b);t=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();t+=b' '*((-len(t))%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(t)+len(b))+struct.pack('<II',len(t),0x4e4f534a)+t+struct.pack('<II',len(b),0x004e4942)+b)
def count(j):return sum(j['accessors'][p['indices']]['count']//3 for m in j.get('meshes',[])for p in m['primitives'])
def worldmat(j,node):
 parents={c:i for i,n in enumerate(j['nodes'])for c in n.get('children',[])}
 def m(i):
  n=j['nodes'][i]
  if 'matrix'in n:x=Matrix([n['matrix'][v:v+4]for v in range(0,16,4)]).transposed()
  else:
   q=n.get('rotation',[0,0,0,1]);x=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),Vector(n.get('scale',[1,1,1])))
  return m(parents[i])@x if i in parents else x
 return m(node)

def reduce(j,b,mi,pi,budget):
 primitive=j['meshes'][mi]['primitives'][pi]
 if primitive.get('targets'):raise RuntimeError('Morph targets require a matching reduction pass; refusing to remove them')
 atts={k:values(j,b,v)for k,v in primitive['attributes'].items()};inds=[v[0]for v in values(j,b,primitive['indices'])];triangles=len(inds)//3
 if triangles<=budget:return {'before':triangles,'after':triangles,'locked':0}
 bpy.ops.wm.read_factory_settings(use_empty=True)
 me=bpy.data.meshes.new('SourceLocalPrimitive');me.from_pydata(atts['POSITION'],[],[inds[i:i+3]for i in range(0,len(inds),3)]);me.update();o=bpy.data.objects.new('SourceLocalPrimitive',me);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
 for p in me.polygons:p.use_smooth=True
 for key,rows in atts.items():
  if key.startswith('TEXCOORD'):
   layer=me.uv_layers.new(name=key)
   for loop in me.loops:layer.data[loop.index].uv=rows[loop.vertex_index]
 if 'NORMAL'in atts:me.normals_split_custom_set_from_vertices(atts['NORMAL'])
 nodeidx=next(i for i,n in enumerate(j['nodes'])if n.get('mesh')==mi);node=j['nodes'][nodeidx];world=worldmat(j,nodeidx)
 joints=[]
 if 'JOINTS_0'in atts:
  joints=j['skins'][node['skin']]['joints'];joint_names=[j['nodes'][i].get('name','')for i in joints]
  for i in range(len(joints)):o.vertex_groups.new(name='Joint'+str(i))
  for vi,(js,ws)in enumerate(zip(atts['JOINTS_0'],atts['WEIGHTS_0'])):
   for idx,w in zip(js,ws):
    if w>0:o.vertex_groups[idx].add([vi],w,'REPLACE')
 hand_locked=set();face_locked=set();locked=set();group=o.vertex_groups.new(name='ReducibleSurface')
 # Keep exact fingertips and visible eye/nose/mouth surface, bias the rest of
 # the hand toward preservation. Welding redundant glTF seam vertices first
 # lets the decimator preserve a continuous body instead of treating UV seams
 # as separate pieces. UVs remain per-corner and are not merged.
 tip_limits={}
 if joints:
  for ji,jname in enumerate(joint_names):
   if 'Hand' in jname and jname.endswith('3'):
    nodeworld=worldmat(j,joints[ji]);origin=nodeworld.translation
    parent=next((i for i,n in enumerate(j['nodes'])if joints[ji]in n.get('children',[])),None)
    if parent is None:continue
    axis=(origin-worldmat(j,parent).translation).normalized()
    projections=[(world@Vector(p)-origin).dot(axis) for p,js,ws in zip(atts['POSITION'],atts['JOINTS_0'],atts['WEIGHTS_0'])if any(k==ji and w>.5 for k,w in zip(js,ws))]
    if projections:tip_limits[ji]=(origin,axis,max(projections)*.15)
 for vi,pos in enumerate(atts['POSITION']):
  weight=1.
  if joints:
   js,ws=atts['JOINTS_0'][vi],atts['WEIGHTS_0'][vi];wp=world@Vector(pos)
   if any(w>.1 and 'Hand' in joint_names[idx] for idx,w in zip(js,ws)):weight=.15
   if any(w>.6 and 'Head' in joint_names[idx] for idx,w in zip(js,ws)) and wp.z>.14 and wp.y>1.18 and abs(wp.x)<.19:weight=.12
   for ji,(origin,axis,limit)in tip_limits.items():
    if js[max(range(4),key=lambda k:ws[k])]==ji:locked.add(vi);hand_locked.add(vi)
   # Eye surfaces use spatially masked runtime gaze. Preserve their shape.
   if wp.z>.205 and 1.365<wp.y<1.52 and abs(wp.x)<.185:locked.add(vi);face_locked.add(vi)
  if vi not in locked:group.add([vi],weight,'REPLACE')
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.to_mesh(me);bm.free();me.update()
 # Pin true topological boundaries after seam welding, not duplicate UV verts.
 bm=bmesh.new();bm.from_mesh(me);boundary={v.index for e in bm.edges if e.is_boundary for v in e.verts};bm.free()
 if boundary:group.remove(list(boundary))
 mod=o.modifiers.new('ProtectFaceHandsAndUVBoundaries','DECIMATE');mod.ratio=max(.001,budget/triangles);mod.use_collapse_triangulate=True;mod.vertex_group=group.name;mod.vertex_group_factor=.001
 bpy.ops.object.modifier_apply(modifier=mod.name);me=o.data;me.calc_loop_triangles()
 if len(me.loop_triangles)>budget:
  raise RuntimeError(f'{mi}/{pi}: {len(me.loop_triangles)} exceeds {budget}; locks {len(locked)}, hands {len(hand_locked)}, face {len(face_locked)}')
 # Preserve source corner normals/UVs through the modifier; split output only
 # where a UV or normal seam requires it. Joint indices use the original skin.
 result={k:[]for k in primitive['attributes']};newindices=[];seen={}
 source_min=[min(p[k]for p in atts['POSITION'])for k in range(3)];source_max=[max(p[k]for p in atts['POSITION'])for k in range(3)]
 uv={k:me.uv_layers[k]for k in atts if k.startswith('TEXCOORD')};normals=me.corner_normals
 for tri in me.loop_triangles:
  for li in tri.loops:
   vi=me.loops[li].vertex_index;v=me.vertices[vi];row={'POSITION':tuple(max(source_min[k],min(source_max[k],v.co[k]))for k in range(3))}
   if 'NORMAL'in atts:row['NORMAL']=tuple(normals[li].vector)
   for k,layer in uv.items():row[k]=tuple(layer.data[li].uv)
   if joints:
    weights=sorted([(g.group,g.weight)for g in v.groups if g.group<len(joints) and g.weight>0],key=lambda x:x[1],reverse=True)[:4]
    total=sum(w for _,w in weights);weights+=[(0,0)]*(4-len(weights));row['JOINTS_0']=tuple(i for i,_ in weights);row['WEIGHTS_0']=tuple(w/total for _,w in weights)
   missing=set(result)-set(row)
   if missing:raise RuntimeError('Unsupported attributes '+str(missing))
   key=tuple(c for k in result for c in row[k]);idx=seen.get(key)
   if idx is None:
    idx=len(seen);seen[key]=idx
    for k in result:result[k].append(row[k])
   newindices.append((idx,))
 for key,rows in result.items():
  primitive['attributes'][key]=append(j,b,rows,'VEC'+str(len(rows[0])),5123 if key.startswith('JOINTS')else 5126,bounds=key=='POSITION')
 primitive['indices']=append(j,b,newindices,'SCALAR',5125 if len(seen)>65535 else 5123)
 return {'before':triangles,'after':len(newindices)//3,'locked':len(locked),'handsLocked':len(hand_locked),'faceLocked':len(face_locked),'vertices':len(seen)}

def main():
 args=sys.argv[sys.argv.index('--')+1:]if '--'in sys.argv else[];names=args or FILES;report=[]
 for name in names:
  filename=name+'.glb';path=DEST/filename;backup=WORK/'originals'/filename;backup.parent.mkdir(exist_ok=True)
  if not backup.exists():backup.write_bytes(path.read_bytes())
  j,b=read(backup);before=count(j);parts=[]
  if before>8000:
   target=7900
   for mi,m in enumerate(j['meshes']):
    for pi,p in enumerate(m['primitives']):
     n=j['accessors'][p['indices']]['count']//3;parts.append(reduce(j,b,mi,pi,max(1,math.floor(target*n/before))))
   assert count(j)<=8000
   write(path,j,b)
  report.append({'file':filename,'beforeTriangles':before,'afterTriangles':count(j),'sourceSha256':sha(backup.read_bytes()),'outputSha256':sha(path.read_bytes()),'unchanged':before<=8000,'parts':parts})
  print(json.dumps(report[-1]),flush=True)
  (WORK/'report-partial.json').write_text(json.dumps(report,indent=2))
 (WORK/'report.json').write_text(json.dumps({'maxTriangles':8000,'assets':report},indent=2))
if __name__=='__main__':main()
