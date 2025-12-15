import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT } from './state.js';

export function wireAdvanced() {
  // Histogram equalization
  document.getElementById('btnHistEq')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    try {
      const j = await postJSON('/api/histeq', { image: CURRENT });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Histogram equalization');
    } catch (e) {
      showToast('Histogram equalization failed', 'error');
    }
  });

  // Background tolerance slider display
  const bgTol = document.getElementById('bgTol');
  const bgTolVal = document.getElementById('bgTolVal');
  if (bgTol && bgTolVal) {
    bgTol.addEventListener('input', () => {
      bgTolVal.textContent = bgTol.value;
    });
  }

  // Simple background removal
  document.getElementById('btnBgRemove')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const tol = parseInt(document.getElementById('bgTol')?.value || '18');
    try {
      const j = await postJSON('/api/background_remove', { image: CURRENT, tolerance: tol });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Background remove (tol: ${tol})`);
    } catch (e) {
      showToast('Background removal failed', 'error');
    }
  });

  // AI background removal
  document.getElementById('btnBgRemoveAI')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    showToast('Processing with AI...', 'info');
    try {
      const j = await postJSON('/api/background_remove_ai', { image: CURRENT });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('AI background removal');
      showToast('Background removed!', 'success');
    } catch (e) {
      showToast('AI background removal failed', 'error');
    }
  });

  // Vignette
  const vigSlider = document.getElementById('vignetteStrength');
  const vigVal = document.getElementById('vignetteVal');
  if (vigSlider && vigVal) {
    vigSlider.addEventListener('input', () => {
      vigVal.textContent = `${vigSlider.value}%`;
    });
  }

  document.getElementById('btnVignette')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const strength = parseInt(document.getElementById('vignetteStrength')?.value || '50') / 100;
    try {
      const j = await postJSON('/api/vignette', { image: CURRENT, strength });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Vignette (${Math.round(strength * 100)}%)`);
    } catch (e) {
      showToast('Vignette failed', 'error');
    }
  });

  // Border
  document.getElementById('btnBorder')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const size = parseInt(document.getElementById('borderSize')?.value || '10');
    const color = document.getElementById('borderColor')?.value || '#000000';
    try {
      const j = await postJSON('/api/border', { image: CURRENT, size, color });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Border (${size}px, ${color})`);
    } catch (e) {
      showToast('Border failed', 'error');
    }
  });

  // Watermark
  const wmOpacity = document.getElementById('watermarkOpacity');
  const wmOpacityVal = document.getElementById('watermarkOpacityVal');
  if (wmOpacity && wmOpacityVal) {
    wmOpacity.addEventListener('input', () => {
      wmOpacityVal.textContent = `${wmOpacity.value}%`;
    });
  }

  document.getElementById('btnWatermark')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    const text = document.getElementById('watermarkText')?.value || '';
    if (!text.trim()) {
      showToast('Please enter watermark text', 'error');
      return;
    }
    const position = document.getElementById('watermarkPos')?.value || 'bottom-right';
    const opacity = parseInt(document.getElementById('watermarkOpacity')?.value || '50') / 100;
    const color = document.getElementById('watermarkColor')?.value || '#ffffff';
    
    try {
      const j = await postJSON('/api/watermark', { 
        image: CURRENT, 
        text: text.trim(), 
        position, 
        opacity, 
        color 
      });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory(`Watermark: "${text.trim()}"`);
    } catch (e) {
      showToast('Watermark failed', 'error');
    }
  });

  // Seam carving
  const seamSlider = document.getElementById('seamSlider');
  const seamLbl = document.getElementById('seamW');
  const seamBusy = document.getElementById('seamBusy');
  let seamTimer = null;
  let seamReqId = 0;
  let seamLastCommitted = null;

  if (seamSlider && seamLbl) {
    const setBusy = (on) => {
      if (seamBusy) seamBusy.classList.toggle('hidden', !on);
      if (seamSlider) seamSlider.disabled = !!on;
    };

    const runSeam = async () => {
      if (!CURRENT) return;
      const target = parseInt(seamSlider.value, 10);
      seamLbl.textContent = `${target} px`;
      const myId = ++seamReqId;
      setBusy(true);
      
      try {
        const j = await postJSON('/api/seam_carve', {
          image: CURRENT,
          target_width: target,
          order: 'width-first',
          energy_mode: 'backward'
        });
        if (myId !== seamReqId) return;
        setCurrent(j.img);
        loadDataURLToCanvas(j.img);
        await refreshInspect();
      } catch (e) {
        console.warn('Seam carve failed', e);
      } finally {
        if (myId === seamReqId) setBusy(false);
      }
    };

    const debounced = () => {
      clearTimeout(seamTimer);
      seamTimer = setTimeout(runSeam, 300);
    };
    
    seamSlider.addEventListener('input', debounced);

    const commit = () => {
      const target = parseInt(seamSlider.value, 10);
      if (seamLastCommitted !== target && CURRENT) {
        pushHistory(`Seam carve → ${target}px`);
        seamLastCommitted = target;
      }
    };
    
    seamSlider.addEventListener('change', commit);
    seamSlider.addEventListener('mouseup', commit);
    seamSlider.addEventListener('touchend', commit);
  }
}
