"""Bake the repeating honey-oak planks used on the staff-room floor."""
from math import cos, hypot, sin
from pathlib import Path
from random import Random

from PIL import Image


def office_floor():
    width = height = 1024
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    rng = Random(54331)
    for row in range(12):
        top, bottom = round(row * height / 12), round((row + 1) * height / 12)
        start = rng.randrange(-420, -20)
        joins = [start + rng.randrange(-44, 44), start + 512 + rng.randrange(-44, 44)]
        joins.append(joins[0] + width)
        for lo, hi in zip(joins, joins[1:]):
            length = hi - lo
            knot_x = rng.uniform(-length, length * 2)
            knot_y = rng.uniform(-90, 180)
            phase, tone = rng.uniform(0, 6), rng.uniform(-14, 14)
            bow = [3 * sin(x / length * 6 + phase) + 1.6 * cos(x / length * 11 + phase) for x in range(length)]
            for py in range(top, bottom):
                y = py - top
                edge = -40 if py == top else -18 if py == top + 1 else -7 if py == bottom - 1 else 0
                row_tone = rng.uniform(-1.4, 1.4) + tone + edge
                for x in range(length):
                    growth = (hypot((x - knot_x) * .119, (y - knot_y) * 1.18) + bow[x]) * .63
                    rings = max(0, cos(growth) - .4) ** 1.6
                    value = row_tone + cos(growth * .17) * 2 - rings * 12.5 + cos(y * .38 + bow[x] * .11) + rng.uniform(-1.8, 1.8)
                    if x < 2:
                        value -= 36
                    pixels[(lo + x) % width, py] = round(178 + value), round(142 + value * .95), round(78 + value * .77)
    return image


if __name__ == "__main__":
    asset = Path(__file__).resolve().parents[1] / "dist/assets/materials/office-oak92.webp"
    office_floor().save(asset, quality=89, method=6)
