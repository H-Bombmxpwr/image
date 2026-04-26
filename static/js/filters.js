import { filterBlob } from './client_ops.js';
import { CURRENT, IS_GIF, getCurrentBlob, replaceCurrentBlob, showToast } from './state.js';

let baseBlob = null;
let previewToken = 0;
let previewTimer = null;

function buildPayload() {
  return {
    grayscale: document.getElementById('fGrayscale')?.checked || false,
    sepia: document.getElementById('fSepia')?.checked || false,
    invert: document.getElementById('fInvert')?.checked || false,
    sharpen: document.getElementById('fSharpen')?.checked || false,
    edge: document.getElementById('fEdge')?.checked || false,
    emboss: document.getElementById('fEmboss')?.checked || false,
    contour: document.getElementById('fContour')?.checked || false,
    smooth: document.getElementById('fSmooth')?.checked || false,
    gaussian: document.getElementById('fGaussian')?.checked || false,
    gaussian_radius: parseFloat(document.getElementById('fGaussR')?.value || '1.5'),
    median: document.getElementById('fMedian')?.checked || false,
    median_size: parseInt(document.getElementById('fMedianSize')?.value || '3', 10),
    posterize: parseInt(document.getElementById('fPoster')?.value || '0', 10),
    pixelate: parseInt(document.getElementById('fPixel')?.value || '1', 10),
    solarize: parseInt(document.getElementById('fSolarize')?.value || '0', 10),
  };
}

function hasAnyFilter(payload) {
  return payload.grayscale || payload.sepia || payload.invert || payload.sharpen ||
    payload.edge || payload.emboss || payload.contour || payload.smooth ||
    payload.gaussian || payload.median || payload.posterize > 0 ||
    payload.pixelate > 1 || payload.solarize > 0;
}

function buildDescription(payload) {
  const parts = [];
  if (payload.grayscale) parts.push('Grayscale');
  if (payload.sepia) parts.push('Sepia');
  if (payload.invert) parts.push('Invert');
  if (payload.sharpen) parts.push('Sharpen');
  if (payload.edge) parts.push('Edges');
  if (payload.emboss) parts.push('Emboss');
  if (payload.contour) parts.push('Contour');
  if (payload.smooth) parts.push('Smooth');
  if (payload.gaussian) parts.push(`Gaussian(${payload.gaussian_radius})`);
  if (payload.median) parts.push(`Median(${payload.median_size})`);
  if (payload.posterize > 0) parts.push(`Posterize(${payload.posterize})`);
  if (payload.pixelate > 1) parts.push(`Pixelate(${payload.pixelate})`);
  if (payload.solarize > 0) parts.push(`Solarize(${payload.solarize})`);
  return parts.join(', ');
}

function resetControls() {
  [
    'fGrayscale',
    'fSepia',
    'fInvert',
    'fSharpen',
    'fEdge',
    'fEmboss',
    'fContour',
    'fSmooth',
    'fGaussian',
    'fMedian',
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.checked = false;
  });

  const poster = document.getElementById('fPoster');
  const pixel = document.getElementById('fPixel');
  const solar = document.getElementById('fSolarize');
  const gauss = document.getElementById('fGaussR');
  const median = document.getElementById('fMedianSize');
  if (poster) poster.value = 0;
  if (pixel) pixel.value = 1;
  if (solar) solar.value = 0;
  if (gauss) gauss.value = 1.5;
  if (median) median.value = 3;
  baseBlob = null;
}

async function previewFilters() {
  if (!CURRENT || !getCurrentBlob()) return;
  if (IS_GIF) {
    showToast('Use the GIF panel to preserve animation.', 'info');
    return;
  }
  if (!baseBlob) {
    baseBlob = getCurrentBlob();
  }

  const payload = buildPayload();
  if (!hasAnyFilter(payload)) {
    if (getCurrentBlob() !== baseBlob) {
      await replaceCurrentBlob(baseBlob, { recordHistory: false, resetRedo: false });
    }
    return;
  }

  const token = ++previewToken;
  try {
    const blob = await filterBlob(baseBlob, payload);
    if (token !== previewToken) return;
    await replaceCurrentBlob(blob, { recordHistory: false, resetRedo: false });
  } catch (_) {
    showToast('Filter preview failed', 'error');
  }
}

async function commitFilters() {
  if (!CURRENT || !getCurrentBlob()) return;
  if (IS_GIF) {
    showToast('Use the GIF panel to preserve animation.', 'info');
    return;
  }
  if (!baseBlob) baseBlob = getCurrentBlob();

  const payload = buildPayload();
  if (!hasAnyFilter(payload)) return;

  try {
    const finalBlob = getCurrentBlob() === baseBlob
      ? await filterBlob(baseBlob, payload)
      : getCurrentBlob();
    await replaceCurrentBlob(finalBlob, {
      recordHistory: true,
      label: `Filters: ${buildDescription(payload)}`,
    });
    resetControls();
  } catch (_) {
    showToast('Filter application failed', 'error');
  }
}

export function wireFilters() {
  const checkboxes = [
    'fGrayscale',
    'fSepia',
    'fInvert',
    'fSharpen',
    'fEdge',
    'fEmboss',
    'fContour',
    'fSmooth',
    'fGaussian',
    'fMedian',
  ];
  checkboxes.forEach((id) => {
    const input = document.getElementById(id);
    input?.addEventListener('change', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        previewFilters();
      }, 50);
    });
  });

  ['fGaussR', 'fMedianSize', 'fPoster', 'fPixel', 'fSolarize'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        previewFilters();
      }, 50);
    });
  });

  document.getElementById('btnFilters')?.addEventListener('click', () => {
    commitFilters();
  });

  document.addEventListener('imagelab:new-image', () => {
    clearTimeout(previewTimer);
    resetControls();
  });
}
