"""Crop actual source palms with a short forearm. Preserve v2 grip coordinates.

Only writes v3 GLBs and art-source/firstperson48. Existing body/hand-v2 assets
are untouched. Texture colours are preserved; no scene-light baking.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import prepare_characters40 as source
from prepare_characters40 import *
REVIEW=ROOT/'art-source/firstperson48'
REVIEW.mkdir(parents=True,exist_ok=True)
source.REVIEW=REVIEW

def export_forearms():
 # New source skin only. UVs remain on the original image; the cap uses the
 # skin-side boundary UVs and actual wrist vertices, not a hidden full body.
 ch=Character('boy');ch.reset();source=ch.meshes[0];reports=[];outdir=REVIEW;outdir.mkdir(parents=True,exist_ok=True)
 for side in ['Left','Right']:
  wrist=ch.heads[side+'Hand'];frame=ch.frames[side]['quaternion'].to_matrix().to_4x4();transform=frame.inverted()@Matrix.Translation(-wrist)
  m=source.copy();m.data=source.data.copy();m.animation_data_clear();ch.scene.collection.objects.link(m);m.parent=None;m.matrix_world=Matrix.Identity(4);m.name=side+'PalmAndForearm'
  # Sample existing diffuse colours only for the newly built wrist cap.
  # Original hand faces retain the original UV material, never this bake.
  for mod in list(m.modifiers):m.modifiers.remove(mod)
  baked=m.data.color_attributes.new(name='CapSkin',type='FLOAT_COLOR',domain='CORNER');m.data.color_attributes.active_color=baked
  for o in ch.scene.objects:o.select_set(o==m)
  bpy.context.view_layer.objects.active=m;ch.scene.render.engine='CYCLES';ch.scene.cycles.samples=1;ch.scene.render.bake.target='VERTEX_COLORS'
  bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},target='VERTEX_COLORS')
  capmat=bpy.data.materials.new(side+'WristSkin');capmat.use_nodes=True;principled=capmat.node_tree.nodes.get('Principled BSDF');principled.inputs['Roughness'].default_value=.9;color_node=capmat.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='CapSkin';capmat.node_tree.links.new(color_node.outputs['Color'],principled.inputs['Base Color']);cap_index=len(m.data.materials);m.data.materials.append(capmat)
  world=source.matrix_world.copy();bm=bmesh.new();bm.from_mesh(m.data);deform=bm.verts.layers.deform.active;uv=bm.loops.layers.uv.active;colors=bm.loops.layers.float_color.get('CapSkin')
  # A generous wrist-centred sphere excludes the torso and opposite hand.
  distal=[ch.heads[n] for n in ch.heads if n.startswith(side+'Hand')];radius=max((p-wrist).length for p in distal)+.055
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if (world@v.co-wrist).length>radius],context='VERTS')
  for v in bm.verts:v.co=transform@(world@v.co)
  cut=-.070
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=vec((0,cut,0)),plane_no=vec((0,1,0)),clear_inner=True)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002)
  # Keep the palm component; disconnected cuff remnants cannot become fingers.
  unseen=set(bm.verts);parts=[]
  while unseen:
   first=unseen.pop();part={first};todo=[first]
   while todo:
    v=todo.pop()
    for e in v.link_edges:
     other=e.other_vert(v)
     if other in unseen:unseen.remove(other);part.add(other);todo.append(other)
   parts.append(part)
  if not parts:raise RuntimeError('Palm crop empty '+side)
  largest=max(parts,key=len);bmesh.ops.delete(bm,geom=[v for p in parts if p is not largest for v in p],context='VERTS')
  hand_group=m.vertex_groups[ch.bones[side+'Hand'].name]
  root_group=m.vertex_groups[ch.bones[side+'ForeArm'].name];root_id=root_group.index
  # Original skin and finger weights remain. Only the fresh cut edge and
  # round closure belong rigidly to the real upstream forearm joint.
  for v in bm.verts:
   if abs(v.co.y-cut)<.000003:
    weights=v[deform]
    for k in list(weights.keys()):del weights[k]
    weights[root_id]=1
  boundary=[e for e in bm.edges if e.is_boundary]
  if not boundary:raise RuntimeError('No wrist boundary '+side)
  # At the cut plane all boundary loops should join the same wrist. Other
  # original holes are a validation failure, never silently filled as wrists.
  if max(abs(v.co.y-cut) for e in boundary for v in e.verts)>.002:raise RuntimeError('Unexpected non-wrist hand boundary '+side)
  start=boundary[0].verts[0];ring=[start];previous=None;current=start
  while True:
   candidates=[e.other_vert(current) for e in current.link_edges if e.is_boundary and e.other_vert(current)!=previous]
   if not candidates:raise RuntimeError('Broken wrist loop '+side)
   nxt=candidates[0]
   if nxt==start:break
   if nxt in ring:raise RuntimeError('Branching wrist loop '+side)
   ring.append(nxt);previous,current=current,nxt
  if len(ring)!=len(boundary):raise RuntimeError('Multiple hand boundaries '+side)
  colors_uv={v:(next(iter(v.link_loops))[uv].uv.copy() if uv else vec((0,0))) for v in ring}
  edge_colors={v:sum((Vector(l[colors]) for l in v.link_loops),Vector((0,0,0,0)))/len(v.link_loops) for v in ring}
  mean_color=sum(edge_colors.values(),Vector((0,0,0,0)))/len(ring)
  # White vertex factors leave every original textured triangle unchanged.
  for f in bm.faces:
   for loop in f.loops:loop[colors]=(1,1,1,1)
  # A newly made cap cannot interpolate between unrelated source UV islands:
  # that crosses shirt texels and paints blue stripes across the wrist.
  skin_vertex=min((v for v in bm.verts if v.co.y>cut+.025),key=lambda v:(v.co-vec((0,cut+.065,.018))).length)
  cap_skin_uv=next(iter(skin_vertex.link_loops))[uv].uv.copy() if uv else vec((0,0))
  center=sum((v.co for v in ring),Vector())/len(ring);last=ring;cap_uv={v:colors_uv[v] for v in ring};cap_colors=dict(edge_colors)
  for step in range(1,6):
   angle=step/6*math.pi/2;shrink=math.cos(angle);new=[]
   for v in ring:
    co=center+(v.co-center)*shrink;co.y=cut-.015*math.sin(angle);n=bm.verts.new(co);n[deform][root_id]=1;new.append(n);cap_uv[n]=colors_uv[v];cap_colors[n]=edge_colors[v].lerp(mean_color,(1-shrink)*.8)
   for k in range(len(ring)):
    n=(k+1)%len(ring);f=bm.faces.new((last[k],last[n],new[n],new[k]));f.smooth=True;f.material_index=cap_index
    for loop in f.loops:loop[colors]=cap_colors[loop.vert]
    if uv:
     for loop in f.loops:loop[uv].uv=cap_skin_uv
   last=new
  tip=bm.verts.new(vec((center.x,cut-.015,center.z)));tip[deform][root_id]=1;cap_colors[tip]=mean_color
  for k in range(len(ring)):
   n=(k+1)%len(ring);f=bm.faces.new((last[k],last[n],tip));f.smooth=True;f.material_index=cap_index
   for loop in f.loops:loop[colors]=cap_colors[loop.vert]
   if uv:
    for loop in f.loops:loop[uv].uv=cap_skin_uv
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));open_edges=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges)
  if open_edges or nonmanifold:raise RuntimeError(f'Invalid palm topology {side} {open_edges} {nonmanifold}')
  rebase=Matrix.Translation(vec((0,-.030,0)))
  for v in bm.verts:v.co=rebase@v.co
  transform=rebase@transform
  bm.to_mesh(m.data);bm.free();m.data.update()
  for mod in list(m.modifiers):m.modifiers.remove(mod)
  arm=bpy.data.armatures.new(side+'PalmRig');ob=bpy.data.objects.new(side+'PalmRig',arm);ch.scene.collection.objects.link(ob)
  for o in ch.scene.objects:o.select_set(False)
  ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT')
  selected=[b for b in ch.rig.data.bones if b.name.replace('mixamorig:','').replace('mixamorig_','').startswith(side+'Hand') or b.name.replace('mixamorig:','').replace('mixamorig_','')==side+'ForeArm']
  for b in selected:
   e=arm.edit_bones.new(b.name);e.head=transform@(ch.rig.matrix_world@b.head_local);e.tail=transform@(ch.rig.matrix_world@b.tail_local)
   e.align_roll((transform.to_3x3()@ch.rig.matrix_world.to_3x3()@b.matrix_local.to_3x3().col[2]).normalized())
   if b.name==ch.bones[side+'Hand'].name:e.head=vec((0,0,0))
  for b in selected:
   if b.parent and b.parent.name in arm.edit_bones:arm.edit_bones[b.name].parent=arm.edit_bones[b.parent.name]
  bpy.ops.object.mode_set(mode='OBJECT');allowed={b.name for b in arm.bones}
  for v in m.data.vertices:
   transfer=sum(g.weight for g in v.groups if m.vertex_groups[g.group].name not in allowed)
   if transfer:root_group.add([v.index],transfer,'ADD')
  for g in list(m.vertex_groups):
   if g.name not in allowed:m.vertex_groups.remove(g)
  mod=m.modifiers.new('PalmSkin','ARMATURE');mod.object=ob;m.parent=ob
  # Blender exports Z-up to Y-up; this compensates because the cropped hand
  # is already expressed in the desired glTF (+Y fingers / +Z dorsal) frame.
  ob.rotation_euler.x=math.pi/2;refresh()
  for o in ch.scene.objects:o.select_set(o in [ob,m])
  bpy.context.view_layer.objects.active=ob;path=outdir/f'hand-{side.lower()}-v3.glb'
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_image_format='AUTO',export_keep_originals=False)
  j,data,sha=read_glb(path)
  # Packed image filepaths are not real files. keep_originals=True can silently
  # omit those textures; reattach the exact embedded source JPEG after export.
  if len(j.get('images',[]))!=len(ch.json['images']):raise RuntimeError('Palm image bindings changed '+side)
  for idx,image in enumerate(ch.json['images']):
   source_view=ch.json['bufferViews'][image['bufferView']];a=source_view.get('byteOffset',0);image_bytes=ch.binary[a:a+source_view['byteLength']]
   while len(data)%4:data.append(0)
   offset=len(data);data.extend(image_bytes);view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(image_bytes)})
   j['images'][idx].pop('uri',None);j['images'][idx].update(bufferView=view,mimeType=image['mimeType'])
  j.setdefault('asset',{}).setdefault('extras',{})['characters40']={'role':side.lower()+'Palm','palmFrameRevision':42,'palmFrame':'long-finger knuckle plane; thumb disambiguates radial side only','metric':True,'wrist':[0,0,0],'proximalCutY':-.100,'fingerDirection':'+Y','dorsalDirection':'+Z','sourceSHA256':ch.sha,'parts':'Actual source four-finger palm and short forearm skin; capped proximal end; original UV texture and weights.', 'forearmRevision':48, 'shortForearm':True, 'forearmLength':.10, 'capDepth':.015, 'originalPalmRebaseY':-.030};write_glb(path,j,data);(DEST/path.name).write_bytes(path.read_bytes())
  report={'side':side,'vertices':len(m.data.vertices),'faces':len(m.data.polygons),'openEdges':open_edges,'nonManifoldEdges':nonmanifold,'bones':[b.name for b in arm.bones],'sourceImagesSHA256':ch.images,'outputImagesSHA256':image_hashes(j,data),'wrist':[0,0,0],'proximalCutY':-.100,'fingerDirection':'+Y','dorsalDirection':'+Z'};reports.append(report)
  print('FOREARM48_EXPORTED',side,str(path),flush=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(outdir/'editable-forearms48.blend'));(outdir/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))

def render_forearms():
 for side in ['left','right']:
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=str(REVIEW/f'hand-{side}-v3.glb'))
  scene=bpy.context.scene
  for mat in bpy.data.materials:
   if not mat.use_nodes:continue
   nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF');out=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
   if p and out:
    emission=nodes.new('ShaderNodeEmission')
    if p.inputs['Base Color'].links:links.new(p.inputs['Base Color'].links[0].from_socket,emission.inputs['Color'])
    else:emission.inputs['Color'].default_value=p.inputs['Base Color'].default_value
    links.new(emission.outputs[0],out.inputs['Surface'])
  cam=setup_render(scene,.39);scene.render.resolution_x=600;scene.render.resolution_y=750;scene.cycles.samples=8;cam.data.ortho_scale=.40
  center=vec((0,0,.05))
  for view,pos in [('dorsal',(0,-1,.05)),('oblique',(.6,-1,.20))]:
   cam.location=vec(pos);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REVIEW/f'{side}-{view}.png');bpy.ops.render.render(write_still=True)

if __name__=="__main__":
 export_forearms()
 if '--render' in sys.argv:render_forearms()
