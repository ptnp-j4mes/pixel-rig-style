// Pure logic — no three.js imports here so node can test it directly.

export const SNAP_SIZE = 1;       // optional snap unit (m); free placement by default
export const MAP_EXTENT = 128;    // 64x64 m of ground
export const MAP_VERSION = 3;
export const DEFAULT_SPAWN = { pos: [0, 0, 8], rotY: 0 };
const DEFAULT_LAYER_ID = 'layer-default';

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

function uniqueId(value, prefix, used) {
  let id = typeof value === 'string' && value.trim() ? value : '';
  if (!id || used.has(id)) {
    let n = 1;
    do { id = `${prefix}-${n++}`; } while (used.has(id));
  }
  used.add(id);
  return id;
}

function normalizeSpawn(spawn) {
  const pos = spawn?.pos;
  return {
    pos: Array.isArray(pos) && pos.length === 3 && pos.every(Number.isFinite) ? [...pos] : [...DEFAULT_SPAWN.pos],
    rotY: Number.isFinite(spawn?.rotY) ? spawn.rotY : DEFAULT_SPAWN.rotY,
  };
}

function normalizeDocument(doc) {
  if (!Array.isArray(doc.objects)) throw new Error('map has no objects array');

  const legacy = doc.version < MAP_VERSION;
  const layerIds = new Set();
  const layerIdMap = new Map();
  const sourceLayers = legacy || !Array.isArray(doc.layers) ? [] : doc.layers;
  const layers = sourceLayers.map((layer, index) => {
    const id = uniqueId(layer.id, `layer-${index + 1}`, layerIds);
    if (typeof layer.id === 'string' && !layerIdMap.has(layer.id)) layerIdMap.set(layer.id, id);
    return {
      id,
      name: typeof layer.name === 'string' && layer.name ? layer.name : `Layer ${index + 1}`,
      visible: layer.visible !== false,
      locked: layer.locked === true,
    };
  });
  if (!layerIds.has(DEFAULT_LAYER_ID)) {
    layers.unshift({ id: DEFAULT_LAYER_ID, name: 'Default Layer', visible: true, locked: false });
    layerIds.add(DEFAULT_LAYER_ID);
    layerIdMap.set(DEFAULT_LAYER_ID, DEFAULT_LAYER_ID);
  }
  const groupIds = new Set();
  const groupIdMap = new Map();
  const groups = (legacy || !Array.isArray(doc.groups) ? [] : doc.groups).map((group, index) => {
    const id = uniqueId(group.id, `group-${index + 1}`, groupIds);
    if (typeof group.id === 'string' && !groupIdMap.has(group.id)) groupIdMap.set(group.id, id);
    const sourceLayerId = layerIdMap.get(group.layerId) ?? group.layerId;
    const layerId = layerIds.has(sourceLayerId) ? sourceLayerId : DEFAULT_LAYER_ID;
    return {
      id,
      name: typeof group.name === 'string' && group.name ? group.name : `Group ${index + 1}`,
      layerId,
      pos: Array.isArray(group.pos) ? [...group.pos] : [0, 0, 0],
      rotY: Number.isFinite(group.rotY) ? group.rotY : 0,
      scale: Array.isArray(group.scale) ? [...group.scale] : [1, 1, 1],
      visible: group.visible !== false,
      locked: group.locked === true,
      order: Number.isFinite(group.order) ? group.order : index,
    };
  });
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const objectIds = new Set();
  const objects = doc.objects.map((object, index) => {
    const id = uniqueId(object.id, `object-${index + 1}`, objectIds);
    const requestedLayerId = layerIdMap.get(object.layerId) ?? object.layerId;
    const requestedGroupId = groupIdMap.get(object.groupId) ?? object.groupId;
    const hasValidLayer = layerIds.has(requestedLayerId);
    let layerId = hasValidLayer ? requestedLayerId : DEFAULT_LAYER_ID;
    let groupId = requestedGroupId;
    const group = groupById.get(groupId);
    if (!hasValidLayer || !group || layerId !== group.layerId) {
      if (groupId !== undefined) layerId = DEFAULT_LAYER_ID;
      groupId = undefined;
    }
    return {
      id,
      pack: object.pack,
      asset: object.asset,
      name: typeof object.name === 'string' && object.name ? object.name : String(object.asset ?? 'Object'),
      layerId,
      ...(groupId === undefined ? {} : { groupId }),
      pos: Array.isArray(object.pos) ? [...object.pos] : [0, 0, 0],
      rotY: Number.isFinite(object.rotY) ? object.rotY : 0,
      scale: Array.isArray(object.scale) ? [...object.scale] : [1, 1, 1],
      visible: object.visible !== false,
      locked: object.locked === true,
      order: Number.isFinite(object.order) ? object.order : index,
    };
  });

  return {
    ...doc,
    spawn: normalizeSpawn(doc.spawn),
    layers,
    groups,
    objects,
  };
}

export function serializeMap(mapName, objects, layers, groups, spawn = DEFAULT_SPAWN) {
  return normalizeDocument({
    version: MAP_VERSION,
    gridSize: SNAP_SIZE,
    mapName,
    spawn,
    layers: layers ?? [{ id: DEFAULT_LAYER_ID, name: 'Default Layer', visible: true, locked: false }],
    groups: groups ?? [],
    objects,
  });
}

export function deserializeMap(text) {
  const doc = JSON.parse(text);
  if (![1, 2, MAP_VERSION].includes(doc.version)) throw new Error(`unsupported map version: ${doc.version}`);
  return normalizeDocument(doc);
}
