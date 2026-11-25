"""Rebuild the hair-vertex selection from the editable purple student's GLB atlas."""
import base64
import io
import re
from pathlib import Path

from paint_uniform107 import geometry
from pack_runtime93 import load, view_bytes
import numpy as np
from PIL import Image

def bob_selection():
    doc, binary = load("student-girl-v4")
    points, uv, _ = geometry(doc, binary)
    image = Image.open(io.BytesIO(view_bytes(doc, binary, doc["images"][0]["bufferView"])))
    atlas = np.asarray(image.convert("RGB"))
    row = np.floor(uv[:, 1] * image.height).astype(int) % image.height
    col = np.floor(uv[:, 0] * image.width).astype(int) % image.width
    r, g, b = atlas[row, col].astype(float).T
    x, y, z = points[:, :3].T
    purple = (r > g * 1.25) & (b > g * 1.28) & (b > r * .37)
    cap = (y > 1.583) & (z < .28)
    old_ear = (abs(x) > .245) & (z < .081) & (y > 1.27)
    angle = abs(np.arctan2(x, z + .049))
    selected = (y > 1.154) & (purple | cap | old_ear) & ((y > 1.485) | (angle > np.radians(41)))
    return base64.b64encode(np.packbits(selected, bitorder="little")).decode()

if __name__ == "__main__":
    source = Path(__file__).resolve().parents[2] / "dist/student-hair109.js"
    source.write_text(re.sub(r"const bobSelection='[^']+';", f"const bobSelection='{bob_selection()}';", source.read_text(), count=1))
