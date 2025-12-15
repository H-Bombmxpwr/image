import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, setFileName, CURRENT } from './state.js';

export function wireBasic() {
  // Rotate -90
  document.getElementById('btnRotNeg90')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    try {
      const j = await postJSON('/api/rotate', { image: CURRENT, degrees: -90, expand: true });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Rotate −90°');
    } catch (e) {
      showToast('Rotation failed', 'error');
    }
  });

  // Rotate +90
  document.getElementById('btnRotPos90')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    try {
      const j = await postJSON('/api/rotate', { image: CURRENT, degrees: 90, expand: true });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Rotate +90°');
    } catch (e) {
      showToast('Rotation failed', 'error');
    }
  });

  // Custom rotation
  document.getElementById('btnRotate')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const deg = parseFloat(document.getElementById('rotateDeg')?.value || '0');
    try {
      const j = await postJSON('/api/rotate', { image: CURRENT, degrees: deg, expand: true });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Rotate ${deg}°`);
    } catch (e) {
      showToast('Rotation failed', 'error');
    }
  });

  // Flip horizontal
  document.getElementById('btnFlipH')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    try {
      const j = await postJSON('/api/flip', { image: CURRENT, axis: 'h' });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Flip horizontal');
    } catch (e) {
      showToast('Flip failed', 'error');
    }
  });

  // Flip vertical
  document.getElementById('btnFlipV')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    try {
      const j = await postJSON('/api/flip', { image: CURRENT, axis: 'v' });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Flip vertical');
    } catch (e) {
      showToast('Flip failed', 'error');
    }
  });

  // Resize
  document.getElementById('btnResize')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const w = parseInt(document.getElementById('resizeW')?.value || '0');
    const h = parseInt(document.getElementById('resizeH')?.value || '0');
    const keep = document.getElementById('keepAspect')?.checked ?? true;
    const method = document.getElementById('resampleMethod')?.value || 'lanczos';
    
    if (!w || !h) {
      showToast('Please enter valid dimensions', 'error');
      return;
    }
    
    try {
      const j = await postJSON('/api/resize', { 
        image: CURRENT, 
        width: w, 
        height: h, 
        keep_aspect: keep, 
        method 
      });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Resize to ${w}×${h} (${method})`);
    } catch (e) {
      showToast('Resize failed', 'error');
    }
  });

  // Convert
  document.getElementById('btnConvert')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const to = document.getElementById('convertTo')?.value || 'png';
    const quality = parseInt(document.getElementById('convertQuality')?.value || '92');
    
    try {
      const j = await postJSON('/api/convert', { image: CURRENT, to, quality });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Convert → ${to.toUpperCase()}`);
      showToast(`Converted to ${to.toUpperCase()}`, 'success');
    } catch (e) {
      showToast('Conversion failed', 'error');
    }
  });

  // Rename
  document.getElementById('btnRename')?.addEventListener('click', () => {
    const current = document.getElementById('fileName')?.textContent || 'untitled';
    const newName = prompt('New filename (without extension):', current);
    if (newName && newName.trim()) {
      setFileName(newName.trim());
      pushHistory(`Renamed to "${newName.trim()}"`);
    }
  });
}
