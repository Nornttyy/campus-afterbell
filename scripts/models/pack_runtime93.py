"""Build lossless delivery copies for the web game. The original GLBs stay editable."""
import collections
import gzip
import hashlib
import io
import json
from pathlib import Path
import struct
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

DIST = Path(__file__).resolve().parents[2] / "dist"
SOURCE = DIST / "assets/models"
OUTPUT = DIST / "assets/stream93"
MODELS = """
student-boy-v4 student-girl-v4 student-glasses-v2 student-ponytail-v1 teacher-v2
hand-left-v3 hand-right-v3 teacher-hand-left-v1 teacher-hand-right-v1 desk-v2 chair-v2
snack-v1 drink-v1 burger-v1 ink-v1 banana-v1 garlic-v1 phone-v67 gum-v67 lunch-v67 pen-v67
mouse-v67 keyboard-v67 computer-tower-v67 monitor-v67 office-desk-v67 office-chair-v67 cabinet-v67 toilet-v78
""".split()


def load(name):
    raw = (SOURCE / (name + ".glb")).read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    return json.loads(raw[20:20 + size]), memoryview(raw)[28 + size:]


def view_bytes(doc, binary, index):
    view = doc["bufferViews"][index]
    start = view.get("byteOffset", 0)
    return binary[start:start + view["byteLength"]].tobytes()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()[:20]


def lossless_webp(raw):
    with Image.open(io.BytesIO(raw)) as src:
        if src.mode not in ("RGB", "RGBA", "L", "LA") or any(k in src.info for k in ("icc_profile", "gamma", "chromaticity")):
            return None
        out = io.BytesIO()
        src.save(out, "WEBP", lossless=True, exact=True, method=4)
        result = out.getvalue()
        if len(result) >= len(raw):
            return None
        with Image.open(io.BytesIO(result)) as check:
            assert check.convert("RGBA").tobytes() == src.convert("RGBA").tobytes()
        return result


def fields(obj, key):
    if isinstance(obj, list):
        for entry in obj:
            yield from fields(entry, key)
    elif isinstance(obj, dict):
        for name, value in obj.items():
            if name == key:
                yield obj
            else:
                yield from fields(value, key)


def use_webp(doc,index):
    for texture in doc.get("textures",[]):
        if texture.get("source")==index:
            texture.setdefault("extensions",{})["EXT_texture_webp"] = {"source":texture.pop("source")}
    for field in ("extensionsUsed","extensionsRequired"):
        if "EXT_texture_webp" not in doc.setdefault(field,[]):
            doc[field].append("EXT_texture_webp")


def encode_model(name, shared):
    doc, binary = load(name)
    if name == "student-glasses-v2":
        # Both shipped character shaders use the base-colour texture only.
        # Assert the exact source layout before omitting the unused normal atlas.
        mat, = doc["materials"]
        assert mat["normalTexture"]["index"] == 1 and len(doc["textures"]) == len(doc["images"]) == 2
        assert mat["pbrMetallicRoughness"]["baseColorTexture"]["index"] == doc["textures"][0]["source"] == 0
        del mat["normalTexture"]
        doc["textures"].pop()
        doc["images"].pop()
    image_views = {}
    for index, image in enumerate(doc.get("images", [])):
        vi = image["bufferView"]
        raw = view_bytes(doc, binary, vi)
        key = digest(raw)
        if index == 0 and name in MODELS[:5]:
            filename = name + "-cloth107.webp"
            if not (DIST / "assets/materials" / filename).is_file():
                raise FileNotFoundError("Bake uniforms first: " + filename)
            image.pop("bufferView")
            image.update(uri="../materials/" + filename, mimeType="image/webp")
            use_webp(doc,index)
        elif key in shared:
            image.pop("bufferView")
            image["uri"] = shared[key]
        elif image["mimeType"] == "image/png":
            converted = lossless_webp(raw)
            if converted is not None:
                image_views[vi] = converted
                image["mimeType"] = "image/webp"
                use_webp(doc,index)
    # Preserve all mesh/skin/clip accessor bytes, layout and ordering. Old hand
    # exports contain a second, unreferenced copy of the body's colour atlas.
    refs = list(fields(doc, "bufferView"))
    ids = sorted({r["bufferView"] for r in refs})
    buffer = bytearray()
    views = []
    offsets = {}
    for old in ids:
        view = dict(doc["bufferViews"][old])
        data = image_views.get(old)
        if data is None:
            data = view_bytes(doc, binary, old)
        key = hashlib.sha256(data).digest()
        if key not in offsets:
            buffer.extend(bytes(-len(buffer) % 4))
            offsets[key] = len(buffer)
            buffer.extend(data)
        view.update(buffer=0, byteOffset=offsets[key], byteLength=len(data))
        views.append(view)
    mapping = {old: new for new, old in enumerate(ids)}
    for ref in refs:
        ref["bufferView"] = mapping[ref["bufferView"]]
    doc["bufferViews"] = views
    doc["buffers"] = [{"byteLength": len(buffer)}]
    header = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    buffer.extend(bytes(-len(buffer) % 4))
    glb = struct.pack("<4sIIII", b"glTF", 2, 28 + len(header) + len(buffer), len(header), 0x4e4f534a) + header + struct.pack("<II", len(buffer), 0x004e4942) + buffer
    compressed = gzip.compress(glb, compresslevel=6, mtime=0)
    filename = name + "." + digest(compressed) + ".glz"
    (OUTPUT / filename).write_bytes(compressed)
    return name, filename


def main():
    OUTPUT.mkdir(exist_ok=True)
    sources = {}
    counts = collections.Counter()
    for name in MODELS:
        doc, binary = load(name)
        for image in doc.get("images", []):
            raw = view_bytes(doc, binary, image["bufferView"])
            key = digest(raw)
            counts[key] += 1
            sources[key] = (raw, image["mimeType"])
    shared = {}
    for key, count in counts.items():
        if count < 2:
            continue
        raw, mime = sources[key]
        filename = "shared-" + key + (".jpg" if mime == "image/jpeg" else ".png")
        (OUTPUT / filename).write_bytes(raw)
        shared[key] = filename
    with ThreadPoolExecutor(max_workers=3) as pool:
        manifest = dict(pool.map(lambda n: encode_model(n, shared), MODELS))
    (OUTPUT / "models.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    used = [*manifest.values(), *shared.values()]
    print(len(manifest), "models;", sum((OUTPUT / n).stat().st_size for n in used), "bytes including shared textures")


if __name__ == "__main__":
    main()
