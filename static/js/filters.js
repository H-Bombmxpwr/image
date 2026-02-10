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

function buildDescription(p) {
  const parts = [];
  if (p.grayscale) parts.push('Grayscale');
  if (p.sepia) parts.push('Sepia');
  if (p.invert) parts.push('Invert');
  if (p.sharpen) parts.push('Sharpen');
  if (p.edge) parts.push('Edges');
  if (p.emboss) parts.push('Emboss');
  if (p.contour) parts.push('Contour');
  if (p.smooth) parts.push('Smooth');
  if (p.gaussian) parts.push(`Gaussian(${p.gaussian_radius})`);
  if (p.median) parts.push(`Median(${p.median_size})`);
  if (p.posterize > 0) parts.push(`Posterize(${p.posterize})`);
  if (p.pixelate > 1) parts.push(`Pixelate(${p.pixelate})`);
  if (p.solarize > 0) parts.push(`Solarize(${p.solarize})`);
  return parts.join(', ');
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

// Live preview — re-applies all currently checked filters from the base
// Check = adds filter, uncheck = removes it. No history, no reset.
async function previewFilters() {
  if (!baseSnapshot) baseSnapshot = CURRENT;
  const payload = buildPayload();

  // If nothing is checked, restore the base image
  if (!hasAnyFilter(payload)) {
    setCurrent(baseSnapshot);
    loadDataURLToCanvas(baseSnapshot);
    await refreshInspect();
    return;
  }

  payload.image = baseSnapshot;

  try {
    const j = await postJSON('/api/filters', payload);
    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    await refreshInspect();
  } catch (e) {
    showToast('Filter application failed', 'error');
  }
}

// Commit — pushes history and resets controls
async function commitFilters() {
  if (!baseSnapshot) baseSnapshot = CURRENT;
  const payload = buildPayload();
  if (!hasAnyFilter(payload)) return;

  payload.image = baseSnapshot;

  try {
    const j = await postJSON('/api/filters', payload);
    setCurrent(j.img);
    loadDataURLToCanvas(j.img);
    await refreshInspect();
    pushHistory(`Filters: ${buildDescription(payload)}`);
    resetControls();
  } catch (e) {
    showToast('Filter application failed', 'error');
  }
}

export function wireFilters() {
  // Checkboxes — live preview on check/uncheck
  const checkboxIds = [
    'fGrayscale', 'fSepia', 'fInvert', 'fSharpen', 'fEdge',
    'fEmboss', 'fContour', 'fSmooth', 'fGaussian', 'fMedian'
  ];
  checkboxIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!baseSnapshot && CURRENT) baseSnapshot = CURRENT;
      previewFilters();
    });
  });

  // Number inputs — live preview on change
  ['fGaussR', 'fMedianSize', 'fPoster', 'fPixel', 'fSolarize'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!baseSnapshot && CURRENT) baseSnapshot = CURRENT;
      previewFilters();
    });
  });

  // Apply button — commits to history and resets
  document.getElementById('btnFilters')?.addEventListener('click', () => commitFilters());
}
