"""Normalize the five user-supplied skins and author classroom motion.

Blender --background --factory-startup --python this_file -- --role boy
Only world alignment and animation channels are grafted into the source GLB.
Its original mesh, UV, skin weights, inverse binds and embedded images remain
byte-for-byte in the original binary prefix. No face/material/light baking.
The authored clips are a reconstruction, not extracted original-game motion.
"""
import argparse, copy, hashlib, json, math, struct, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Matrix, Vector, Quaternion

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art-source/tripo-exports-20261108'
REVIEW=ROOT/'art-source/characters40'
DEST=ROOT/'dist/assets/models'
SPECS={
 'boy':('男同学.glb','student-boy-v4.glb',1.80),
 'girl':('紫发女同学.glb','student-girl-v4.glb',1.80),
 'glasses':('眼镜同学.glb','student-glasses-v2.glb',1.80),
 'ponytail':('棕马尾女同学.glb','student-ponytail-v1.glb',1.80),
 'teacher':('老师.glb','teacher-v2.glb',2.08),
}
STUDENT_CLIPS=[('Idle',3),('Walk',1.0),('Sit',3),('Write',2),('Snack',2.4),('Phone',2),('Note',2),('Think',3),('Carry',3),('WalkCarry',1.0)]
TEACHER_CLIPS=[('Idle',3),('Walk',1.0),('Write',2),('Card',1),('Throw',.7)]
FPS=30
WALK_DURATION=.80
WALK_STRIDE_LEG_RATIO=.66
STANCE=.54
# Wrists lie just before the desk's front edge (actor local Z=.32). Fingers
# may hang below the tabletop outside its XZ footprint; do not raise the
# whole hand to clear a plane of infinite extent.
TABLE_WRIST_HEIGHT={'boy':.912,'girl':.912,'glasses':.912,'ponytail':.912}
C=Matrix.Rotation(math.pi/2,4,'X') # glTF world -> Blender world

def vec(v):return Vector(v)
def refresh():bpy.context.view_layer.update()
def rounded(v):return [round(float(x),7) for x in v]
def matrix_json(m):return [float(m[r][c]) for c in range(4) for r in range(4)]
def node_matrix(n):
 if 'matrix' in n:return Matrix([n['matrix'][i:i+4] for i in range(0,16,4)]).transposed()
 q=n.get('rotation',[0,0,0,1]);return Matrix.LocRotScale(vec(n.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),vec(n.get('scale',[1,1,1])))
def read_glb(path):
 raw=path.read_bytes();off=12;j=None;data=None
 while off<len(raw):
  n,t=struct.unpack_from('<II',raw,off);block=raw[off+8:off+8+n];off+=8+n
  if t==0x4e4f534a:j=json.loads(block)
  elif t==0x004e4942:data=bytearray(block)
 return j,data,hashlib.sha256(raw).hexdigest()
def write_glb(path,j,data):
 while len(data)%4:data.append(0)
 j['buffers'][0]['byteLength']=len(data)
 text=json.dumps(j,separators=(',',':'),ensure_ascii=False).encode();text+=b' '*((-len(text))%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(data))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(data),0x004e4942)+data)
def append_float(j,data,values,kind):
 width={'SCALAR':1,'VEC3':3,'VEC4':4}[kind]
 flat=[float(x) for row in values for x in (row if isinstance(row,(list,tuple,Vector,Quaternion)) else [row])]
 while len(data)%4:data.append(0)
 offset=len(data);data.extend(struct.pack('<'+'f'*len(flat),*flat));view=len(j.setdefault('bufferViews',[]));j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(flat)*4})
 access={'bufferView':view,'componentType':5126,'count':len(flat)//width,'type':kind}
 if kind=='SCALAR':access.update(min=[min(flat)],max=[max(flat)])
 index=len(j.setdefault('accessors',[]));j['accessors'].append(access);return index
def glb_worlds(j):
 parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};worlds={}
 def world(i):
  if i not in worlds:worlds[i]=(world(parents[i]) if i in parents else Matrix.Identity(4))@node_matrix(j['nodes'][i])
  return worlds[i]
 for i in range(len(j['nodes'])):world(i)
 return parents,worlds
def image_hashes(j,data):
 result=[]
 for image in j.get('images',[]):
  view=j['bufferViews'][image['bufferView']];start=view.get('byteOffset',0);raw=bytes(data[start:start+view['byteLength']]);result.append(hashlib.sha256(raw).hexdigest())
 return result

