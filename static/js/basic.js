import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory } from './state.js';
import { CURRENT } from './state.js';

export function wireBasic(){
  document.getElementById('btnRotNeg90')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const j = await postJSON('/api/rotate', { image: CURRENT, degrees: -90, expand: true });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory('Rotate −90°');
  });

  document.getElementById('btnRotPos90')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const j = await postJSON('/api/rotate', { image: CURRENT, degrees: 90, expand: true });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory('Rotate +90°');
  });

  document.getElementById('btnRotate')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const deg = parseFloat(document.getElementById('rotateDeg').value || '0');
    const j = await postJSON('/api/rotate', { image: CURRENT, degrees: deg, expand: true });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory(`Rotate ${deg}°`);
  });

  document.getElementById('btnFlipH')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const j = await postJSON('/api/flip', { image: CURRENT, axis:'h' });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory('Flip horizontal');
  });
  document.getElementById('btnFlipV')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const j = await postJSON('/api/flip', { image: CURRENT, axis:'v' });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory('Flip vertical');
  });

  document.getElementById('btnResize')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const w = parseInt(document.getElementById('resizeW').value);
    const h = parseInt(document.getElementById('resizeH').value);
    const keep = document.getElementById('keepAspect').checked;
    const method = document.getElementById('resampleMethod').value;
    const j = await postJSON('/api/resize', { image: CURRENT, width:w, height:h, keep_aspect:keep, method });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory(`Resize to ${w}×${h} (${keep ? 'keep aspect' : 'stretch'}, ${method})`);
  });

  document.getElementById('btnConvert')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const to = document.getElementById('convertTo').value;
    const quality = parseInt(document.getElementById('convertQuality').value || '92');
    const j = await postJSON('/api/convert', { image: CURRENT, to, quality });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory(`Convert → ${to.toUpperCase()} (q=${quality})`);
  });

  document.getElementById('btnRename')?.addEventListener('click', ()=>{
    // keep identical behavior (prompt)
    const next = prompt('New name (without extension):', document.getElementById('fileName')?.textContent || 'untitled');
    if(next){
      // setFileName is in state.js; import not needed here if you prefer keeping rename button elsewhere.
      const ev = new CustomEvent('rename-file', { detail: { name: next }});
      window.dispatchEvent(ev);
    }
  });

  // Listen for rename to avoid direct import if you prefer loose coupling
  window.addEventListener('rename-file', (ev)=>{
    const { setFileName, pushHistory } = requireState();
    setFileName(ev.detail.name);
    pushHistory(`Rename to "${document.getElementById('fileName').textContent}"`);
  });
}

/* helper to lazy import from state (avoid circular) */
function requireState(){
  return awaitImport('./state.js');
}
async function awaitImport(p){ return await import(p); }
