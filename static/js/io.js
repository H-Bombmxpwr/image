import {
  refreshInspect, setFileName, renderHistory, saveState,
  pushHistory, loadDataURLToCanvas, setCurrent, setOriginal,
  clearHistory, getFileName, bootPreview
} from './state.js';

export function wireOpeners(){
  const hint = document.getElementById('dropHint');
  const drop = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  async function openFile(file){
    const buf = await file.arrayBuffer();
    const dataURL = `data:${file.type};base64,` + btoa(String.fromCharCode(...new Uint8Array(buf)));

    setCurrent(dataURL);
    setOriginal(dataURL);
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    if (hint) hint.style.display = 'none';

    loadDataURLToCanvas(dataURL);
    clearHistory();
    pushHistory(`Opened "${getFileName()}"`);

    await refreshInspect();
    saveState();
  }
  window.openImageFile = openFile; // optional: expose for manual testing

  // File picker
  fileInput?.addEventListener('change', (e)=>{
    const f = e.target.files?.[0];
    if(f) openFile(f);
  });

  // Click the stage to open picker (handy with checkerboard)
  drop?.addEventListener('click', ()=>{
    document.getElementById('fileInput')?.click();
  });

  // Reset button → bootPreview (checker + cleared history)
  document.getElementById('btnReset')?.addEventListener('click', ()=>{
    bootPreview();
    saveState(); // persists checker as current (like boot)
  });

  // Paste button (async API → overlay fallback)
  document.getElementById('btnPaste')?.addEventListener('click', async ()=>{
    if (navigator.clipboard && window.isSecureContext) {
      try { await tryReadFromClipboard(openFile); return; }
      catch(e) { /* fall through */ }
    }
    const ov = document.getElementById('pasteOverlay');
    if(!ov) return;
    ov.classList.remove('hidden');
    const onPaste = async (e)=>{
      ov.classList.add('hidden');
      window.removeEventListener('paste', onPaste);
      for(const item of e.clipboardData.items){
        if(item.type.startsWith('image/')){
          const blob = item.getAsFile();
          if(window.ORIGINAL && !confirm('Replace current image with the pasted one?')) return;
          await openFile(new File([blob], 'pasted', { type: blob.type || 'image/png' }));
          return;
        }
      }
      alert('Clipboard did not contain an image.');
    };
    window.addEventListener('paste', onPaste, { once:true });
  });

  // Global paste
  window.addEventListener('paste', async (e)=>{
    for(const item of e.clipboardData.items){
      if(item.type.startsWith('image/')){
        const blob = item.getAsFile();
        if(window.ORIGINAL && !confirm('Replace current image with the pasted one?')) return;
        await openFile(new File([blob], 'pasted', { type: blob.type || 'image/png' }));
        break;
      }
    }
  });

  // Drag & drop
  ['dragenter','dragover'].forEach(ev => drop?.addEventListener(ev, e=>{
    e.preventDefault(); drop.classList.add('drag');
  }));
  ['dragleave','drop'].forEach(ev => drop?.addEventListener(ev, e=>{
    e.preventDefault(); drop.classList.remove('drag');
  }));
  drop?.addEventListener('drop', (e)=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if(f) openFile(f);
  });
}

async function tryReadFromClipboard(openFile){
  const items = await navigator.clipboard.read();
  for (const it of items){
    for (const type of it.types){
      if(type.startsWith('image/')){
        const blob = await it.getType(type);
        if(window.ORIGINAL && !confirm('Replace current image with the pasted one?')) return;
        await openFile(new File([blob], 'pasted', {type}));
        return;
      }
    }
  }
  alert('Clipboard does not contain an image');
}
