#!/usr/bin/env python3
"""Build textured, placeable Asian-village environment pieces with Blender."""
import math
import random
import shutil
import tempfile
import zipfile
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector, noise
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/packs/village-pack/VillageEnvironment.glb"
REFERENCE_OUT = ROOT / "public/packs/village-pack/VillageReferenceSet.glb"
SEED = 73

MAT_NAMES = (
    "stone", "rock", "far_rock", "reference_rock", "earth", "grass", "moss", "water", "foam", "wood", "roof",
    "leaf_dark", "leaf_mid", "leaf_light", "leaf_autumn", "blossom",
)

UV_SCALE = {
    "stone": 0.5, "rock": 0.28, "far_rock": 0.5, "reference_rock": 0.28, "earth": 0.5, "grass": 0.5,
    "moss": 0.5, "water": 0.5, "foam": 1.0, "wood": 1.0,
    "leaf_dark": 1.0, "leaf_mid": 1.0, "leaf_light": 1.0,
    "leaf_autumn": 1.0, "blossom": 1.0, "roof": 1.0,
}


def generate_procedural_textures(size=1024):
    """Generate high-resolution PBR textures for granite, terrain and water."""
    np.random.seed(SEED)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size

    def seamless_fbm(fx, fy, octaves=5, pers=0.55):
        total = np.zeros((size, size), dtype=np.float32)
        amp = 1.0
        max_amp = 0.0
        for _ in range(octaves):
            gx, gy = max(2, int(fx)), max(2, int(fy))
            grid = np.random.uniform(0, 1, (gy, gx)).astype(np.float32)
            xi = (x * gx) % gx
            yi = (y * gy) % gy
            x0 = np.floor(xi).astype(int)
            x1 = (x0 + 1) % gx
            y0 = np.floor(yi).astype(int)
            y1 = (y0 + 1) % gy
            wx = xi - x0
            wy = yi - y0
            wx = wx * wx * (3.0 - 2.0 * wx)
            wy = wy * wy * (3.0 - 2.0 * wy)
            val = (grid[y0, x0] * (1 - wx) + grid[y0, x1] * wx) * (1 - wy) + \
                  (grid[y1, x0] * (1 - wx) + grid[y1, x1] * wx) * wy
            total += val * amp
            max_amp += amp
            amp *= pers
            fx *= 2
            fy *= 2
        return total / max_amp

    # 1. Granite Textures (Korean Bukhansan / Seoraksan / Huangshan bornhardt style)
    macro = seamless_fbm(4, 4, 4)
    flow = seamless_fbm(6, 26, 4, pers=0.58)  # Vertical rain runoff weathering
    grain = seamless_fbm(64, 64, 3, pers=0.65)  # Fine granitic crystalline grain

    crack_noise = seamless_fbm(16, 4, 3, pers=0.5)
    cracks = np.clip(1.0 - np.abs(crack_noise - 0.5) * 20.0, 0, 1) ** 2.0
    crack_mask = np.clip((seamless_fbm(3, 3, 2) - 0.45) * 3.0, 0, 1)
    cracks = cracks * crack_mask

    height = macro * 0.4 + flow * 0.35 + grain * 0.15 - cracks * 0.3

    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1))
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0))
    strength = 5.2
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(height)
    norm_len = np.sqrt(nx**2 + ny**2 + nz**2)
    nx /= norm_len
    ny /= norm_len
    nz /= norm_len

    rock_norm = np.zeros((size, size, 4), dtype=np.float32)
    rock_norm[:, :, 0] = nx * 0.5 + 0.5
    rock_norm[:, :, 1] = ny * 0.5 + 0.5
    rock_norm[:, :, 2] = nz * 0.5 + 0.5
    rock_norm[:, :, 3] = 1.0

    # Warm natural granite with subtle mineral washes and crevice moss
    base_val = (175 + (macro - 0.5) * 38 + (flow - 0.5) * 28 - cracks * 55) / 255.0
    speckle = np.random.uniform(-1, 1, (size, size))
    salt = np.clip((speckle - 0.68) * 3.5, 0, 1) * (26.0 / 255.0)
    pepper = np.clip((-speckle - 0.68) * 3.5, 0, 1) * (34.0 / 255.0)

    rock_color = np.zeros((size, size, 4), dtype=np.float32)
    r = base_val + 0.024 + salt - pepper
    g = base_val - 0.005 + salt - pepper
    b = base_val - 0.055 + salt - pepper

    moss_mask = np.clip((1.0 - macro) * 0.55 + cracks * 0.5 - 0.35, 0, 1) * 0.4
    r = r * (1 - moss_mask) + (115.0 / 255.0) * moss_mask
    g = g * (1 - moss_mask) + (135.0 / 255.0) * moss_mask
    b = b * (1 - moss_mask) + (85.0 / 255.0) * moss_mask

    rock_color[:, :, 0] = np.clip(r, 0, 1)
    rock_color[:, :, 1] = np.clip(g, 0, 1)
    rock_color[:, :, 2] = np.clip(b, 0, 1)
    rock_color[:, :, 3] = 1.0

    far_rock_color = rock_color.copy()
    far_rock_color[:, :, :3] *= np.array((0.84, 0.91, 1.06), dtype=np.float32)
    far_rock_color[:, :, :3] = np.clip(far_rock_color[:, :, :3], 0, 1)

    reference_rock_color = rock_color.copy()
    reference_rock_color[:, :, :3] *= np.array((0.72, 0.77, 0.82), dtype=np.float32)
    reference_rock_color[:, :, :3] = np.clip(reference_rock_color[:, :, :3], 0, 1)

    rock_rough = np.zeros((size, size, 4), dtype=np.float32)
    rough = 0.66 + (1.0 - macro) * 0.12 + moss_mask * 0.2 + cracks * 0.15
    rock_rough[:, :, 0] = np.clip(rough, 0, 1)
    rock_rough[:, :, 1] = np.clip(rough, 0, 1)
    rock_rough[:, :, 2] = np.clip(rough, 0, 1)
    rock_rough[:, :, 3] = 1.0

    # 2. Meadow Grass & Moss Textures
    grass_macro = seamless_fbm(8, 8, 4)
    grass_fine = seamless_fbm(32, 32, 3)
    grass_color = np.zeros((size, size, 4), dtype=np.float32)
    g_val = 0.34 + (grass_macro - 0.5) * 0.12 + (grass_fine - 0.5) * 0.06
    grass_color[:, :, 0] = np.clip(g_val * 0.82, 0, 1)
    grass_color[:, :, 1] = np.clip(g_val * 1.15, 0, 1)
    grass_color[:, :, 2] = np.clip(g_val * 0.48, 0, 1)
    grass_color[:, :, 3] = 1.0

    # 3. Earth Texture
    earth_macro = seamless_fbm(6, 6, 4)
    earth_color = np.zeros((size, size, 4), dtype=np.float32)
    e_val = 0.40 + (earth_macro - 0.5) * 0.14
    earth_color[:, :, 0] = np.clip(e_val * 1.25, 0, 1)
    earth_color[:, :, 1] = np.clip(e_val * 0.95, 0, 1)
    earth_color[:, :, 2] = np.clip(e_val * 0.65, 0, 1)
    earth_color[:, :, 3] = 1.0

    # 4. Water Texture
    water_flow = seamless_fbm(12, 4, 3)
    water_color = np.zeros((size, size, 4), dtype=np.float32)
    water_color[:, :, 0] = 0.18 + water_flow * 0.08
    water_color[:, :, 1] = 0.38 + water_flow * 0.12
    water_color[:, :, 2] = 0.52 + water_flow * 0.15
    water_color[:, :, 3] = 1.0

    return {
        "rock_color": rock_color,
        "far_rock_color": far_rock_color,
        "reference_rock_color": reference_rock_color,
        "rock_norm": rock_norm,
        "rock_rough": rock_rough,
        "grass_color": grass_color,
        "earth_color": earth_color,
        "water_color": water_color,
    }


