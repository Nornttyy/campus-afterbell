"""Build the cropped student's bare wrist against the actual palm perimeter."""
import collections
import json
import math
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "dist/assets/models"
COMPONENT = {5126: "f", 5121: "B", 5123: "H"}
WIDTH = {"VEC2": 2, "VEC3": 3, "VEC4": 4, "SCALAR": 1, "MAT4": 16}


def mix(a, b, t):
    return tuple(x + (y-x)*t for x, y in zip(a, b))


def clamp(x, lo=0., hi=1.):
    return min(hi, max(lo, x))


def unit(v):
    return tuple(x/math.hypot(*v) for x in v)


def weights(a, b, t):
    balance = collections.defaultdict(float)
    for vert, factor in ((a, 1-t), (b, t)):
        for joint, weight in zip(vert["JOINTS_0"], vert["WEIGHTS_0"]):
            balance[joint] += factor*weight
    top = sorted(((w, j) for j, w in balance.items() if w > 0), reverse=True)[:4]
    total = sum(w for w, _ in top)
    top += [(0., 0)]*(4-len(top))
    return {"JOINTS_0": tuple(j for _, j in top), "WEIGHTS_0": tuple(w/total for w, _ in top)}


def build(side):
    raw = (ROOT/f"ponytail-hand-{side}-v1.glb").read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    source = raw[28+size:]

    def codec(a):
        return struct.Struct("<"+str(WIDTH[a["type"]])+COMPONENT[a["componentType"]])

    def read(i):
        a = doc["accessors"][i]
        view = doc["bufferViews"][a["bufferView"]]
        start = a.get("byteOffset", 0)+view.get("byteOffset", 0)
        row = codec(a)
        return [row.unpack_from(source, start+j*view.get("byteStride", row.size)) for j in range(a["count"])]

    hand, cap = doc["meshes"][0]["primitives"]
    attributes = {key: read(i) for key, i in hand["attributes"].items()}
    verts = [dict(zip(attributes, values)) for values in zip(*attributes.values())]
    indices = [i for i, in read(hand["indices"])]
    names = [doc["nodes"][n]["name"] for n in doc["skins"][0]["joints"]]
    forearm = next(i for i, n in enumerate(names) if n.endswith("ForeArm"))
    arm = {"JOINTS_0": (forearm, 0, 0, 0), "WEIGHTS_0": (1., 0., 0., 0.)}
    # The skin-coloured section dips below the wrist at the base of the thumb.
    distance = []
    for v in verts:
        thumb = sum(w for j, w in zip(v["JOINTS_0"], v["WEIGHTS_0"]) if "Thumb" in names[j])
        distance.append(v["POSITION"][1]+.008+.010*clamp((thumb-.45)/.5))
    edges = {}
    triangles = []
    border = []

    def intersection(a, b):
        key = tuple(sorted((a, b)))
        if key not in edges:
            t = distance[a]/(distance[a]-distance[b])
            v = {k: mix(verts[a][k], verts[b][k], t) for k in attributes if k not in arm}
            v["NORMAL"] = unit(v["NORMAL"])
            v.update(weights(verts[a], verts[b], t))
            edges[key] = len(verts)
            verts.append(v)
        return edges[key]

    for i in range(0, len(indices), 3):
        face = indices[i:i+3]
        clipped = []
        for a, b in zip(face, face[1:]+face[:1]):
            if distance[a] >= 0:
                clipped.append(a)
            if (distance[a] >= 0) != (distance[b] >= 0):
                clipped.append(intersection(a, b))
        for k in range(1, len(clipped)-1):
            triangles.extend((clipped[0], clipped[k], clipped[k+1]))
        for a, b in zip(clipped, clipped[1:]+clipped[:1]):
            if min(a, b) >= len(distance):
                border.append((a, b))

    # Extend the same rim vertices, keeping UV seams separate and continuing
    # their local tangent into the wrist. No independent sleeve overlaps them.
    rings = {}
    capverts, capindices = [], []
    atlas = Image.open(ROOT/doc["images"][0]["uri"]).convert("RGB")
    rim_y = -.061
    levels = (.18, .42, .70, 1.)
    def extend(i):
        if i in rings:
            return rings[i]
        v = verts[i]
        x, y, z = v["POSITION"]
        nx, ny, nz = v["NORMAL"]
        angle = math.atan2(z/.037, x/.048)
        ex, ez = .048*math.cos(angle), .037*math.sin(angle)
        radial = unit((x, z))
        slope = clamp(-ny/max(.25, nx*radial[0]+nz*radial[1]), -1., 1.)
        dx, dz = (radial[k]*slope*(rim_y-y) for k in range(2))
        ring = [i]
        for t in levels:
            h = t*t*(3-2*t)
            tangent = t*(1-t)**2
            pos = (x+(ex-x)*h+dx*tangent, y+(rim_y-y)*t, z+(ez-z)*h+dz*tangent)
            grad = unit((math.cos(angle)/.048, 0., math.sin(angle)/.037))
            normal = unit(mix(v["NORMAL"], grad, t))
            ring.append(len(verts))
            verts.append(dict(v, POSITION=pos, NORMAL=normal, **weights(v, arm, h)))
        ring.append(len(verts))
        verts.append(dict(v, POSITION=(ex*.90, -.0645, ez*.90),
                          NORMAL=unit((grad[0]*.4, -.92, grad[2]*.4)), **arm))
        rings[i] = ring
        return ring

    def pigment(v):
        # Match the same bilinear texel lookup as the textured skin on the rim.
        u, w = v["TEXCOORD_0"]
        x, y = u*atlas.width-.5, w*atlas.height-.5
        ix, iy = math.floor(x), math.floor(y)
        def tex(a, b):
            srgb = atlas.getpixel((a % atlas.width, b % atlas.height))
            return tuple((c/255/12.92 if c/255<=.04045 else ((c/255+.055)/1.055)**2.4) for c in srgb)
        return mix(mix(tex(ix, iy), tex(ix+1, iy), x-ix), mix(tex(ix, iy+1), tex(ix+1, iy+1), x-ix), y-iy)

    seam = collections.Counter()
    for a, b in border:
        ra, rb = extend(a), extend(b)
        for j in range(len(ra)-1):
            triangles.extend((rb[j], ra[j], ra[j+1], rb[j], ra[j+1], rb[j+1]))
        for i in (a,b):
            seam[tuple(round(c, 6) for c in verts[i]["POSITION"])] += 1
        for i in (rb[-1], ra[-1]):
            capverts.append(dict(verts[i], COLOR_0=pigment(verts[i])))
    assert seam and set(seam.values()) == {2}, "Open palm boundary"
    center = len(capverts)
    color = tuple(sum(v["COLOR_0"][k] for v in capverts)/center for k in range(3))
    capverts.append(dict(capverts[0], POSITION=(0., -.0645, 0.), NORMAL=(0., -1., 0.), COLOR_0=color))
    for i in range(0, center, 2):
        capindices.extend((i, i+1, center))

    # Repack only referenced vertices. All untouched hand triangles retain
    # their source attributes and the rig's original inverse bind matrices.
    used = sorted(set(triangles))
    remap = {j:i for i,j in enumerate(used)}
    arrays = {doc["skins"][0]["inverseBindMatrices"]:read(doc["skins"][0]["inverseBindMatrices"])}
    for primitive, rows, ids in ((hand,[verts[i] for i in used],[remap[i] for i in triangles]), (cap,capverts,capindices)):
        for key, acc in primitive["attributes"].items():
            arrays[acc] = [v[key] for v in rows]
        arrays[primitive["indices"]] = [(i,) for i in ids]
    binary = bytearray()
    views = []
    for i, acc in enumerate(doc["accessors"]):
        rows = arrays[i]
        row = codec(acc)
        blob = b"".join(row.pack(*v) for v in rows)
        binary.extend(bytes(-len(binary)%4))
        view = dict(doc["bufferViews"][acc["bufferView"]], byteOffset=len(binary), byteLength=len(blob))
        acc.update(bufferView=len(views), count=len(rows))
        acc.pop("byteOffset", None)
        for key, op in (("min",min),("max",max)):
            if key in acc:
                acc[key] = [op(k) for k in zip(*rows)]
        binary.extend(blob)
        views.append(view)
    doc["bufferViews"] = views
    binary.extend(bytes(-len(binary)%4))
    doc["buffers"] = [{"byteLength":len(binary)}]
    doc["asset"]["extras"]["characters40"].update(continuousWrist=True,forearmLength=.0645,proximalCutY=rim_y,capDepth=.0035)
    header = json.dumps(doc,separators=(",",":")).encode()
    header += b" "*(-len(header)%4)
    result = struct.pack("<4sIIII",b"glTF",2,28+len(header)+len(binary),len(header),0x4e4f534a) + header + struct.pack("<II",len(binary),0x004e4942) + binary
    (ROOT/f"ponytail-hand-{side}-v2.glb").write_bytes(result)


if __name__ == "__main__":
    for side in ("left","right"):
        build(side)
