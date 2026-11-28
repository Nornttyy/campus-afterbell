"""Separate exact inventory geometry and finishes for the playable corridor entry."""
import gzip
import hashlib
import json
import struct
from copy import deepcopy
from pathlib import Path

DIST = Path(__file__).resolve().parents[2] / "dist"
PACK = DIST / "assets/stream93"


def write_part(name, doc, data):
    views = doc.pop("bufferViews")
    doc.pop("buffers")
    packed = bytearray()
    selected = []
    indices = {}

    def remap(obj):
        if isinstance(obj, list):
            for child in obj:
                remap(child)
        elif isinstance(obj, dict):
            for key, value in obj.items():
                if key != "bufferView":
                    remap(value)
                    continue
                if value not in indices:
                    view = views[value].copy()
                    start = view.get("byteOffset", 0)
                    packed.extend(bytes(-len(packed) % 4))
                    view["byteOffset"] = len(packed)
                    packed.extend(data[start:start + view["byteLength"]])
                    indices[value] = len(selected)
                    selected.append(view)
                obj[key] = indices[value]

    remap(doc)
    doc.update(bufferViews=selected, buffers=[{"byteLength": len(packed)}])
    head = json.dumps(doc, separators=(",", ":")).encode()
    head += b" " * (-len(head) % 4)
    packed.extend(bytes(-len(packed) % 4))
    binary = struct.pack("<4sIIII", b"glTF", 2, 28 + len(head) + len(packed), len(head), 0x4e4f534a)
    binary += head + struct.pack("<II", len(packed), 0x004e4942) + packed
    result = gzip.compress(binary, compresslevel=7, mtime=0)
    path = name + "." + hashlib.sha256(result).hexdigest()[:20] + ".glz"
    (PACK / path).write_bytes(result)
    return path


def main():
    sources = json.loads((PACK / "models.json").read_text())
    sources.update(json.loads((DIST / "game-models158.js").read_text().split(" = ")[1].rstrip(";\n")))
    catalog = {}
    for model in ("burger-v1", "ink-v1", "banana-v1", "lunch-v67", "drink-v1", "phone-v67"):
        raw = gzip.decompress((PACK / sources[model]).read_bytes())
        length, = struct.unpack_from("<I", raw, 12)
        doc = json.loads(raw[20:20 + length])
        data = raw[28 + length:]
        geometry = deepcopy(doc)
        for key in ("images", "extensionsUsed", "extensionsRequired", "textures", "samplers"):
            geometry.pop(key, None)
        assert set(doc.get("extensionsUsed", [])) <= {"EXT_texture_webp"}
        geometry["materials"] = [{"name": mat.get("name", str(i))} for i, mat in enumerate(doc["materials"])]
        finishes = {k: v for k, v in doc.items() if k in ("asset", "materials", "textures", "samplers", "images", "extensionsUsed", "extensionsRequired", "buffers", "bufferViews")}
        finishes.update(scenes=[{}], scene=0)
        catalog[model] = [write_part(model + "-mesh", geometry, data), write_part(model + "-finish", finishes, data)]
    (DIST / "inventory-packs160.js").write_text("export const inventoryPacks = " + json.dumps(catalog, indent=2) + ";\n")


if __name__ == "__main__":
    main()