def make_materials():
    tex_data = generate_procedural_textures(size=1024)
    size = 1024

    def create_packed_img(name, arr, is_non_color=False):
        img = bpy.data.images.new(name, size, size)
        if is_non_color:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(arr.ravel())
        img.pack()
        return img

    img_rock_col = create_packed_img("Rock_BaseColor", tex_data["rock_color"])
    img_far_rock_col = create_packed_img("Far_Rock_BaseColor", tex_data["far_rock_color"])
    img_reference_rock_col = create_packed_img("Reference_Rock_BaseColor", tex_data["reference_rock_color"])
    img_rock_norm = create_packed_img("Rock_Normal", tex_data["rock_norm"], is_non_color=True)
    img_rock_rough = create_packed_img("Rock_Roughness", tex_data["rock_rough"], is_non_color=True)
    img_grass_col = create_packed_img("Grass_BaseColor", tex_data["grass_color"])
    img_earth_col = create_packed_img("Earth_BaseColor", tex_data["earth_color"])
    img_water_col = create_packed_img("Water_BaseColor", tex_data["water_color"])

    colors = {
        "stone": (0.65, 0.62, 0.58, 1),
        "rock": (0.75, 0.72, 0.65, 1),
        "far_rock": (0.39, 0.48, 0.58, 1),
        "reference_rock": (0.44, 0.46, 0.47, 1),
        "earth": (0.55, 0.42, 0.28, 1),
        "grass": (0.35, 0.48, 0.22, 1),
        "moss": (0.28, 0.38, 0.18, 1),
        "water": (0.22, 0.44, 0.58, 1),
        "foam": (0.85, 0.92, 0.95, 1),
        "wood": (0.24, 0.15, 0.09, 1),
        "roof": (0.12, 0.18, 0.22, 1),
        "leaf_dark": (0.055, 0.15, 0.065, 1),  # Deep evergreen pine
        "leaf_mid": (0.14, 0.30, 0.10, 1),     # Forest green
        "leaf_light": (0.26, 0.42, 0.13, 1),   # Olive highlight
        "leaf_autumn": (0.58, 0.30, 0.10, 1),  # Golden autumn foliage
        "blossom": (0.85, 0.48, 0.56, 1),      # Cherry blossom
    }

    materials = {}
    for name in MAT_NAMES:
        mat = bpy.data.materials.new(f"Village_{name}")
        mat.diffuse_color = colors[name]
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = colors[name]
        bsdf.inputs["Roughness"].default_value = 0.85 if name != "water" else 0.15

        if name in ("rock", "far_rock", "reference_rock"):
            tex_c = nodes.new("ShaderNodeTexImage")
            tex_c.image = {"rock": img_rock_col, "far_rock": img_far_rock_col,
                           "reference_rock": img_reference_rock_col}[name]
            links.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])

            tex_n = nodes.new("ShaderNodeTexImage")
            tex_n.image = img_rock_norm
            norm_node = nodes.new("ShaderNodeNormalMap")
            norm_node.inputs["Strength"].default_value = 0.72 if name == "reference_rock" else 1.8
            links.new(tex_n.outputs["Color"], norm_node.inputs["Color"])
            links.new(norm_node.outputs["Normal"], bsdf.inputs["Normal"])

            tex_r = nodes.new("ShaderNodeTexImage")
            tex_r.image = img_rock_rough
            links.new(tex_r.outputs["Color"], bsdf.inputs["Roughness"])
        elif name == "stone":
            tex_n = nodes.new("ShaderNodeTexImage")
            tex_n.image = img_rock_norm
            norm_node = nodes.new("ShaderNodeNormalMap")
            norm_node.inputs["Strength"].default_value = 1.0
            links.new(tex_n.outputs["Color"], norm_node.inputs["Color"])
            links.new(norm_node.outputs["Normal"], bsdf.inputs["Normal"])
            bsdf.inputs["Roughness"].default_value = 0.75
        elif name == "grass":
            tex_c = nodes.new("ShaderNodeTexImage")
            tex_c.image = img_grass_col
            links.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])
        elif name == "earth":
            tex_c = nodes.new("ShaderNodeTexImage")
            tex_c.image = img_earth_col
            links.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])
        elif name == "water":
            tex_c = nodes.new("ShaderNodeTexImage")
            tex_c.image = img_water_col
            links.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])
            bsdf.inputs["Roughness"].default_value = 0.15
            bsdf.inputs["Metallic"].default_value = 0.10
        materials[name] = mat

    return materials


