import { postJSON } from './api.js';
import { CURRENT, setCurrent, loadDataURLToCanvas, pushHistory, refreshInspect, showToast } from './state.js';

let ORIGINAL_META = {};

async function loadMeta() {
  if (!CURRENT) return;
  try {
    const j = await postJSON('/api/metadata_read', { image: CURRENT });
    ORIGINAL_META = j.meta || {};
    const editor = document.getElementById('metaEditor');
    if (editor) editor.value = JSON.stringify(ORIGINAL_META, null, 2);
    showToast('Metadata loaded', 'success');
  } catch (e) {
    showToast('Failed to load metadata', 'error');
  }
}

async function writeMeta() {
  if (!CURRENT) return;
  const editor = document.getElementById('metaEditor');
  let updates = {};
  try { updates = JSON.parse(editor?.value || "{}"); } catch (_) {
    showToast('Invalid JSON in metadata editor', 'error');
    return;
  }
  try {
    const j = await postJSON('/api/metadata_write', { image: CURRENT, updates });
    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    pushHistory('Metadata updated');
    await refreshInspect();
    showToast('Metadata written', 'success');
  } catch (e) {
    showToast('Failed to write metadata', 'error');
  }
}

export function wireMetadata() {
  document.addEventListener('imagelab:new-image', loadMeta);
  document.getElementById('metaLoad')?.addEventListener('click', loadMeta);
  document.getElementById('metaWrite')?.addEventListener('click', writeMeta);
}
