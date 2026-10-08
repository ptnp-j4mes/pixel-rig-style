export function createHistory(initialState, limit = 50) {
  // ponytail: 50 full snapshots bound memory; switch to delta history if map size makes this restrictive.
  const maxSnapshots = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 50;
  let snapshots = [JSON.stringify(initialState)];
  let cursor = 0;
  const copy = (index) => JSON.parse(snapshots[index]);

  return {
    record(state) {
      const snapshot = JSON.stringify(state);
      if (snapshot === snapshots[cursor]) return false;
      snapshots = snapshots.slice(0, cursor + 1);
      snapshots.push(snapshot);
      cursor++;
      if (snapshots.length > maxSnapshots) {
        snapshots.shift();
        cursor--;
      }
      return true;
    },
    undo() {
      if (cursor === 0) return null;
      cursor--;
      return copy(cursor);
    },
    redo() {
      if (cursor >= snapshots.length - 1) return null;
      cursor++;
      return copy(cursor);
    },
    reset(state) {
      snapshots = [JSON.stringify(state)];
      cursor = 0;
    },
    canUndo: () => cursor > 0,
    canRedo: () => cursor < snapshots.length - 1,
  };
}
