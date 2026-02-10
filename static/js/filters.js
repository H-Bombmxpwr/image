import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT } from './state.js';

let baseSnapshot = null;

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
    median_size: parseInt(document.getElementById('fMedianSize')?.value || '3'),
    posterize: parseInt(document.getElementById('fPoster')?.value || '0'),
    pixelate: parseInt(document.getElementById('fPixel')?.value || '1'),
    solarize: parseInt(document.getElementById('fSolarize')?.value || '0'),
  };
}

function hasAnyFilter(p) {
  return p.grayscale || p.sepia || p.invert || p.sharpen || p.edge ||
         p.emboss || p.contour || p.smooth || p.gaussian || p.median ||
         p.posterize > 0 || p.pixelate > 1 || p.solarize > 0;
}

function resetControls() {
  ['fGrayscale', 'fSepia', 'fInvert', 'fSharpen', 'fEdge', 'fEmboss',
   'fContour', 'fSmooth', 'fGaussian', 'fMedian'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  const fPoster = document.getElementById('fPoster');
  const fPixel = document.getElementById('fPixel');
  const fSolarize = document.getElementById('fSolarize');
  if (fPoster) fPoster.value = 0;
  if (fPixel) fPixel.value = 1;
  if (fSolarize) fSolarize.value = 0;
  baseSnapshot = null;
}

async function applyFilters() {
  if (!baseSnapshot) baseSnapshot = CURRENT;
  const payload = buildPayload();
  if (!hasAnyFilter(payload)) return;

  payload.image = baseSnapshot;

  try {
    const j = await postJSON('/api/filters', payload);
    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    await refreshInspect();

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

    pushHistory(`Filters: ${parts.join(', ')}`);
    resetControls();
  } catch (e) {
    showToast('Filter application failed', 'error');
  }
}

export function wireFilters() {
  // Checkboxes — auto-apply on change
  const checkboxIds = [
    'fGrayscale', 'fSepia', 'fInvert', 'fSharpen', 'fEdge',
    'fEmboss', 'fContour', 'fSmooth', 'fGaussian', 'fMedian'
  ];
  checkboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!baseSnapshot && CURRENT) baseSnapshot = CURRENT;
      applyFilters();
    });
  });

  // Number inputs — auto-apply on change
  ['fGaussR', 'fMedianSize', 'fPoster', 'fPixel', 'fSolarize'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!baseSnapshot && CURRENT) baseSnapshot = CURRENT;
      applyFilters();
    });
  });

  // Keep button as fallback
  document.getElementById('btnFilters')?.addEventListener('click', () => applyFilters());
}
