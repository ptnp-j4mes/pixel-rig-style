#!/usr/bin/env python3
"""Scan public/packs/* -> public/manifest.json (array of packs).

Pack types:
  gltf-folder: a directory of *.gltf files (each = one object)
  glb:         one or more .glb files whose named mesh nodes share one pack
"""
import json
import os
import struct
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
PACKS_DIR = os.path.join(ROOT, 'public', 'packs')
OUT = os.path.join(ROOT, 'public', 'manifest.json')


def gltf_size(path):
    """[w, h, d] from POSITION accessor min/max."""
    with open(path) as f:
        d = json.load(f)
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for mesh in d.get('meshes', []):
        for prim in mesh.get('primitives', []):
            acc = d['accessors'][prim['attributes']['POSITION']]
            for i in range(3):
                mins[i] = min(mins[i], acc['min'][i])
                maxs[i] = max(maxs[i], acc['max'][i])
    return [round(maxs[i] - mins[i], 2) for i in range(3)]


def glb_nodes(path):
    """Named mesh nodes of a .glb with size = bounds * node scale."""
    with open(path, 'rb') as f:
        data = f.read()
    chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
    d = json.loads(data[20:20 + chunk_len])
    entries = []
    for node in d.get('nodes', []):
        if 'mesh' not in node or not node.get('name'):
            continue
        scale = node.get('scale', [1, 1, 1])
        mins = [1e9] * 3
        maxs = [-1e9] * 3
        mesh = d['meshes'][node['mesh']]
        for prim in mesh.get('primitives', []):
            acc = d['accessors'][prim['attributes']['POSITION']]
            for i in range(3):
                mins[i] = min(mins[i], acc['min'][i] * scale[i])
                maxs[i] = max(maxs[i], acc['max'][i] * scale[i])
        size = [round(maxs[i] - mins[i], 2) for i in range(3)]
        entries.append({'name': node['name'], 'size': size})
    entries.sort(key=lambda e: e['name'])
    return entries


def main():
    packs = []
    for dir_name in sorted(os.listdir(PACKS_DIR)):
        pack_dir = os.path.join(PACKS_DIR, dir_name)
        if not os.path.isdir(pack_dir):
            continue
        glb_files = sorted(f for f in os.listdir(pack_dir) if f.endswith('.glb'))
        gltf_files = sorted(f[:-5] for f in os.listdir(pack_dir) if f.endswith('.gltf'))
        if glb_files:
            main_file = f'{dir_name.title().replace("-", "")}.glb'
            if main_file not in glb_files:
                main_file = glb_files[0]
            entries = glb_nodes(os.path.join(pack_dir, main_file))
            for source_file in glb_files:
                if source_file == main_file:
                    continue
                for entry in glb_nodes(os.path.join(pack_dir, source_file)):
                    entry['file'] = source_file
                    entries.append(entry)
            entries.sort(key=lambda e: e['name'])
            packs.append({
                'id': dir_name,
                'name': dir_name.replace('-', ' ').title(),
                'type': 'glb',
                'file': main_file,
                'entries': entries,
            })
        elif gltf_files:
            packs.append({
                'id': dir_name,
                'name': dir_name.replace('-', ' ').title(),
                'type': 'gltf-folder',
                'entries': [
                    {'name': name, 'size': gltf_size(os.path.join(pack_dir, name + '.gltf'))}
                    for name in gltf_files
                ],
            })
    assert len(packs) == 2, f'expected 2 packs, found {len(packs)}'
    by_id = {p['id']: p for p in packs}
    assert len(by_id['japan-village']['entries']) >= 35, 'japan-village base assets are incomplete'
    assert len(by_id['village-pack']['entries']) >= 84, 'village-pack base assets are incomplete'
    for p in packs:
        assert all(e['size'][0] > 0 and e['size'][1] > 0 and e['size'][2] > 0 for e in p['entries']), \
            f"degenerate size in {p['id']}"
    with open(OUT, 'w') as f:
        json.dump(packs, f, indent=1)
    total = sum(len(p['entries']) for p in packs)
    print(f'wrote {OUT}: {len(packs)} packs, {total} objects')
    for p in packs:
        print(f"  {p['id']} ({p['type']}): {len(p['entries'])} objects")


if __name__ == '__main__':
    sys.exit(main())
