"""Bake classroom uniform seams in bind-pose metres onto the original 4K UV layouts.

Run with Python, Pillow and NumPy. Scene and skin data come from the editable GLBs.
"""
import io

import numpy as np
from PIL import Image
from pack_runtime93 import DIST, load, view_bytes

# Base dye, shoulder height, trouser stripe centre (left/right at ankle and hip).
STUDENTS = {
    "student-boy-v4": ([41,142,249], 1.010, [-.015,-.012,-.004,.001]),
    "student-girl-v4": ([49,135,251], 1.020, [-.014,.008,.009,.018]),
    "student-glasses-v2": ([45,132,249], .954, [-.008,.005,-.008,.009]),
    "student-ponytail-v1": ([30,108,245], .991, [-.011,.001,-.006,.005]),
}
TEACHER = "teacher-v2"


def attr(doc, data, index):
    a = doc["accessors"][index]
    v = doc["bufferViews"][a["bufferView"]]
    dtype = np.dtype({5121:"u1",5123:"<u2",5125:"<u4",5126:"<f4"}[a["componentType"]])
    count = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}[a["type"]]
    return np.ndarray((a["count"],count), dtype, data,
                      offset=v.get("byteOffset",0)+a.get("byteOffset",0),
                      strides=(v.get("byteStride",dtype.itemsize*count),dtype.itemsize))


def geometry(doc, data):
    def visit(index, parent):
        node = doc["nodes"][index]
        if "matrix" in node:
            local = np.array(node["matrix"]).reshape(4,4).T
        else:
            x,y,z,w = node.get("rotation", (0,0,0,1))
            rot = np.array([[1-2*y*y-2*z*z,2*x*y-2*w*z,2*x*z+2*w*y],
                            [2*x*y+2*w*z,1-2*x*x-2*z*z,2*y*z-2*w*x],
                            [2*x*z-2*w*y,2*y*z+2*w*x,1-2*x*x-2*y*y]])
            local = np.eye(4)
            local[:3,:3] = rot @ np.diag(node.get("scale",(1,1,1)))
            local[:3,3] = node.get("translation",(0,0,0))
        world = parent @ local
        if "skin" in node:
            yield node,world
        for child in node.get("children",[]):
            yield from visit(child,world)

    found = [m for root in doc["scenes"][doc.get("scene",0)]["nodes"] for m in visit(root,np.eye(4))]
    (node,world), = found
    prim, = doc["meshes"][node["mesh"]]["primitives"]
    attribs = prim["attributes"]
    positions = attr(doc,data,attribs["POSITION"]) @ world[:3,:3].T + world[:3,3]
    skin = doc["skins"][node["skin"]]
    bones = [doc["nodes"][b]["name"].lower() for b in skin["joints"]]
    cloth = np.array([not any(v in name for v in ("head","neck","hand","foot","toe")) for name in bones])
    influences = attr(doc,data,attribs["WEIGHTS_0"]).astype(float)
    influence = (cloth[attr(doc,data,attribs["JOINTS_0"])]*influences).sum(1)/np.maximum(influences.sum(1),1e-9)
    return np.column_stack((positions,influence)),attr(doc,data,attribs["TEXCOORD_0"]),attr(doc,data,prim["indices"]).reshape(-1,3)


def step(a,b,value):
    t = np.clip((value-a)/(b-a),0,1)
    return t*t*(3-2*t)


def blend(a,b,t):
    return a+(b-a)*t[:,None]


def student_panels(name, points, color):
    x,y,z,garment = points.T
    ax = abs(x)
    base,shoulder,offsets = STUDENTS[name]
    blue = np.array(base)
    white = np.array([246,246,249])
    # Follow the shoulder slope and the back yoke across disconnected UV pieces.
    if "glasses" in name:
        edge = shoulder+.45*np.maximum(0,ax-.235)
    else:
        edge = shoulder-.26*np.maximum(0,ax-.210)
    edge -= .009*step(.025,.15,z)*(1-step(.05,.17,ax))
    flank = np.maximum(step(.10,.155,ax),1-step(-.05,.025,z))
    seam = flank*(1-step(.035,.069,abs(y-edge)))*(1-step(.32,.38,ax))
    # Remove stray dark/skin-coloured marks higher on the white panel, without
    # bleaching the original blue collar where the panel turns into the neck.
    upper_panel = step(edge+.024,edge+.043,y)*(1-step(1.106,1.15,y))
    is_collar_blue = step(57,105,color[:,2]-color[:,0])
    seam = np.maximum(seam,flank*upper_panel*(1-is_collar_blue)*(1-step(.31,.36,ax)))
    upper = step(edge-.0015,edge+.0015,y)
    # Keep the embroidery, front zipper and its original shaded edges.
    if "girl" in name or "ponytail" in name:
        zip_width = .014
    else:
        zip_width = .115
    front = step(.06,.12,z)
    seam *= 1-front*(1-step(zip_width,zip_width+.023,ax))
    badge_x,badge_y = {"student-boy-v4":(.136,1.038),"student-girl-v4":(.099,1.063),
                       "student-glasses-v2":(.143,1.018),"student-ponytail-v1":(.089,1.030)}[name]
    seam *= 1-front*(1-step(.034,.042,abs(x-badge_x)))*(1-step(.040,.049,abs(y-badge_y)))

    ankle = .165 if "glasses" in name else .20
    rise = step(ankle,.65,y)
    center = np.where(x<0,offsets[0]+(offsets[1]-offsets[0])*rise,offsets[2]+(offsets[3]-offsets[2])*rise)
    top = {"student-boy-v4":.656,"student-girl-v4":.703,
           "student-glasses-v2":.653,"student-ponytail-v1":.659}[name]
    stripe = step(ankle,ankle+.028,y)*(1-step(top+.014,top+.033,y))*step(.11,.145,ax)
    dz = abs(z-center)
    stripe *= 1-step(.059,.089,dz)
    stripe_white = (1-step(.019,.0225,dz))*(1-step(top-.002,top+.001,y))
    panel = np.where(stripe>0,stripe_white,upper)
    # Retain a little of the native cloth shading only where its dye matches.
    old_blue = step(65,130,color[:,2]-color[:,0])
    old_white = step(160,215,color.min(axis=1))
    lit_blue = blend(np.broadcast_to(blue,color.shape),color,.32*old_blue)
    lit_white = blend(np.broadcast_to(white,color.shape),color,.30*old_white)
    target = blend(lit_blue,lit_white,panel)
    mask = np.maximum(seam,stripe)*step(.74,.98,garment)
    result = blend(color,target,mask)
    # The end of each sleeve is a ring perpendicular to its forearm.
    cuff_end = {"student-boy-v4":-.484,"student-girl-v4":-.500,
                "student-glasses-v2":-.504,"student-ponytail-v1":-.481}[name]
    along = .48*ax-.877*y-cuff_end
    cuff = step(.28,.32,ax)*step(-.039,-.020,along)*(1-step(-.002,.001,along))
    cuff *= step(.45,.90,garment)
    return blend(result,lit_blue,cuff)


