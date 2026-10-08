#!/usr/bin/env python3
"""Add five modular, atlas-textured road tiles to VillagePack.glb."""
import json
import math
import random
import struct
from pathlib import Path

PACK = Path(__file__).resolve().parents[1] / "public/packs/village-pack/VillagePack.glb"
ROAD_TILES = (
    ("Road_Straight", (((0, -3), (0, 3)),)),
    ("Road_Corner", ("curve", (0, -3), (0, -1.1), (1.1, 0), (3, 0))),
    ("Road_TJunction", (((-3, 0), (3, 0)), ((0, 0), (0, 3)))),
    ("Road_Cross", (((-3, 0), (3, 0)), ((0, -3), (0, 3)))),
    ("Road_End", (((0, -0.85), (0, 3)),)),
)
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
ARRAY_BUFFER = 34962
ELEMENT_ARRAY_BUFFER = 34963


def nearest_path(x, z, paths):
    best_distance, best_lateral = float("inf"), 0.0
    for path in paths:
        for a, b in zip(path, path[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]
            length_sq = dx * dx + dz * dz
            t = max(0.0, min(1.0, ((x - a[0]) * dx + (z - a[1]) * dz) / length_sq))
            px, pz = a[0] + dx * t, a[1] + dz * t
            ox, oz = x - px, z - pz
            distance = math.hypot(ox, oz)
            if distance < best_distance:
                best_distance = distance
                best_lateral = (ox * -dz + oz * dx) / math.sqrt(length_sq)
    return best_distance, best_lateral


def path_distance(x, z, paths):
    return nearest_path(x, z, paths)[0]


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def road_profile(x, z, paths, name, seed):
    distance, lateral = nearest_path(x, z, paths)
    rut = max(math.exp(-((lateral - 0.31) / 0.12) ** 2),
              math.exp(-((lateral + 0.31) / 0.12) ** 2))
    if name in ("Road_TJunction", "Road_Cross"):
        rut *= smoothstep(0.58, 1.18, math.hypot(x, z))
    edge = smoothstep(0.58, 1.02, distance)
    height = (0.03 - 0.008 * edge - 0.01 * rut
              + 0.0012 * math.sin(x * 3.1 + seed) * math.cos(z * 2.7 - seed))
    return distance, rut, height


def road_normal(x, z, paths, name, seed):
    epsilon = 0.015
    dx = (road_profile(x + epsilon, z, paths, name, seed)[2]
          - road_profile(x - epsilon, z, paths, name, seed)[2]) / (2 * epsilon)
    dz = (road_profile(x, z + epsilon, paths, name, seed)[2]
          - road_profile(x, z - epsilon, paths, name, seed)[2]) / (2 * epsilon)
    length = math.sqrt(dx * dx + 1 + dz * dz)
    return -dx / length, 1 / length, -dz / length


def bezier_path(p0, p1, p2, p3, steps=48):
    points = []
    for i in range(steps + 1):
        t = i / steps
        q = 1 - t
        points.append((q**3 * p0[0] + 3 * q * q * t * p1[0] + 3 * q * t * t * p2[0] + t**3 * p3[0],
                       q**3 * p0[1] + 3 * q * q * t * p1[1] + 3 * q * t * t * p2[1] + t**3 * p3[1]))
    return points


def path_samples(path, first, spacing):
    lengths = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(path, path[1:])]
    total = sum(lengths)
    distance = first
    while distance < total - first:
        remaining = distance
        for i, (a, b) in enumerate(zip(path, path[1:])):
            length = lengths[i]
            if remaining <= length:
                t = remaining / length
                tangent = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
                yield (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), tangent
                break
            remaining -= length
        distance += spacing


def add_road_stone(positions, normals, uvs, colors, indices, x, z, tangent, side, rng):
    tx, tz = tangent
    nx, nz = -tz * side, tx * side
    length, width = rng.uniform(0.12, 0.16), rng.uniform(0.075, 0.105)
    top = rng.uniform(0.068, 0.091)
    offsets = ((-length, -width * 0.62), (-length * 0.72, -width),
               (length * 0.78, -width * 0.84), (length, width * 0.34),
               (length * 0.55, width), (-length * 0.78, width * 0.78))
    base = len(positions) // 3
    for y, scale in ((0.027, 1.0), (top, 0.82)):
        for along, across in offsets:
            along *= scale
            across *= scale
            positions.extend((x + tx * along + nx * across, y, z + tz * along + nz * across))
            normals.extend((nx * across + tx * along, 0, nz * across + tz * along))
            uvs.extend((0.466355, 0.31 if y < top else 0.18))
            colors.extend((1, 1, 1))
    center = len(positions) // 3
    positions.extend((x, top, z))
    normals.extend((0, 1, 0))
    uvs.extend((0.466355, 0.22))
    colors.extend((1, 1, 1))
    for i in range(6):
        j = (i + 1) % 6
        indices.extend((base + i, base + j, base + 6 + j,
                        base + i, base + 6 + j, base + 6 + i,
                        base + 6 + i, base + 6 + j, center))


