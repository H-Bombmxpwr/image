/* ========== State ========== */
let CURRENT = null;        // dataURL of the working image
let ORIGINAL = null;       // original loaded image (null until user loads/pastes)
let FILE_NAME = 'untitled';
let CROP = null;           // Cropper instance
let HISTORY = [];          // [{label, snapshot}]
let ASPECT = null;

const cv = document.getElementById('canvas');
const ctx = cv.getContext('2d');
const drop = document.getElementById('dropZone');
const hint = document.getElementById('dropHint');
const fileNameEl = document.getElementById('fileName');

/* ========== Persistence ========== */
const STORE_KEY = 'imagelab-session-v1';

function saveState() {
  try {
    if (!CURRENT) return;
    const payload = {
      CURRENT,
      ORIGINAL,
      FILE_NAME,
      HISTORY
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.CURRENT) return false;
    CURRENT = s.CURRENT;
    ORIGINAL = s.ORIGINAL || s.CURRENT;
    FILE_NAME = s.FILE_NAME || 'untitled';
    HISTORY = Array.isArray(s.HISTORY) && s.HISTORY.length ? s.HISTORY : [{ label: `Opened "${FILE_NAME}"`, snapshot: CURRENT }];
    hint.style.display = 'none';
    setFileName(FILE_NAME);
    loadDataURLToCanvas(CURRENT);
    renderHistory();
    return true;
  } catch { return false; }
}

