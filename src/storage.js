import { deserializeMap } from './lib.js';

const AUTOSAVE_KEY = 'mve.autosave';
let timer = null;

export function saveMapFile(doc) {
  const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.mapName || 'map'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function openMapFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(deserializeMap(await file.text()));
      } catch (err) {
        resolve({ error: err.message });
      }
    };
    input.click();
  });
}

export function scheduleAutosave(doc) {
  clearTimeout(timer);
  timer = setTimeout(() => localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc)), 500);
}

export function readAutosave() {
  const text = localStorage.getItem(AUTOSAVE_KEY);
  if (!text) return null;
  try {
    return deserializeMap(text);
  } catch {
    return null;
  }
}

export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
}
