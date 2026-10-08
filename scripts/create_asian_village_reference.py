#!/usr/bin/env python3
"""Create a separate reference-scene map from the modular Village Pack kit."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "maps/asian-village-reference.json"
objects = []


def add(asset, x, z, rot=0, scale=1, pack="village-pack", y=0):
    objects.append({
        "pack": pack,
        "asset": asset,
        "pos": [x, y, z],
        "rotY": rot,
        "scale": [scale, scale, scale] if isinstance(scale, (int, float)) else scale,
    })


# Mountain ring: overlapping ridges create a natural, uneven horizon.
for asset, x, s in (("Mountain_Ridge_A", -13, .82),
                    ("Mountain_Ridge_B", 0, .82),
                    ("Mountain_Peak", 13, .78)):
    add(asset, x, -24, scale=s)
for asset, x, z, rot in (("Mountain_Ridge_B", -20, -6, 90),
                         ("Mountain_Ridge_A", -20, 8, 90),
                         ("Mountain_Ridge_A", 20, -7, 270),
                         ("Mountain_Ridge_B", 20, 7, 270)):
    add(asset, x, z, rot, .8)
add("Mountain_Peak", -16, -23, 0, .8)
add("Mountain_Cliff", 20, -25, 0, .9)
add("tower", 20, -25, 0, .9, y=15.075)

# A seamless 8 m terrain grid keeps the village from floating over an empty plane.
for x in (-20, -12, -4, 4, 12, 20):
    for z in (-28, -20, -12, -4, 4, 12, 20):
        material = "Ground_Earth_8" if abs(x) <= 12 and abs(z) <= 12 else "Ground_Grass_8"
        add(material, x, z)

# A stream runs across the foreground and turns toward the mountain valley.
add("River_Bend", -14, 8, 90)
for x in (-10, -6, -2, 2, 6, 10):
    add("River_Straight", x, 8, 90)
add("River_Bend", 14, 8, 180)
add("River_Straight", -14, 4)
add("River_End", -14, 0)
add("River_Straight", 14, 4)
add("River_End", 14, 0, 180)
add("Bridge_Stone", 0, 8)

# Main rampart and gate; each wall section uses a four-metre connector span.
for x in (-22, -18, -14, -10, -6, 6, 10, 14, 18, 22):
    add("Wall_Straight", x, -4)
add("Wall_Gate", 0, -4)
add("Wall_Tower", -22, -4, scale=.82)
add("Wall_Tower", 22, -4, scale=.82)

# Main road passes over the stream and through the gate, with one east-side branch.
for z in (20, 16, 12, 4, 0, -4, -12):
    add("Road_Straight", 0, z)
add("Road_TJunction", 0, -8, 90)
for x in (4, 8):
    add("Road_Straight", x, -8, 90)
add("Road_End", 12, -8, 90)
add("Road_Corner", -4, 0, 90)

# Homes, shops and landmarks form tight street clusters behind and before the wall.
for asset, x, z, rot, scale in (
    ("building_1", -14, -12, 35, 1), ("shop", -7, -12, 90, 1),
    ("shop", 7, -12, 270, 1), ("building_1", 14, -12, 270, .92),
    ("building_2", -14, -18, 0, 1), ("granary", -7, -18, 0, 1),
    ("shrine", 7, -18, 0, 1.05),
    ("building_2", -10, 1, 90, .95), ("building_3", 10, 1, 270, .95),
    ("shop", -18, -1, 0, .85), ("granary", 18, -1, 180, .88),
):
    add(asset, x, z, rot, scale)

# Trees, rocks and village props soften the walls, stream banks and road edges.
for asset, placements in (
    ("Tree_Broadleaf", [(-19,15,0,.9),(-15,10,0,1),
                        (-11,5,0,.8),(14,5,0,.92),(19,14,0,.86),
                        (11,18,0,.9),(-12,18,0,.83),
                        (-18,-11,0,.78),(18,-11,0,.86),(-4,-18,0,.7)]),
    ("Tree_Pine", [(-18,-17,0,.85),(-8,-21,0,.78),(2,-22,0,.82),
                    (9,-20,0,.9),(20,-17,0,.75),(-20,3,0,.82),(20,11,0,.8)]),
    ("Tree_Blossom", [(-8,10,0,.78),(8,15,0,.82),(15,-14,0,.7)]),
    ("Bamboo_Clump", [(-16,5,0,.85),(16,4,0,.85),(-5,15,0,.7),(5,16,0,.72)]),
    ("Bush_Cluster", [(-9,11,0,1),(-12,8,0,.8),(11,11,0,.9),(13,8,0,.75),
                       (-15,-7,0,.9),(15,-7,0,.85),(-4,-15,0,.7),(5,-11,0,.8)]),
    ("Rock_Cluster", [(-18,-19,0,.72),(-21,11,0,.85),(19,11,0,.8),
                       (16,-19,0,.72),(-12,2,0,.66),(12,2,0,.68)]),
):
    for x, z, rot, scale in placements:
        add(asset, x, z, rot, scale)

for asset, x, z, rot, scale in (
    ("well", -9, 5, 0, 1), ("cart", 5, 14, 25, .9),
    ("lamp", -5, 3, 0, 1), ("lamp", 5, 3, 180, 1),
    ("fence_1", -11, 15, 90, 1), ("fence_2", 10, 15, 90, 1),
    ("barrel_1", -2, 14, 35, 1), ("barrel_2", 2, 14, 15, 1),
    ("brazier", -3, -15, 0, .8), ("urn_1", 3, -15, 0, .8),
    ("garden_bush_1", -2, 5, 0, .8), ("garden_bush_2", 2, 5, 0, .8),
):
    add(asset, x, z, rot, scale)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "version": 2,
    "gridSize": 1,
    "mapName": "Asian Village - Reference",
    "objects": objects,
}, indent=1) + "\n")
print(f"wrote {OUT}: {len(objects)} objects")
