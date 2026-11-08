"""Reuse the verified high-to-low texture bake for user-selected banana/garlic."""
from pathlib import Path
import sys
source=Path(__file__).with_name('prepare_food35.py').read_text()
source=source.replace("SOURCE = ROOT / 'art-source/tripo-props-20261107'", "SOURCE = ROOT / 'art-source/tripo-props-20261108'")
source=source.replace("'burger': {'dimensions':", "'banana': {'dimensions': (.13,.06,.25), 'triangles': 6000, 'texture': 2048, 'yaw': 0},\n    'garlic': {'dimensions': (.09,.06,.12), 'triangles': 3500, 'texture': 2048, 'yaw': 0},\n    'burger': {'dimensions':")
exec(compile(source, str(Path(__file__).with_name('prepare_food35.py')), 'exec'))
