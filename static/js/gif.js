import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT, IS_GIF } from './state.js';

export function wireGif() {
  // GIF speed slider display
  const gifSpeed = document.getElementById('gifSpeed');
  const gifSpeedVal = document.getElementById('gifSpeedVal');
  if (gifSpeed && gifSpeedVal) {
    gifSpeed.addEventListener('input', () => {
      const speed = parseInt(gifSpeed.value) / 100;
      gifSpeedVal.textContent = `${speed.toFixed(1)}x`;
    });
  }

  // Resize GIF
  document.getElementById('btnGifResize')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const w = parseInt(document.getElementById('gifResizeW')?.value || '0');
    const h = parseInt(document.getElementById('gifResizeH')?.value || '0');
    const keep = document.getElementById('gifKeepAspect')?.checked ?? true;
    
    if (!w && !h) {
      showToast('Please enter at least one dimension', 'error');
      return;
    }
    
    showToast('Resizing GIF...', 'info');
    try {
      const j = await postJSON('/api/gif/resize', {
        image: CURRENT,
        width: w || 0,
        height: h || 0,
        keep_aspect: keep
      });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`GIF resize to ${w}×${h}`);
      showToast('GIF resized!', 'success');
    } catch (e) {
      showToast('GIF resize failed', 'error');
    }
  });

  // Trim GIF
  document.getElementById('btnGifTrim')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const start = parseInt(document.getElementById('gifTrimStart')?.value || '0');
    const end = parseInt(document.getElementById('gifTrimEnd')?.value || '-1');
    
    showToast('Trimming GIF...', 'info');
    try {
      const j = await postJSON('/api/gif/trim', {
        image: CURRENT,
        start_frame: start,
        end_frame: end
      });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`GIF trim (${start} to ${end})`);
      showToast('GIF trimmed!', 'success');
    } catch (e) {
      showToast('GIF trim failed', 'error');
    }
  });

  // Change GIF speed
  document.getElementById('btnGifSpeed')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const speedFactor = parseInt(document.getElementById('gifSpeed')?.value || '100') / 100;
    
    showToast('Changing GIF speed...', 'info');
    try {
      const j = await postJSON('/api/gif/speed', {
        image: CURRENT,
        speed_factor: speedFactor
      });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`GIF speed ${speedFactor.toFixed(1)}x`);
      showToast('GIF speed changed!', 'success');
    } catch (e) {
      showToast('GIF speed change failed', 'error');
    }
  });

  // Reverse GIF
  document.getElementById('btnGifReverse')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    
    showToast('Reversing GIF...', 'info');
    try {
      const j = await postJSON('/api/gif/reverse', { image: CURRENT });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('GIF reversed');
      showToast('GIF reversed!', 'success');
    } catch (e) {
      showToast('GIF reverse failed', 'error');
    }
  });
}
