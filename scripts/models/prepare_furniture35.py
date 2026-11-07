"""Prepare the user-selected Tripo desk/chair; immutable source, authored movable tray.
Run with Blender 5.2 --background --python scripts/models/prepare_furniture35.py.
Original UV/color/normal/roughness are preserved. Only straight metal legs shorten;
top, seat, back and all rounded edge thicknesses keep uniform proportions.
"""
import bpy, bmesh, json, math
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'art-source/tripo-props-20261107/desk-chair-original.glb'
QA=ROOT/'art-source/tripo-props-20261107/furniture-qa';QA.mkdir(parents=True,exist_ok=True)
DEST=ROOT/'dist/assets/models'

def activate(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def bounds(o):
 return [[min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)] for i in range(3)]

def simplify(o,n):
 activate(o);m=o.modifiers.new('SilhouettePreservingReduction','DECIMATE');m.ratio=min(1,n/len(o.data.polygons));m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True

def paint(name,color,metal=.05,rough=.48):
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough;return m

def box(name,location,dimensions,mat,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.dimensions=dimensions;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(mat)
 m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=3;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True
 m=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name);return o

def tube(name,points,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,v in zip(s.bezier_points,points):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);activate(o);bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return o

def join(objects,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;o.location=(0,0,0);return o

def export(objects,path):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=88,export_animations=False,export_extras=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
source=next(o for o in bpy.context.scene.objects if o.type=='MESH');activate(source);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
originalFaces=len(source.data.polygons)
# Imported mesh is split at atlas seams. Weld positions while keeping per-loop UVs.
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000002);bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
parts=sorted([o for o in bpy.context.scene.objects if o.type=='MESH'],key=lambda o:-len(o.data.polygons));assert len(parts)==3, 'Source topology changed'
body,chair,front=parts
body.name='DeskBody';chair.name='ChairBody';front.name='DeskDrawerSourceFront'
# First simplify full source pieces, retaining continuous silhouettes and UV data.
simplify(body,16500);simplify(chair,9000);simplify(front,2400)
mat=body.active_material;mat.name='TripoFurnitureOriginalPBR'
# Strip the fixed closed shell by geometry + original blue painted-metal colour.
# This avoids cutting legs that intersect the source tray region.
me=body.data;co=np.array([v.co[:] for v in me.vertices]);iv=np.array([p.vertices[:] for p in me.polygons]);cent=co[iv].mean(1)
uv=np.array([p.uv[:] for p in me.uv_layers.active.data]).reshape(-1,3,2).mean(1)
base=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and 'basecolor' in n.image.name)
w,h=base.size;pix=np.array(base.pixels[:]).reshape(h,w,4);ix=(uv[:,0]*w).astype(int).clip(0,w-1);iy=(uv[:,1]*h).astype(int).clip(0,h-1);rgb=pix[iy,ix,:3]
inside=(np.abs(cent[:,0])<.357)&(cent[:,2]>.598)&(cent[:,2]<.738)
painted=(rgb[:,2]-rgb[:,0]>.043)&(cent[:,2]>.590)&(cent[:,2]<.741)
remove=np.flatnonzero(inside|painted)
bm=bmesh.new();bm.from_mesh(me);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[int(i)] for i in remove],context='FACES')
# Seal resulting underside and tiny seam loops; retain all real legs and source top.
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
edges=[e for e in bm.edges if e.is_boundary]
if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
# Independent thin curved front surface from the source solid front component.
bm=bmesh.new();bm.from_mesh(front.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,.072,0),plane_no=(0,1,0),clear_inner=True)
edges=[e for e in bm.edges if e.is_boundary]
if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(front.data);bm.free()
# Uniform wooden top scale to 1.20 m; shorten only its straight support section.
s=1.2/(.4459838569164276*2);tableCenterY=(-.4874877631664276+.14314264059066772)/2
delta=.7879638671875*s-.875
for o in (body,front):
 for v in o.data.vertices:
  x,y,z=v.co;v.co=(x*s,(y-tableCenterY)*s,z*s-delta*max(0,min(1,(z-.28)/.24)))
# Chair panel widths and cross-sections keep uniform scale; shorten straight legs.
cs=.56/(.2753600776195526+.2525939643383026);cx=(.2753600776195526-.2525939643383026)/2
cy=(-.1275787502527237+.3841552138328552)/2
cdelta=.4829730689525604*cs-.44
for v in chair.data.vertices:
 x,y,z=v.co;v.co=((x-cx)*cs,(y-cy)*cs,z*cs-cdelta*max(0,min(1,(z-.13)/.23)))
