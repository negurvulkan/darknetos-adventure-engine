// Adventure loader utilities
// Responsible for loading JSON assets and ASCII art for the adventure module.

const DATA_ROOT = './js/games/adventure/data';

/**
 * Load a JSON file relative to the adventure data root.
 * @param {string} path Relative path inside the data directory.
 */
export async function loadJson(path) {
  const url = `${DATA_ROOT}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Konnte Datei nicht laden: ${url}`);
  }
  return res.json();
}

/**
 * Load and render ASCII art in the output terminal.
 * Uses a <pre> element to preserve monospace layout and allows font scaling.
 * @param {{file: string, fontSize?: number}} param0 
 */
export async function loadAscii({ file, fontSize }) {
  const url = `${DATA_ROOT}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ASCII konnte nicht geladen werden: ${url}`);
  }
  const text = await res.text();
  const size = fontSize || 6;

  if (typeof document !== 'undefined' && typeof outputEl !== 'undefined') {
    const pre = document.createElement('pre');
    pre.textContent = text;
    pre.style.fontFamily = 'monospace';
    pre.style.fontSize = `${size}px`;
    pre.style.lineHeight = '1.1';
    pre.classList.add('adventure-ascii');
    outputEl.appendChild(pre);
    outputEl.scrollTop = outputEl.scrollHeight;
  } else if (typeof printLines === 'function') {
    printLines(text.split('\n'));
  }

  return text;
}