def teacher_panels(points,color):
    x,y,z,garment = points.T
    ax = abs(x)
    hem = .863+.013*step(.10,.22,ax)-.004*step(0,.15,z)
    mask = (1-step(.025,.058,abs(y-hem)))*(1-step(.204,.24,ax))
    shirt = np.array([220,229,209])
    pants = np.array([68,47,35])
    old_shirt = step(145,205,color.min(axis=1))
    old_pants = 1-step(80,145,color.max(axis=1))
    sage = blend(np.broadcast_to(shirt,color.shape),color,.32*old_shirt)
    brown = blend(np.broadcast_to(pants,color.shape),color,.65*old_pants)
    target = blend(brown,sage,step(hem-.0016,hem+.0016,y))
    # The outer shirt panels pick up stray flesh colour under the short sleeves.
    side = step(.11,.15,ax)*(1-step(.208,.248,ax))*(1-step(.065,.14,abs(z)))
    side *= step(.90,.95,y)*(1-step(1.21,1.27,y))
    result = blend(color,target,mask*step(.75,.98,garment))
    along = .48*ax-.877*y+.946
    sleeve = step(.21,.265,ax)*step(-.036,-.019,along)*(1-step(-.002,.001,along))
    return blend(result,sage,np.maximum(side,sleeve)*step(.75,.98,garment))


def bake(name):
    doc,data = load(name)
    base_index = doc["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    image = doc["images"][doc["textures"][base_index]["source"]]
    raw = view_bytes(doc,data,image["bufferView"])
    original = np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
    h,w,_ = original.shape
    result = original.copy()
    pts,uv,faces = geometry(doc,data)
    uv = uv.astype(np.float64)*[w,h]-.5
    covered = np.zeros((h,w),bool)
    changed = 0
    for ids in faces:
        xyz = pts[ids]
        tri = uv[ids]
        lo = np.maximum(0,np.ceil(tri.min(0)).astype(int))
        hi = np.minimum([w-1,h-1],np.floor(tri.max(0)).astype(int))
        if np.any(lo>hi):
            continue
        a,b,c = tri
        ex,ey = b-a
        fx,fy = c-a
        det = ex*fy-ey*fx
        if abs(det)<1e-8:
            continue
        iy,ix = np.ogrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        u = ((ix-a[0])*fy-(iy-a[1])*fx)/det
        v = ((iy-a[1])*ex-(ix-a[0])*ey)/det
        inner = (u>=0)&(v>=0)&(u+v<=1)
        row,col = np.nonzero(inner)
        if not len(row):
            continue
        row += lo[1]
        col += lo[0]
        covered[row,col] = True
        if xyz[:,3].max()<.45 or xyz[:,1].max()<.15 or xyz[:,1].min()>1.32:
            continue
        coord = xyz[0]+u[inner,None]*(xyz[1]-xyz[0])+v[inner,None]*(xyz[2]-xyz[0])
        old = original[row,col].astype(float)
        new = teacher_panels(coord,old) if name==TEACHER else student_panels(name,coord,old)
        pixels = np.uint8(np.rint(np.clip(new,0,255)))
        result[row,col] = pixels
        changed += np.count_nonzero(np.max(abs(new-old),axis=1)>3)
    assert changed>12000, (name,changed)
    # Extend changed island edge pixels into their unused gutters for mipmaps.
    seeds = (result != original).any(axis=2)
    for _ in range(4):
        updated = np.zeros_like(seeds)
        for axis,delta in ((0,-1),(0,1),(1,-1),(1,1)):
            candidate = np.roll(seeds,delta,axis) & ~covered
            sy,sx = np.nonzero(candidate)
            result[sy,sx] = result[(sy-(delta if axis==0 else 0))%h,(sx-(delta if axis==1 else 0))%w]
            updated |= candidate
            covered |= candidate
        seeds = updated
    output = DIST/"assets/materials"/(name+"-cloth107.webp")
    Image.fromarray(result).save(output, "WEBP",quality=96,method=5)
    print(f"{name}: {w}x{h}, {changed:,} garment texels corrected, {output.stat().st_size:,} bytes",flush=True)


if __name__=="__main__":
    for model in [*STUDENTS,TEACHER]:
        bake(model)
