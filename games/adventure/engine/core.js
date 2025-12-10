// Core adventure engine logic.
import { parseInput } from './parser.js';
import { loadJson, loadAscii } from './loader.js';
import { runEvents } from './events.js';
import { startCombat, handleCombatAction } from './combat.js';

const DATA_ROOT = './js/games/adventure/data';
const SAVE_PREFIX = 'darkadv_';

const defaultStats = { hp: 12, attack: 2, defense: 1 };

const cache = {
  world: null,
  rooms: {},
  items: {},
  objects: {},
  enemies: {}
};

const state = {
  location: null,
  inventory: [],
  flags: {},
  stats: { ...defaultStats },
  inCombat: false,
  enemy: null,
  visited: {},
  lockedExits: {}
};

let adventureActive = false;

function isActive() {
  return adventureActive;
}

function deactivate() {
  adventureActive = false;
}

function getSaveKey() {
  if (typeof getUserName === 'function') {
    return `${SAVE_PREFIX}${getUserName()}`;
  }
  return `${SAVE_PREFIX}guest`;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

async function ensureWorldLoaded() {
  if (!cache.world) {
    cache.world = await loadJson('world.json');
  }
}

async function loadRoom(id) {
  if (!cache.rooms[id]) {
    cache.rooms[id] = await loadJson(`rooms/${id}.json`);
  }
  return cache.rooms[id];
}

async function loadItem(id) {
  if (!cache.items[id]) {
    cache.items[id] = await loadJson(`items/${id}.json`);
  }
  return cache.items[id];
}

async function loadObject(id) {
  if (!cache.objects[id]) {
    cache.objects[id] = await loadJson(`objects/${id}.json`);
  }
  return cache.objects[id];
}

async function loadEnemy(id) {
  if (!cache.enemies[id]) {
    cache.enemies[id] = await loadJson(`enemies/${id}.json`);
  }
  return cache.enemies[id];
}

function saveState() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    getSaveKey(),
    JSON.stringify({
      location: state.location,
      inventory: state.inventory,
      flags: state.flags,
      stats: state.stats,
      inCombat: state.inCombat,
      enemy: state.enemy,
      visited: state.visited,
      lockedExits: state.lockedExits
    })
  );
}

function loadStateFromSave() {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(getSaveKey());
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    return true;
  } catch (err) {
    console.error('Savegame fehlerhaft:', err);
    return false;
  }
}

function clearSave() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getSaveKey());
}

function describeInventory() {
  if (!state.inventory.length) {
    printLines(['Dein Inventar ist leer.']);
    return;
  }
  const lines = ['Inventar:'];
  state.inventory.forEach((id) => lines.push(`- ${id}`));
  printLines(lines);
}

async function showRoom(firstTime = false) {
  const room = await loadRoom(state.location);
  state.visited[room.id] = true;

  if (room.ascii) {
    await loadAscii(room.ascii);
  }

  const lines = [room.title, room.description];
  if (room.items && room.items.length) {
    lines.push('Hier siehst du: ' + room.items.map((i) => `"${i}"`).join(', '));
  }
  if (room.objects && room.objects.length) {
    lines.push('Objekte: ' + room.objects.join(', '));
  }
  const exits = Object.keys(room.exits || {});
  if (exits.length) {
    lines.push('Ausgänge: ' + exits.join(', '));
  }
  printLines(lines);

  const events = firstTime && room.on_first_enter ? room.on_first_enter : room.on_enter;
  if (Array.isArray(events) && events.length) {
    await runEvents(events, state, ctxForEvents());
  }
}

function ctxForEvents() {
  return {
    saveState,
    showCurrentRoom: async (first = false) => showRoom(first),
    startCombat: async (enemyId) => startCombat(enemyId, state, ctxForEvents()),
    loadEnemy
  };
}

async function performMove(action) {
  const room = await loadRoom(state.location);
  const direction = action.direction || action.object;
  const dest = room.exits ? room.exits[direction] : null;
  const lockKey = `${room.id}:${direction}`;

  if (!dest) {
    printLines([cache.world.messages.cannotGo]);
    return;
  }
  if (state.lockedExits[lockKey]) {
    printLines(['Der Weg ist versperrt.']);
    return;
  }

  state.location = dest;
  saveState();
  await showRoom(!state.visited[dest]);
}

async function performTake(action) {
  const room = await loadRoom(state.location);
  if (!action.object) {
    printLines([cache.world.messages.unknownCommand]);
    return;
  }
  const itemId = (action.object || '').replace(/\s+/g, '_');
  const available = room.items || [];
  const match = available.find((id) => id.toLowerCase().includes(itemId));
  if (!match) {
    printLines([cache.world.messages.cannotTake]);
    return;
  }
  const item = await loadItem(match);
  if (!item.pickup) {
    printLines(['Das lässt sich nicht mitnehmen.']);
    return;
  }
  room.items = available.filter((i) => i !== match);
  if (!state.inventory.includes(item.id)) {
    state.inventory.push(item.id);
  }
  printLines([`Du nimmst ${item.name}.`]);
  saveState();
}