/* ========== Utilities ========== */
function setFileName(name){
  FILE_NAME = (name || 'untitled').replace(/[\\/:*?"<>|]/g, '_');
  const fileNameEl = document.getElementById('fileName');
  if (fileNameEl) fileNameEl.textContent = FILE_NAME;
}



function setCanvasFromImage(img){
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
function dataURLFromCanvas(){ return cv.toDataURL("image/png"); }
function loadDataURLToCanvas(dataURL){
  const img = new Image();
  img.onload = () => setCanvasFromImage(img);
  img.src = dataURL;
}
async function postJSON(url, payload){
  const r = await fetch(url, { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  if(!r.ok){ const t = await r.text(); throw new Error(t || r.statusText); }
  return r.json();
}

function fmtHistoryLabel(base, extras){ return extras ? `${base} ${extras}` : base; }

function pushHistory(label){
  if(!CURRENT) return;
  HISTORY.push({ label, snapshot: CURRENT });
  renderHistory();
  saveState();
}

function renderHistory(){
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  HISTORY.forEach((h, idx)=>{
    const row = document.createElement('div');
    row.className = 'hist';
    row.innerHTML = `<span>${idx}. ${h.label}</span><button class="btn" data-idx="${idx}">Undo to here</button>`;
    row.querySelector('button').addEventListener('click', async (e)=>{
      const i = parseInt(e.target.dataset.idx,10);
      CURRENT = HISTORY[i].snapshot;
      loadDataURLToCanvas(CURRENT);
      HISTORY = HISTORY.slice(0, i+1);
      renderHistory();
      await refreshInspect();
      saveState();
    });
    list.appendChild(row);
  });
}

function updateInfo(meta, exif){
  document.getElementById('infoFormat').textContent = meta.format || '—';
  document.getElementById('infoMode').textContent   = meta.mode || '—';
  document.getElementById('infoDim').textContent    = `${meta.width} × ${meta.height}`;
  document.getElementById('infoAvg').textContent    = `rgb(${meta.mean_rgb.join(', ')})`;
  document.getElementById('infoSize').textContent   = meta.file_size_str || '—';
  document.getElementById('exifBox').textContent    = JSON.stringify(exif || {}, null, 2);

  // NEW: aspect, reduced
  const g = (a,b)=>{ while(b){ [a,b] = [b, a % b]; } return a; };
  const gg = g(meta.width, meta.height);
  const aspectText = `${meta.width/gg}:${meta.height/gg}`;
  const aspectEl = document.getElementById('infoAspect');
  if (aspectEl) aspectEl.textContent = aspectText;

  // keep for W/H sync
  ASPECT = meta.width / meta.height;

  // Reflect current dims into inputs
  const wEl = document.getElementById('resizeW');
  const hEl = document.getElementById('resizeH');
  wEl.value = meta.width;
  hEl.value = meta.height;

  // Seam slider sync (unchanged)
  const seam = document.getElementById('seamSlider');
  const seamW = document.getElementById('seamW');
  if(seam && seamW){
    seam.min = Math.max(10, Math.floor(meta.width * 0.25));
    seam.max = Math.floor(meta.width * 1.5);
    seam.value = meta.width;
    seamW.textContent = `${meta.width} px`;
  }
}


async function refreshInspect(){
  if(!CURRENT) return;
  const j = await postJSON('/api/inspect', { image: CURRENT });
  updateInfo(j.meta, j.exif);
}

/* ========== Loading images ========== */
async function openFile(file){
  const buf = await file.arrayBuffer();
  const dataURL = `data:${file.type};base64,` + btoa(String.fromCharCode(...new Uint8Array(buf)));
  CURRENT = dataURL;
  ORIGINAL = dataURL;
  setFileName(file.name.replace(/\.[^.]+$/, ''));
  hint.style.display = 'none';
  loadDataURLToCanvas(CURRENT);
  HISTORY = [{ label: `Opened "${FILE_NAME}"`, snapshot: CURRENT }];
  renderHistory();
  await refreshInspect();
  saveState();
}

document.getElementById('fileInput').addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(f) openFile(f);
});

/* Paste button */
document.getElementById('btnPaste').addEventListener('click', async ()=>{
  // If we can use the async Clipboard API in a secure context, try that first
  if (navigator.clipboard && window.isSecureContext) {
    try { await tryReadFromClipboard(); return; }
    catch (e) { /* fall through to overlay */ }
  }
  // Fallback: show overlay and wait for a one-time paste event
  const ov = document.getElementById('pasteOverlay');
  ov.classList.remove('hidden');
  const onPaste = async (e)=>{
    ov.classList.add('hidden');
    window.removeEventListener('paste', onPaste);
    for(const item of e.clipboardData.items){
      if(item.type.startsWith('image/')){
        const blob = item.getAsFile();
        if(ORIGINAL && !confirm('Replace current image with the pasted one?')) return;
        await openFile(new File([blob], 'pasted', { type: blob.type || 'image/png' }));
        return;
      }
    }
    alert('Clipboard did not contain an image.');
  };
  window.addEventListener('paste', onPaste, { once:true });
});

/* Paste anywhere */
async function tryReadFromClipboard(){
  try{
    const items = await navigator.clipboard.read();
    for(const it of items){
      for(const type of it.types){
        if(type.startsWith('image/')){
          const blob = await it.getType(type);
          if(ORIGINAL){
            if(!confirm('Replace current image with the pasted one?')) return;
          }
          await openFile(new File([blob], 'pasted', {type}));
          return;
        }
      }
    }
    alert('Clipboard does not contain an image');
  }catch{ alert('Clipboard API blocked by browser'); }
}
window.addEventListener('paste', async (e)=>{
  for(const item of e.clipboardData.items){
    if(item.type.startsWith('image/')){
      const blob = item.getAsFile();
      if(ORIGINAL){
        if(!confirm('Replace current image with the pasted one?')) return;
      }
      await openFile(new File([blob], 'pasted', {type: blob.type || 'image/png'}));
      break;
    }
  }
});

/* Drag & drop */
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); drop.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); drop.classList.remove('drag');}));
drop.addEventListener('drop', (e)=>{ const f = e.dataTransfer.files?.[0]; if(f) openFile(f); });

/* ========== Tabs ========== */
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
    btn.classList.add('active');
    const target = document.getElementById('panel-' + btn.dataset.panel);
    if (target) target.classList.add('show');
  });
});

(()=>{
  const wEl = document.getElementById('resizeW');
  const hEl = document.getElementById('resizeH');
  const keep = document.getElementById('keepAspect');
  if(!wEl || !hEl || !keep) return;

  let locking = false; // prevent recursion
  wEl.addEventListener('input', ()=>{
    if (!keep.checked || !ASPECT || locking) return;
    locking = true;
    const w = Math.max(1, parseInt(wEl.value||'1',10));
    hEl.value = Math.max(1, Math.round(w / ASPECT));
    locking = false;
  });
  hEl.addEventListener('input', ()=>{
    if (!keep.checked || !ASPECT || locking) return;
    locking = true;
    const h = Math.max(1, parseInt(hEl.value||'1',10));
    wEl.value = Math.max(1, Math.round(h * ASPECT));
    locking = false;
  });
})();


