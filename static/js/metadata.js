// static/js/metadata.js
import { postJSON } from './api.js';
import { pushHistory, refreshInspect } from './state.js';

let ORIGINAL_META = {};

async function loadMeta() {
  if (!window.CURRENT) return;
  const j = await postJSON('/api/metadata_read', { image: window.CURRENT });
  ORIGINAL_META = j.meta || {};
  const orig = document.getElementById('metaOriginal');
  const curr = document.getElementById('metaCurrent');
  const editor = document.getElementById('metaEditor');
  if (orig)  orig.textContent  = JSON.stringify(ORIGINAL_META, null, 2);
  if (curr)  curr.textContent  = JSON.stringify(ORIGINAL_META, null, 2);
  if (editor) editor.value     = JSON.stringify(ORIGINAL_META, null, 2);
}

async function writeMeta() {
  if (!window.CURRENT) return;
  const editor = document.getElementById('metaEditor');
  let updates = {};
  try { updates = JSON.parse(editor.value || "{}"); } catch (_) { updates = {}; }
  const j = await postJSON('/api/metadata_write', { image: window.CURRENT, updates });
  window.CURRENT = j.img;
  // Show updated "current" (original stays as the first-read snapshot)
  const curr = document.getElementById('metaCurrent');
  if (curr) curr.textContent = JSON.stringify(j.meta || {}, null, 2);
  pushHistory('Metadata updated');
  await refreshInspect(); // keep info panel in sync
}

export function wireMetadata(){
  // load when a new image opens
  document.addEventListener('imagelab:new-image', loadMeta);

  // "Load from image" (optional button) — re-read current EXIF
  document.getElementById('metaLoad')?.addEventListener('click', loadMeta);

  // "Write" button
  document.getElementById('metaWrite')?.addEventListener('click', writeMeta);
}