async function performInspect(action) {
  const room = await loadRoom(state.location);

  // Kein Objekt angegeben → Umgebung / Raumbeschreibung erneut anzeigen
  if (!action.object) {
    await showRoom(false);
    return;
  }

  const objId = (action.object || '').replace(/\s+/g, '_');
  const candidates = (room.objects || []).concat(room.items || []);
  const match = candidates.find((id) => id.toLowerCase().includes(objId));
  if (!match) {
    printLines(['Nichts Besonderes.']);
    return;
  }

  if (room.objects.includes(match)) {
    const obj = await loadObject(match);
    const lines = [`${obj.name}: ${obj.description}`];
    printLines(lines);
    await runEvents(obj.inspect || [], state, ctxForEvents());
  } else if (room.items.includes(match) || state.inventory.includes(match)) {
    const item = await loadItem(match);
    printLines([`${item.name}: ${item.description}`]);
  }
}

async function performUse(action) {
  const room = await loadRoom(state.location);
  if (!action.object) {
    printLines([cache.world.messages.unknownCommand]);
    return;
  }
  const id = (action.object || '').replace(/\s+/g, '_');
  const onObject = (room.objects || []).find((o) => o.toLowerCase().includes(id));
  if (onObject) {
    const obj = await loadObject(onObject);
    if (obj.locked) {
      await runEvents(obj.on_locked_use || [], state, ctxForEvents());
      return;
    }
    await runEvents(obj.use || [], state, ctxForEvents());
    return;
  }
  const itemMatch = state.inventory.find((i) => i.toLowerCase().includes(id));
  if (itemMatch) {
    const item = await loadItem(itemMatch);
    await runEvents(item.on_use || [], state, ctxForEvents());
    return;
  }
  printLines([cache.world.messages.unknownCommand]);
}

async function performCombine(action) {
  const sourceId = (action.object || '').replace(/\s+/g, '_');
  const targetId = (action.target || '').replace(/\s+/g, '_');
  const match = state.inventory.find((i) => i.toLowerCase().includes(sourceId));
  if (!match) {
    printLines(['Dir fehlt ein benötigtes Item.']);
    return;
  }
  const item = await loadItem(match);
  const combination = item.combine ? item.combine[targetId] : null;
  if (!combination) {
    printLines(['Das lässt sich nicht kombinieren.']);
    return;
  }
  await runEvents(combination, state, ctxForEvents());
}

async function handleAction(action) {
  if (!action || !action.verb) {
    printLines([cache.world.messages.unknownCommand]);
    return;
  }

  if (state.inCombat) {
    const handled = await handleCombatAction(action, state, ctxForEvents());
    if (!handled) {
      printLines(['Kampf läuft bereits.']);
    }
    return;
  }

  switch (action.verb) {
    case 'go':
      await performMove(action);
      break;
    case 'take':
      await performTake(action);
      break;
    case 'inspect':
    case 'look':
      await performInspect(action);
      break;
    case 'use':
    case 'open':
    case 'close':
    case 'push':
    case 'pull':
      await performUse(action);
      break;
    case 'combine':
      await performCombine(action);
      break;
    case 'inventory':
      describeInventory();
      break;
    case 'help':
      printHelp();
      break;
    case 'attack':
      await handleCombatAction(action, state, ctxForEvents());
      break;
    default:
      printLines([cache.world.messages.unknownCommand]);
  }
}

function printHelp() {
  printLines([
    'Adventure-Befehle:',
    '- adv start | adv continue | adv reset',
    '- Bewegung: geh nord/ost/sued/west oder n/s/o/w',
    '- nimm <item>, untersuche <objekt>',
    '- benutze <objekt|item>',
    '- kombiniere <item> mit <anderes>',
    '- inventar, hilfe'
  ]);
}

export const adventure = {
  async start() {
    await ensureWorldLoaded();
    adventureActive = true; // <— NEU
    state.location = cache.world.startRoom;
    state.inventory = [];
    state.flags = clone(cache.world.globalFlags || {});
    state.stats = { ...defaultStats };
    state.inCombat = false;
    state.enemy = null;
    state.visited = {};
    state.lockedExits = {};
    saveState();
    printLines(['Starte Adventure...']);
    await showRoom(true);
  },
  async continue() {
    await ensureWorldLoaded();
    adventureActive = true; // <— NEU
    const loaded = loadStateFromSave();
    if (!loaded) {
      printLines(['Kein Spielstand gefunden. Starte neu.']);
      await adventure.start();
      return;
    }
    printLines(['Lade letzten Spielstand...']);
    await showRoom(!state.visited[state.location]);
  },
  async reset() {
    clearSave();
    
    await adventure.start();
  },
  async handleInput(text) {
    if (!cache.world) {
      await ensureWorldLoaded();
    }
    const action = parseInput(text);
    await handleAction(action);
  },
  help: printHelp,
  getState: () => state,
  getWorld: () => cache.world,
  dataRoot: DATA_ROOT,
  isActive,            
  exit: () => {        
    deactivate();
    printLines(['Du verlässt das Adventure und kehrst ins Darknetz-Terminal zurück.', ''], 'dim');
  }
};

export default adventure;