class MeshBuilder:
    def __init__(self, materials):
        self.materials = materials
        self.vertices = []
        self.faces = []
        self.face_materials = []
        self.smooth_faces = []

    def vertex(self, point):
        self.vertices.append(tuple(float(v) for v in point))
        return len(self.vertices) - 1

    def face(self, indices, material, smooth=False):
        self.faces.append(tuple(indices))
        self.face_materials.append(material)
        self.smooth_faces.append(smooth)

    def add_box(self, center, size, material="stone", bevel_noise=0):
        cx, cy, cz = center
        sx, sy, sz = (v / 2 for v in size)
        points = [(cx-sx, cy-sy, cz-sz), (cx+sx, cy-sy, cz-sz),
                  (cx+sx, cy+sy, cz-sz), (cx-sx, cy+sy, cz-sz),
                  (cx-sx, cy-sy, cz+sz), (cx+sx, cy-sy, cz+sz),
                  (cx+sx, cy+sy, cz+sz), (cx-sx, cy+sy, cz+sz)]
        base = len(self.vertices)
        for p in points:
            if bevel_noise:
                p = (p[0] + random.uniform(-bevel_noise, bevel_noise),
                     p[1] + random.uniform(-bevel_noise, bevel_noise),
                     p[2] + random.uniform(-bevel_noise, bevel_noise))
            self.vertex(p)
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                  (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.face([base + i for i in f], material)

    def add_ico(self, center, scale, material, seed=0, subdivisions=1, smooth=False):
        rng = random.Random(seed)
        t = (1 + math.sqrt(5)) / 2
        verts = [(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),
                 (0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),
                 (t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
        faces = [(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),
                 (1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),
                 (3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),
                 (4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
        def norm(p):
            length = math.sqrt(sum(v*v for v in p))
            return tuple(v / length for v in p)
        verts = [norm(v) for v in verts]
        for _ in range(subdivisions):
            cache, next_faces = {}, []
            def midpoint(a, b):
                key = tuple(sorted((a, b)))
                if key not in cache:
                    cache[key] = len(verts)
                    verts.append(norm(tuple((verts[a][i] + verts[b][i]) / 2 for i in range(3))))
                return cache[key]
            for a, b, c in faces:
                ab, bc, ca = midpoint(a,b), midpoint(b,c), midpoint(c,a)
                next_faces.extend(((a,ab,ca),(b,bc,ab),(c,ca,bc),(ab,bc,ca)))
            faces = next_faces
        cx, cy, cz = center
        sx, sy, sz = scale
        base = len(self.vertices)
        for x, y, z in verts:
            radius = 1 + rng.uniform(-0.055, 0.055)
            self.vertex((cx + x*sx*radius, cy + y*sy*radius, cz + z*sz*radius))
        for f in faces:
            self.face([base + i for i in f], material, smooth=smooth)

    def add_cylinder(self, start, end, radius0, radius1, material="wood", sides=8):
        a, b = Vector(start), Vector(end)
        axis = (b - a).normalized()
        helper = Vector((0, 1, 0)) if abs(axis.dot(Vector((0, 0, 1)))) > 0.92 else Vector((0, 0, 1))
        u = axis.cross(helper).normalized()
        v = axis.cross(u).normalized()
        base = len(self.vertices)
        for point, radius in ((a, radius0), (b, radius1)):
            for i in range(sides):
                angle = i * math.tau / sides
                offset = u * (math.cos(angle) * radius) + v * (math.sin(angle) * radius)
                self.vertex(point + offset)
        for i in range(sides):
            j = (i + 1) % sides
            self.face((base+i, base+j, base+sides+j, base+sides+i), material, smooth=True)
        self.face(tuple(base+i for i in reversed(range(sides))), material)
        self.face(tuple(base+sides+i for i in range(sides)), material)

    def add_cone(self, base, top, radius, material="leaf_mid", sides=8):
        self.add_cylinder(base, top, radius, 0.015, material, sides)

    def add_granite_boulder(self, center, size, seed=0, cuts=6, material="rock"):
        """Sculpted East-Asian granite bornhardt/tor with steep joint facets and rounded dome caps."""
        rng = random.Random(seed)
        t = (1 + math.sqrt(5)) / 2
        verts = [(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),
                 (0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),
                 (t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
        faces = [(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),
                 (1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),
                 (3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),
                 (4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
        def norm(p):
            length = math.sqrt(sum(v*v for v in p))
            return tuple(v / length for v in p)
        verts = [norm(v) for v in verts]
        for _ in range(2):
            cache, next_faces = {}, []
            def midpoint(a, b):
                key = tuple(sorted((a, b)))
                if key not in cache:
                    cache[key] = len(verts)
                    verts.append(norm(tuple((verts[a][i] + verts[b][i]) / 2 for i in range(3))))
                return cache[key]
            for a, b, c in faces:
                ab, bc, ca = midpoint(a,b), midpoint(b,c), midpoint(c,a)
                next_faces.extend(((a,ab,ca),(b,bc,ab),(c,ca,bc),(ab,bc,ca)))
            faces = next_faces

        planes = []
        for i in range(max(3, cuts - 2)):
            ang = i * math.tau / max(3, cuts - 2) + rng.uniform(-0.25, 0.25)
            tilt = rng.uniform(0.75, 1.25)
            n = Vector((math.cos(ang)*math.sin(tilt), math.sin(ang)*math.sin(tilt), math.cos(tilt)*0.25)).normalized()
            d = rng.uniform(0.62, 0.82)
            planes.append((n, d, 0.92))
        for _ in range(2):
            phi = rng.uniform(0, math.tau)
            theta = rng.uniform(0.3, 0.7)
            n = Vector((math.cos(phi)*math.sin(theta), math.sin(phi)*math.sin(theta), math.cos(theta))).normalized()
            d = rng.uniform(0.75, 0.90)
            planes.append((n, d, 0.85))

        sx, sy, sz = size
        base = len(self.vertices)
        for x_c, y_c, z_c in verts:
            p = Vector((x_c, y_c, z_c))
            if p.z > 0.1:
                p.z = math.sin(p.z * math.pi * 0.5) * 1.06
                p.x *= (1.0 + 0.05 * (1.0 - p.z))
                p.y *= (1.0 + 0.05 * (1.0 - p.z))
            else:
                p.z *= 0.92
                p.x *= 1.05
                p.y *= 1.05

            for n_vec, dist, factor in planes:
                proj = p.dot(n_vec)
                if proj > dist:
                    p -= n_vec * ((proj - dist) * factor)

            flute = math.sin(math.atan2(p.y, p.x) * 6.0 + seed) * 0.045
            p.x += flute
            p.y += flute

            ns = noise.noise(Vector((p.x * 2.5 + seed, p.y * 2.5, p.z * 1.8))) * 0.08
            p += p.normalized() * ns
            self.vertex((p.x * sx + center[0], p.y * sy + center[1], p.z * sz + center[2]))

        for f in faces:
            self.face([base + i for i in f], material, smooth=True)

    def add_crevice_pine(self, pos, scale=1.0, seed=0):
        """Build a recognizable tiered evergreen with a visible, leaning trunk."""
        rng = random.Random(seed)
        x, y, z = pos
        h = 4.8 * scale
        lean = rng.uniform(0, math.tau)
        dx, dy = math.cos(lean) * 0.32 * scale, math.sin(lean) * 0.32 * scale
        p0, p1, p2 = (x, y, z), (x + dx * 0.48, y + dy * 0.48, z + h * 0.58), (x + dx, y + dy, z + h)
        self.add_cylinder(p0, p1, 0.16 * scale, 0.10 * scale, "wood", sides=7)
        self.add_cylinder(p1, p2, 0.10 * scale, 0.035 * scale, "wood", sides=7)

        for bottom, top, radius, material in (
            (0.22, 0.66, 1.05, "leaf_dark"),
            (0.42, 0.84, 0.82, "leaf_mid"),
            (0.64, 0.99, 0.58, "leaf_light"),
        ):
            start = (x + dx * bottom, y + dy * bottom, z + h * bottom)
            end = (x + dx * top, y + dy * top, z + h * top)
            self.add_cylinder(start, end, radius * scale, 0.02 * scale,
                              material, sides=9)

    def add_crevice_broadleaf(self, pos, scale=1.0, seed=0, blossom=False):
        """Build a broad crown around a visible trunk and branching limbs."""
        rng = random.Random(seed)
        x, y, z = pos
        h = 6.0 * scale
        lean_x, lean_y = rng.uniform(-0.08, 0.08) * scale, rng.uniform(-0.08, 0.08) * scale
        branch_base = (x + lean_x * 0.45, y + lean_y * 0.45, z + h * 0.54)
        self.add_cylinder((x, y, z), branch_base, 0.22 * scale, 0.15 * scale, "wood", 8)
        self.add_cylinder(branch_base,
                          (x + lean_x, y + lean_y, z + h * 0.82),
                          0.12 * scale, 0.06 * scale, "wood", 7)

        colors = (("blossom", "blossom", "leaf_mid", "blossom", "leaf_light", "blossom", "leaf_mid")
                  if blossom else
                  ("leaf_mid", "leaf_light", "leaf_mid", "leaf_dark", "leaf_light", "leaf_mid", "leaf_dark"))
        clusters = [(0.0, 0.0, 0.83, 0.72)]
        for i in range(6):
            angle = i * math.tau / 6 + rng.uniform(-0.16, 0.16)
            clusters.append((math.cos(angle) * rng.uniform(0.72, 0.92),
                            math.sin(angle) * rng.uniform(0.62, 0.82),
                            0.72 + rng.uniform(-0.035, 0.045),
                            rng.uniform(0.62, 0.76)))

        for index, (ox, oy, level, radius) in enumerate(clusters):
            cx, cy, cz = x + lean_x + ox * scale, y + lean_y + oy * scale, z + h * level
            if index:
                self.add_cylinder(branch_base, (cx, cy, cz - 0.18 * scale),
                                  0.075 * scale, 0.035 * scale, "wood", 6)
            self.add_ico((cx, cy, cz),
                         (radius * 1.12 * scale, radius * 0.94 * scale, radius * 0.58 * scale),
                         colors[index], seed + index * 13, 0, False)


    def add_mountain_skirt(self, length, depth, nx, ny, height_fn, material="grass"):
        """Solid terrain skirt that anchors mountain to y=0 with sealed vertical sides."""
        verts_grid = []
        for ix in range(nx + 1):
            row = []
            x = -length/2 + length * ix / nx
            for iy in range(ny + 1):
                y = -depth/2 + depth * iy / ny
                z = height_fn(x, y) if height_fn else 0.0
                row.append(self.vertex((x, y, max(0.04, z))))
            verts_grid.append(row)

        for ix in range(nx):
            for iy in range(ny):
                v0 = verts_grid[ix][iy]
                v1 = verts_grid[ix+1][iy]
                v2 = verts_grid[ix+1][iy+1]
                v3 = verts_grid[ix][iy+1]
                self.face((v0, v1, v2), material)
                self.face((v0, v2, v3), material)

        bot_grid = []
        for ix in range(nx + 1):
            row = []
            x = -length/2 + length * ix / nx
            for iy in range(ny + 1):
                y = -depth/2 + depth * iy / ny
                row.append(self.vertex((x, y, 0.0)))
            bot_grid.append(row)

        for ix in range(nx):
            self.face((verts_grid[ix][0], bot_grid[ix][0], bot_grid[ix+1][0], verts_grid[ix+1][0]), material)
            self.face((verts_grid[ix+1][ny], bot_grid[ix+1][ny], bot_grid[ix][ny], verts_grid[ix][ny]), material)
        for iy in range(ny):
            self.face((verts_grid[0][iy+1], bot_grid[0][iy+1], bot_grid[0][iy], verts_grid[0][iy]), material)
            self.face((verts_grid[nx][iy], bot_grid[nx][iy], bot_grid[nx][iy+1], verts_grid[nx][iy+1]), material)

    def build(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        used = sorted(set(self.face_materials), key=MAT_NAMES.index)
        material_index = {m_name: i for i, m_name in enumerate(used)}
        for mat_name in used:
            mesh.materials.append(self.materials[mat_name])
        for i, polygon in enumerate(mesh.polygons):
            polygon.material_index = material_index[self.face_materials[i]]
            polygon.use_smooth = self.smooth_faces[i]
        mesh.update()

        # Triangulate mesh so tangents can be cleanly computed
        bm_tri = bmesh.new()
        bm_tri.from_mesh(mesh)
        bmesh.ops.triangulate(bm_tri, faces=bm_tri.faces)
        bm_tri.to_mesh(mesh)
        bm_tri.free()
        mesh.update()

        uv = mesh.uv_layers.new(name="UVMap")
        for polygon in mesh.polygons:
            mat_name = used[polygon.material_index]
            scale = UV_SCALE.get(mat_name, 1.0)
            normal = polygon.normal
            for loop_index in polygon.loop_indices:
                p = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                if abs(normal.z) >= abs(normal.x) and abs(normal.z) >= abs(normal.y):
                    coords = (p.x, p.y)
                elif abs(normal.x) >= abs(normal.y):
                    coords = (p.y, p.z)
                else:
                    coords = (p.x, p.z)
                uv.data[loop_index].uv = (coords[0] * scale, coords[1] * scale)
        mesh.calc_tangents()

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def add_tree(builder, kind, x=0, y=0, z=0, seed=0):
    if kind == "pine":
        builder.add_crevice_pine((x, y, z), scale=1.35, seed=seed)
    else:
        builder.add_crevice_broadleaf((x, y, z), seed=seed, blossom=kind == "blossom")


def make_tree_assets(materials):
    for name, kind, seed in (("Tree_Pine", "pine", 120),
                             ("Tree_Broadleaf", "broadleaf", 220),
                             ("Tree_Blossom", "blossom", 320)):
        builder = MeshBuilder(materials)
        add_tree(builder, kind, seed=seed)
        builder.build(name)
    builder = MeshBuilder(materials)
    rng = random.Random(424)
    for i in range(11):
        x, y = rng.uniform(-1.1,1.1), rng.uniform(-0.9,0.9)
        h = rng.uniform(3.8,5.2)
        builder.add_cylinder((x,y,0), (x+rng.uniform(-.08,.08),y,h), .045, .035, "wood", 7)
        for side in (-1,1):
            for level in range(3):
                z = h*rng.uniform(.42,.9)
                tip = (x+side*rng.uniform(.35,.8), y+rng.uniform(-.3,.3), z+rng.uniform(.1,.45))
                builder.add_cylinder((x,y,z), tip, .045, .012, "leaf_mid", 5)
    builder.build("Bamboo_Clump")
    builder = MeshBuilder(materials)
    for i, (x,y,s) in enumerate(((-.55,0,.72),(.2,.15,.9),(.58,-.3,.66),(-.1,-.5,.68),(.55,.48,.62))):
        builder.add_ico((x,y,s*.62),(s,s*.83,s*.66),("leaf_dark","leaf_mid","leaf_light")[i%3],700+i,2,True)
    builder.build("Bush_Cluster")


def make_ground_tiles(materials):
    for name, material in (("Ground_Grass_8", "grass"), ("Ground_Earth_8", "earth")):
        builder = MeshBuilder(materials)
        builder.add_box((0, 0, 0), (8, 8, .008), material)
        builder.build(name)


def make_mountains(materials):
    def mass_profile(length, depth, base_height, peaks, roughness=0.2):
        def height(x, y):
            side = max(0.0, 1.0 - (abs(x) / (length * 0.54)) ** 3) ** 0.55
            rear = max(0.0, min(1.0, (y + depth * 0.52) / (depth * 1.04)))
            rear = rear * rear * (3.0 - 2.0 * rear)
            height = side * (base_height * (0.18 + 0.78 * rear))
            for cx, cy, amplitude, width_x, width_y in peaks:
                radius = math.sqrt(((x - cx) / width_x) ** 2 + ((y - cy) / width_y) ** 2)
                height += amplitude * max(0.0, 1.0 - radius) ** 0.82
            weather = roughness * (
                math.sin(x * 1.25 + y * 0.38)
                + 0.55 * math.cos(x * 2.1 - y * 0.82)
                + 0.34 * math.sin(y * 2.6 + x * 0.72)
                + 0.16 * math.cos(x * 4.2 - y * 2.1)
            )
            return max(0.04, height + weather * side)
        return height

    def build_mass(name, length, depth, profile, material, trees=()):
        builder = MeshBuilder(materials)
        builder.add_mountain_skirt(length, depth, 48, 24, profile, material)
        for kind, x, y, scale, seed in trees:
            add_tree(builder, kind, x, y, profile(x, y), seed)
        return builder

    # K01: joined angular peaks with visible saddles and a rough rock surface.
    peak_profile = mass_profile(
        22, 16, 1.1,
        [(-8.0, 3.6, 8.5, 3.7, 5.3), (-3.2, 5.2, 7.0, 3.0, 4.4),
         (2.8, 4.0, 9.6, 3.5, 5.1), (8.0, 2.8, 7.6, 3.4, 4.7)],
        roughness=0.48,
    )
    peak = build_mass(
        "Mountain_Peak", 22, 16, peak_profile, "rock",
        [
            ("pine", -6.0, -0.2, 1.0, 601),
            ("pine", 4.6, 0.1, 1.05, 602),
            ("broadleaf", -8.0, -1.3, 0.88, 603),
            ("pine", 8.2, -1.0, 0.92, 604),
        ],
    )
    peak.build("Mountain_Peak")

    # K02: varied, low-detail blue-gray chains create depth behind the village.
    ridge_a = build_mass(
        "Mountain_Ridge_A", 24, 11,
        mass_profile(24, 11, 0.9,
                     [(-9.0, 2.3, 3.0, 3.0, 3.5), (-5.0, 3.4, 3.8, 2.8, 3.8),
                      (0.0, 2.2, 3.2, 3.2, 3.2), (5.0, 3.5, 3.9, 3.0, 3.8),
                      (9.5, 2.4, 3.0, 2.8, 3.4)], roughness=0.30),
        "far_rock",
    )
    ridge_a.build("Mountain_Ridge_A")

    ridge_b = build_mass(
        "Mountain_Ridge_B", 24, 11,
        mass_profile(24, 11, 1.0,
                     [(-9.0, 3.1, 3.0, 3.1, 3.6), (-4.1, 2.2, 3.6, 2.8, 3.2),
                      (1.2, 3.6, 4.3, 3.0, 3.8), (6.3, 2.1, 3.6, 3.1, 3.2),
                      (10.0, 3.4, 3.0, 2.8, 3.6)], roughness=0.32),
        "far_rock",
    )
    ridge_b.build("Mountain_Ridge_B")

    # K03: a steep split cliff rises to a broad, level pagoda summit.
    def cliff_height(x, y):
        ax = abs(x)
        shoulder_t = max(0.0, min(1.0, (10.0 - ax) / 6.6))
        shoulder = shoulder_t * shoulder_t * (3.0 - 2.0 * shoulder_t)
        front_t = max(0.0, min(1.0, (y + 7.0) / 5.8))
        front = front_t * front_t * (3.0 - 2.0 * front_t)
        back_t = max(0.0, min(1.0, (7.0 - y) / 4.0))
        back = back_t * back_t * (3.0 - 2.0 * back_t)
        splits = sum(1.15 * math.exp(-0.5 * ((x - ridge) / 0.55) ** 2)
                     for ridge in (-7.0, -4.3, 4.2, 6.8))
        strata = 0.16 * math.sin(x * 1.3 + y * 0.35) + 0.08 * math.cos(x * 0.7 - y)
        return max(0.04, shoulder * back * (2.5 + 14.0 * front - splits + strata))

    cliff = build_mass(
        "Mountain_Cliff", 20, 14, cliff_height, "rock",
        [
            ("pine", -7.0, 0.0, 0.95, 981),
            ("pine", 7.0, 0.3, 1.0, 982),
            ("broadleaf", -8.1, -1.8, 0.85, 983),
        ],
    )
    cliff.add_box((0, 0, 16.55), (4.8, 3.8, 0.4), "stone")
    for step in range(7):
        x = -1.35 if step % 2 else 1.35
        y = -6.0 + step * 0.82
        cliff.add_box((x, y, cliff_height(x, y) + 0.12),
                      (2.2, 1.5, 0.24), "stone")
    cliff.build("Mountain_Cliff")

    rocks = MeshBuilder(materials)
    for center, size, seed, cuts in (
        ((0.0, 0.2, 1.8), (2.2, 2.0, 2.2), 911, 5),
        ((-1.4, -0.4, 1.3), (1.8, 1.7, 1.6), 912, 4),
        ((1.3, -0.2, 1.2), (1.7, 1.6, 1.5), 913, 5),
        ((0.4, 1.4, 1.1), (1.6, 1.5, 1.4), 914, 4),
        ((-0.8, 1.2, 0.9), (1.4, 1.3, 1.2), 915, 4),
        ((0.2, -1.3, 0.8), (1.5, 1.4, 1.1), 916, 5),
    ):
        rocks.add_granite_boulder(center, size, seed=seed, cuts=cuts)
    rocks.build("Rock_Cluster")

    # Original layered stone outcrop guided by Stone Rock(part11)'s forms and palette.
    stone_ridge = MeshBuilder(materials)
    for center, size, seed, cuts, material in (
        ((-1.4, 0.0, 2.55), (7.2, 5.5, 2.7), 931, 9, "rock"),
        ((-5.3, 1.4, 4.6), (3.5, 4.0, 4.7), 932, 8, "reference_rock"),
        ((0.0, 2.1, 5.9), (3.5, 3.9, 6.0), 933, 9, "rock"),
        ((5.0, 1.7, 4.7), (3.8, 3.7, 4.8), 934, 8, "reference_rock"),
        ((-7.2, 0.1, 2.4), (2.0, 3.7, 2.5), 935, 7, "far_rock"),
        ((7.4, 0.0, 2.6), (1.9, 3.6, 2.7), 936, 7, "far_rock"),
        ((-2.0, -3.0, 1.3), (5.0, 2.6, 1.5), 937, 7, "reference_rock"),
        ((3.2, -2.7, 1.5), (4.4, 2.5, 1.7), 938, 7, "rock"),
    ):
        stone_ridge.add_granite_boulder(center, size, seed=seed, cuts=cuts, material=material)
    model = stone_ridge.build("Mountain_StoneRidge")
    for polygon in model.data.polygons:
        polygon.use_smooth = False

    # Broad, overlapping granite domes keep the skyline rounded instead of pointed.
    granite_massif = MeshBuilder(materials)
    for center, size, seed, cuts, material in (
        ((-9.0, 2.0, 4.9), (6.0, 6.2, 5.3), 1401, 7, "rock"),
        ((-4.5, 2.8, 6.1), (6.4, 6.5, 6.7), 1402, 8, "reference_rock"),
        ((1.4, 3.0, 5.2), (6.3, 6.4, 5.8), 1403, 7, "rock"),
        ((7.2, 2.8, 6.8), (6.1, 6.4, 7.5), 1404, 8, "rock"),
        ((11.0, 1.7, 4.4), (4.8, 5.7, 4.9), 1405, 7, "rock"),
        ((-10.2, 5.1, 5.8), (4.5, 5.4, 6.5), 1406, 7, "rock"),
        ((-1.8, 6.0, 5.9), (5.4, 5.2, 6.5), 1407, 8, "reference_rock"),
        ((6.1, 5.6, 5.7), (4.8, 5.0, 6.4), 1408, 7, "rock"),
        ((-9.4, -3.2, 2.2), (4.9, 4.3, 2.7), 1409, 6, "reference_rock"),
        ((-3.1, -3.5, 2.3), (5.2, 4.2, 2.8), 1410, 6, "rock"),
        ((3.2, -3.3, 2.3), (5.0, 4.2, 2.8), 1411, 6, "reference_rock"),
        ((9.2, -3.0, 2.0), (4.5, 4.0, 2.5), 1412, 6, "rock"),
    ):
        granite_massif.add_granite_boulder(center, size, seed=seed, cuts=cuts, material=material)
    massif = granite_massif.build("Mountain_GraniteMassif")
    assert massif.dimensions.x > 28.0 and 14.0 < massif.dimensions.z < 17.5, (
        f"granite massif is too small: {tuple(round(v, 2) for v in massif.dimensions)}"
    )
    for polygon in massif.data.polygons:
        polygon.use_smooth = False


def _segment_distance(point, a, b):
    px, py = point
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / denom))
    return math.hypot(px - (ax + dx * t), py - (ay + dy * t))


def _path_distance(point, paths):
    return min(_segment_distance(point, a, b) for path in paths for a, b in zip(path, path[1:]))


def _bezier(p0, p1, p2, p3, steps=48):
    points = []
    for i in range(steps + 1):
        t = i / steps
        q = 1 - t
        points.append((q**3*p0[0] + 3*q*q*t*p1[0] + 3*q*t*t*p2[0] + t**3*p3[0],
                       q**3*p0[1] + 3*q*q*t*p1[1] + 3*q*t*t*p2[1] + t**3*p3[1]))
    return points


def make_river_tile(materials, name, paths, pond=None, seed=0):
    builder = MeshBuilder(materials)
    rng = random.Random(seed)
    steps = 32
    cell = 4 / steps
    channel = 0.82
    for ix in range(steps):
        x0 = -2 + ix * cell
        x1 = x0 + cell
        for iy in range(steps):
            y0 = -2 + iy * cell
            y1 = y0 + cell
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            distance = _path_distance((cx, cy), paths)
            if pond and math.hypot(cx - pond[0], cy - pond[1]) < pond[2]:
                distance = 0
            if distance < channel:
                continue
            def bank_z(x, y):
                return 0.055 + 0.018 * math.sin(x * 3.2 + seed) * math.cos(y * 2.7 - seed)
            base = len(builder.vertices)
            for x_coord, y_coord in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
                builder.vertex((x_coord, y_coord, bank_z(x_coord, y_coord)))
            mat = "grass" if distance > 1.18 else "earth" if rng.random() < 0.58 else "moss"
            builder.face((base, base + 1, base + 2, base + 3), mat)
    for path in paths:
        for a, b in zip(path, path[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            count = max(2, math.ceil(length / 0.18))
            for i in range(count):
                t0 = i / count
                t1 = (i + 1) / count
                c0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
                c1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
                dx, dy = b[0] - a[0], b[1] - a[1]
                ln = math.hypot(dx, dy) or 1
                nx, ny = -dy / ln, dx / ln
                phase = (i + t0) * 0.7 + seed
                half = channel * 0.78
                base = len(builder.vertices)
                builder.vertex((c0[0] - nx * half, c0[1] - ny * half, 0.064 + math.sin(phase) * 0.012))
                builder.vertex((c1[0] - nx * half, c1[1] - ny * half, 0.064 + math.sin(phase + 0.3) * 0.012))
                builder.vertex((c1[0] + nx * half, c1[1] + ny * half, 0.064 + math.sin(phase + 0.3) * 0.012))
                builder.vertex((c0[0] + nx * half, c0[1] + ny * half, 0.064 + math.sin(phase) * 0.012))
                builder.face((base, base + 1, base + 2, base + 3), "water", True)
    if pond:
        cx, cy, r = pond
        base = builder.vertex((cx, cy, 0.066))
        ring = []
        for i in range(48):
            a = i * math.tau / 48
            ring.append(builder.vertex((cx + math.cos(a) * r, cy + math.sin(a) * r, 0.066 + math.sin(a * 5) * 0.008)))
        for i in range(48):
            builder.face((base, ring[i], ring[(i + 1) % 48]), "water", True)
    for path in paths:
        for a, b in zip(path, path[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            count = max(1, int(length / 0.75))
            for i in range(count):
                t = (i + 0.35) / count
                px = a[0] + (b[0] - a[0]) * t
                py = a[1] + (b[1] - a[1]) * t
                dx, dy = b[0] - a[0], b[1] - a[1]
                ln = math.hypot(dx, dy) or 1
                nx, ny = -dy / ln, dx / ln
                for side in (-1, 1):
                    if rng.random() < 0.72:
                        offset = side * rng.uniform(0.82, 1.12)
                        s = rng.uniform(0.11, 0.24)
                        builder.add_ico((px + nx * offset, py + ny * offset, 0.12),
                                        (s * 1.5, s, s * 0.56), "rock" if rng.random() < 0.7 else "moss", seed + i * 13 + side, 1)
                    if rng.random() < 0.19:
                        x = px + nx * side * 1.15
                        y = py + ny * side * 1.15
                        for blade in range(3):
                            ang = rng.random() * math.tau
                            h = rng.uniform(0.22, 0.42)
                            tip = (x + math.cos(ang) * 0.16, y + math.sin(ang) * 0.16, 0.08 + h)
                            builder.add_cylinder((x, y, 0.08), tip, 0.025, 0.004, "leaf_mid", 5)
    builder.build(name)


def make_rivers(materials):
    make_river_tile(materials, "River_Straight", [[(0, -2), (0, 2)]], seed=41)
    arc = _bezier((0, -2), (0, -0.7), (1.3, 0), (2, 0))
    make_river_tile(materials, "River_Bend", [arc], seed=42)
    make_river_tile(materials, "River_TJunction", [[(0, -2), (0, 2)], [(-2, 0), (0, 0)]], seed=43)
    make_river_tile(materials, "River_End", [[(0, -2), (0, 0.45)]], pond=(0, 1.05, 0.9), seed=44)


def add_wall_segment(builder, start, end, thickness=1.0, height=2.8, seed=0):
    rng = random.Random(seed)
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    cx, cy = (ax + bx) / 2, (ay + by) / 2
    builder.add_box((cx, cy, height / 2), (length, thickness, height), "stone")
    for side in (-1, 1):
        along = -length / 2 + 0.18
        row = 0
        while along < length / 2 - 0.12:
            block_w = min(rng.uniform(0.34, 0.62), length / 2 - 0.06 - along)
            for level in range(5):
                bh = rng.uniform(0.31, 0.42)
                z = 0.18 + level * 0.42 + (0.12 if row % 2 else 0)
                if z + bh > height - 0.3:
                    continue
                x = cx + dx / length * (along + block_w / 2) + nx * side * (thickness / 2 + 0.035)
                y = cy + dy / length * (along + block_w / 2) + ny * side * (thickness / 2 + 0.035)
                mat = ("stone", "rock", "stone", "moss")[rng.randrange(4)]
                builder.add_box((x, y, z), (block_w * 0.96, 0.10, bh * 0.88), mat, 0.015)
            along += block_w
            row += 1
    count = max(3, int(length / 0.48))
    for i in range(count):
        t = (i + 0.5) / count
        x = ax + dx * t
        y = ay + dy * t
        builder.add_box((x, y, height + 0.16), (length / count * 0.64, thickness + 0.18, 0.42), "stone")
        if i % 2 == 0:
            builder.add_box((x, y, height + 0.5), (length / count * 0.44, thickness * 0.82, 0.36), "rock")


def make_walls(materials):
    b = MeshBuilder(materials)
    add_wall_segment(b, (-2, 0), (2, 0), seed=51)
    b.build("Wall_Straight")

    b = MeshBuilder(materials)
    add_wall_segment(b, (-2, 0), (0, 0), seed=52)
    add_wall_segment(b, (0, 0), (0, 2), seed=53)
    b.build("Wall_Corner")

    b = MeshBuilder(materials)
    add_wall_segment(b, (-4, 0), (-2, 0), height=3.4, seed=54)
    add_wall_segment(b, (2, 0), (4, 0), height=3.4, seed=55)
    for x in (-2.15, 2.15):
        b.add_box((x, 0, 2.1), (1.0, 1.25, 4.2), "stone")
        for level in range(6):
            b.add_box((x, 0, 0.38 + level * 0.58), (0.92, 1.32, 0.42), "rock" if level % 3 == 0 else "stone", 0.012)
        b.add_box((x, 0, 4.5), (1.55, 1.7, 0.5), "wood")
    for i in range(9):
        x = -2.0 + i * 0.5
        b.add_box((x, 0, 4.85), (0.46, 1.55, 0.25), "stone")
    for x in (-2.15, 2.15):
        for y in (-1.3, 1.3):
            b.add_box((x, y, 5.45), (0.18, 0.18, 1.25), "wood")
    roof_base = len(b.vertices)
    for point in ((-3.3, 0, 7.0), (3.3, 0, 7.0), (4.0, -1.9, 6.15),
                  (4.0, 1.9, 6.15), (-4.0, 1.9, 6.15), (-4.0, -1.9, 6.15)):
        b.vertex(point)
    for face in ((roof_base, roof_base + 1, roof_base + 2, roof_base + 5),
                 (roof_base, roof_base + 1, roof_base + 3, roof_base + 4),
                 (roof_base, roof_base + 4, roof_base + 5),
                 (roof_base + 1, roof_base + 2, roof_base + 3)):
        b.face(face, "roof")
    b.add_cylinder((-3.35, 0, 7.08), (3.35, 0, 7.08), 0.13, 0.13, "wood", 10)
    for y in (-1.55, -1.2, -0.85, -0.5, -0.15, 0.2, 0.55, 0.9, 1.25, 1.6):
        z = 7.0 - 0.85 * abs(y) / 1.9 + 0.025
        b.add_cylinder((-3.65, y, z), (3.65, y, z), 0.025, 0.025, "wood", 5)
    for side in (-1, 1):
        for front in (-1, 1):
            b.add_cylinder((side * 3.7, front * 1.75, 6.22),
                           (side * 4.18, front * 2.0, 6.72), 0.055, 0.025, "wood", 6)
    b.build("Wall_Gate")

    b = MeshBuilder(materials)
    b.add_box((0, 0, 1.25), (3.1, 3.1, 2.5), "stone")
    for level in range(4):
        z = 0.35 + level * 0.52
        b.add_box((0, 0, z), (3.25, 3.25, 0.42), "rock" if level % 3 == 0 else "stone", 0.018)
    b.add_box((0, 0, 3.15), (2.55, 2.55, 1.1), "stone")
    b.add_box((0, 0, 3.8), (2.75, 2.75, 0.28), "wood")
    for z, scale in ((4.0, 1.0), (5.2, 0.78)):
        width = 4.25 * scale
        depth = 4.25 * scale
        ridge = width * 0.55
        base = len(b.vertices)
        for p in ((-width/2, -depth/2, z), (width/2, -depth/2, z), (width/2, depth/2, z), (-width/2, depth/2, z),
                  (-ridge/2, -ridge/2, z + 1.0*scale), (ridge/2, -ridge/2, z + 1.0*scale),
                  (ridge/2, ridge/2, z + 1.0*scale), (-ridge/2, ridge/2, z + 1.0*scale)):
            b.vertex(p)
        for face in ((base, base + 1, base + 5, base + 4), (base + 1, base + 2, base + 6, base + 5),
                     (base + 2, base + 3, base + 7, base + 6), (base + 3, base, base + 4, base + 7),
                     (base + 4, base + 5, base + 6, base + 7)):
            b.face(face, "roof")
        for x in (-width/2, width/2):
            for y in (-depth/2, depth/2):
                b.add_ico((x, y, z + 0.12*scale), (0.34*scale, 0.34*scale, 0.42*scale), "wood", 600 + int(z*10) + int(x*3), 1)
    b.build("Wall_Tower")


def add_weathered_wall_segment(builder, start, end, height=2.8, thickness=1.2, seed=0):
    """Build a thick, irregular block wall with moss seams and a separate cap course."""
    rng = random.Random(seed)
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    length = math.hypot(dx, dy)
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    cx, cy = (ax + bx) / 2, (ay + by) / 2
    along_x = abs(ux) >= abs(uy)
    core_size = (length, thickness, height) if along_x else (thickness, length, height)
    builder.add_box((cx, cy, height / 2), core_size, "far_rock")

    courses = 5
    course_height = height / courses
    for side in (-1, 1):
        for level in range(courses):
            cursor = -length / 2 + (0.16 if level % 2 else 0.04)
            while cursor < length / 2 - 0.04:
                remaining = length / 2 - 0.04 - cursor
                width = min(rng.uniform(0.55, 0.96), remaining)
                if width < 0.12:
                    break
                block_height = course_height * rng.uniform(0.76, 1.18)
                along = cursor + width / 2
                z = level * course_height + course_height / 2 + rng.uniform(-0.07, 0.07)
                x = cx + ux * along + nx * side * (thickness / 2 + 0.07)
                y = cy + uy * along + ny * side * (thickness / 2 + 0.07)
                block_size = ((width * 0.96, 0.19, block_height * 0.92) if along_x
                              else (0.19, width * 0.96, block_height * 0.92))
                material = rng.choices(("stone", "reference_rock", "far_rock"), (4, 5, 1))[0]
                builder.add_box((x, y, z), block_size, material, 0.055)
                cursor += width + rng.uniform(0.035, 0.075)

    cap_count = max(2, math.ceil(length / 0.92))
    for i in range(cap_count):
        along = -length / 2 + length * (i + 0.5) / cap_count
        x, y = cx + ux * along, cy + uy * along
        cap_size = (length / cap_count + 0.08, thickness + 0.22, 0.26) if along_x \
            else (thickness + 0.22, length / cap_count + 0.08, 0.26)
        builder.add_box((x, y, height + 0.13), cap_size,
                        "reference_rock" if i % 3 else "stone", 0.035)

    for i in range(max(3, round(length * 1.6))):
        along = rng.uniform(-length / 2 + 0.15, length / 2 - 0.15)
        side = rng.choice((-1, 1))
        x = cx + ux * along + nx * side * (thickness / 2 + 0.19)
        y = cy + uy * along + ny * side * (thickness / 2 + 0.19)
        patch_size = (rng.uniform(0.13, 0.32), 0.035, rng.uniform(0.07, 0.15)) if along_x \
            else (0.035, rng.uniform(0.13, 0.32), rng.uniform(0.07, 0.15))
        builder.add_ico((x, y, rng.uniform(0.25, 1.05)), patch_size,
                        "moss", seed + i, 1, True)


def make_reference_assets(materials):
    """Add original, modular assets guided by the supplied village references."""
    assets = []

    builder = MeshBuilder(materials)
    add_weathered_wall_segment(builder, (-2, 0), (2, 0), seed=1101)
    assets.append(builder.build("Wall_Weathered_Straight"))

    builder = MeshBuilder(materials)
    add_weathered_wall_segment(builder, (-2, 0), (0, 0), seed=1102)
    add_weathered_wall_segment(builder, (0, 0), (0, 2), seed=1103)
    assets.append(builder.build("Wall_Weathered_Corner"))

    builder = MeshBuilder(materials)
    for center, size, seed, cuts, material in (
        ((-4.8, 0.0, 4.1), (3.4, 4.5, 8.2), 1201, 8, "reference_rock"),
        ((-2.1, 0.45, 3.0), (3.3, 4.2, 6.0), 1202, 7, "rock"),
        ((0.65, 0.20, 4.6), (3.3, 4.6, 9.2), 1203, 9, "reference_rock"),
        ((3.3, 0.0, 3.45), (3.2, 4.3, 6.9), 1204, 8, "rock"),
        ((5.85, 0.2, 2.5), (2.8, 3.8, 5.0), 1205, 7, "reference_rock"),
        ((-6.15, -0.1, 1.2), (2.1, 3.5, 2.4), 1206, 6, "far_rock"),
        ((5.5, -0.25, 1.1), (2.1, 3.3, 2.2), 1207, 6, "far_rock"),
    ):
        builder.add_granite_boulder(center, size, seed=seed, cuts=cuts, material=material)
    for i, x in enumerate((-5.4, -3.2, -0.6, 1.7, 4.2, 5.8)):
        builder.add_ico((x, -2.2, 0.56), (0.42, 0.065, 0.19),
                        "moss", 1210 + i, 1, True)
    mountain = builder.build("Mountain_WeatheredTor")
    for polygon in mountain.data.polygons:
        polygon.use_smooth = False
    assets.append(mountain)

    source_zip = ROOT / "tree-model/tree_with_leaves_1.zip"
    if not source_zip.is_file():
        raise FileNotFoundError(f"Missing credited tree source: {source_zip}")
    extracted = Path(tempfile.mkdtemp(prefix="village-tree-source-"))
    try:
        with zipfile.ZipFile(source_zip) as archive:
            archive.extractall(extracted)
        existing = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(extracted / "scene.gltf"))
        imported = [obj for obj in bpy.context.scene.objects if obj not in existing]
        tree_parts = [obj for obj in imported if obj.type == "MESH"]
        assert len(tree_parts) == 6008, f"unexpected source tree mesh count: {len(tree_parts)}"

        low = [float("inf")] * 3
        high = [float("-inf")] * 3
        for obj in tree_parts:
            for corner in obj.bound_box:
                point = obj.matrix_world @ Vector(corner)
                for axis in range(3):
                    low[axis] = min(low[axis], point[axis])
                    high[axis] = max(high[axis], point[axis])
        height = high[2] - low[2]
        target_height = 5.5
        scale = target_height / height
        center_x = (low[0] + high[0]) / 2
        center_y = (low[1] + high[1]) / 2
        normalize = Matrix.Scale(scale, 4) @ Matrix.Translation((-center_x, -center_y, -low[2]))
        for obj in tree_parts:
            obj.matrix_world = normalize @ obj.matrix_world

        source_triangles = sum(
            sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
            for obj in tree_parts
        )
        bpy.ops.object.select_all(action="DESELECT")
        for obj in tree_parts:
            obj.select_set(True)
        tree = tree_parts[0]
        bpy.context.view_layer.objects.active = tree
        bpy.ops.object.join()
        tree.name = "Tree_VillageBroadleaf"
        tree.data.name = tree.name
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        for material in tree.data.materials:
            if material and material.name.lower().startswith("twig"):
                bark = (0.31, 0.17, 0.08, 1)
                material.diffuse_color = bark
                if material.use_nodes:
                    shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
                    if shader:
                        if not shader.inputs["Base Color"].is_linked:
                            shader.inputs["Base Color"].default_value = bark
                        shader.inputs["Roughness"].default_value = 0.9

        # Keep the dense leaf silhouette while reducing the 6.3M-face source for browser use.
        simplify = tree.modifiers.new("Village_Runtime_Detail", "DECIMATE")
        simplify.ratio = 0.08
        bpy.ops.object.modifier_apply(modifier=simplify.name)
        tree_triangles = sum(len(polygon.vertices) - 2 for polygon in tree.data.polygons)
        assert 0 < tree_triangles < source_triangles * 0.12
        assert abs(tree.dimensions.z - target_height) < 0.05
        tree["source"] = "https://sketchfab.com/3d-models/tree-with-leaves-1-d4a1988bfdb143a298f2333d4ecd6996"
        tree["author"] = "Helindu"
        tree["license"] = "CC-BY-4.0"
        tree["changes"] = "Scaled to village proportions, bark recolored, merged by material and simplified to 8% of source triangles."
        for image in bpy.data.images:
            if image.source == "FILE":
                image.pack()
        bpy.ops.file.pack_all()
        assets.append(tree)
        print(f"tree source triangles: {source_triangles}; optimized triangles: {tree_triangles}")
    finally:
        shutil.rmtree(extracted, ignore_errors=True)
    return assets


def make_bridge(materials):
    b = MeshBuilder(materials)
    rng = random.Random(88)
    for ix in range(24):
        x0 = -2 + 4 * ix / 24
        x1 = -2 + 4 * (ix + 1) / 24
        for iy in range(24):
            y0 = -2 + 4 * iy / 24
            y1 = -2 + 4 * (iy + 1) / 24
            cy = (y0 + y1) / 2
            base = len(b.vertices)
            for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
                zz = 0.18 + 1.18 * (1 - (y / 2)**2) + 0.025 * math.sin(x * 5 + cy * 3)
                b.vertex((x, y, zz))
            b.face((base, base + 1, base + 2, base + 3), "stone" if rng.random() < 0.68 else "earth")
    for side in (-1, 1):
        for i in range(12):
            y = -1.9 + i * 0.34
            z = 0.42 + 1.18 * (1 - (y / 2)**2)
            b.add_box((side * 1.92, y, z + 0.26), (0.32, 0.42, 0.56), "stone")
            b.add_box((side * 1.92, y, z + 0.57), (0.4, 0.46, 0.12), "moss" if i % 4 == 0 else "rock")
        for i in range(7):
            x = -1.75 + i * 0.58
            b.add_ico((x, -1.86, 0.36), (rng.uniform(0.12, 0.22), 0.16, 0.1), "rock", 900 + i, 1)
            b.add_ico((x, 1.86, 0.36), (rng.uniform(0.12, 0.22), 0.16, 0.1), "rock", 920 + i, 1)
    for side in (-1, 1):
        for i in range(15):
            angle = math.pi * i / 14
            x = side * 1.85
            y = math.cos(angle) * 1.5
            z = 0.18 + math.sin(angle) * 1.32
            block = (0.32, 0.36, 0.34)
            b.add_box((x, y, z), block, "rock" if i % 4 == 0 else "stone", 0.008)
        for x in (-1.85, 1.85):
            for y in (-1.7, 1.7):
                b.add_box((x, y, 0.62), (0.34, 0.54, 1.24), "stone")
    b.build("Bridge_Stone")


def build_assets():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(SEED)
    materials = make_materials()
    make_mountains(materials)
    make_rivers(materials)
    make_walls(materials)
    make_bridge(materials)
    make_tree_assets(materials)
    make_ground_tiles(materials)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=False,
        export_tangents=True,
    )
    print(f"wrote {OUT}: {len(bpy.context.scene.objects)} modular environment assets")

    reference_assets = make_reference_assets(materials)
    expected_names = {
        "Wall_Weathered_Straight", "Wall_Weathered_Corner",
        "Mountain_WeatheredTor", "Tree_VillageBroadleaf",
    }
    assert {obj.name for obj in reference_assets} == expected_names
    bpy.ops.object.select_all(action="DESELECT")
    for obj in reference_assets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = reference_assets[0]
    bpy.ops.export_scene.gltf(
        filepath=str(REFERENCE_OUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=False,
        export_tangents=True,
    )
    print(f"wrote {REFERENCE_OUT}: {len(reference_assets)} original reference-guided assets")


if __name__ == "__main__":
    build_assets()
