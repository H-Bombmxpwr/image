import { CURRENT, getFileName } from './state.js';

export function wireExporter(){
  document.getElementById('btnDownload')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const format  = document.getElementById('exportFormat').value;
    const quality = parseInt(document.getElementById('exportQuality').value || '92');
    const r = await fetch('/api/export', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ image: CURRENT, format, quality })
    });
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${getFileName()}.${format}`; a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  });

  document.getElementById('btnCopy')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const res  = await fetch(CURRENT);
    const blob = await res.blob();
    try{
      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
      const b = document.getElementById('btnCopy');
      b.textContent = 'Copied!'; setTimeout(()=> b.textContent = 'Copy', 1200);
    }catch{ alert('Clipboard write not permitted'); }
  });
}
