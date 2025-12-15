import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT } from './state.js';

export function wireAdjust() {
  // Wire up slider value displays
  const sliders = [
    { id: 'adjBright', valId: 'adjBrightVal', format: v => `${v}%` },
    { id: 'adjContrast', valId: 'adjContrastVal', format: v => `${v}%` },
    { id: 'adjSaturation', valId: 'adjSaturationVal', format: v => `${v}%` },
    { id: 'adjGamma', valId: 'adjGammaVal', format: v => (v / 100).toFixed(2) },
    { id: 'adjTemp', valId: 'adjTempVal', format: v => v > 0 ? `+${v}` : v },
  ];
  
  sliders.forEach(({ id, valId, format }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(valId);
    if (slider && display) {
      slider.addEventListener('input', () => {
        display.textContent = format(parseInt(slider.value));
      });
    }
  });

  // Apply adjustments
  document.getElementById('btnAdjust')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    
    const b = parseInt(document.getElementById('adjBright')?.value || '100') / 100;
    const c = parseInt(document.getElementById('adjContrast')?.value || '100') / 100;
    const s = parseInt(document.getElementById('adjSaturation')?.value || '100') / 100;
    const g = parseInt(document.getElementById('adjGamma')?.value || '100') / 100;
    const temp = parseInt(document.getElementById('adjTemp')?.value || '0');
    
    try {
      const j = await postJSON('/api/adjust', {
        image: CURRENT,
        brightness: b,
        contrast: c,
        saturation: s,
        gamma: g,
        temperature: temp
      });
      
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      
      // Build description
      const parts = [];
      if (Math.abs(b - 1) > 0.01) parts.push(`B:${Math.round(b * 100)}%`);
      if (Math.abs(c - 1) > 0.01) parts.push(`C:${Math.round(c * 100)}%`);
      if (Math.abs(s - 1) > 0.01) parts.push(`S:${Math.round(s * 100)}%`);
      if (Math.abs(g - 1) > 0.01) parts.push(`γ:${g.toFixed(2)}`);
      if (Math.abs(temp) > 0) parts.push(`T:${temp > 0 ? '+' : ''}${temp}`);
      
      pushHistory(`Adjust: ${parts.join(', ') || 'no changes'}`);
      
      // Reset sliders
      document.getElementById('adjBright').value = 100;
      document.getElementById('adjBrightVal').textContent = '100%';
      document.getElementById('adjContrast').value = 100;
      document.getElementById('adjContrastVal').textContent = '100%';
      document.getElementById('adjSaturation').value = 100;
      document.getElementById('adjSaturationVal').textContent = '100%';
      document.getElementById('adjGamma').value = 100;
      document.getElementById('adjGammaVal').textContent = '1.00';
      document.getElementById('adjTemp').value = 0;
      document.getElementById('adjTempVal').textContent = '0';
      
    } catch (e) {
      showToast('Adjustment failed', 'error');
    }
  });

  // Auto enhance
  document.getElementById('btnAutoEnhance')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    
    try {
      const j = await postJSON('/api/auto_enhance', { image: CURRENT });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Auto enhance');
      showToast('Auto enhance applied', 'success');
    } catch (e) {
      showToast('Auto enhance failed', 'error');
    }
  });
}
