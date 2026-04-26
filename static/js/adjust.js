import { adjustBlob, autoEnhanceBlob } from './client_ops.js';
import { CURRENT, getCurrentBlob, replaceCurrentBlob, showToast } from './state.js';

let baseBlob = null;
let previewToken = 0;
let previewTimer = null;

function getSliderValues() {
  return {
    brightness: parseInt(document.getElementById('adjBright')?.value || '100', 10) / 100,
    contrast: parseInt(document.getElementById('adjContrast')?.value || '100', 10) / 100,
    saturation: parseInt(document.getElementById('adjSaturation')?.value || '100', 10) / 100,
    gamma: parseInt(document.getElementById('adjGamma')?.value || '100', 10) / 100,
    hue: parseInt(document.getElementById('adjHue')?.value || '0', 10),
    temperature: parseInt(document.getElementById('adjTemp')?.value || '0', 10),
  };
}

function isDefault(values) {
  return Math.abs(values.brightness - 1) < 0.01 &&
    Math.abs(values.contrast - 1) < 0.01 &&
    Math.abs(values.saturation - 1) < 0.01 &&
    Math.abs(values.gamma - 1) < 0.01 &&
    Math.abs(values.hue) < 1 &&
    Math.abs(values.temperature) < 1;
}

function buildDescription(values) {
  const parts = [];
  if (Math.abs(values.brightness - 1) > 0.01) parts.push(`B ${Math.round(values.brightness * 100)}%`);
  if (Math.abs(values.contrast - 1) > 0.01) parts.push(`C ${Math.round(values.contrast * 100)}%`);
  if (Math.abs(values.saturation - 1) > 0.01) parts.push(`S ${Math.round(values.saturation * 100)}%`);
  if (Math.abs(values.gamma - 1) > 0.01) parts.push(`G ${values.gamma.toFixed(2)}`);
  if (Math.abs(values.hue) > 0) parts.push(`Hue ${values.hue}`);
  if (Math.abs(values.temperature) > 0) parts.push(`Temp ${values.temperature > 0 ? '+' : ''}${values.temperature}`);
  return parts.join(', ');
}

function resetSliders() {
  const defaults = [
    ['adjBright', 100, 'adjBrightVal', '100%'],
    ['adjContrast', 100, 'adjContrastVal', '100%'],
    ['adjSaturation', 100, 'adjSaturationVal', '100%'],
    ['adjGamma', 100, 'adjGammaVal', '1.00'],
    ['adjHue', 0, 'adjHueVal', '0deg'],
    ['adjTemp', 0, 'adjTempVal', '0'],
  ];
  defaults.forEach(([inputId, value, valueId, text]) => {
    const input = document.getElementById(inputId);
    const label = document.getElementById(valueId);
    if (input) input.value = value;
    if (label) label.textContent = text;
  });
  baseBlob = null;
}

async function previewAdjustments() {
  if (!CURRENT || !getCurrentBlob()) return;
  if (!baseBlob) {
    baseBlob = getCurrentBlob();
  }

  const values = getSliderValues();
  if (isDefault(values)) {
    if (getCurrentBlob() !== baseBlob) {
      await replaceCurrentBlob(baseBlob, { recordHistory: false, resetRedo: false });
    }
    return;
  }

  const token = ++previewToken;
  try {
    const blob = await adjustBlob(baseBlob, values);
    if (token !== previewToken) return;
    await replaceCurrentBlob(blob, { recordHistory: false, resetRedo: false });
  } catch (_) {
    showToast('Adjustment preview failed', 'error');
  }
}

async function commitAdjustments() {
  if (!CURRENT || !getCurrentBlob()) return;
  if (!baseBlob) baseBlob = getCurrentBlob();

  const values = getSliderValues();
  if (isDefault(values)) {
    resetSliders();
    return;
  }

  try {
    const finalBlob = getCurrentBlob() === baseBlob
      ? await adjustBlob(baseBlob, values)
      : getCurrentBlob();
    await replaceCurrentBlob(finalBlob, {
      recordHistory: true,
      label: `Adjust: ${buildDescription(values)}`,
      resetRedo: true,
    });
    resetSliders();
  } catch (_) {
    showToast('Adjustment failed', 'error');
  }
}

async function commitPreviewIfNeeded() {
  clearTimeout(previewTimer);
  const values = getSliderValues();
  if (!baseBlob && !isDefault(values) && getCurrentBlob()) {
    baseBlob = getCurrentBlob();
  }
  if (!baseBlob) return;
  if (isDefault(values)) {
    if (getCurrentBlob() !== baseBlob) {
      await replaceCurrentBlob(baseBlob, { recordHistory: false, resetRedo: false });
    }
    resetSliders();
    return;
  }
  await commitAdjustments();
}

export function wireAdjust() {
  const sliders = [
    ['adjBright', 'adjBrightVal', (value) => `${value}%`],
    ['adjContrast', 'adjContrastVal', (value) => `${value}%`],
    ['adjSaturation', 'adjSaturationVal', (value) => `${value}%`],
    ['adjGamma', 'adjGammaVal', (value) => (value / 100).toFixed(2)],
    ['adjHue', 'adjHueVal', (value) => `${value}deg`],
    ['adjTemp', 'adjTempVal', (value) => (value > 0 ? `+${value}` : `${value}`)],
  ];

  sliders.forEach(([inputId, valueId, formatter]) => {
    const input = document.getElementById(inputId);
    const label = document.getElementById(valueId);
    if (!input || !label) return;

    input.addEventListener('input', () => {
      if (!baseBlob && CURRENT && getCurrentBlob()) {
        baseBlob = getCurrentBlob();
      }
      label.textContent = formatter(parseInt(input.value, 10));
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        previewAdjustments();
      }, 70);
    });
  });

  document.getElementById('btnAdjust')?.addEventListener('click', () => {
    commitAdjustments();
  });

  document.getElementById('btnAutoEnhance')?.addEventListener('click', async () => {
    if (!CURRENT || !getCurrentBlob()) return;
    try {
      const blob = await autoEnhanceBlob(getCurrentBlob());
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: 'Auto enhance',
      });
      resetSliders();
      showToast('Auto enhance applied', 'success');
    } catch (_) {
      showToast('Auto enhance failed', 'error');
    }
  });

  document.addEventListener('imagelab:new-image', () => {
    clearTimeout(previewTimer);
    resetSliders();
  });

  document.addEventListener('imagelab:state-changed', () => {
    clearTimeout(previewTimer);
    resetSliders();
  });

  document.addEventListener('imagelab:before-panel-change', () => {
    commitPreviewIfNeeded();
  });
}
