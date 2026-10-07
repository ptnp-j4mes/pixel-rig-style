// Pure logic — no three.js imports here so node can test it directly.

export const SNAP_SIZE = 1;       // optional snap unit (m); free placement by default
export const MAP_EXTENT = 128;    // 64x64 m of ground
export const MAP_VERSION = 2;

export const CATEGORY_ORDER = [
  'Floor', 'Wall', 'Corner', 'Door', 'DoorFrame', 'Window', 'WindowShutters',
  'Overhang', 'Roof', 'Stairs', 'Balcony', 'HoleCover', 'Prop',
];

export function snapToGrid(v, grid = SNAP_SIZE) {
  return Math.round(v / grid) * grid;
}

export function quantizeRotY(deg) {
  const norm = ((deg % 360) + 360) % 360;
  return (Math.round(norm / 90) * 90) % 360;
}

export function serializeMap(mapName, objects) {
  return {
    version: MAP_VERSION,
    gridSize: SNAP_SIZE,
    mapName,
    objects: objects.map((o) => ({
      pack: o.pack,
      asset: o.asset,
      pos: [...o.pos],
      rotY: o.rotY,
      scale: [...o.scale],
    })),
  };
}

export function deserializeMap(text) {
  const doc = JSON.parse(text);
  if (![1, MAP_VERSION].includes(doc.version)) throw new Error(`unsupported map version: ${doc.version}`);
  if (!Array.isArray(doc.objects)) throw new Error('map has no objects array');
  return doc;
}
