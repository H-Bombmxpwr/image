import { ASPECT } from './state.js';

export function wireAspectCoupling() {
  const wEl = document.getElementById('resizeW');
  const hEl = document.getElementById('resizeH');
  const keep = document.getElementById('keepAspect');
  
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
  
  // GIF resize aspect coupling
  const gifW = document.getElementById('gifResizeW');
  const gifH = document.getElementById('gifResizeH');
  const gifKeep = document.getElementById('gifKeepAspect');
  
  if (gifW && gifH && gifKeep) {
    gifW.addEventListener('input', () => {
      if (!gifKeep.checked || !ASPECT || locking) return;
      locking = true;
      const w = Math.max(1, parseInt(gifW.value || '1', 10));
      gifH.value = Math.max(1, Math.round(w / ASPECT));
      locking = false;
    });
    
    gifH.addEventListener('input', () => {
      if (!gifKeep.checked || !ASPECT || locking) return;
      locking = true;
      const h = Math.max(1, parseInt(gifH.value || '1', 10));
      gifW.value = Math.max(1, Math.round(h * ASPECT));
      locking = false;
    });
  }
}