def add_grass_tuft(positions, normals, uvs, colors, indices, x, z, rng):
    for shade, angle, length in ((0.405, rng.random() * math.tau, 0.16),
                                 (0.415, rng.random() * math.tau, 0.12),
                                 (0.425, rng.random() * math.tau, 0.14)):
        dx, dz = math.cos(angle), math.sin(angle)
        wx, wz = -dz * 0.045, dx * 0.045
        base = len(positions) // 3
        positions.extend((x - wx, 0.032, z - wz, x + wx, 0.032, z + wz,
                          x + dx * length, 0.055, z + dz * length))
        normals.extend((0, 1, 0) * 3)
        uvs.extend((shade, 0.78, shade, 0.78, shade, 0.78))
        colors.extend((1, 1, 1) * 3)
        indices.extend((base, base + 1, base + 2))


def tile_geometry(spec, name, seed):
    rng = random.Random(seed)
    positions, normals, uvs, colors, indices = [], [], [], [], []
    if spec[0] == "curve":
        paths = [bezier_path(*spec[1:])]
    else:
        paths = [list(path) for path in spec]
    grid, extent = 60, 2.0
    step = extent * 2 / grid

    for ix in range(grid):
        x0 = -extent + ix * step
        x1 = x0 + step
        for iz in range(grid):
            z0 = -extent + iz * step
            z1 = z0 + step
            cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
            distance, _, _ = road_profile(cx, cz, paths, name, seed)
            # Slight contour wobble reads as packed earth; it fades at tile edges for clean joins.
            roughness = 0 if max(abs(cx), abs(cz)) > 1.65 else 0.018 * math.sin(cx * 7.1 + seed) * math.cos(cz * 5.3 - seed)
            if distance > 1.02 + roughness:
                continue
            u, v = 0.7041, 0.2119

            base = len(positions) // 3
            corners = ((x0, z0), (x1, z0), (x1, z1), (x0, z1))
            for x, z in corners:
                distance, rut, height = road_profile(x, z, paths, name, seed)
                positions.extend((x, height, z))
                normals.extend(road_normal(x, z, paths, name, seed))
                shade = min(1.0, 1 - 0.24 * rut + 0.03 * smoothstep(0.68, 1.02, distance))
                colors.extend((shade, shade * 0.97, shade * 0.9))
            uvs.extend((u, v) * 4)
            indices.extend((base, base + 2, base + 1, base, base + 3, base + 2))

    for path in paths:
        for point, tangent in path_samples(path, 0.2, 0.4):
            x, z = point
            if name in ("Road_TJunction", "Road_Cross") and math.hypot(x, z) < 0.96:
                continue
            for side in (-1, 1):
                nx, nz = -tangent[1] * side, tangent[0] * side
                sx, sz = x + nx * 0.91, z + nz * 0.91
                if abs(sx) < 1.93 and abs(sz) < 1.93:
                    add_road_stone(positions, normals, uvs, colors, indices, sx, sz, tangent, side, rng)

        for point, tangent in path_samples(path, 0.4, 1.0):
            x, z = point
            if max(abs(x), abs(z)) > 1.7:
                continue
            if name in ("Road_TJunction", "Road_Cross") and math.hypot(x, z) < 1.3:
                continue
            for side in (-1, 1):
                nx, nz = -tangent[1] * side, tangent[0] * side
                gx, gz = x + nx * 1.24, z + nz * 1.24
                if path_distance(gx, gz, paths) > 1.08:
                    add_grass_tuft(positions, normals, uvs, colors, indices, gx, gz, rng)
    return positions, normals, uvs, colors, indices


def add_view(binary, views, raw, target):
    binary.extend(b"\0" * (-len(binary) % 4))
    offset = len(binary)
    binary.extend(raw)
    views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
    return len(views) - 1


def add_accessor(doc, binary, values, width, kind, target, minmax=False):
    raw = struct.pack("<" + "f" * len(values), *values) if kind == "float" else struct.pack("<" + "H" * len(values), *values)
    view = add_view(binary, doc["bufferViews"], raw, target)
    accessor = {
        "bufferView": view,
        "componentType": 5126 if kind == "float" else 5123,
        "count": len(values) // width,
        "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3"}[width],
    }
    if minmax:
        rows = [values[i:i + width] for i in range(0, len(values), width)]
        accessor["min"] = [min(row[j] for row in rows) for j in range(width)]
        accessor["max"] = [max(row[j] for row in rows) for j in range(width)]
    doc["accessors"].append(accessor)
    return len(doc["accessors"]) - 1


