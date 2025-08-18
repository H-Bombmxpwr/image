import { postJSON } from './api.js';

/* ===== Core state (matches your app.js) ===== */
export let CURRENT = null;      // dataURL
export let ORIGINAL = null;     // first loaded image
export let FILE_NAME = 'untitled';
export let HISTORY = [];        // [{ label, snapshot }]
export let ASPECT = null;

const STORE_KEY = 'imagelab-session-v1';

/* Canvas / UI refs */
const cv   = document.getElementById('canvas');
const ctx  = cv.getContext('2d');
const drop = document.getElementById('dropZone');
const hint = document.getElementById('dropHint');

/* ---------- Persistence ---------- */
export function saveState(){
  try {
    if (!CURRENT) return;
    const payload = { CURRENT, ORIGINAL, FILE_NAME, HISTORY };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch {}
}

export function initStateFromStorage(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.CURRENT) return false;

    CURRENT   = s.CURRENT;
    ORIGINAL  = s.ORIGINAL || s.CURRENT;
    FILE_NAME = s.FILE_NAME || 'untitled';
    HISTORY   = Array.isArray(s.HISTORY) && s.HISTORY.length
      ? s.HISTORY
      : [{ label: `Opened "${FILE_NAME}"`, snapshot: CURRENT }];

    if (hint) hint.style.display = 'none';
    setFileName(FILE_NAME);
    loadDataURLToCanvas(CURRENT);
    renderHistory();
    return true;
  }catch{ return false; }
}

export function saveOnUnload(){
  window.addEventListener('beforeunload', saveState);
}

/* ---------- Utilities ---------- */
export function setFileName(name){
  FILE_NAME = (name || 'untitled').replace(/[\\/:*?"<>|]/g, '_');
  const el = document.getElementById('fileName');
  if (el) el.textContent = FILE_NAME;
}

export function setCanvasFromImage(img){
  const maxW = drop.clientWidth - 20;
  const maxH = Math.min(window.innerHeight * 0.75, drop.clientHeight - 20);
  let w = img.width, h = img.height;
  const r = Math.min(maxW / w, maxH / h, 1);
  w = Math.max(1, Math.floor(w * r));
  h = Math.max(1, Math.floor(h * r));
  cv.width = w; cv.height = h;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(img, 0, 0, w, h);
}
export function dataURLFromCanvas(){ return cv.toDataURL("image/png"); }
export function loadDataURLToCanvas(dataURL){
  const img = new Image();
  img.onload = () => setCanvasFromImage(img);
  img.src = dataURL;
}

/* ---------- History (only visual change: newest-first list) ---------- */
export function pushHistory(label){
  if(!CURRENT) return;
  HISTORY.push({ label, snapshot: CURRENT });
  renderHistory();
  saveState();
}

export function clearHistory(){
  HISTORY = [];
  renderHistory();
}

export function renderHistory(){
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';

  // Render newest-first, but keep the index mapped to the real array index.
  for (let i = HISTORY.length - 1; i >= 0; i--) {
    const row = document.createElement('div');
    row.className = 'hist';
    row.innerHTML = `
      <span>${HISTORY[i].label}</span>
      <button class="btn" data-idx="${i}">Undo to here</button>
    `;
    row.querySelector('button').addEventListener('click', async (e)=>{
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      const snap = HISTORY[idx].snapshot;

      setCurrent(snap);
      loadDataURLToCanvas(snap);

      // Keep up to and including idx
      HISTORY = HISTORY.slice(0, idx + 1);

      renderHistory();
      await refreshInspect();
      saveState();
    });
    list.appendChild(row);
  }
}

/* ---------- Info panel / inspect ---------- */
export function updateInfo(meta, exif){
  document.getElementById('infoFormat').textContent = meta.format || '—';
  document.getElementById('infoMode').textContent   = meta.mode || '—';
  document.getElementById('infoDim').textContent    = `${meta.width} × ${meta.height}`;
  document.getElementById('infoAvg').textContent    = `rgb(${meta.mean_rgb.join(', ')})`;
  document.getElementById('infoSize').textContent   = meta.file_size_str || '—';
  document.getElementById('exifBox').textContent    = JSON.stringify(exif || {}, null, 2);

  const gcd = (a,b)=>{ while(b){ [a,b]=[b,a%b]; } return a; };
  const g = gcd(meta.width, meta.height);
  const aspectText = `${meta.width/g}:${meta.height/g}`;
  const aspectEl = document.getElementById('infoAspect');
  if (aspectEl) aspectEl.textContent = aspectText;

  ASPECT = meta.width / meta.height;

  const wEl = document.getElementById('resizeW');
  const hEl = document.getElementById('resizeH');
  if (wEl && hEl){ wEl.value = meta.width; hEl.value = meta.height; }

  const seam = document.getElementById('seamSlider');
  const seamW = document.getElementById('seamW');
  if(seam && seamW){
    seam.min = Math.max(10, Math.floor(meta.width * 0.25));
    seam.max = Math.floor(meta.width * 1.5);
    seam.value = meta.width;
    seamW.textContent = `${meta.width} px`;
  }
}

export async function refreshInspect(){
  if(!CURRENT) return;
  const j = await postJSON('/api/inspect', { image: CURRENT });
  updateInfo(j.meta, j.exif);
}

/* ---------- Checkerboard boot & reset ---------- */
export function bootPreview(){
  // Exactly like your app.js boot: seed a tiny checker as CURRENT
  const p = document.createElement('canvas'); p.width = p.height = 32;
  const g = p.getContext('2d'); g.fillStyle='#ddd'; g.fillRect(0,0,32,32);
  g.fillStyle='#bbb'; g.fillRect(0,0,16,16); g.fillRect(16,16,16,16);
  setCurrent(p.toDataURL('image/png'));
  loadDataURLToCanvas(CURRENT);
  refreshInspect();
  setFileName('untitled');
  clearHistory(); // no history on boot
}

/* ---------- Setters / getters used by other modules ---------- */
export function setCurrent(dataURL){ CURRENT = dataURL; }
export function setOriginal(dataURL){ ORIGINAL = dataURL; }
export function getFileName(){ return FILE_NAME; }
