"""Prepare the user-selected static toilet; keep the original and 2K PBR maps."""
import bpy,bmesh,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'art-source/toilet78/originals/toilet.glb'
OUT=ROOT/'dist/assets/models/toilet-v78.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
obs=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in obs:o.select_set(True)
bpy.context.view_layer.objects.active=obs[0]
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
def tris():return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in obs)
before=tris();scale=.35/.46
for o in obs:
 o.name='toilet-porcelain78'
 for v in o.data.vertices:
  v.co*=scale
  v.co.y+=.116667 # game Z -= .116667; bowl centre matches the seat anchor
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.to_mesh(o.data);bm.free()
 if before>7900:
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Preserve silhouette within prop budget','DECIMATE');mod.ratio=7800/before;mod.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.update()
lowest=min(v.co.z for o in obs for v in o.data.vertices)
for o in obs:
 for v in o.data.vertices:v.co.z-=lowest
if tris()>8000:raise RuntimeError('Triangle budget exceeded')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=False,export_extras=False,export_yup=True)
verts=[(v.co.x,v.co.z,-v.co.y) for o in obs for v in o.data.vertices]
r={'source':'https://studio.tripo3d.ai/3d-model/生成一个白色的简化的马桶厚厚圆圆的结构-结构简单-马桶盖打开的状态-马桶盖子与水箱中间没有缝隙紧挨在一起-没有多余结构-f2842f08-a1c5-4762-bd8c-666cfd112948','sourceSHA256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'sourceTriangles':before,'triangles':tris(),'outputSHA256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'min':[min(v[k] for v in verts) for k in range(3)],'max':[max(v[k] for v in verts) for k in range(3)],'scale':scale,'translationZ':-.116667,'textures':'Original 2K PBR unchanged','bytes':OUT.stat().st_size}
(ROOT/'docs/toilet-model78.json').write_text(json.dumps(r,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(r),flush=True)
