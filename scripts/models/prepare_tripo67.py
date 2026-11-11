"""Calibrate new user-created static props. Originals stay immutable.
Blender --background --factory-startup --python scripts/models/prepare_tripo67.py
Only these new static exports are processed; character/hand rigs are untouched.
"""
import bpy,bmesh,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'art-source/tripo67/originals';OUT=ROOT/'dist/assets/models';REPORT=ROOT/'art-source/tripo67/prepared';REPORT.mkdir(exist_ok=True)
# Dimension selected for UNIFORM normalization; no per-axis stretching.
CONFIG={
 'phone':('upright',1,.208,'center',1024),
 'mouse':('table',2,.145,'floor',512),
 'keyboard':('table',0,.58,'floor',1024),
 'computer-tower':('upright',1,.50,'floor',512),
 'gum':('upright',0,.13,'center',512),
 'lunch':('lid',0,.22,'center',512),
 'pen':('upright',1,.175,'center',512),
 'cabinet':('upright',1,1.1475,'floor',1024),
 'office-desk':('back',1,.985,'floor',1024),
 'office-chair':('upright',1,1.09,'floor',1024),
 'monitor':('back',0,.66,'floor',1024),
}
def triangles(obs):return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in obs)
def game(v):return Vector((v.x,v.z,-v.y))
def blender(v):return Vector((v.x,-v.z,v.y))
def orient(v,mode):
 x,y,z=v
 if mode=='table':return Vector((-x,z,y))
 if mode=='lid':return Vector((y,z,x))
 if mode=='back':return Vector((-x,y,-z))
 return v

def prepare(name):
 source=SRC/(name+'.glb')
 if not source.exists():return
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];before=triangles(obs)
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 mode,axis,length,pivot,tex=CONFIG[name]
 verts=[orient(game(v.co),mode) for o in obs for v in o.data.vertices]
 lo=Vector([min(v[i] for v in verts) for i in range(3)]);hi=Vector([max(v[i] for v in verts) for i in range(3)]);size=hi-lo;center=(lo+hi)*.5
 if pivot=='floor':center.y=lo.y
 scale=length/size[axis]
 for o in obs:
  o.name=name+'-surface'
  for v in o.data.vertices:v.co=blender((orient(game(v.co),mode)-center)*scale)
  o.data.update()
 # Preserve original per-corner UVs; weld duplicate glTF seam positions before
 # decimation so neighbouring surfaces do not crack apart. No texture rebake.
 if before>7900:
  for o in obs:
   bpy.context.view_layer.objects.active=o
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=length*1e-6);bm.to_mesh(o.data);bm.free();o.data.update()
   mod=o.modifiers.new('New static prop mobile budget','DECIMATE');mod.ratio=7800/before;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 if name=='office-desk':
  # Preserve the actual textured central drawer front as a separate rigid part.
  # Its new parent slides; the desk body stays fixed. No duplicate closed front.
  o=obs[0];bm=bmesh.new();bm.from_mesh(o.data)
  chosen=[]
  for face in bm.faces:
   c=game(face.calc_center_median())
   if -.82<c.x<.30 and .695<c.y<.905 and c.z<-.37:chosen.append(face)
  if len(chosen)<8:raise RuntimeError('Could not isolate office drawer front')
  for face in bm.faces:face.select=face in chosen
  bm.to_mesh(o.data);bm.free()
  bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_mode(type='FACE');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
  front=next(x for x in bpy.context.scene.objects if x.type=='MESH' and x!=o);front.name='office-desk-drawer-front';o.name='office-desk-body';obs=[o,front]
 if triangles(obs)>8000:raise RuntimeError(name+' exceeded 8000 triangle limit')
 # Decimation can remove the lowest source vertex. Re-seat the finished mesh
 # after simplification rather than preserving a tiny empty gap under it.
 if pivot=='floor':
  bottom=min(v.co.z for o in obs for v in o.data.vertices)
  for o in obs:
   for v in o.data.vertices:v.co.z-=bottom
   o.data.update()
 for image in bpy.data.images:
  if image.type=='IMAGE' and max(image.size)>tex:
   ratio=tex/max(image.size);image.scale(round(image.size[0]*ratio),round(image.size[1]*ratio));image.pack()
 for o in obs:
  for m in o.data.materials:
   if not m or not m.use_nodes:continue
   shader=m.node_tree.nodes.get('Principled BSDF')
   if shader and not shader.inputs['Roughness'].is_linked:shader.inputs['Roughness'].default_value=.64 if name in ('phone','mouse','monitor','keyboard','computer-tower','pen') else .78
 target=OUT/(name+'-v67.glb');bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=False,export_image_format='AUTO')
 final=[game(o.matrix_world@v.co) for o in obs for v in o.data.vertices];flo=[min(v[i] for v in final) for i in range(3)];fhi=[max(v[i] for v in final) for i in range(3)]
 report=dict(name=name,source=str(source.relative_to(ROOT)),sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),output=str(target.relative_to(ROOT)),sourceTriangles=before,triangles=triangles(obs),gameMin=flo,gameMax=fhi,dimensions=[b-a for a,b in zip(flo,fhi)],textureLimit=tex,orientation=mode,pivot=pivot,uniformScale=scale,bytes=target.stat().st_size)
 (REPORT/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(CONFIG)
for name in args:prepare(name)