class Character:
 def __init__(self,role):
  self.role=role;self.filename,self.output,self.height=SPECS[role];self.dir=REVIEW/role;self.dir.mkdir(parents=True,exist_ok=True)
  self.source=SOURCE/self.filename;self.json,self.binary,self.sha=read_glb(self.source);self.binary_size=len(self.binary);self.original_binary_hash=hashlib.sha256(self.binary).hexdigest();self.images=image_hashes(self.json,self.binary)
  self.parents,self.original_world=glb_worlds(self.json)
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(self.source));refresh()
  self.scene=bpy.context.scene;self.rig=next(o for o in self.scene.objects if o.type=='ARMATURE')
  self.meshes=[o for o in self.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==self.rig for m in o.modifiers)]
  if not self.meshes:raise RuntimeError('No source skinned mesh found')
  self.bones={b.name.replace('mixamorig:','').replace('mixamorig_',''):b for b in self.rig.pose.bones}
  self.node_for_bone={name:i for i,n in enumerate(self.json['nodes']) for name in [n.get('name','').replace('mixamorig:','').replace('mixamorig_','')] if name in self.bones}
  required=['Hips','Head','Neck','Spine1']+[s+p for s in ['Left','Right'] for p in ['Arm','ForeArm','Hand','UpLeg','Leg','Foot','ToeBase','HandIndex1','HandMiddle1','HandPinky1','HandThumb1']]
  missing=[n for n in required if n not in self.bones]
  if missing:raise RuntimeError('Missing bones '+str(missing))
  before={name:self.rig.matrix_world@b.matrix for name,b in self.bones.items()}
  self.correction={name:before[name].inverted()@C@self.original_world[i] for name,i in self.node_for_bone.items()}
  points=[o.matrix_world@v.co for o in self.meshes for v in o.data.vertices]
  left=before['LeftArm'].translation-before['RightArm'].translation;left.z=0;left.normalize();up=vec((0,0,1));back=up.cross(left).normalized()
  rot=Matrix((left,back,up)).to_4x4()
  rotated=[rot@v for v in points];low=min(v.z for v in rotated);high=max(v.z for v in rotated);scale=self.height/(high-low)
  pelvis=rot@before['Hips'].translation
  self.normalization=Matrix.Scale(scale,4)@Matrix.Translation(vec((-pelvis.x,-pelvis.y,-low)))@rot
  top=self.rig
  while top.parent:top=top.parent
  root=bpy.data.objects.new('Character40Normalization',None);self.scene.collection.objects.link(root);top.parent=root;root.matrix_world=self.normalization;refresh();self.root=root
  self.rest={name:self.rig.matrix_world@b.matrix for name,b in self.bones.items()};self.heads={name:m.translation.copy() for name,m in self.rest.items()}
  self.inv=self.rig.matrix_world.inverted();self.rest_local={name:b.matrix.copy() for name,b in self.bones.items()}
  self.finger_report=self.report_fingers()
  self.frames={s:self.hand_frame(s) for s in ['Left','Right']}
  self.motion_report={};self.actions=[]
  contact_path=REVIEW/'runtime/write-contact42.json'
  self.table_contact=json.loads(contact_path.read_text()).get(role) if contact_path.exists() else None
  self.toe_floor={s:self.heads[s+'Foot'].z for s in ['Left','Right']}
  self.hip_height=self.heads['Hips'].z
  self.seat_hip=.49
  self.prepare_gait()
  self.original_name_to_node={n.get('name'):i for i,n in enumerate(self.json['nodes'])}
  self.rig.animation_data_create()

 def report_fingers(self):
  report={}
  for side in ['Left','Right']:
   result={}
   for finger in ['Index','Middle','Ring','Pinky','Thumb']:
    names={self.bones[n].name for n in self.bones if n.startswith(side+'Hand'+finger)};weight=0;vertices=0
    for mesh in self.meshes:
     ids={g.index for g in mesh.vertex_groups if g.name in names}
     for v in mesh.data.vertices:
      amount=sum(g.weight for g in v.groups if g.group in ids);weight+=amount;vertices+=amount>.01
    result[finger]={'summedWeight':round(weight,6),'verticesAbove001':vertices,'base':rounded(self.heads.get(side+'Hand'+finger+'1',vec((0,0,0))))}
   report[side]=result
  return {'preservedAllWeights':True,'policy':'All supplied chains including Ring are retained. Ring bends with neighbouring long fingers; no deletion or reassignment of weights.','sides':report}

 def reset(self):
  for b in self.bones.values():b.matrix_basis=Matrix.Identity(4)
  refresh()
 def world(self,name):return self.rig.matrix_world@self.bones[name].matrix
 def set_world(self,name,m):self.bones[name].matrix=self.inv@m;refresh()
 def absolute(self,name,q):
  m=self.world(name);self.set_world(name,Matrix.LocRotScale(m.translation,q,m.to_scale()))
 def aim(self,name,child,target):
  m=self.world(name);origin=m.translation;current=self.world(child).translation-origin;desired=vec(target)-origin
  if current.length<1e-8 or desired.length<1e-8:return
  q=current.rotation_difference(desired)@m.to_quaternion();self.absolute(name,q)
 def chain(self,side,a,b,c,target,pole):
  na,nb,nc=side+a,side+b,side+c;root=self.world(na).translation;mid=self.world(nb).translation;end=self.world(nc).translation
  l1=(mid-root).length;l2=(end-mid).length;delta=vec(target)-root;d=max(abs(l1-l2)+.001,min(delta.length,l1+l2-.004));direction=delta.normalized();p=vec(pole)-root;p-=direction*p.dot(direction)
  if p.length<.0001:p=direction.orthogonal()
  p.normalize();along=(l1*l1-l2*l2+d*d)/(2*d);height=math.sqrt(max(0,l1*l1-along*along));elbow=root+direction*along+p*height
  self.aim(na,nb,elbow);self.aim(nb,nc,root+direction*d)
 def hand_frame(self,side):
  wrist=self.heads[side+'Hand'];along=(self.heads[side+'HandMiddle1']-wrist).normalized()
  # The long-finger knuckles define the actual broad palm plane. The thumb
  # base is not coplanar: using it as the transverse axis rolled the boy's
  # palms 54–58 degrees and bent his fingers diagonally across their surface.
  # Use the thumb only to disambiguate swapped Index/Pinky labels, exactly as
  # runtime handFrame does; preserve all supplied bones and skin weights.
  radial=self.heads[side+'HandThumb1']-self.heads[side+'HandMiddle1'];radial-=along*radial.dot(along);radial.normalize()
  across=self.heads[side+'HandIndex1']-self.heads[side+'HandPinky1'];across-=along*across.dot(along);across.normalize()
  if across.dot(radial)<0:across=-across
  if side=='Right':across=-across
  dorsal=across.cross(along).normalized()
  # In the user-approved A pose both hand backs point out from the body.
  expected=vec((1 if side=='Left' else -1,0,0))
  if dorsal.dot(expected)<0:across=-across;dorsal=-dorsal
  frame=Matrix((across,along,dorsal)).transposed().to_quaternion()
  return {'quaternion':frame,'across':across,'along':along,'dorsal':dorsal}
 def palm(self,side,along,dorsal):
  y=vec(along).normalized();z=vec(dorsal);z-=y*z.dot(y);z.normalize();x=y.cross(z).normalized()
  target=Matrix((x,y,z)).transposed().to_quaternion();frame=self.frames[side]['quaternion'];q=target@frame.inverted()@self.rest[side+'Hand'].to_quaternion();self.absolute(side+'Hand',q)
 def curl(self,side,amount):
  frame=self.frames[side]
  for finger in ['Index','Middle','Ring','Pinky']:
   for level,factor in [(1,.52),(2,.76),(3,.50)]:
    name=side+'Hand'+finger+str(level)
    if name not in self.bones:continue
    # Bend towards the inward palm: use a real anatomical frame, not Euler X.
    axis=self.rest[name].to_quaternion().inverted()@frame['across']
    self.bones[name].rotation_mode='QUATERNION';self.bones[name].rotation_quaternion=Quaternion(axis,-amount*factor)
  # Keep the source thumb's natural spread; runtime handles opposition/contact.
  refresh()

 def contact_fingers(self,side,relative):
  # The measured skin-contact pose is in the delivered glTF joint frame,
  # relative to its actual wrist. Convert both the world-up basis and each
  # imported bone's roll correction back into Blender before keying it.
  wrist=side+'Hand';wrist_gltf=C.inverted()@self.world(wrist)@self.correction[wrist]
  for name,values in relative.items():
   if name not in self.bones:raise RuntimeError('Contact pose bone missing '+name)
   local=Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
   desired=C@wrist_gltf@local@self.correction[name].inverted()
   self.set_world(name,desired)

 def prepare_gait(self):
  # The supplied students have ~.52 m legs despite their large heads. A
  # .58 m support stride forced ~9 cm of squatting. Derive a reachable stride
  # from actual bones and expose its true travel speed to the runtime.
  lengths=[(self.heads[s+'Leg']-self.heads[s+'UpLeg']).length+(self.heads[s+'Foot']-self.heads[s+'Leg']).length for s in ['Left','Right']]
  self.walk_span=min(lengths)*(.60 if self.role=='teacher' else WALK_STRIDE_LEG_RATIO)
  self.walk_speed=self.walk_span/(WALK_DURATION*STANCE)
  self.walk_lift=.05 if self.role=='teacher' else .045
  self.walk_bob=.016 if self.role=='teacher' else .014
  # Compute one fixed reachable pelvis baseline across the entire cycle.
  # Never clamp the root separately at each frame: that makes the body pop.
  limits=[]
  for i in range(481):
   t=WALK_DURATION*i/480;phase=t*math.tau/WALK_DURATION;rise=self.walk_bob*(.5-.5*math.cos(phase*2))
   for side,length in zip(['Left','Right'],lengths):
    _,foot,_=self.walk_foot(side,t);root=self.heads[side+'UpLeg'].copy();root.x+=.006*math.sin(phase)
    reach=length-.006;horizontal=(foot.x-root.x)**2+(foot.y-root.y)**2
    limits.append(foot.z+math.sqrt(max(.001,reach*reach-horizontal))-root.z-rise)
  self.walk_hip_offset=min(0,min(limits))
  self.teacher_hip_curve=None
  if self.role=='teacher':
   # Adult cadence needs a longer stride than the students. Holding the pelvis
   # at the worst-reach height made every stance a squat. Follow the currently
   # supporting leg's reachable height, then smooth the double-support switch.
   count=480;allowed=[]
   for i in range(count):
    t=WALK_DURATION*i/count;phase=t*math.tau/WALK_DURATION;row=[]
    for side,length in zip(['Left','Right'],lengths):
     u,foot,_=self.walk_foot(side,t);root=self.heads[side+'UpLeg'].copy();root.x+=.006*math.sin(phase)
     reach=length-(.009 if u<STANCE else .006)
     horizontal=(foot.x-root.x)**2+(foot.y-root.y)**2
     row.append(foot.z+math.sqrt(max(.001,reach*reach-horizontal))-root.z)
    allowed.append(min(0,min(row)))
   sigma=.015/(WALK_DURATION/count);radius=math.ceil(sigma*3)
   weights=[math.exp(-.5*(j/sigma)**2) for j in range(-radius,radius+1)];total=sum(weights)
   smooth=[sum(allowed[(i+j)%count]*w for j,w in zip(range(-radius,radius+1),weights))/total for i in range(count)]
   # Filtering must not push any limb past its real reach.
   shift=max(a-b for a,b in zip(smooth,allowed));self.teacher_hip_curve=[v-shift for v in smooth]
   self.walk_hip_offset=min(self.teacher_hip_curve);self.walk_bob=max(self.teacher_hip_curve)-self.walk_hip_offset

 def walk_foot(self,side,t):
  u=(t/WALK_DURATION+(0 if side=='Left' else .5))%1
  foot=self.heads[side+'Foot'].copy();span=self.walk_span
  if u<STANCE:
   foot.y+=-span*.5+self.walk_speed*u*WALK_DURATION
   lift=0
  else:
   v=(u-STANCE)/(1-STANCE);smooth=v*v*v*(10+v*(-15+6*v))
   # Quintic Hermite with the SAME velocity as contact at both ends.
   # A zero-velocity smoothstep made each toe-off/landing visibly jerk.
   tangent=self.walk_speed*WALK_DURATION*(1-STANCE)
   foot.y+=span*.5+tangent*v+(-span-tangent)*smooth
   lift=self.walk_lift*math.sin(math.pi*v)**3
   if self.role=='teacher':
    # Adult upright walk: lift before the C2 return arc travels farther back.
    # A late sine lift forced the pelvis down to keep the long stride reachable.
    # Smooth acceleration at both floor contacts; no root/leg-length shortcut.
    up=max(0,min(1,v/.25));down=max(0,min(1,(1-v)/.25))
    lift=self.walk_lift*(up**3*(10+up*(-15+6*up)))*(down**3*(10+down*(-15+6*down)))
   foot.z+=lift
  return u,foot,lift

 def free_arm(self,side,sign,phase,walking):
  # FK shoulders and forearms: the elbow follows the upper arm, rather than
  # solving a wrist constrained to a fixed world trajectory.
  upper_rest=self.heads[side+'ForeArm']-self.heads[side+'Arm']
  lower_rest=self.heads[side+'Hand']-self.heads[side+'ForeArm']
  upper_base=vec((sign*.115,.035,-1)).normalized()
  lower_base=vec((sign*.045,-.18,-1)).normalized()
  ph=phase+(0 if sign==1 else math.pi)
  shoulder_swing=.38*math.cos(ph) if walking else 0
  # The lower arm lags by 0.30 rad and bends a little more on forward swing.
  elbow_bend=.12+(.13*(.5-.5*math.cos(ph-.30)) if walking else .015)
  upper_q=Quaternion((1,0,0),shoulder_swing)@upper_rest.rotation_difference(upper_base)@self.rest[side+'Arm'].to_quaternion()
  self.absolute(side+'Arm',upper_q)
  fore_swing=.34*math.cos(ph-.30) if walking else 0
  lower_dir=Quaternion((1,0,0),fore_swing-elbow_bend)@lower_base
  self.absolute(side+'ForeArm',lower_rest.rotation_difference(lower_dir)@self.rest[side+'ForeArm'].to_quaternion())
  along=(self.world(side+'Hand').translation-self.world(side+'ForeArm').translation).normalized()
  # A small genuine wrist bend trails the forearm instead of welding the
  # palm's long axis to it. These are tuned values, not measured game curves.
  if walking:along=Quaternion((1,0,0),math.radians(3.5)*math.sin(ph-.52))@along
  self.palm(side,along,(sign,0,0));self.curl(side,.12)

 def pose(self,kind,t):
  self.reset();teacher=self.role=='teacher';seated=not teacher and kind in ['Sit','Write','Snack','Phone','Note','Think'];walking=kind in ['Walk','WalkCarry'];carry=kind in ['Carry','WalkCarry'];phase=t*math.tau/WALK_DURATION
  hip=self.world('Hips');dz=self.seat_hip-self.hip_height if seated else 0
  if walking:
   if self.teacher_hip_curve:
    sample=((t/WALK_DURATION)%1)*len(self.teacher_hip_curve);index=math.floor(sample);fraction=sample-index
    dz=(1-fraction)*self.teacher_hip_curve[index]+fraction*self.teacher_hip_curve[(index+1)%len(self.teacher_hip_curve)]
   else:dz=self.walk_hip_offset+self.walk_bob*(.5-.5*math.cos(phase*2))
   hip.translation.x+=.006*math.sin(phase)
  hip.translation.z+=dz;self.set_world('Hips',hip)
  lean=.055 if seated else .025 if walking else 0
  self.absolute('Spine1',Quaternion((1,0,0),lean)@self.rest['Spine1'].to_quaternion())
  for side,sign in [('Left',1),('Right',-1)]:
   u=(t/WALK_DURATION+(0 if sign==1 else .5))%1;foot=self.heads[side+'Foot'].copy();l1=(self.heads[side+'Leg']-self.heads[side+'UpLeg']).length;l2=(self.heads[side+'Foot']-self.heads[side+'Leg']).length
   if seated:
    # Knee in front, shins nearly vertical. Derive both from actual leg lengths.
    thigh=self.world(side+'UpLeg').translation;knee=thigh+vec((sign*.012,-l1*.94,-l1*.15));foot=knee+vec((sign*.008,.025,-l2*.95));foot.z=max(self.toe_floor[side],foot.z)
   elif walking:
    u,foot,lift=self.walk_foot(side,t)
   root=self.world(side+'UpLeg').translation;pole=root+vec((sign*.035,-.48,-.15));self.chain(side,'UpLeg','Leg','Foot',foot,pole)
   angle=-.10*math.sin(math.pi*(u-STANCE)/(1-STANCE))**3 if walking and u>=STANCE else 0
   self.absolute(side+'Foot',Quaternion((1,0,0),angle)@self.rest[side+'Foot'].to_quaternion())
   if kind=='Walk':
    # Both clavicles share a tiny torso-space yaw: the left shoulder travels
    # back while the right travels forward, then reverses with the gait.
    # Idle and held-object gestures remain steady.
    self.absolute(side+'Shoulder',Quaternion((0,0,1),math.radians(2)*math.cos(phase))@self.rest[side+'Shoulder'].to_quaternion())
   shoulder=self.world(side+'Arm').translation;upper=(self.heads[side+'ForeArm']-self.heads[side+'Arm']).length;lower=(self.heads[side+'Hand']-self.heads[side+'ForeArm']).length;reach=upper+lower
   if kind in ['Idle','Walk']:
    self.free_arm(side,sign,phase,walking)
    continue
   target=shoulder+vec((sign*reach*.22,-.035,-reach*.91))
   if walking:
    swing=math.sin(phase+(0 if sign==1 else math.pi));target.y+=swing*min(.14,reach*.31);target.z+=.018*(1+math.cos(phase+.5+(0 if sign==1 else math.pi)))
   # The source arms are short (.326-.386 m). A fixed .34 m forward reach
   # locks the elbow; keep reachable table contact with a visibly bent elbow.
   if seated:target=vec((sign*.16,shoulder.y-min(.275,reach*.77),TABLE_WRIST_HEIGHT[self.role]))
   if kind=='Write' and not teacher:
    if side=='Right':target+=vec((math.sin(t*6)*.012,math.sin(t*8)*.009,.006))
   contact=None;contact_digits=None
   if self.table_contact and kind in ['Sit','Write','Snack']:
    if kind=='Write' and side=='Right':
     contact=self.table_contact['best'];contact_digits=self.table_contact['fingerRelativeMatrices']
    elif kind!='Snack' or side=='Right':
     contact=self.table_contact['resting'][side];contact_digits=contact['fingerRelativeMatrices']
    if contact:
     target=C.to_3x3()@vec(contact['wrist'])
     if kind=='Write' and side=='Right':target+=vec((math.sin(t*6)*.006,math.sin(t*8)*.005,0))
   if kind in ['Phone','Note'] or carry:target=shoulder+vec((-sign*.035,-reach*.61,-reach*.35))
   if kind=='Snack' and side=='Left':target=shoulder+vec((-sign*.025,-reach*.64,-reach*.38+.035*(.5-.5*math.cos(t*math.tau/1.2))))
   if kind=='Think' and side=='Right':target=shoulder+vec((-sign*.018,-reach*.48,-reach*.08))
   if teacher and kind in ['Write','Card','Throw'] and side=='Right':
    if kind=='Write':target=shoulder+vec((-.025+math.sin(t*5)*.016,-reach*.76,.12+math.sin(t*7)*.013))
    elif kind=='Card':target=shoulder+vec((-.015,-reach*.63,.08))
    else:
     q=min(1,t/.7);a=min(1,q/.38);a=a*a*(3-2*a);send=max(0,min(1,(q-.38)/.30));send=send*send*(3-2*send);recover=max(0,min(1,(q-.72)/.28));recover=recover*recover*(3-2*recover)
     base=shoulder+vec((sign*reach*.22,-.035,-reach*.91));raised=shoulder+vec((-.01,-reach*.20,.14));thrown=shoulder+vec((-.025,-reach*.87,-.025));target=base.lerp(raised,a).lerp(thrown,send).lerp(base,recover)
   pole=shoulder+vec((sign*reach*.50,-.07,-reach*.48))
   if walking:pole.y+=math.sin(phase+.38+(0 if sign==1 else math.pi))*.05
   self.chain(side,'Arm','ForeArm','Hand',target,pole)
   if contact:
    self.palm(side,C.to_3x3()@vec(contact['along']),C.to_3x3()@vec(contact['dorsal']))
    self.contact_fingers(side,contact_digits)
   elif (kind in ['Phone','Note'] or carry or (kind=='Snack' and side=='Left')):
    self.palm(side,(0,0,1),(0,-1,0));self.curl(side,.26)
   elif seated:
    self.palm(side,(0,-1,-.10),(0,0,1));self.curl(side,.20 if kind=='Write' and side=='Right' else .10)
   elif teacher and kind in ['Write','Card','Throw'] and side=='Right':
    self.palm(side,(0,.10,1),(0,-1,.10));self.curl(side,.28)
   else:
    # Neutral standing/walking: hand backs lateral, PALMS TOWARDS THIGHS.
    fore=self.world(side+'Hand').translation-self.world(side+'ForeArm').translation;fore.normalize();along=vec((sign*.07,0,-1)).lerp(fore,.22)
    self.palm(side,along,(sign,0,0));self.curl(side,.12)
  # Small intentional glance only for Think; no perpetual nod or scale pulse.
  yaw=.035*math.sin(t*math.tau/3) if kind=='Think' else 0
  self.absolute('Head',Quaternion((1,0,0),.075 if seated else 0)@Quaternion((0,0,1),yaw)@self.rest['Head'].to_quaternion())
  refresh()

 def sample(self):
  normalized={name:C.inverted()@self.world(name)@self.correction[name] for name in self.node_for_bone}
  bynode={self.node_for_bone[name]:m for name,m in normalized.items()};ng=C.inverted()@self.normalization@C
  result={}
  for name,i in self.node_for_bone.items():
   parent=self.parents.get(i);pm=bynode.get(parent,ng@self.original_world[parent] if parent is not None else ng)
   local=pm.inverted()@bynode[i];loc,q,scale=local.decompose();result[i]=(loc,q,scale)
  return result

 def build(self):
  j=copy.deepcopy(self.json);data=bytearray(self.binary);j['animations']=[]
  normalization=C.inverted()@self.normalization@C;root_index=len(j['nodes']);oldroots=j['scenes'][j.get('scene',0)]['nodes'];j['nodes'].append({'name':'Character40Root','matrix':matrix_json(normalization),'children':oldroots});j['scenes'][j.get('scene',0)]['nodes']=[root_index]
  for i in self.node_for_bone.values():
   node=j['nodes'][i];loc,q,scale=node_matrix(node).decompose();node.pop('matrix',None);node.update(translation=list(loc),rotation=[q.x,q.y,q.z,q.w],scale=list(scale))
  clips=[(name,WALK_DURATION if name.startswith('Walk') else duration) for name,duration in (TEACHER_CLIPS if self.role=='teacher' else STUDENT_CLIPS)]
  self.scene.render.fps=FPS
  for kind,duration in clips:
   sample_fps=60 if kind.startswith('Walk') else FPS;count=round(duration*sample_fps)
   times=[f/sample_fps for f in range(count+1)]
   if kind.startswith('Walk'):times=sorted(set(times+[WALK_DURATION*(STANCE-.5),WALK_DURATION*STANCE]))
   samples={i:{'translation':[],'rotation':[]} for i in self.node_for_bone.values()};previous={}
   action=bpy.data.actions.new(kind);self.rig.animation_data.action=action
   for time in times:
    frame=time*FPS;whole=math.floor(frame);self.scene.frame_set(whole,subframe=frame-whole);self.pose(kind,time);pose=self.sample()
    for i,(loc,q,scale) in pose.items():
     if i in previous and previous[i].dot(q)<0:q.negate()
     previous[i]=q.copy();samples[i]['translation'].append(list(loc));samples[i]['rotation'].append([q.x,q.y,q.z,q.w])
    for bone in self.bones.values():
     bone.rotation_mode='QUATERNION';bone.keyframe_insert(data_path='location',frame=frame,group=bone.name);bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
   access_time=append_float(j,data,times,'SCALAR');animation={'name':kind,'samplers':[],'channels':[]}
   for i,paths in samples.items():
    for path,values in paths.items():
     output=append_float(j,data,values,'VEC4' if path=='rotation' else 'VEC3');s=len(animation['samplers']);animation['samplers'].append({'input':access_time,'output':output,'interpolation':'LINEAR'});animation['channels'].append({'sampler':s,'target':{'node':i,'path':path}})
   j['animations'].append(animation);track=self.rig.animation_data.nla_tracks.new();track.name=kind;track.strips.new(kind,0,action);track.mute=True;self.rig.animation_data.action=None;self.actions.append(action)
   self.motion_report[kind]={'duration':duration,'frames':len(times),'jointChannels':len(animation['channels'])}
  self.reset()
  extra={'revision':40,'motionRevision':43,'wristFollowDegrees':3.5,'shoulderSwingDegrees':2,'palmFrameRevision':42,'palmFrame':'long-finger knuckle plane; thumb disambiguates radial side only','role':self.role,'height':self.height,'normalized':True,'forward':'+Z','up':'+Y','feetY':0,'nominalWalkSpeed':self.walk_speed,'cycleDuration':WALK_DURATION,'stanceFraction':STANCE,'stanceTravel':self.walk_span,'walkGaitRevision':43,'walkHipBob':self.walk_bob,'walkHipOffset':self.walk_hip_offset,'walkFootLift':self.walk_lift,'walkSwing':'C2 quintic, contact velocity at both ends','sourceSHA256':self.sha,'preservedOriginalBinaryBytes':self.binary_size,'preservedImagesSHA256':self.images,'motionEvidence':'Reconstructed classroom clips; not extracted original-game animation and not validated by continuous source-video viewing.','fingerWeights':'Preserved, including Ring chains.'}
  if self.role=='teacher':extra['teacherUprightWalkRevision']=2;extra['walkPelvis']='support-leg reach, periodic 15 ms smoothing'
  if self.table_contact:extra['writeContact42']={'source':'actual skinned finger and desk-surface contact fit','tableTop':.875,'pageSurface':.89,'clips':{'Sit':['Left','Right'],'Write':['Left','Right'],'Snack':['Right']}}
  j.setdefault('asset',{}).setdefault('extras',{})['characters40']=extra
  assert bytes(data[:self.binary_size])==bytes(self.binary),'Source binary changed'
  out=self.dir/self.output;write_glb(out,j,data);DEST.mkdir(parents=True,exist_ok=True);(DEST/self.output).write_bytes(out.read_bytes())
  bpy.ops.wm.save_as_mainfile(filepath=str(self.dir/'editable-motion.blend'))
  report={'source':str(self.source),'output':str(DEST/self.output),'sourceSHA256':self.sha,'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'height':self.height,'normalization':matrix_json(normalization),'sourceMeshCount':len(self.json['meshes']),'sourceSkinCount':len(self.json['skins']),'sourceImagesUnchanged':image_hashes(j,data)==self.images,'originalBinaryPrefixUnchanged':True,'fingerWeights':self.finger_report,'bindHeadsBlender':{n:rounded(v) for n,v in self.heads.items()},'clips':self.motion_report,'evidence':extra['motionEvidence']}
  (self.dir/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('CHARACTER40_EXPORTED',self.role,str(out),flush=True)
  return out

def setup_render(scene,height):
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
 world=bpy.data.worlds.new('Character40ReviewWorld');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.75,.77,.80,1);world.node_tree.nodes['Background'].inputs[1].default_value=.75
 for name,position,power,size in [('Key',(-3,-4,5),320,5),('Fill',(4,-2,3),180,4)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(vec((0,0,height*.55))-o.location).to_track_quat('-Z','Y').to_euler()
 cam=bpy.data.objects.new('ReviewCamera',bpy.data.cameras.new('ReviewCamera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=height*1.16;return cam

def render_export(role,path):
 # Read the delivered GLB again. This catches animation/bind conversion bugs
 # that a render of the authoring armature alone would miss.
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');height=SPECS[role][2];cam=setup_render(scene,height)
 source_meshes=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
 for o in scene.objects:
  if o.type=='MESH' and o not in source_meshes:o.hide_render=True
 actions={a.name.split('.')[0]:a for a in bpy.data.actions};rig.animation_data_create()
 for t in rig.animation_data.nla_tracks:t.mute=True
 cases=[('Idle',0,'front'),('Idle',0,'side'),('Walk',.16,'oblique'),('Walk',.66,'side'),('Write',.4,'oblique')]
 if role!='teacher':cases += [('Sit',.3,'side'),('Snack',.6,'front')]
 for kind,time,view in cases:
  if kind not in actions:raise RuntimeError('Imported clip missing '+kind+'; '+str(list(actions)))
  rig.animation_data.action=actions[kind]
  if hasattr(actions[kind],'slots') and actions[kind].slots:rig.animation_data.action_slot=actions[kind].slots[0]
  scene.frame_set(round(time*FPS));refresh();center=vec((0,0,height*.50))
  cam.location={'front':vec((0,-5,height*.50)),'side':vec((5,0,height*.50)),'oblique':vec((3,-5,height*.58))}[view];cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=height*1.16
  scene.render.filepath=str(REVIEW/role/f'{kind.lower()}-{view}-{round(time*100):02}.png');bpy.ops.render.render(write_still=True)
 print('CHARACTER40_REVIEWED_EXPORT',role,flush=True)

def export_palms():
 # New source skin only. UVs remain on the original image; the cap uses the
 # skin-side boundary UVs and actual wrist vertices, not a hidden full body.
 ch=Character('boy');ch.reset();source=ch.meshes[0];reports=[];outdir=REVIEW/'palms';outdir.mkdir(parents=True,exist_ok=True)
 for side in ['Left','Right']:
  wrist=ch.heads[side+'Hand'];frame=ch.frames[side]['quaternion'].to_matrix().to_4x4();transform=frame.inverted()@Matrix.Translation(-wrist)
  m=source.copy();m.data=source.data.copy();m.animation_data_clear();ch.scene.collection.objects.link(m);m.parent=None;m.matrix_world=Matrix.Identity(4);m.name=side+'PalmOnly'
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
  cut=.045
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
  root_group=m.vertex_groups[ch.bones[side+'Hand'].name];root_id=root_group.index
  # Stiffen the cap and narrow wrist collar without changing finger weights.
  for v in bm.verts:
   blend=max(0,min(1,(.032-v.co.y)/.017))
   if blend:
    weights=v[deform]
    for k in list(weights.keys()):weights[k]*=1-blend
    weights[root_id]=weights.get(root_id,0)+blend
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
  rebase=Matrix.Translation(vec((0,-(cut-.015),0)))
  for v in bm.verts:v.co=rebase@v.co
  transform=rebase@transform
  bm.to_mesh(m.data);bm.free();m.data.update()
  for mod in list(m.modifiers):m.modifiers.remove(mod)
  arm=bpy.data.armatures.new(side+'PalmRig');ob=bpy.data.objects.new(side+'PalmRig',arm);ch.scene.collection.objects.link(ob)
  for o in ch.scene.objects:o.select_set(False)
  ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT')
  selected=[b for b in ch.rig.data.bones if b.name.replace('mixamorig:','').replace('mixamorig_','').startswith(side+'Hand')]
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
  bpy.context.view_layer.objects.active=ob;path=outdir/f'hand-{side.lower()}-v2.glb'
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
  j.setdefault('asset',{}).setdefault('extras',{})['characters40']={'role':side.lower()+'Palm','palmFrameRevision':42,'palmFrame':'long-finger knuckle plane; thumb disambiguates radial side only','metric':True,'wrist':[0,0,0],'fingerDirection':'+Y','dorsalDirection':'+Z','sourceSHA256':ch.sha,'parts':'Actual cropped four-finger palm skin only; round capped wrist; original UV texture, no sleeve or arm.'};write_glb(path,j,data);(DEST/path.name).write_bytes(path.read_bytes())
  report={'side':side,'vertices':len(m.data.vertices),'faces':len(m.data.polygons),'openEdges':open_edges,'nonManifoldEdges':nonmanifold,'bones':[b.name for b in arm.bones],'sourceImagesSHA256':ch.images,'outputImagesSHA256':image_hashes(j,data),'wrist':[0,0,0],'fingerDirection':'+Y','dorsalDirection':'+Z'};reports.append(report)
  print('PALM40_EXPORTED',side,str(path),flush=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(outdir/'editable-palms.blend'));(outdir/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))

def render_palms():
 for side in ['Left','Right']:
  path=REVIEW/'palms'/f'hand-{side.lower()}-v2.glb';bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');bones={b.name.replace('mixamorig:','').replace('mixamorig_',''):b for b in rig.pose.bones}
  meshes=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
  for o in scene.objects:
   if o.type=='MESH' and o not in meshes:o.hide_render=True
  cam=setup_render(scene,.28);cam.data.ortho_scale=.44;center=vec((0,0,.10));rest={n:(rig.matrix_world@b.matrix).copy() for n,b in bones.items()}
  for view,pos,curl in [('dorsal',(0,-1,.09),0),('palm',(0,1,.09),0),('side',(1,0,.09),0),('curled',(.6,-1,.23),.58)]:
   for b in bones.values():b.matrix_basis=Matrix.Identity(4)
   for finger in ['Index','Middle','Ring','Pinky']:
    for level,factor in [(1,.52),(2,.76),(3,.50)]:
     name=side+'Hand'+finger+str(level)
     if name in bones:b=bones[name];b.rotation_mode='QUATERNION';axis=rest[name].to_quaternion().inverted()@vec((1,0,0));b.rotation_quaternion=Quaternion(axis,-curl*factor)
   refresh();cam.location=vec(pos);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(REVIEW/'palms'/f'{side.lower()}-{view}.png');bpy.ops.render.render(write_still=True)
 print('PALM40_RENDERED',flush=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--role',choices=list(SPECS)+['all'],default='boy');parser.add_argument('--skip-render',action='store_true');parser.add_argument('--render-only',action='store_true');parser.add_argument('--palms-only',action='store_true');parser.add_argument('--palms-review',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [])
 if args.palms_only:export_palms();return
 if args.palms_review:render_palms();return
 roles=list(SPECS) if args.role=='all' else [args.role]
 for role in roles:
  path=REVIEW/role/SPECS[role][1]
  if not args.render_only:path=Character(role).build()
  if not args.skip_render:render_export(role,path)

if __name__=='__main__':main()