/* ========== Basic ========== */
document.getElementById('btnRotNeg90').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const j = await postJSON('/api/rotate', { image: CURRENT, degrees: -90, expand: true });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory('Rotate −90°');
});
document.getElementById('btnRotPos90').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const j = await postJSON('/api/rotate', { image: CURRENT, degrees: 90, expand: true });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory('Rotate +90°');
});
document.getElementById('btnRotate').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const deg = parseFloat(document.getElementById('rotateDeg').value || '0');
  const j = await postJSON('/api/rotate', { image: CURRENT, degrees: deg, expand: true });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory(`Rotate ${deg}°`);
});

document.getElementById('btnFlipH').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const j = await postJSON('/api/flip', { image: CURRENT, axis:'h' });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory('Flip horizontal');
});
document.getElementById('btnFlipV').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const j = await postJSON('/api/flip', { image: CURRENT, axis:'v' });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory('Flip vertical');
});

document.getElementById('btnResize').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const w = parseInt(document.getElementById('resizeW').value);
  const h = parseInt(document.getElementById('resizeH').value);
  const keep = document.getElementById('keepAspect').checked;
  const method = document.getElementById('resampleMethod').value;
  const j = await postJSON('/api/resize', { image: CURRENT, width:w, height:h, keep_aspect:keep, method });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory(`Resize to ${w}×${h} (${keep ? 'keep aspect' : 'stretch'}, ${method})`);
});

document.getElementById('btnConvert').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const to = document.getElementById('convertTo').value;
  const quality = parseInt(document.getElementById('convertQuality').value || '92');
  const j = await postJSON('/api/convert', { image: CURRENT, to, quality });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory(`Convert → ${to.toUpperCase()} (q=${quality})`);
});

document.getElementById('btnRename').addEventListener('click', ()=>{
  const next = prompt('New name (without extension):', FILE_NAME);
  if(next){ setFileName(next); pushHistory(`Rename to "${FILE_NAME}"`); }
});

/* ========== Adjust ========== */
document.getElementById('btnAdjust').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const b = parseInt(adjBright.value)/100;
  const c = parseInt(adjContrast.value)/100;
  const s = parseInt(adjSaturation.value)/100;
  const g = parseInt(adjGamma.value)/100;
  const j = await postJSON('/api/adjust', { image: CURRENT, brightness:b, contrast:c, saturation:s, gamma:g });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();

  const pct = x => ((x-1)>=0?'+':'') + Math.round((x-1)*100) + '%';
  const gtxt = g===1 ? '' : ` γ${g.toFixed(2)}`;
  pushHistory(`Adjust: Brightness ${pct(b)} / Contrast ${pct(c)} / Saturation ${pct(s)}${gtxt}`);
});

/* ========== Filters ========== */
document.getElementById('btnFilters').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const payload = {
    image: CURRENT,
    grayscale: fGrayscale.checked,
    sepia: fSepia.checked,
    invert: fInvert.checked,
    sharpen: fSharpen.checked,
    edge: fEdge.checked,
    emboss: fEmboss.checked,
    gaussian: fGaussian.checked,
    gaussian_radius: parseFloat(fGaussR.value||'1.5'),
    median: fMedian.checked,
    median_size: parseInt(fMedianSize.value||'3'),
    posterize: parseInt(fPoster.value||'0'),
    pixelate: parseInt(fPixel.value||'1')
  };
  const j = await postJSON('/api/filters', payload);
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();

  const parts = [];
  if(payload.grayscale) parts.push('Grayscale');
  if(payload.sepia) parts.push('Sepia');
  if(payload.invert) parts.push('Invert');
  if(payload.sharpen) parts.push('Sharpen');
  if(payload.edge) parts.push('Edges');
  if(payload.emboss) parts.push('Emboss');
  if(payload.gaussian) parts.push(`Gaussian r=${payload.gaussian_radius}`);
  if(payload.median) parts.push(`Median ${payload.median_size}×${payload.median_size}`);
  if(payload.posterize>0) parts.push(`Posterize ${payload.posterize} bits`);
  if(payload.pixelate>1) parts.push(`Pixelate ${payload.pixelate}px`);
  pushHistory(`Filters: ${parts.join(', ') || 'none'}`);
});

/* ========== Advanced ========== */
document.getElementById('btnHistEq').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const j = await postJSON('/api/histeq', { image: CURRENT });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory('Histogram equalization');
});

