"""Prepare the user-selected Tripo ink bottle, retaining the original download.

Run: Blender --background --factory-startup --python this_file -- inspect|export
Game coordinates are metres, +Y up and +Z front; Blender uses +Z up/-Y front.
"""
import bpy, bmesh, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art-source/tripo-props-20261107/ink-original.glb'
QA=SOURCE.parent/'ink-qa'
OUT=ROOT/'dist/assets/models/ink-v1.glb'
QA.mkdir(parents=True,exist_ok=True)

def bounds(objects):
    pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    return Vector(tuple(min(v[i] for v in pts) for i in range(3))),Vector(tuple(max(v[i] for v in pts) for i in range(3)))

def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def render_setup(objects):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=880;scene.render.resolution_y=880;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.world=bpy.data.worlds.new('Ink inspection world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.58,.6,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
    lo,hi=bounds(objects);center=(lo+hi)/2;ext=max(hi-lo)
    for delta,power,size in [((1,-1.5,2.5),120,2),((-2,-1,1),60,2),((1,2,2),100,2)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(delta)*ext)
        lamp=bpy.context.object;lamp.data.energy=power*ext*ext;lamp.data.size=size*ext;aim(lamp,center)
    bpy.ops.object.camera_add(location=center+Vector((1.6,-2.7,1.3))*ext)
    cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=ext*1.45;aim(cam,center);scene.camera=cam
    return cam,center,ext

def render(name):
    bpy.context.scene.render.filepath=str(QA/name);bpy.ops.render.render(write_still=True)

def load(path=SOURCE):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return obj

def components(obj):
    bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
    seen=set();parts=[]
    for v in bm.verts:
        if v.index in seen:continue
        todo=[v];seen.add(v.index);ids=[]
        while todo:
            q=todo.pop();ids.append(q.index)
            for e in q.link_edges:
                other=e.other_vert(q)
                if other.index not in seen:seen.add(other.index);todo.append(other)
        lo=[min(bm.verts[i].co[a] for i in ids) for a in range(3)];hi=[max(bm.verts[i].co[a] for i in ids) for a in range(3)]
        parts.append({'count':len(ids),'bounds':[lo,hi],'first':ids[0]})
    bm.free();return sorted(parts,key=lambda p:-p['count'])

def inspect():
    obj=load();parts=components(obj);(QA/'source-components.json').write_text(json.dumps(parts,indent=2))
    lo,hi=bounds([obj]);print('SOURCE',len(obj.data.vertices),len(obj.data.polygons),list(lo),list(hi),parts[:10],flush=True)
    cam,center,ext=render_setup([obj]);render('source-perspective.png')
    cam.location=center+Vector((0,-3,.2))*ext;aim(cam,center);render('source-front.png')
    cam.location=center+Vector((3,0,.2))*ext;aim(cam,center);render('source-side.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(QA/'source-inspection.blend'))

def weld_inspect():
    obj=load();bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000003)
    bm.to_mesh(obj.data);bm.free();parts=components(obj)
    (QA/'welded-components.json').write_text(json.dumps(parts,indent=2));print('WELDED COMPONENTS',parts[:30],flush=True)

def export():
    obj=load();original_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000003)
    bm.verts.ensure_lookup_table();seen=set();groups=[]
    for v in bm.verts:
        if v.index in seen:continue
        group=[];todo=[v];seen.add(v.index)
        while todo:
            q=todo.pop();group.append(q)
            for edge in q.link_edges:
                other=edge.other_vert(q)
                if other.index not in seen:seen.add(other.index);todo.append(other)
        groups.append(group)
    # The physical bottle is the sole component with its neck above .40.
    bottle=[g for g in groups if max(v.co.z for v in g)>.40]
    assert len(bottle)==1 and len(groups)==2, 'Source topology changed; do not crop blindly.'
    removed=[v for g in groups if g is not bottle[0] for v in g]
    removed_count=len(removed);bmesh.ops.delete(bm,geom=removed,context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    lo,hi=bounds([obj]);center=(lo+hi)/2
    source_dimensions=hi-lo;factor=min(a/b for a,b in zip((.094,.0975,.1575),source_dimensions))
    for v in obj.data.vertices:v.co=(v.co-center)*factor
    obj.data.update();obj.name='InkBottle';obj.data.name='InkBottle_source_surface'
    source_bottle_triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
    cam,center,ext=render_setup([obj]);render('bottle-clean-source.png')
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    mod=obj.modifiers.new('Game geometry reduction','DECIMATE');mod.ratio=9000/source_bottle_triangles
    mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in obj.data.polygons:p.use_smooth=True
    for im in list(bpy.data.images):
        if im.type!='IMAGE' or not im.size[0]:continue
        if max(im.size)>1024:im.scale(round(im.size[0]*1024/max(im.size)),round(im.size[1]*1024/max(im.size)))
        im.filepath_raw=str(QA/(im.name.replace('.jpg','').replace('.png','')+'-game.png'))
        im.file_format='PNG';im.save();im.pack()
    obj['asset_source']='Tripo 02f1a12b-a8be-48e2-97e7-d3808a9bc660'
    obj['quill_removed']=True
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_apply=True,
        export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    render('ink-game-perspective.png')
    cam.location=center+Vector((0,-3,.15))*ext;aim(cam,center);render('ink-game-front.png')
    cam.location=center+Vector((3,0,.15))*ext;aim(cam,center);render('ink-game-side.png')
    cam.location=center+Vector((0,3,.15))*ext;aim(cam,center);render('ink-game-back.png')
    lo,hi=bounds([obj]);dim=hi-lo
    report={'source':str(SOURCE.relative_to(ROOT)),'originalTriangles':original_triangles,
            'bottleSourceTriangles':source_bottle_triangles,'quillVerticesRemoved':removed_count,
            'gameTriangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'vertices':len(obj.data.vertices),
            'gameDimensionsXYZ':[dim.x,dim.z,dim.y],
            'gameBounds':[[-dim.x/2,-dim.z/2,-dim.y/2],[dim.x/2,dim.z/2,dim.y/2]],
            'uvLayers':len(obj.data.uv_layers),'textures':[{'name':im.name,'size':list(im.size)} for im in bpy.data.images if im.type=='IMAGE'],
            'outputBytes':OUT.stat().st_size,'uniformScale':factor}
    (QA/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('FINAL',report,flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(QA/'ink-game-editable.blend'))

def validate_export():
    obj=load(OUT);render_setup([obj]);render('ink-export-reimported.png')
    lo,hi=bounds([obj]);print('REIMPORTED',len(obj.data.polygons),list(lo),list(hi),flush=True)

if __name__=='__main__':
    if sys.argv[-1]=='weld':weld_inspect()
    elif sys.argv[-1]=='export':export()
    elif sys.argv[-1]=='validate':validate_export()
    else:inspect()
