import { getMetadata, pushHistory, setMetadata, showToast } from './state.js';

function loadMeta(showFeedback = true) {
  const editor = document.getElementById('metaEditor');
  if (!editor) return;
  editor.value = JSON.stringify(getMetadata(), null, 2);
  if (showFeedback) {
    showToast('Metadata loaded into the editor', 'success');
  }
}

function writeMeta() {
  const editor = document.getElementById('metaEditor');
  if (!editor) return;

  let updates = {};
  try {
    updates = JSON.parse(editor.value || '{}');
  } catch (_) {
    showToast('Metadata must be valid JSON.', 'error');
    return;
  }

  setMetadata(updates);
  pushHistory('Metadata updated', { force: true });
  showToast('Metadata saved. Download to embed it into the file.', 'success');
}

export function wireMetadata() {
  document.getElementById('metaLoad')?.addEventListener('click', () => loadMeta(true));
  document.getElementById('metaWrite')?.addEventListener('click', writeMeta);
}
