// Adventure configuration management.
// Loads adventure metadata from a game.json manifest and exposes
// normalized paths for the rest of the engine.

const DEFAULT_ID = 'adventure';
const DEFAULT_TITLE = 'NRW Noir Adventure';
const DEFAULT_DATA_DIR = 'data';
const DEFAULT_WORLD_FILE = 'world.json';

let currentConfig = null;

function normalizePath(basePath, relativePath) {
  if (!relativePath) return basePath;
  if (/^https?:\/\//.test(relativePath) || relativePath.startsWith('/')) {
    return relativePath.replace(/\/$/, '');
  }
  const base = basePath.replace(/\/$/, '');
  const trimmed = relativePath.replace(/^\.\//, '').replace(/\/$/, '');
  return `${base}/${trimmed}`;
}

export function getAdventureConfig() {
  if (currentConfig) return currentConfig;
  const basePath = `./js/games/${DEFAULT_ID}`;
  currentConfig = {
    id: DEFAULT_ID,
    title: DEFAULT_TITLE,
    basePath,
    dataPath: `${basePath}/${DEFAULT_DATA_DIR}`,
    worldFile: DEFAULT_WORLD_FILE
  };
  return currentConfig;
}

/**
 * Loads a game.json manifest for the given adventure id and updates the
 * active configuration. Paths inside the manifest are treated as relative
 * to the adventure folder.
 * @param {string} [adventureId]
 */
export async function setActiveAdventure(adventureId = null) {
  const desiredId = adventureId || getAdventureConfig().id;
  const basePath = `./js/games/${desiredId}`;
  const manifestUrl = `${basePath}/game.json`;
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(`Konnte Adventure nicht laden (${manifestUrl})`);
  }
  const manifest = await res.json();

  currentConfig = {
    id: manifest.id || desiredId,
    title: manifest.title || DEFAULT_TITLE,
    basePath,
    dataPath: normalizePath(basePath, manifest.dataPath || DEFAULT_DATA_DIR),
    worldFile: manifest.worldFile || DEFAULT_WORLD_FILE
  };

  return currentConfig;
}
