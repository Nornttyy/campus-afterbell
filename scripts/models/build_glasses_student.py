"""Independent glasses pupil, derived from the approved body/rig (not a runtime eyewear overlay).
Blender: Z up, -Y forward; runtime retains the source armature and ten clips.
Reference: continuous gameplay frames 0412, 0500, 0508, 1026 (full video audit 29).
"""
import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art-source/glasses-student-v1';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'dist/assets/models/student-boy-v2.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
body=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
body.name='GlassesStudentBody';body.data.name='GlassesStudentBodyMesh'
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o!=body:bpy.data.objects.remove(o,do_unlink=True)
# Work at bind pose, not on the first sampled action.
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
for pb in rig.pose.bones:pb.matrix_basis.identity()
img=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
pixels=list(img.pixels);w,h=img.size;uv=body.data.uv_layers.active.data

def sample(poly):
 u=sum(uv[i].uv.x for i in poly.loop_indices)/len(poly.loop_indices);v=sum(uv[i].uv.y for i in poly.loop_indices)/len(poly.loop_indices)
 idx=(min(h-1,max(0,int(v*h)))*w+min(w-1,max(0,int(u*w))))*4
 return pixels[idx:idx+3]
shoe_faces=[];skin_samples=[]
for p in body.data.polygons:
 co=sum((body.matrix_world@body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices);c=sample(p)
 if co.z<.105:shoe_faces.append(p.index)
 if .69<co.z<.78 and co.y<-.08 and c[0]>c[2]*1.5 and c[1]>.12:skin_samples.append(c)

def mat(name,color,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough
 return m
hair=mat('Soft black bowl cut',(.019,.015,.013),.72)
frame=mat('Thin charcoal spectacles',(.013,.018,.018),.43)
lens=mat('Opaque pale green lenses',(.82,.89,.83),.70)
# Recolour texels within the actual shoe UV islands. Face-centre material
# assignment broke the shoe side into red/blue triangles at every boundary.
shoe_texels=set()
for face in shoe_faces:
 poly=body.data.polygons[face];points=[(uv[i].uv.x*(w-1),uv[i].uv.y*(h-1)) for i in poly.loop_indices]
 for t in range(1,len(points)-1):
  (ax,ay),(bx,by),(cx,cy)=points[0],points[t],points[t+1];det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
  if abs(det)<1e-8:continue
  for yy in range(max(0,math.floor(min(ay,by,cy))),min(h-1,math.ceil(max(ay,by,cy)))+1):
   for xx in range(max(0,math.floor(min(ax,bx,cx))),min(w-1,math.ceil(max(ax,bx,cx)))+1):
    a=((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/det;b=((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/det
    if a>=-.015 and b>=-.015 and a+b<=1.015:shoe_texels.add(yy*w+xx)
changed=0
for texel in shoe_texels:
 i=texel*4;r,g,b=pixels[i:i+3];weight=max(0,min(1,(b-max(r,g*.82)-.035)/.13))
 if weight>0:
  target=(min(1,b*.88),r*.30+.012,r*.28+.021)
  pixels[i:i+3]=[old+(new-old)*weight for old,new in zip((r,g,b),target)];changed+=1
img.pixels.foreach_set(pixels);img.update();img.pack()
# Reconstruct the scalp, cheeks and nape as one radial envelope. Projecting the
# original multi-layer quiff onto a skull kept the source sideburn folds; a new
# surface removes those internal sheets instead of merely smoothing them.
skin_color=tuple(sorted(c[k] for c in skin_samples)[len(skin_samples)//2] for k in range(3))
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
body.data.calc_loop_triangles()
source_vertices=[body.matrix_world@v.co for v in body.data.vertices]
source_triangles=[tuple(t.vertices) for t in body.data.loop_triangles]
source_uvs=[tuple(Vector((uv[i].uv.x,uv[i].uv.y,0)) for i in t.loops) for t in body.data.loop_triangles]
source_tree=BVHTree.FromPolygons(source_vertices,source_triangles,all_triangles=True)
def source_at(z,az):
 direction=Vector((math.sin(az),-math.cos(az),0));center=Vector((0,.012,z))
 point,normal,index,distance=source_tree.ray_cast(center+direction*.5,-direction,1)
 if point is None:return None,None,None
 tri=source_triangles[index];tex=barycentric_transform(point,*[source_vertices[i] for i in tri],*source_uvs[index])
 px=min(w-1,max(0,int(tex.x*w)));py=min(h-1,max(0,int(tex.y*h)))
 color=pixels[(py*w+px)*4:(py*w+px)*4+3]
 return point,(point-center).dot(direction),color
def skull_radius(z,az):
 # A single superellipsoid has continuous curvature without knot bands. The
 # compact jaw is gently fuller than a sphere, with no planar cheek shelves.
 height=max(-.999999,min(.999999,(z-.809)/.149))
 section=max(.000001,1-height*height)**.34
 rx=.174*section;ry=.159*section
 if z>.875:
  hair_height=max(0,min(.999999,(z-.813)/.148))
  inside_cap=max(.000001,1-hair_height**(2/.88))**(.88/2)
  rx=min(rx,.172*inside_cap);ry=min(ry,.162*inside_cap)
 return 1/math.sqrt((math.sin(az)/max(rx,.00001))**2+(math.cos(az)/max(ry,.00001))**2)
# Cut at the chin/neck transition, leaving every body and finger vertex below
# the cut unchanged. Weld only cranial UV duplicates before making the cut.
if body.data.has_custom_normals:body.data.normals_split_custom_set([(0,0,0)]*len(body.data.loops))
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=[v for v in bm.verts if (body.matrix_world@v.co).z>.64],dist=.000002)
cut_z=.665
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0000001,plane_co=body.matrix_world.inverted()@Vector((0,0,cut_z)),plane_no=(body.matrix_world.to_3x3().transposed()@Vector((0,0,1))).normalized(),clear_outer=True,clear_inner=False)
neck=[v for v in bm.verts if any(e.is_boundary for e in v.link_edges) and abs((body.matrix_world@v.co).z-cut_z)<.00001]
assert len(neck)>12, 'No connected neck boundary after removing old head'
neck.sort(key=lambda v:math.atan2((body.matrix_world@v.co).x,-((body.matrix_world@v.co).y-.012))%math.tau)
# Uniformly parameterised face UVs avoid interpolating across unrelated source
# UV islands. Only the original eye and mouth features are transferred.
TW=512;TH=512;head_pixels=[0.]*(TW*TH*4)
for yy in range(TH):
 z=cut_z+(yy+.5)/TH*(.958-cut_z)
 for xx in range(TW):
  az=(xx+.5)/TW*math.tau;col=skin_color
  if math.cos(az)>.48 and .692<z<.846:
   point,radius,c=source_at(z,az)
   if point is not None:
    eye=.749<z<.844 and .021<abs(point.x)<.145 and point.y<-.125
    mouth=.693<z<.755 and abs(point.x)<.055 and point.y<-.105
    if (eye and (max(c)-min(c)<.16 or max(c)<.30)) or (mouth and max(c)<.42):col=c
  idx=(yy*TW+xx)*4;head_pixels[idx:idx+4]=[*col,1]
head_img=bpy.data.images.new('Glasses student continuous face atlas',width=TW,height=TH,alpha=False)
head_img.pixels.foreach_set(head_pixels);head_img.update();head_img.pack()
head_mat=mat('Continuous face and nape',skin_color,.73)
tex=head_mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=head_img
head_mat.node_tree.links.new(tex.outputs['Color'],head_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
body.data.materials.append(head_mat);head_material=len(body.data.materials)-1
uv_layer=bm.loops.layers.uv.active
deform=bm.verts.layers.deform.verify();head_group=body.vertex_groups.get('mixamorig:Head').index
NHEAD=160;RHEAD=96;newrings=[]
for j in range(RHEAD):
 z=.667+(.957-.667)*j/(RHEAD-1);ring=[]
 for i in range(NHEAD):
  az=i/NHEAD*math.tau;c=math.cos(az);point,radius,color=source_at(z,az);r=skull_radius(z,az)
  if point is not None and radius>0:
   # Preserve the approved front nose/eye/jaw silhouette, not the black quiff.
   sx=abs(point.x)
   nose=math.exp(-((sx/.049)**4)-(((z-.738)/.039)**4))*smooth(.72,.9,c)
   eye=math.exp(-(((sx-.082)/.055)**4)-(((z-.802)/.044)**4))*smooth(.48,.74,c)
   jaw=smooth(.60,.85,c)*(1-smooth(.720,.760,z))
   front=max(nose,eye,jaw)*(1-smooth(.84,.86,z))
   if max(color)<.27 and z>.80:front=0
   r=r+(radius-r)*front
   # Keep the ear bulge, with one continuous surface behind and ahead of it.
   ear=smooth(.716,.742,z)*(1-smooth(.795,.823,z))*(1-smooth(.38,.64,abs(c)))
   r+=max(0,radius-r)*ear
   neck_blend=1-smooth(.667,.687,z);r=r+(radius-r)*neck_blend
  v=bm.verts.new(body.matrix_world.inverted()@Vector((r*math.sin(az),.012-r*math.cos(az),z)))
  v[deform][head_group]=1;ring.append(v)
 newrings.append(ring)
def surface_face(vertices,coords):
 f=bm.faces.new(vertices);f.material_index=head_material;f.smooth=True
 for loop,coord in zip(f.loops,coords):loop[uv_layer].uv=coord
 return f
for j in range(RHEAD-1):
 va=(.667+(.957-.667)*j/(RHEAD-1)-cut_z)/(.958-cut_z)
 vb=(.667+(.957-.667)*(j+1)/(RHEAD-1)-cut_z)/(.958-cut_z)
 for i in range(NHEAD):
  k=(i+1)%NHEAD;ua=i/NHEAD;ub=(i+1)/NHEAD
  surface_face([newrings[j][i],newrings[j][k],newrings[j+1][k],newrings[j+1][i]],[(ua,va),(ub,va),(ub,vb),(ua,vb)])
pole=bm.verts.new(body.matrix_world.inverted()@Vector((0,.012,.958)));pole[deform][head_group]=1
for i in range(NHEAD):surface_face([newrings[-1][i],newrings[-1][(i+1)%NHEAD],pole],[(i/NHEAD,.9966),((i+1)/NHEAD,.9966),((i+.5)/NHEAD,1)])
# Join the irregular source neck loop to the regular new skull loop using an
# angular zipper. These are shared vertices, not overlapping collar/scalp shells.
angles=[math.atan2((body.matrix_world@v.co).x,-((body.matrix_world@v.co).y-.012))%math.tau for v in neck]
i=j=0;zipper_faces=0
while i<len(neck) or j<NHEAD:
 a=neck[i%len(neck)];b=newrings[0][j%NHEAD]
 next_a=(angles[(i+1)%len(neck)]+(math.tau if i+1>=len(neck) else 0)) if i<len(neck) else math.inf
 next_b=(j+1)/NHEAD*math.tau if j<NHEAD else math.inf
 if next_a<next_b:
  c=neck[(i+1)%len(neck)];surface_face([a,c,b],[(0,0),(0,0),(0,.0068)]);i+=1
 else:
  c=newrings[0][(j+1)%NHEAD];surface_face([a,c,b],[(0,0),(0,.0068),(0,.0068)]);j+=1
 zipper_faces+=1
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
cranial_open_edges=sum(e.is_boundary and all((body.matrix_world@v.co).z>.6649 for v in e.verts) for e in bm.edges)
assert cranial_open_edges==0,f'Head reconstruction left {cranial_open_edges} open edges'
bm.to_mesh(body.data);bm.free();body.data.update()

parts=[body]
def make(name,vertices,faces,material):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([rig.matrix_world.inverted()@Vector(v) for v in vertices],[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in mesh.polygons:p.use_smooth=True
 g=o.vertex_groups.new(name='mixamorig:Head');g.add(list(range(len(vertices))),1,'REPLACE')
 mod=o.modifiers.new('Same animated head bone','ARMATURE');mod.object=rig;o.parent=rig;parts.append(o);return o
# Short bowl cut: high temples expose the ears; the back ends above the neck.
# The cap is a closed solid independent of the complete skin below it.
vs=[];fs=[];N=96;R=28;hair_edge=[]
def cap_point(t,az,inset=0):
 c=math.cos(az);front=max(0,c);rear=max(0,-c)
 edge=.809+.046*front**2-.064*rear**.7
 # Small pointed fringe separations, seen at 08:20 and 17:06, are confined
 # to the front edge instead of drawing noisy grooves all over the crown.
 fringe=max(0,(c-.12)/.88)
 edge+=.027*(max(0,math.cos(az*18+.3))**12)*fringe
 zc=.813;rz=.148
 end=math.acos(max(-1,min(1,(edge-zc)/rz)));a=t*end
 groove=.0035*(max(0,math.cos(az*18+.3))**14)*fringe*smooth(.30,.85,t)
 radial=math.sin(a)**.88
 x=(.180-inset-groove)*radial*math.sin(az)
 y=.012-(.170-inset-groove)*radial*c
 z=zc+(rz-inset)*math.copysign(abs(math.cos(a))**.88,math.cos(a))
 return x,y,z
for j in range(R+1):
 for i in range(N):
  v=cap_point(j/R,i/N*math.tau);vs.append(v)
  if j==R:hair_edge.append(v)
for j in range(R):
 for i in range(N):
  a=j*N+i;b=j*N+(i+1)%N;fs.append((a,a+N,b+N,b))
# A narrow hem folds under into a closed inner cap. No hair reaches the collar.
base=len(vs)
for j in range(R+1):
 for i in range(N):vs.append(cap_point(1-j/R,i/N*math.tau,.005))
for i in range(N):fs.append((R*N+i,R*N+(i+1)%N,base+(i+1)%N,base+i))
for j in range(R):
 for i in range(N):
  a=base+j*N+i;b=base+j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
hair_object=make('Short bowl cut with exposed ears and nape',vs,fs,hair)
bm=bmesh.new();bm.from_mesh(hair_object.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
shell_boundary=sum(e.is_boundary for e in bm.edges);shell_nonmanifold=sum(not e.is_manifold for e in bm.edges)
bm.to_mesh(hair_object.data);bm.free()
# Near-round, gently convex and opaque lenses; geometry stays attached to the head.
for sign in [-1,1]:
 cx=sign*.087;cz=.805;rx=.074;rz=.075;front=-.181
 vs=[];fs=[];segments=64
 for layer in range(2):
  for i in range(segments):
   a=i/segments*math.tau;vs.append((cx+rx*math.cos(a),front+layer*.009,cz+rz*math.sin(a)))
 fs.append(tuple(reversed(range(segments))));fs.append(tuple(range(segments,2*segments)))
 for i in range(segments):fs.append((i,(i+1)%segments,(i+1)%segments+segments,i+segments))
 make(('Left' if sign<0 else 'Right')+' opaque lens',vs,fs,lens)
 vs=[];fs=[]
 for i in range(segments):
  a=i/segments*math.tau
  for j in range(10):
   b=j/10*math.tau;vs.append((cx+(rx+.004*math.cos(b))*math.cos(a),front+.004*math.sin(b),cz+(rz+.004*math.cos(b))*math.sin(a)))
 for i in range(segments):
  for j in range(10):fs.append((i*10+j,((i+1)%segments)*10+j,((i+1)%segments)*10+(j+1)%10,i*10+(j+1)%10))
 make(('Left' if sign<0 else 'Right')+' spectacle rim',vs,fs,frame)

def tube(name,points,r,material):
 vs=[];fs=[]
 for n,p in enumerate(points):
  tangent=(Vector(points[min(n+1,len(points)-1)])-Vector(points[max(0,n-1)])).normalized();side=tangent.cross(Vector((0,0,1))).normalized();up=side.cross(tangent).normalized()
  for i in range(10):vs.append(Vector(p)+r*(side*math.cos(i/10*math.tau)+up*math.sin(i/10*math.tau)))
 for n in range(len(points)-1):
  for i in range(10):fs.append((n*10+i,n*10+(i+1)%10,(n+1)*10+(i+1)%10,(n+1)*10+i))
 make(name,vs,fs,material)
tube('Spectacle bridge',[(-.018,-.18,.811),(-.009,-.183,.814),(.009,-.183,.814),(.018,-.18,.811)],.0045,frame)
for s in [-1,1]:tube('Spectacle temple '+str(s),[(s*.161,-.181,.811),(s*.178,-.157,.81),(s*.181,-.09,.80),(s*.176,-.012,.79)],.0045,frame)
# Independent, editable export, retaining ten source clips and bind matrices.
for tr in rig.animation_data.nla_tracks:tr.mute=True
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'glasses-student-editable.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/assets/models/student-glasses-v1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_rest_position_armature=True)
audit={
 'removedOriginalHeadAboveZ':cut_z,
 'headConstruction':'single radial envelope; new topology stitched to original neck boundary',
 'sourceVertexCount':17829,'sourceFaceCount':30000,
 'repairedVertexCount':len(body.data.vertices),'repairedFaceCount':len(body.data.polygons),
 'headAngularSamples':NHEAD,'headVerticalSamples':RHEAD,
 'neckBoundaryVertices':len(neck),'neckZipperFaces':zipper_faces,
 'cranialOpenEdges':cranial_open_edges,'sourceHeadSurfacePreserved':False,
 'preservedSourceFeatures':['front nose and jaw silhouette','front eye bulge','ear outer contour','original neck, body and four-finger rig'],
 'napeClearanceAboveCollar':min(p[2]for p in hair_edge)-.635,
 'recolouredShoeTexels':changed,
 'hairlineMinZ':min(p[2]for p in hair_edge),'hairlineMaxZ':max(p[2]for p in hair_edge),
 'cranialShellBoundaryEdges':shell_boundary,'cranialShellNonManifoldEdges':shell_nonmanifold,
 'scalpColorFromSourceAtlas':skin_color,'parts':[o.name for o in parts],
 'source':'student-boy-v2.glb',
 'reference':'gameplay 06:52,08:20,08:28,17:06; frames 0412,0500,0508,1026',
 'status':'head topology rebuilt; requires render and engine visual review',
 'knownDifferences':['Head and ear contours are reconstructed from the approved Tripo base and visible references, not original topology.','Glasses depth and protruding eye profile remain stylized approximations.','Hairline is reconstructed from visible references, not an original 3D asset.']
}
(OUT/'build-audit.json').write_text(json.dumps(audit,indent=2))
print('GLASSES_STUDENT_EXPORTED')
