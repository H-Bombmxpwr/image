import { postJSON } from './api.js';

// Core state
export let CURRENT = null;
export let ORIGINAL = null;
export let FILE_NAME = 'untitled';
export let HISTORY = [];
export let ASPECT = null;
export let IS_GIF = false;

const STORE_KEY = 'imagelab-session-v2';

// DOM references
const canvas = document.getElementById('canvas');
const ctx = canvas?.getContext('2d');
const dropZone = document.getElementById('dropZone');
const dropHint = document.getElementById('dropHint');

// Toast notifications
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// State persistence
export function saveState() {
  try {
    if (!CURRENT) return;
    const payload = { CURRENT, ORIGINAL, FILE_NAME, HISTORY, IS_GIF };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

export function initStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    
    const s = JSON.parse(raw);
    if (!s || !s.CURRENT) return false;
    
    CURRENT = s.CURRENT;
    ORIGINAL = s.ORIGINAL || s.CURRENT;
    FILE_NAME = s.FILE_NAME || 'untitled';
    IS_GIF = s.IS_GIF || false;
    HISTORY = Array.isArray(s.HISTORY) && s.HISTORY.length
      ? s.HISTORY
      : [{ label: `Opened "${FILE_NAME}"`, snapshot: CURRENT }];
    
    if (dropHint) dropHint.style.display = 'none';
    setFileName(FILE_NAME);
    loadDataURLToCanvas(CURRENT);
    renderHistory();
    return true;
  } catch (e) {
    console.warn('Failed to restore state:', e);
    return false;
  }
}

export function saveOnUnload() {
  window.addEventListener('beforeunload', saveState);
}

// File name handling
export function setFileName(name) {
  FILE_NAME = (name || 'untitled').replace(/[\\/:*?"<>|]/g, '_');
  const el = document.getElementById('fileName');
  if (el) el.textContent = FILE_NAME;
}

export function getFileName() {
  return FILE_NAME;
}

// Canvas operations
export function setCanvasFromImage(img) {
  if (!canvas || !ctx || !dropZone) return;
  
  const maxW = dropZone.clientWidth - 20;
  const maxH = Math.min(window.innerHeight * 0.7, dropZone.clientHeight - 20);
  
  let w = img.width;
  let h = img.height;
  const ratio = Math.min(maxW / w, maxH / h, 1);
  
  w = Math.max(1, Math.floor(w * ratio));
  h = Math.max(1, Math.floor(h * ratio));
  
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
}

export function dataURLFromCanvas() {
  return canvas?.toDataURL('image/png') || '';
}

export function loadDataURLToCanvas(dataURL) {
  const img = new Image();
  img.onload = () => setCanvasFromImage(img);
  img.onerror = () => console.error('Failed to load image');
  img.src = dataURL;
}

// Setters
export function setCurrent(dataURL) {
  CURRENT = dataURL;
}

export function setOriginal(dataURL) {
  ORIGINAL = dataURL;
}

export function setIsGif(value) {
  IS_GIF = value;
}

// History management
export function pushHistory(label) {
  if (!CURRENT) return;
  HISTORY.push({ label, snapshot: CURRENT });
  renderHistory();
  saveState();
}

export function clearHistory() {
  HISTORY = [];
  renderHistory();
}

export function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  
  list.innerHTML = '';
  
  // Render newest first
  for (let i = HISTORY.length - 1; i >= 0; i--) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="history-label">${HISTORY[i].label}</span>
      <button class="btn btn-sm" data-idx="${i}">Restore</button>
    `;
    
    item.querySelector('button').addEventListener('click', async (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      const snap = HISTORY[idx].snapshot;
      
      setCurrent(snap);
      loadDataURLToCanvas(snap);
      
      // Keep history up to this point
      HISTORY = HISTORY.slice(0, idx + 1);
      
      renderHistory();
      await refreshInspect();
      saveState();
      showToast('Restored to: ' + HISTORY[idx].label);
    });
    
    list.appendChild(item);
  }
}

// Info panel update
export function updateInfo(meta, exif) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  
  set('infoFormat', meta.format || '—');
  set('infoMode', meta.mode || '—');
  set('infoDim', `${meta.width} × ${meta.height}`);
  set('infoSize', meta.file_size_str || '—');
  
  // Calculate average color display
  if (meta.mean_rgb) {
    const [r, g, b] = meta.mean_rgb;
    const avgEl = document.getElementById('infoAvg');
    if (avgEl) {
      avgEl.innerHTML = `<span style="display:inline-block;width:12px;height:12px;background:rgb(${r},${g},${b});border-radius:2px;vertical-align:middle;margin-right:4px"></span>rgb(${r}, ${g}, ${b})`;
    }
  }
  
  // Aspect ratio
  const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
  const g = gcd(meta.width, meta.height);
  const aspectText = `${meta.width / g}:${meta.height / g}`;
  set('infoAspect', aspectText);
  
  ASPECT = meta.width / meta.height;
  
  // Update resize inputs
  const wEl = document.getElementById('resizeW');
  const hEl = document.getElementById('resizeH');
  if (wEl && hEl) {
    wEl.value = meta.width;
    hEl.value = meta.height;
  }
  
  // Update GIF resize inputs
  const gifWEl = document.getElementById('gifResizeW');
  const gifHEl = document.getElementById('gifResizeH');
  if (gifWEl && gifHEl) {
    gifWEl.value = meta.width;
    gifHEl.value = meta.height;
  }
  
  // Update seam slider
  const seam = document.getElementById('seamSlider');
  const seamW = document.getElementById('seamW');
  if (seam && seamW) {
    seam.min = Math.max(10, Math.floor(meta.width * 0.25));
    seam.max = Math.floor(meta.width * 1.5);
    seam.value = meta.width;
    seamW.textContent = `${meta.width} px`;
  }
  
  // Update GIF info
  if (meta.is_animated || meta.frame_count > 1) {
    IS_GIF = true;
    const gifInfo = document.getElementById('gifInfo');
    if (gifInfo) {
      gifInfo.textContent = `Animated: ${meta.frame_count} frames`;
    }
  }
  
  // Update EXIF display
  updateExif(exif);
}

function updateExif(exif) {
  const content = document.getElementById('exifContent');
  if (!content) return;
  
  if (!exif || Object.keys(exif).length === 0) {
    content.innerHTML = '<div class="metadata-empty">No metadata available</div>';
    return;
  }
  
  let html = '<table class="metadata-table">';
  for (const [key, value] of Object.entries(exif)) {
    if (key === 'error') continue;
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    html += `<tr><td>${key}</td><td>${displayValue}</td></tr>`;
  }
  html += '</table>';
  content.innerHTML = html;
}

export async function refreshInspect() {
  if (!CURRENT) return;
  
  try {
    const j = await postJSON('/api/inspect', { image: CURRENT });
    updateInfo(j.meta, j.exif);
  } catch (e) {
    console.error('Failed to inspect image:', e);
  }
}

// Boot with checkerboard pattern
export function bootPreview() {
  const p = document.createElement('canvas');
  p.width = p.height = 32;
  const g = p.getContext('2d');
  g.fillStyle = '#1a1f28';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#12151c';
  g.fillRect(0, 0, 16, 16);
  g.fillRect(16, 16, 16, 16);
  
  const dataURL = p.toDataURL('image/png');
  setCurrent(dataURL);
  loadDataURLToCanvas(CURRENT);
  refreshInspect();
  setFileName('untitled');
  clearHistory();
  IS_GIF = false;
  
  if (dropHint) dropHint.style.display = '';
}