document.getElementById('btnBgRemove').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const tol = parseInt(document.getElementById('bgTol').value);
  const j = await postJSON('/api/background_remove', { image: CURRENT, tolerance: tol });
  CURRENT = j.img; loadDataURLToCanvas(CURRENT); await refreshInspect();
  pushHistory(`Background remove (tol ${tol})`);
});

/* Seam carving live (debounced). Only push 1 history entry on release. */
/* ========== Seam carving live ========== */
let seamTimer = null;
let seamReqId = 0;
let seamLastCommitted = null; // width value last committed to history
const seamSlider = document.getElementById('seamSlider');
const seamLbl    = document.getElementById('seamW');
const seamBusy   = document.getElementById('seamBusy');

if (seamSlider && seamLbl) {
  const setBusy = (on) => {
    if (!seamBusy) return;
    seamBusy.classList.toggle('hidden', !on);
    seamSlider.disabled = !!on;
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
        order:'width-first',
        energy_mode:'backward'
      });
      if (myId !== seamReqId) return; // stale response
      CURRENT = j.img;
      loadDataURLToCanvas(CURRENT);
      await refreshInspect();
    } catch (e) {
      console.warn('Seam carve failed', e);
    } finally {
      if (myId === seamReqId) setBusy(false);
    }
  };

  const debounced = () => { clearTimeout(seamTimer); seamTimer = setTimeout(runSeam, 250); };
  seamSlider.addEventListener('input', debounced);

  // Commit a single, descriptive history entry when the user finishes dragging.
  const commit = async () => {
    const target = parseInt(seamSlider.value, 10);
    if (seamLastCommitted !== target && CURRENT) {
      pushHistory(`Seam carve width → ${target}px`);
      seamLastCommitted = target;
    }
  };
  seamSlider.addEventListener('change', commit);
  seamSlider.addEventListener('mouseup', commit);
  seamSlider.addEventListener('touchend', commit);
}

/* ========== Cropper modal ========== */
const dlg = document.getElementById('cropDialog');
document.getElementById('openCropper').addEventListener('click', ()=>{
  if(!CURRENT) return;
  const img = document.getElementById('cropImage');
  img.src = CURRENT;
  dlg.showModal();
  setTimeout(()=>{
    CROP?.destroy();
    CROP = new Cropper(img, { viewMode: 1, autoCropArea: .85, background:false, movable:true, zoomable:true });
  }, 30);
});
document.getElementById('cropCancel').addEventListener('click', ()=>{ CROP?.destroy(); dlg.close(); });
document.getElementById('cropApply').addEventListener('click', async ()=>{
  if(!CROP) return;
  const canvas = CROP.getCroppedCanvas({ imageSmoothingEnabled:true });
  CURRENT = canvas.toDataURL('image/png');
  loadDataURLToCanvas(CURRENT);
  await refreshInspect();
  pushHistory('Crop');
  CROP.destroy(); dlg.close();
});

/* ========== Export / copy ========== */
document.getElementById('btnDownload').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const format = document.getElementById('exportFormat').value;
  const quality = parseInt(document.getElementById('exportQuality').value || '92');
  const r = await fetch('/api/export', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: CURRENT, format, quality }) });
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${FILE_NAME}.${format}`; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1200);
});

document.getElementById('btnCopy').addEventListener('click', async ()=>{
  if(!CURRENT) return;
  const res = await fetch(CURRENT);
  const blob = await res.blob();
  try{
    await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
    const b = document.getElementById('btnCopy');
    b.textContent = 'Copied!'; setTimeout(()=> b.textContent = 'Copy', 1200);
  }catch{ alert('Clipboard write not permitted'); }
});

/* ========== Boot ========== */
/* Restore session if available; otherwise seed checkerboard preview
   (ORIGINAL stays null so we still prompt on overwrite). */
(async function boot(){
  const restored = loadState();
  if (!restored) {
    const p = document.createElement('canvas'); p.width = p.height = 32;
    const g = p.getContext('2d'); g.fillStyle='#ddd'; g.fillRect(0,0,32,32);
    g.fillStyle='#bbb'; g.fillRect(0,0,16,16); g.fillRect(16,16,16,16);
    CURRENT = p.toDataURL('image/png'); loadDataURLToCanvas(CURRENT); refreshInspect();
    setFileName('untitled');
  }
})();

/* Save on unload just in case */
window.addEventListener('beforeunload', saveState);
