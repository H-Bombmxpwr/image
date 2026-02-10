import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT } from './state.js';

let baseSnapshot = null;

function getSliderValues() {
  return {
    b: parseInt(document.getElementById('adjBright')?.value || '100') / 100,
    c: parseInt(document.getElementById('adjContrast')?.value || '100') / 100,
    s: parseInt(document.getElementById('adjSaturation')?.value || '100') / 100,
    g: parseInt(document.getElementById('adjGamma')?.value || '100') / 100,
    temp: parseInt(document.getElementById('adjTemp')?.value || '0'),
  };
}

function isDefault(v) {
  return Math.abs(v.b - 1) < 0.01 && Math.abs(v.c - 1) < 0.01 &&
         Math.abs(v.s - 1) < 0.01 && Math.abs(v.g - 1) < 0.01 &&
         Math.abs(v.temp) < 1;
}

function resetSliders() {
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
  baseSnapshot = null;
}

function buildDescription() {
  const v = getSliderValues();
  const parts = [];
  if (Math.abs(v.b - 1) > 0.01) parts.push(`B:${Math.round(v.b * 100)}%`);
  if (Math.abs(v.c - 1) > 0.01) parts.push(`C:${Math.round(v.c * 100)}%`);
  if (Math.abs(v.s - 1) > 0.01) parts.push(`S:${Math.round(v.s * 100)}%`);
  if (Math.abs(v.g - 1) > 0.01) parts.push(`\u03B3:${v.g.toFixed(2)}`);
  if (Math.abs(v.temp) > 0) parts.push(`T:${v.temp > 0 ? '+' : ''}${v.temp}`);
  return parts.join(', ');
}

// Live preview — re-applies all slider values from the base snapshot
// Does NOT commit to history or reset sliders
async function previewAdjust() {
  if (!baseSnapshot) baseSnapshot = CURRENT;
  const v = getSliderValues();

  // If everything is back to default, restore the base
  if (isDefault(v)) {
    setCurrent(baseSnapshot);
    loadDataURLToCanvas(baseSnapshot);
    await refreshInspect();
    return;
  }

  try {
    const j = await postJSON('/api/adjust', {
      image: baseSnapshot,
      brightness: v.b,
      contrast: v.c,
      saturation: v.s,
      gamma: v.g,
      temperature: v.temp
    });

    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    await refreshInspect();
  } catch (e) {
    showToast('Adjustment failed', 'error');
  }
}

// Commit — pushes history, resets base and sliders
async function commitAdjust() {
  if (!baseSnapshot) baseSnapshot = CURRENT;
  const v = getSliderValues();
  if (isDefault(v)) return;

  try {
    const j = await postJSON('/api/adjust', {
      image: baseSnapshot,
      brightness: v.b,
      contrast: v.c,
      saturation: v.s,
      gamma: v.g,
      temperature: v.temp
    });

    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    await refreshInspect();
    pushHistory(`Adjust: ${buildDescription()}`);
    resetSliders();
  } catch (e) {
    showToast('Adjustment failed', 'error');
  }
}

export function wireAdjust() {
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
    if (!slider || !display) return;

    // Live value display while dragging
    slider.addEventListener('input', () => {
      display.textContent = format(parseInt(slider.value));
      if (!baseSnapshot && CURRENT) baseSnapshot = CURRENT;
    });

    // Preview on release — sliders stay where they are
    slider.addEventListener('change', () => previewAdjust());
  });

  // Apply button — commits to history and resets sliders
  document.getElementById('btnAdjust')?.addEventListener('click', () => commitAdjust());

  // Auto enhance
  document.getElementById('btnAutoEnhance')?.addEventListener('click', async () => {
    if (!CURRENT) return;

    try {
      const j = await postJSON('/api/auto_enhance', { image: CURRENT });
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      pushHistory('Auto enhance');
      resetSliders(); // clear any in-progress adjustment
      showToast('Auto enhance applied', 'success');
    } catch (e) {
      showToast('Auto enhance failed', 'error');
    }
  });
}
