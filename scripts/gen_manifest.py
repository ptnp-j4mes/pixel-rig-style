#!/usr/bin/env python3
"""Scan public/kit/*.gltf -> public/manifest.json (name, file, category, size)."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
KIT_DIR = os.path.join(ROOT, 'public', 'kit')
OUT = os.path.join(ROOT, 'public', 'manifest.json')


def piece_size(path):
    """[w, h, d] in meters from POSITION accessor min/max."""
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
    return [round(maxs[i] - mins[i], 3) for i in range(3)]


def main():
    files = sorted(f for f in os.listdir(KIT_DIR) if f.endswith('.gltf'))
    assert len(files) > 100, f'expected full kit in public/kit, found {len(files)} .gltf files'
    entries = []
    for f in files:
        name = f[: -len('.gltf')]
        entries.append({
            'name': name,
            'file': f,
            'category': name.split('_')[0],
            'size': piece_size(os.path.join(KIT_DIR, f)),
        })
    entries.sort(key=lambda e: (e['category'], e['name']))
    assert all(e['size'][0] > 0 for e in entries), 'degenerate footprint found'
    cats = {}
    for e in entries:
        cats[e['category']] = cats.get(e['category'], 0) + 1
    with open(OUT, 'w') as f:
        json.dump(entries, f, indent=1)
    print(f'wrote {OUT}: {len(entries)} assets in {len(cats)} categories')
    for c in sorted(cats):
        print(f'  {c}: {cats[c]}')


if __name__ == '__main__':
    sys.exit(main())