def read_glb(path):
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 4)[0] != 2:
        raise ValueError(f"not a GLB 2 file: {path}")
    chunks, offset = [], 12
    while offset < len(raw):
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        chunks.append([kind, bytearray(raw[offset:offset + size])])
        offset += size
    json_index = next(i for i, (kind, _) in enumerate(chunks) if kind == JSON_CHUNK)
    binary_index = next(i for i, (kind, _) in enumerate(chunks) if kind == BIN_CHUNK)
    doc = json.loads(chunks[json_index][1].decode("utf-8").rstrip(" \t\r\n\0"))
    binary = bytearray(chunks[binary_index][1][:doc["buffers"][0]["byteLength"]])
    return doc, chunks, json_index, binary_index, binary


def write_glb(path, doc, chunks, json_index, binary_index, binary):
    doc["buffers"][0]["byteLength"] = len(binary)
    json_raw = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_raw += b" " * (-len(json_raw) % 4)
    binary_chunk = bytes(binary) + b"\0" * (-len(binary) % 4)
    chunks[json_index][1] = bytearray(json_raw)
    chunks[binary_index][1] = bytearray(binary_chunk)
    body = bytearray()
    for kind, payload in chunks:
        body.extend(struct.pack("<II", len(payload), kind))
        body.extend(payload)
    path.write_bytes(b"glTF" + struct.pack("<II", 2, len(body) + 12) + body)


def remove_existing_roads(doc, binary):
    names = {name for name, _ in ROAD_TILES}
    road_nodes = [(i, node) for i, node in enumerate(doc["nodes"]) if node.get("name") in names]
    if not road_nodes:
        return binary
    node_ids = {i for i, _ in road_nodes}
    if node_ids != set(range(len(doc["nodes"]) - len(node_ids), len(doc["nodes"]))):
        raise ValueError("road nodes are not a contiguous tail of the Village Pack scene")
    mesh_ids = {node["mesh"] for _, node in road_nodes}
    if mesh_ids != set(range(len(doc["meshes"]) - len(mesh_ids), len(doc["meshes"]))):
        raise ValueError("road meshes are not a contiguous tail of the Village Pack")
    accessor_ids = set()
    for mesh_id in mesh_ids:
        for primitive in doc["meshes"][mesh_id]["primitives"]:
            accessor_ids.update(primitive["attributes"].values())
            accessor_ids.add(primitive["indices"])
    if accessor_ids != set(range(len(doc["accessors"]) - len(accessor_ids), len(doc["accessors"]))):
        raise ValueError("road accessors are not a contiguous tail of the Village Pack")
    view_ids = {doc["accessors"][i]["bufferView"] for i in accessor_ids}
    if view_ids != set(range(len(doc["bufferViews"]) - len(view_ids), len(doc["bufferViews"]))):
        raise ValueError("road buffer views are not a contiguous tail of the Village Pack")

    for scene in doc["scenes"]:
        scene["nodes"] = [i for i in scene.get("nodes", []) if i not in node_ids]
    del doc["nodes"][-len(node_ids):]
    del doc["meshes"][-len(mesh_ids):]
    del doc["accessors"][-len(accessor_ids):]
    del doc["bufferViews"][-len(view_ids):]
    base_end = max((v.get("byteOffset", 0) + v["byteLength"] for v in doc["bufferViews"]), default=0)
    return binary[:base_end]


def main():
    doc, chunks, json_index, binary_index, binary = read_glb(PACK)
    names = {name for name, _ in ROAD_TILES}
    existing = names & {node.get("name") for node in doc.get("nodes", [])}
    if existing and len(existing) != len(names):
        raise ValueError("partial Village Pack road set exists; refusing to duplicate or overwrite")
    if existing:
        binary = remove_existing_roads(doc, binary)

    for seed, (name, spec) in enumerate(ROAD_TILES, 1):
        positions, normals, uvs, colors, indices = tile_geometry(spec, name, seed)
        pos = add_accessor(doc, binary, positions, 3, "float", ARRAY_BUFFER, minmax=True)
        normal = add_accessor(doc, binary, normals, 3, "float", ARRAY_BUFFER)
        uv = add_accessor(doc, binary, uvs, 2, "float", ARRAY_BUFFER)
        color = add_accessor(doc, binary, colors, 3, "float", ARRAY_BUFFER)
        index = add_accessor(doc, binary, indices, 1, "uint16", ELEMENT_ARRAY_BUFFER)
        mesh = len(doc["meshes"])
        doc["meshes"].append({"name": name, "primitives": [{
            "attributes": {"POSITION": pos, "NORMAL": normal, "TEXCOORD_0": uv, "COLOR_0": color},
            "indices": index,
            "material": 0,
        }]})
        node = len(doc["nodes"])
        doc["nodes"].append({"name": name, "mesh": mesh})
        doc["scenes"][doc.get("scene", 0)].setdefault("nodes", []).append(node)

    write_glb(PACK, doc, chunks, json_index, binary_index, binary)
    print(f"added {len(ROAD_TILES)} Village Pack road tiles to {PACK}")


if __name__ == "__main__":
    main()
