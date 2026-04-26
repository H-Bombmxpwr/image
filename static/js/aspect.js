import { ASPECT } from './state.js';

function bindAspectPair(wId, hId, keepId) {
  const wEl = document.getElementById(wId);
  const hEl = document.getElementById(hId);
  const keep = document.getElementById(keepId);
  if (!wEl || !hEl || !keep) return;

  let locking = false;

  wEl.addEventListener('input', () => {
    if (!keep.checked || !ASPECT || locking) return;
    locking = true;
    const w = Math.max(1, parseInt(wEl.value || '1', 10));
    hEl.value = Math.max(1, Math.round(w / ASPECT));
    locking = false;
  });

  hEl.addEventListener('input', () => {
    if (!keep.checked || !ASPECT || locking) return;
    locking = true;
    const h = Math.max(1, parseInt(hEl.value || '1', 10));
    wEl.value = Math.max(1, Math.round(h * ASPECT));
    locking = false;
  });
}

export function wireAspectCoupling() {
  bindAspectPair('resizeW', 'resizeH', 'keepAspect');
  bindAspectPair('gifResizeW', 'gifResizeH', 'gifKeepAspect');
}
