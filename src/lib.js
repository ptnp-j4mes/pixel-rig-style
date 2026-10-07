// Pure logic — no three.js imports here so node can test it directly.

export const GRID_SIZE = 2;       // kit module: floors are 2x2 m, walls 2 m wide
export const MAP_EXTENT = 128;    // 64x64 cells
export const MAP_VERSION = 1;

export const CATEGORY_ORDER = [
  'Floor', 'Wall', 'Corner', 'Door', 'DoorFrame', 'Window', 'WindowShutters',
  'Overhang', 'Roof', 'Stairs', 'Balcony', 'HoleCover', 'Prop',
];

export function snapToGrid(v, grid = GRID_SIZE) {
  return Math.round(v / grid) * grid;
}

export function quantizeRotY(deg) {
  const norm = ((deg % 360) + 360) % 360;
  return (Math.round(norm / 90) * 90) % 360;
}

export function categoryOf(assetName) {
  return assetName.split('_')[0];
}

export function serializeMap(mapName, objects) {
  return {
    version: MAP_VERSION,
    gridSize: GRID_SIZE,
    mapName,
    objects: objects.map((o) => ({
      asset: o.asset,
      pos: [...o.pos],
      rotY: o.rotY,
      scale: [...o.scale],
    })),
  };
}

export function deserializeMap(text) {
  const doc = JSON.parse(text);
  if (doc.version !== MAP_VERSION) throw new Error(`unsupported map version: ${doc.version}`);
  if (!Array.isArray(doc.objects)) throw new Error('map has no objects array');
  return doc;
}