# Ground the chair's actual lowest foot. Compensate seat height by measured bottom.
czmin=min(v.co.z for v in chair.data.vertices)
for v in chair.data.vertices:v.co.z-=czmin
# Source front panel stays original PBR. Matching interior contains visible loot.
traymat=paint('TrayInteriorPaint',(.34,.37,.47),.12,.49)
handleMat=paint('DrawerHandleRubber',(.022,.027,.036),.05,.5)
railMat=paint('DrawerSlideMetal',(.38,.42,.46),.65,.34)
frontBounds=bounds(front);floor=.653;rear=-.310;faceY=frontBounds[1][1]
tray=[front]
tray += [box('DrawerFloor',(0,(rear+faceY-.016)/2,floor),(.970,faceY-.016-rear,.012),traymat,.006)]
for side in [-1,1]:
 tray.append(box('DrawerSide',(side*.480,(rear+faceY-.027)/2,.728),(.012,faceY-.027-rear,.15),traymat,.005))
tray.append(box('DrawerBack',(0,rear,.728),(.970,.012,.15),traymat,.005))
# Black U pull in the user-facing (-Z in Three) direction.
tray.append(tube('DrawerPull',[(-.13,faceY+.002,.758),(-.13,faceY+.047,.724),(.13,faceY+.047,.724),(.13,faceY+.002,.758)],.011,handleMat))
front=join(tray,'DeskDrawer')
for side in [-1,1]:
 rail=box('SlideRail',(side*.493,-.01,.753),(.010,.54,.027),railMat,.002)
 body=join([body,rail],'DeskBody')
# Resize only delivery textures; no texture repaint or de-light. Source stays 4K.
textures=[]
for image in bpy.data.images:
 if image.type=='IMAGE' and image.size[0]>2048:
  image.scale(2048,2048)
 if image.type=='IMAGE' and image.size[0]:textures.append({'name':image.name,'width':image.size[0],'height':image.size[1]})
for o in [body,chair,front]:
 o['source']='Tripo ad24e92f-f337-41b6-9258-2e1c265ae351';o['preparedVersion']=35
 o['sharedTextureSet']='TripoFurnitureOriginalPBR'
 o.data.update()
front['openingAxis']='Three -Z';front['travel']=.24;front['interiorFloorY']=floor+.006
report={'sourceTriangles':originalFaces,'removedFixedShellFaces':len(remove),'deskScale':s,'deskStraightLegShortening':delta,'chairUniformScale':cs,'chairStraightLegShortening':cdelta,'chairGroundAdjustment':czmin,'interiorFloorY':floor+.006,'textures':textures,'parts':{}}
for o in [body,front,chair]:
 b=bounds(o);o.data.calc_loop_triangles();report['parts'][o.name]={'triangles':len(o.data.loop_triangles),'blenderBounds':b,'threeBounds':[b[0],b[2],[-b[1][1],-b[1][0]]],'uvLayers':len(o.data.uv_layers)}
export([body,front],DEST/'desk-v2.glb');export([chair],DEST/'chair-v2.glb')
# Proof render uses the actual prepared assets, original PBR, neutral lighting.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1300;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('InspectionWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.6,.65,.72,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.55
for loc,power,size in [((2,-3,5),450,4),((-3,2,3),300,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=size
chair.location.y=.72
bpy.ops.object.camera_add(location=(2.0,2.5,1.8));c=bpy.context.object;c.rotation_euler=(Vector((0,.20,.53))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=2.1;scene.camera=c;scene.view_settings.view_transform='AgX'
scene.render.filepath=str(QA/'prepared-closed.png');bpy.ops.render.render(write_still=True)
front.location.y=.24
scene.render.filepath=str(QA/'prepared-open.png');bpy.ops.render.render(write_still=True)
chair.hide_render=True;c.location=(.7,1.7,1.55);c.rotation_euler=(Vector((0,.18,.62))-c.location).to_track_quat('-Z','Y').to_euler();c.data.ortho_scale=1.65
scene.render.filepath=str(QA/'prepared-drawer.png');bpy.ops.render.render(write_still=True)
chair.hide_render=False;front.location.y=0;chair.location.y=0
bpy.ops.wm.save_as_mainfile(filepath=str(QA/'furniture35-editable.blend'))
(QA/'prepared-report.json').write_text(json.dumps(report,indent=2));print('REPORT',json.dumps(report),flush=True)
