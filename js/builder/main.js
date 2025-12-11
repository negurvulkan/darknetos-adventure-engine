import { Api } from './api.js';

const state = {
  adventures: [],
  currentAdventure: null,
  data: null,
  dirty: false,
  selection: { view: 'world', roomId: null, itemId: null },
  asciiFiles: [],
};

const viewEl = document.getElementById('view');
const viewHeader = document.getElementById('view-header');
const sidebar = document.getElementById('sidebar-content');
const mapView = document.getElementById('map-view');
const asciiPreview = document.getElementById('ascii-preview');

function $(sel) { return document.querySelector(sel); }

function toast(message, type = 'info') {
  const host = document.getElementById('notifications');
  const tpl = document.getElementById('toast-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  if (type !== 'info') node.classList.add(type);
  host.appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function setDirty(flag = true) {
  state.dirty = flag;
  const btn = document.getElementById('btn-save');
  btn.textContent = flag ? 'Speichern*' : 'Speichern';
}

function init() {
  $('#btn-dashboard').addEventListener('click', renderDashboard);
  $('#btn-save').addEventListener('click', saveCurrent);
  $('#btn-test').addEventListener('click', () => {
    if (!state.currentAdventure) return;
    const url = `./index.html?adv=${state.currentAdventure.id}`;
    window.open(url, '_blank');
  });
  loadAdventures();
}

async function loadAdventures() {
  try {
    const res = await Api.listAdventures();
    state.adventures = res.adventures || res;
    renderDashboard();
    const params = new URLSearchParams(window.location.search);
    const advFromQuery = params.get('adv');
    if (advFromQuery) openAdventure(advFromQuery);
  } catch (e) {
    toast('Konnte Adventure-Liste nicht laden: ' + e.message, 'error');
  }
}

function renderDashboard() {
  state.currentAdventure = null;
  state.data = null;
  sidebar.innerHTML = '';
  viewHeader.innerHTML = '<div class="badge"><span class="dot"></span> Dashboard</div>';
  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';

  const newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.innerHTML = `<h3>Neues Adventure</h3><p>Lege eine frische Instanz an.</p><button class="primary" id="btn-new-adv">Adventure anlegen</button>`;
  grid.appendChild(newCard);
  newCard.querySelector('#btn-new-adv').addEventListener('click', promptNewAdventure);

  state.adventures.forEach((adv) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${adv.title}</h3>
      <p>${adv.description || ''}</p>
      <div class="badge"><span class="dot"></span> ${adv.id}</div>
      <div class="dashboard-actions">
        <button class="primary" data-id="${adv.id}">Bearbeiten</button>
        <button class="ghost" data-dup="${adv.id}">Duplizieren</button>
      </div>
    `;
    grid.appendChild(card);
    card.querySelector('[data-id]').addEventListener('click', () => openAdventure(adv.id));
    card.querySelector('[data-dup]').addEventListener('click', () => duplicateAdventure(adv));
  });
  viewEl.innerHTML = '';
  viewEl.appendChild(grid);
}

async function promptNewAdventure() {
  const id = prompt('Adventure-ID (slug, z.B. my-adventure):');
  if (!id) return;
  const title = prompt('Titel des Adventures:') || id;
  const description = prompt('Kurzbeschreibung:') || '';
  try {
    await Api.createAdventure({ id, title, description });
    toast('Adventure angelegt.');
    await loadAdventures();
    openAdventure(id);
  } catch (e) {
    toast('Erstellen fehlgeschlagen: ' + e.message, 'error');
  }
}

async function duplicateAdventure(source) {
  const id = prompt('Neue ID für die Kopie:', `${source.id}-kopie`);
  if (!id) return;
  try {
    await Api.createAdventure({ id, title: source.title + ' (Kopie)', description: source.description, source: source.id });
    toast('Adventure dupliziert.');
    await loadAdventures();
    openAdventure(id);
  } catch (e) {
    toast('Duplizieren fehlgeschlagen: ' + e.message, 'error');
  }
}

async function openAdventure(id) {
  try {
    const res = await Api.loadAdventure(id);
    state.currentAdventure = res.adventure || state.adventures.find(a => a.id === id) || { id };
    state.data = res.data || res;
    state.asciiFiles = res.ascii || res.asciiFiles || [];
    state.selection = { view: 'world', roomId: null, itemId: null };
    setDirty(false);
    renderEditor();
    renderSidebar();
    renderMap();
  } catch (e) {
    toast('Adventure laden fehlgeschlagen: ' + e.message, 'error');
  }
}

function renderSidebar() {
  if (!state.data) return;
  sidebar.innerHTML = '';

  const worldNav = document.createElement('div');
  worldNav.className = 'nav-item' + (state.selection.view === 'world' ? ' active' : '');
  worldNav.textContent = 'World & Game';
  worldNav.onclick = () => { state.selection.view = 'world'; state.selection.roomId = null; renderEditor(); renderSidebar(); };
  sidebar.appendChild(worldNav);

  sidebar.appendChild(sectionTitle('Räume'));
  const roomList = document.createElement('div');
  roomList.className = 'nav-list';
  (state.data.rooms || []).forEach(room => {
    const item = document.createElement('div');
    item.className = 'nav-item' + (state.selection.roomId === room.id ? ' active' : '');
    item.textContent = room.title || room.id;
    item.onclick = () => { state.selection.view = 'room'; state.selection.roomId = room.id; renderEditor(); renderSidebar(); updateAsciiPreview(room.ascii); };
    roomList.appendChild(item);
  });
  const btnNewRoom = document.createElement('button');
  btnNewRoom.textContent = 'Neuen Raum anlegen';
  btnNewRoom.style.marginTop = '8px';
  btnNewRoom.onclick = addRoom;
  sidebar.appendChild(roomList);
  sidebar.appendChild(btnNewRoom);

  sidebar.appendChild(sectionTitle('Items'));
  const itemList = document.createElement('div');
  itemList.className = 'nav-list';
  (state.data.items || []).forEach(item => {
    const row = document.createElement('div');
    row.className = 'nav-item' + (state.selection.itemId === item.id ? ' active' : '');
    row.textContent = item.name || item.id;
    row.onclick = () => { state.selection.view = 'item'; state.selection.itemId = item.id; renderEditor(); renderSidebar(); };
    itemList.appendChild(row);
  });
  const btnNewItem = document.createElement('button');
  btnNewItem.textContent = 'Neues Item';
  btnNewItem.style.marginTop = '8px';
  btnNewItem.onclick = addItem;
  sidebar.appendChild(itemList);
  sidebar.appendChild(btnNewItem);
}

function sectionTitle(label) {
  const el = document.createElement('div');
  el.className = 'section-title';
  el.textContent = label;
  return el;
}

function renderEditor() {
  if (!state.data) return;
  viewEl.innerHTML = '';
  if (state.selection.view === 'world') {
    renderWorld();
  } else if (state.selection.view === 'room') {
    renderRoomEditor();
  } else if (state.selection.view === 'item') {
    renderItemEditor();
  }
}

function renderWorld() {
  viewHeader.innerHTML = `<div class="badge"><span class="dot"></span> World & Game</div>`;
  const wrap = document.createElement('div');

  wrap.appendChild(renderWorldForm());
  wrap.appendChild(renderGameForm());
  viewEl.appendChild(wrap);
}

function renderWorldForm() {
  const card = document.createElement('div');
  card.className = 'card';
  const world = state.data.world || {};
  card.innerHTML = '<h3>world.json</h3>';
  card.appendChild(createFieldGrid([
    field('ID', 'text', world.id, (v) => updateWorld('id', v)),
    field('Title', 'text', world.title, (v) => updateWorld('title', v)),
    field('Start Room', 'text', world.startRoom, (v) => updateWorld('startRoom', v)),
    field('Difficulty', 'text', world.difficulty, (v) => updateWorld('difficulty', v)),
  ]));

  const flagsField = document.createElement('div');
  flagsField.className = 'field';
  flagsField.innerHTML = '<label>Global Flags (JSON)</label>';
  const area = document.createElement('textarea');
  area.value = JSON.stringify(world.globalFlags || {}, null, 2);
  area.onchange = () => safeJsonUpdate(area.value, (val) => updateWorld('globalFlags', val));
  flagsField.appendChild(area);
  card.appendChild(flagsField);
  return card;
}

function renderGameForm() {
  const card = document.createElement('div');
  card.className = 'card';
  const game = state.data.game || {};
  card.innerHTML = '<h3>game.json</h3>';
  card.appendChild(createFieldGrid([
    field('Titel', 'text', game.title, (v) => updateGame('title', v)),
    field('Untertitel', 'text', game.subtitle, (v) => updateGame('subtitle', v)),
    field('Intro', 'textarea', game.intro, (v) => updateGame('intro', v)),
    field('Outro', 'textarea', game.outro, (v) => updateGame('outro', v)),
  ]));
  return card;
}

function updateWorld(key, value) {
  state.data.world = state.data.world || {};
  state.data.world[key] = value;
  setDirty(true);
}

function updateGame(key, value) {
  state.data.game = state.data.game || {};
  state.data.game[key] = value;
  setDirty(true);
}

function renderRoomEditor() {
  const room = (state.data.rooms || []).find(r => r.id === state.selection.roomId);
  if (!room) return;
  viewHeader.innerHTML = `<div class="badge"><span class="dot"></span> Raum: ${room.id}</div>`;
  const card = document.createElement('div');
  card.className = 'card';

  card.appendChild(createFieldGrid([
    field('ID', 'text', room.id, (v) => updateRoom(room, 'id', v)),
    field('Titel', 'text', room.title, (v) => updateRoom(room, 'title', v)),
    field('ASCII', 'select', room.ascii || '', (v) => { updateRoom(room, 'ascii', v); updateAsciiPreview(v); }, { options: [''].concat(state.asciiFiles) }),
  ]));

  const desc = document.createElement('div');
  desc.className = 'field';
  desc.innerHTML = '<label>Beschreibung</label>';
  const descArea = document.createElement('textarea');
  descArea.value = room.description || '';
  descArea.oninput = () => updateRoom(room, 'description', descArea.value);
  desc.appendChild(descArea);
  card.appendChild(desc);

  const lists = document.createElement('div');
  lists.className = 'form-grid';
  lists.appendChild(multiselectField('Items', state.data.items || [], room.items || [], (vals) => updateRoom(room, 'items', vals)));
  lists.appendChild(textListField('Objekte', room.objects || [], (vals) => updateRoom(room, 'objects', vals)));
  card.appendChild(lists);

  card.appendChild(exitTable(room));
  card.appendChild(eventArea('On First Enter', room.on_first_enter || [], (val) => updateRoom(room, 'on_first_enter', val)));
  card.appendChild(eventArea('On Enter', room.on_enter || [], (val) => updateRoom(room, 'on_enter', val)));

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'Diesen Raum löschen';
  del.onclick = () => deleteRoom(room.id);
  actions.appendChild(del);
  card.appendChild(actions);

  card.appendChild(asciiUploadBlock());

  viewEl.appendChild(card);
}

function renderItemEditor() {
  const item = (state.data.items || []).find(i => i.id === state.selection.itemId);
  if (!item) return;
  viewHeader.innerHTML = `<div class="badge"><span class="dot"></span> Item: ${item.id}</div>`;
  const card = document.createElement('div');
  card.className = 'card';

  card.appendChild(createFieldGrid([
    field('ID', 'text', item.id, (v) => updateItem(item, 'id', v)),
    field('Name', 'text', item.name, (v) => updateItem(item, 'name', v)),
    field('Aufhebbar', 'checkbox', item.pickup !== false, (v) => updateItem(item, 'pickup', v)),
  ]));

  const desc = document.createElement('div');
  desc.className = 'field';
  desc.innerHTML = '<label>Beschreibung</label>';
  const area = document.createElement('textarea');
  area.value = item.description || '';
  area.oninput = () => updateItem(item, 'description', area.value);
  desc.appendChild(area);
  card.appendChild(desc);

  card.appendChild(combineTable(item));
  card.appendChild(eventArea('On Use', item.on_use || [], (val) => updateItem(item, 'on_use', val)));

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '10px';
  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'Item löschen';
  del.onclick = () => deleteItem(item.id);
  actions.appendChild(del);
  card.appendChild(actions);

  viewEl.appendChild(card);
}

function createFieldGrid(fields) {
  const grid = document.createElement('div');
  grid.className = 'form-grid';
  fields.forEach(f => grid.appendChild(f));
  return grid;
}

function field(labelText, type, value, onChange, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.value = value || '';
    input.oninput = () => onChange(input.value);
  } else if (type === 'select') {
    input = document.createElement('select');
    (opts.options || []).forEach(optVal => {
      const opt = document.createElement('option');
      opt.value = optVal;
      opt.textContent = optVal || '— keine —';
      if (optVal === value) opt.selected = true;
      input.appendChild(opt);
    });
    input.onchange = () => onChange(input.value);
  } else if (type === 'checkbox') {
    const boxWrap = document.createElement('label');
    boxWrap.className = 'checkbox-inline';
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!value;
    input.onchange = () => onChange(input.checked);
    boxWrap.appendChild(input);
    boxWrap.appendChild(document.createTextNode('aktiv'));
    wrap.appendChild(boxWrap);
    return wrap;
  } else {
    input = document.createElement('input');
    input.type = type;
    input.value = value || '';
    input.oninput = () => onChange(input.value);
  }
  wrap.appendChild(input);
  return wrap;
}

function multiselectField(labelText, options, selected, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);
  const select = document.createElement('select');
  select.multiple = true;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.name || opt.id;
    if (selected.includes(opt.id)) o.selected = true;
    select.appendChild(o);
  });
  select.onchange = () => {
    const vals = Array.from(select.selectedOptions).map(o => o.value);
    onChange(vals);
  };
  wrap.appendChild(select);
  return wrap;
}

function textListField(labelText, values, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.appendChild(label);
  const input = document.createElement('textarea');
  input.value = (values || []).join('\n');
  input.oninput = () => {
    const list = input.value.split(/\n+/).map(v => v.trim()).filter(Boolean);
    onChange(list);
  };
  wrap.appendChild(input);
  return wrap;
}

function exitTable(room) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.innerHTML = '<label>Ausgänge</label>';
  const table = document.createElement('table');
  table.className = 'table';
  const head = document.createElement('tr');
  head.innerHTML = '<th>Richtung</th><th>Raum-ID</th><th></th>';
  table.appendChild(head);
  const exits = room.exits || {};
  Object.entries(exits).forEach(([dir, target]) => {
    table.appendChild(exitRow(room, dir, target));
  });
  const btn = document.createElement('button');
  btn.textContent = 'Ausgang hinzufügen';
  btn.onclick = () => {
    const key = prompt('Richtung (z.B. nord, ost)?');
    if (!key) return;
    room.exits = room.exits || {};
    room.exits[key] = '';
    setDirty(true);
    renderEditor();
    renderSidebar();
    renderMap();
  };
  wrap.appendChild(table);
  wrap.appendChild(btn);
  return wrap;
}

function exitRow(room, dir, target) {
  const tr = document.createElement('tr');
  const tdDir = document.createElement('td');
  const inputDir = document.createElement('input');
  inputDir.value = dir;
  inputDir.onchange = () => {
    const val = inputDir.value.trim();
    if (!val) return;
    room.exits = room.exits || {};
    delete room.exits[dir];
    room.exits[val] = target;
    setDirty(true);
    renderMap();
  };
  tdDir.appendChild(inputDir);
  const tdTarget = document.createElement('td');
  const inputTarget = document.createElement('input');
  inputTarget.value = target;
  inputTarget.onchange = () => { room.exits[dir] = inputTarget.value.trim(); setDirty(true); renderMap(); };
  tdTarget.appendChild(inputTarget);
  const tdBtn = document.createElement('td');
  const del = document.createElement('button');
  del.className = 'ghost';
  del.textContent = 'x';
  del.onclick = () => {
    delete room.exits[dir];
    setDirty(true);
    renderEditor();
    renderMap();
  };
  tdBtn.appendChild(del);
  tr.append(tdDir, tdTarget, tdBtn);
  return tr;
}

function eventArea(labelText, value, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = `${labelText} (JSON Array)`;
  const area = document.createElement('textarea');
  area.value = JSON.stringify(value || [], null, 2);
  area.onchange = () => safeJsonUpdate(area.value, onChange);
  wrap.append(label, area);
  return wrap;
}

function combineTable(item) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.innerHTML = '<label>Combine Mapping</label>';
  const table = document.createElement('table');
  table.className = 'table';
  const head = document.createElement('tr');
  head.innerHTML = '<th>Ziel-ID</th><th>Event-Liste (JSON)</th><th></th>';
  table.appendChild(head);
  const combine = item.combine || {};
  Object.entries(combine).forEach(([targetId, events]) => {
    const tr = document.createElement('tr');
    const tdTarget = document.createElement('td');
    const inputTarget = document.createElement('input');
    inputTarget.value = targetId;
    inputTarget.onchange = () => {
      const newId = inputTarget.value.trim();
      if (!newId) return;
      delete item.combine[targetId];
      item.combine[newId] = events;
      setDirty(true);
    };
    tdTarget.appendChild(inputTarget);

    const tdEvents = document.createElement('td');
    const textarea = document.createElement('textarea');
    textarea.value = JSON.stringify(events || [], null, 2);
    textarea.onchange = () => safeJsonUpdate(textarea.value, (val) => { item.combine[targetId] = val; setDirty(true); });
    tdEvents.appendChild(textarea);

    const tdBtn = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = 'x';
    del.onclick = () => { delete item.combine[targetId]; setDirty(true); renderEditor(); };
    tdBtn.appendChild(del);

    tr.append(tdTarget, tdEvents, tdBtn);
    table.appendChild(tr);
  });

  const btn = document.createElement('button');
  btn.textContent = 'Mapping hinzufügen';
  btn.onclick = () => {
    const target = prompt('Ziel-Item-ID für Kombination:');
    if (!target) return;
    item.combine = item.combine || {};
    item.combine[target] = [];
    setDirty(true);
    renderEditor();
  };
  wrap.append(table, btn);
  return wrap;
}

function asciiUploadBlock() {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.innerHTML = '<h4>ASCII Upload</h4><p>Neue ASCII-Datei hochladen und dem Raum zuordnen.</p>';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.asc,.ansi,.ans';
  const btn = document.createElement('button');
  btn.textContent = 'Hochladen';
  btn.onclick = async () => {
    const file = input.files && input.files[0];
    if (!file || !state.currentAdventure) return;
    try {
      await Api.uploadAscii(state.currentAdventure.id, file);
      toast('ASCII hochgeladen');
      const res = await Api.loadAdventure(state.currentAdventure.id);
      state.data = res.data || res;
      state.asciiFiles = res.ascii || res.asciiFiles || [];
      renderSidebar();
      renderEditor();
    } catch (e) {
      toast('Upload fehlgeschlagen: ' + e.message, 'error');
    }
  };
  wrap.append(input, btn);
  return wrap;
}

function safeJsonUpdate(text, cb) {
  try {
    const val = JSON.parse(text || '[]');
    cb(val);
    setDirty(true);
  } catch (e) {
    toast('JSON ungültig: ' + e.message, 'error');
  }
}

function updateRoom(room, key, value) {
  room[key] = value;
  setDirty(true);
  if (key === 'exits') renderMap();
}

function updateItem(item, key, value) {
  item[key] = value;
  setDirty(true);
}

function addRoom() {
  const id = prompt('Neue Raum-ID:');
  if (!id) return;
  const newRoom = { id, title: id, description: '', ascii: '', items: [], objects: [], exits: {}, on_enter: [], on_first_enter: [] };
  state.data.rooms = state.data.rooms || [];
  state.data.rooms.push(newRoom);
  state.selection = { view: 'room', roomId: id, itemId: null };
  setDirty(true);
  renderSidebar();
  renderEditor();
  renderMap();
}

function deleteRoom(id) {
  if (!confirm('Raum wirklich löschen?')) return;
  state.data.rooms = (state.data.rooms || []).filter(r => r.id !== id);
  state.selection = { view: 'world', roomId: null, itemId: null };
  setDirty(true);
  renderSidebar();
  renderEditor();
  renderMap();
}

function addItem() {
  const id = prompt('Neue Item-ID:');
  if (!id) return;
  const item = { id, name: id, description: '', pickup: true, combine: {}, on_use: [] };
  state.data.items = state.data.items || [];
  state.data.items.push(item);
  state.selection = { view: 'item', itemId: id, roomId: null };
  setDirty(true);
  renderSidebar();
  renderEditor();
}

function deleteItem(id) {
  if (!confirm('Item löschen?')) return;
  state.data.items = (state.data.items || []).filter(i => i.id !== id);
  setDirty(true);
  state.selection = { view: 'world', roomId: null, itemId: null };
  renderSidebar();
  renderEditor();
}

function updateAsciiPreview(fileName) {
  if (!fileName) {
    asciiPreview.textContent = 'Keine ASCII-Datei zugeordnet.';
    return;
  }
  const path = `js/games/adventure/adventures/${state.currentAdventure.id}/ascii/${fileName}`;
  fetch(path).then(r => r.text()).then(text => asciiPreview.textContent = text).catch(() => asciiPreview.textContent = 'ASCII konnte nicht geladen werden.');
}

function renderMap() {
  mapView.innerHTML = '';
  const rooms = state.data?.rooms || [];
  if (!rooms.length) { mapView.textContent = 'Keine Räume vorhanden.'; return; }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 800 320');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '5');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,0 L6,3 L0,6 z');
  path.setAttribute('fill', 'rgba(255, 134, 255, 0.6)');
  marker.appendChild(path);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const centerX = 400, centerY = 160, radius = 120;
  const positions = {};
  rooms.forEach((room, idx) => {
    const angle = (idx / rooms.length) * Math.PI * 2;
    positions[room.id] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });

  rooms.forEach(room => {
    const exits = room.exits || {};
    Object.values(exits).forEach(targetId => {
      if (!positions[targetId]) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', positions[room.id].x);
      line.setAttribute('y1', positions[room.id].y);
      line.setAttribute('x2', positions[targetId].x);
      line.setAttribute('y2', positions[targetId].y);
      line.setAttribute('class', 'map-link');
      svg.appendChild(line);
    });
  });

  rooms.forEach(room => {
    const pos = positions[room.id];
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', pos.x - 60);
    rect.setAttribute('y', pos.y - 24);
    rect.setAttribute('rx', '8');
    rect.setAttribute('ry', '8');
    rect.setAttribute('width', '120');
    rect.setAttribute('height', '48');
    rect.setAttribute('class', 'map-node');
    svg.appendChild(rect);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y);
    label.setAttribute('class', 'map-text');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.textContent = room.title || room.id;
    svg.appendChild(label);
  });

  mapView.appendChild(svg);
}

async function saveCurrent() {
  if (!state.currentAdventure || !state.data) return;
  try {
    await Api.saveAdventure(state.currentAdventure.id, {
      world: state.data.world,
      game: state.data.game,
      rooms: state.data.rooms,
      items: state.data.items,
    });
    toast('Adventure gespeichert', 'success');
    setDirty(false);
  } catch (e) {
    toast('Speichern fehlgeschlagen: ' + e.message, 'error');
  }
}

init();
