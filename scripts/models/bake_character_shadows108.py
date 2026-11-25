from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from math import sqrt,cos,sin,pi
import json,struct,sys
source,destination=sys.argv[sys.argv.index('--')+1:]
rows=json.loads(Path(source).read_text());table={};data=bytearray()
samples=48
rays=[(sqrt((i+.5)/samples)*cos(2*pi*i*.618033989),sqrt((i+.5)/samples)*sin(2*pi*i*.618033989),sqrt(1-(i+.5)/samples)) for i in range(samples)]
for row in rows:
 name,key=row['file'],row['key'];pts=[Vector(v) for v in row['coords']];ns=[Vector(v) for v in row['normals']]
 ix=row['indices'];faces=[tuple(ix[i:i+3]) for i in range(0,len(ix),3)]
 tree=BVHTree.FromPolygons(pts,faces,all_triangles=True)
 offset=len(data);span=.065 if 'hand-' in name else .145
 for p,normal in zip(pts,ns):
  n=normal.normalized();u=n.cross(Vector((0,0,1) if abs(n.z)<.8 else (0,1,0))).normalized();v=n.cross(u)
  origin=p+n*.0025;occ=0
  for a,b,c in rays:
   ray=u*a+v*b+n*c
   hit,_,_,d=tree.ray_cast(origin,ray,span)
   if hit is None:continue
   # Freely hanging forearms temporarily lie beside the hip in the bind pose.
   # Do not bake those moving parts as stripes into the lower jacket.
   if 'hand-' not in name and .32<p.y<1.20 and abs(abs(p.x)-abs(hit.x))>.06:continue
   occ+=(1-(d/span)**1.7)
  data.append(min(255,round(255*occ/samples)))
 table.setdefault(name,{})[key]=[offset,len(pts)]
 print(name,key,len(pts),min(data[offset:]),max(data[offset:]),flush=True)
h=json.dumps(table,separators=(',',':')).encode()
Path(destination).write_bytes(struct.pack('<I',4+len(h))+h+data)
