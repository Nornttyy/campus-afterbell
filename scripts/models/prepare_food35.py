"""Prepare user-selected Tripo food props; keep the downloaded originals intact.

Run with Blender --background --factory-startup --python this_file -- [kind...].
The game uses metres, Y up and front labels toward +Z (Blender -Y).
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-source/tripo-props-20261107'
QA = SOURCE / 'food-qa'
OUT = ROOT / 'dist/assets/models'
SETTINGS = {
    'burger': {'dimensions': (.2159, .2129, .1409), 'triangles': 14000, 'texture': 2048, 'yaw': 0},
    'drink': {'dimensions': (.0880, .0904, .1756), 'triangles': 5000, 'texture': 1024, 'yaw': 0},
    'snack': {'dimensions': (.1721, .0560, .2090), 'triangles': 6500, 'texture': 2048, 'yaw': 0},
}

def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.get('prop_source')]

def bounds(objects):
    pts = [o.matrix_world @ Vector(p) for o in objects for p in o.bound_box]
    lo = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    return lo, hi

def metric(objects):
    lo, hi = bounds(objects)
    triangles = sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    images={n.image for o in objects for mat in o.data.materials if mat and mat.use_nodes
            for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
    return {'triangles': triangles, 'meshes': len(objects), 'vertices': sum(len(o.data.vertices) for o in objects),
            'blenderBounds': [list(lo), list(hi)], 'dimensionsXYZBlender': list(hi-lo),
            'textures': [{'name': im.name, 'size': list(im.size)} for im in sorted(images,key=lambda im: im.name)],
            'uvLayers': {o.name: len(o.data.uv_layers) for o in objects}}

def aim(o, point):
    o.rotation_euler = (Vector(point)-o.location).to_track_quat('-Z', 'Y').to_euler()

def setup_render(objects):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('Neutral inspection world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.55, .55, .55, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .65
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    lo, hi = bounds(objects)
    extent = max(hi-lo)
    for loc, power, size in [((.28,-.32,.45), 12, .35), ((-.32,-.15,.18), 4, .30), ((.18,.3,.3), 8, .25)]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
        aim(lamp, (0,0,0))
    bpy.ops.object.camera_add(location=(extent*1.75,-extent*2.6,extent*1.4))
    camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=extent*1.6
    aim(camera, (0,0,0));scene.camera=camera
    return camera, extent

def render(path):
    bpy.context.scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)

def bake_reduced_surface(kind, high, low, resolution, extent):
    """Reproject source colour/detail so collapsed UV edges cannot crease the bun."""
    scene=bpy.context.scene
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True);bpy.context.view_layer.objects.active=low
    for uv in list(low.data.uv_layers):low.data.uv_layers.remove(uv)
    low.data.uv_layers.new(name='GameUV')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008)
    bpy.ops.object.mode_set(mode='OBJECT')
    material=bpy.data.materials.new(kind+' baked source surface')
    material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links
    shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.83
    low.data.materials.clear();low.data.materials.append(material)
    colour=bpy.data.images.new(kind+' source colour',width=resolution,height=resolution,alpha=False)
    colour_node=nodes.new('ShaderNodeTexImage');colour_node.image=colour
    normal=bpy.data.images.new(kind+' source normal',width=1024,height=1024,alpha=False)
    normal.colorspace_settings.name='Non-Color'
    normal_node=nodes.new('ShaderNodeTexImage');normal_node.image=normal
    roughness=bpy.data.images.new(kind+' source roughness',width=1024,height=1024,alpha=False)
    roughness.colorspace_settings.name='Non-Color'
    roughness_node=nodes.new('ShaderNodeTexImage');roughness_node.image=roughness
    scene.cycles.samples=8
    scene.render.bake.use_selected_to_active=True
    scene.render.bake.cage_extrusion=extent*.012
    scene.render.bake.max_ray_distance=extent*.03
    scene.render.bake.margin=12
    scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False
    scene.render.bake.use_pass_color=True
    high.hide_render=False;high.hide_set(False);high.select_set(True)
    nodes.active=colour_node
    bpy.ops.object.bake(type='DIFFUSE')
    nodes.active=normal_node
    bpy.ops.object.bake(type='NORMAL')
    nodes.active=roughness_node
    bpy.ops.object.bake(type='ROUGHNESS')
    links.new(colour_node.outputs['Color'],shader.inputs['Base Color'])
    normal_map=nodes.new('ShaderNodeNormalMap');normal_map.inputs['Strength'].default_value=.75
    links.new(normal_node.outputs['Color'],normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'],shader.inputs['Normal'])
    links.new(roughness_node.outputs['Color'],shader.inputs['Roughness'])
    for image,suffix in [(colour,'color'),(normal,'normal'),(roughness,'roughness')]:
        ext='jpg' if image==colour else 'png'
        image.filepath_raw=str(QA/f'{kind}-baked-{suffix}.{ext}')
        image.file_format='JPEG' if image==colour else 'PNG';image.save();image.pack()
    high.hide_render=True;high.hide_set(True);high.select_set(False)
    scene.render.bake.use_selected_to_active=False;scene.cycles.samples=24

def prepare(kind):
    config=SETTINGS[kind]
    source=SOURCE/f'{kind}-original.glb'
    if not source.exists():
        print(f'SKIP {kind}: source not downloaded', flush=True)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in objects:
        o['prop_source']=True
        o.name=f'{kind}_surface'
    source_info=metric(objects)
    # Importer already translates glTF Y-up into Blender Z-up. Bake that result.
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo,hi=bounds(objects);mid=(lo+hi)*.5
    scale=min(a/b for a,b in zip(config['dimensions'], hi-lo))
    for o in objects:
        for v in o.data.vertices:v.co=(v.co-mid)*scale
        o.data.update()
        o.rotation_euler.z=config['yaw']
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    camera,extent=setup_render(objects)
    render(QA/f'{kind}-source.png')
    total=source_info['triangles']
    for o in objects:
        bpy.context.view_layer.objects.active=o
        if total>config['triangles']*1.05:
            high=o.copy();high.data=o.data.copy();bpy.context.collection.objects.link(high)
            high.name=kind+'_immutable_bake_source';high['prop_source']=False
            high.hide_render=True;high.hide_set(True)
            # glTF duplicates vertices on UV/normal seams. Weld coincident positions
            # before reducing, otherwise each side collapses separately and cracks.
            bm=bmesh.new();bm.from_mesh(o.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=extent*.000003)
            bm.to_mesh(o.data);bm.free();o.data.update()
            dec=o.modifiers.new('Game silhouette reduction','DECIMATE')
            dec.ratio=config['triangles']/total
            dec.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=dec.name)
        for poly in o.data.polygons:poly.use_smooth=True
        if total>config['triangles']*1.05:
            bake_reduced_surface(kind, high, o, config['texture'], extent)
    for im in bpy.data.images:
        if im.type=='IMAGE' and max(im.size)>config['texture']:
            ratio=config['texture']/max(im.size)
            im.scale(round(im.size[0]*ratio),round(im.size[1]*ratio))
    final=metric(objects)
    render(QA/f'{kind}-game.png')
    camera.location=(0,-extent*3,0);aim(camera,(0,0,0))
    render(QA/f'{kind}-front.png')
    camera.location=(extent*3,0,0);aim(camera,(0,0,0))
    render(QA/f'{kind}-side.png')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    target=OUT/f'{kind}-v1.glb'
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=False, export_extras=False, export_image_format='AUTO')
    bpy.ops.wm.save_as_mainfile(filepath=str(QA/f'{kind}-game.blend'))
    record={'kind':kind,'source':str(source.relative_to(ROOT)),'game':str(target.relative_to(ROOT)),
        'normalization':'Uniform fit within target bounds, centered, +Y up/+Z front in game',
        'sourceMetrics':source_info,'gameMetrics':final,'bytes':target.stat().st_size}
    (QA/f'{kind}-report.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps(record), flush=True)

QA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SETTINGS)
for kind in args:prepare(kind)
