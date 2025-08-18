import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory } from './state.js';
import { CURRENT } from './state.js';

export function wireCropper(){
  let CROP = null;
  const dlg = document.getElementById('cropDialog');

  document.getElementById('openCropper')?.addEventListener('click', ()=>{
    if(!CURRENT) return;
    const img = document.getElementById('cropImage');
    img.src = CURRENT;
    dlg.showModal();
    setTimeout(()=>{
      try { CROP?.destroy?.(); } catch {}
      CROP = new Cropper(img, { viewMode: 1, autoCropArea: .85, background:false, movable:true, zoomable:true });
    }, 30);
  });

  document.getElementById('cropCancel')?.addEventListener('click', ()=>{
    try { CROP?.destroy?.(); } catch {}
    dlg.close();
  });

  document.getElementById('cropApply')?.addEventListener('click', async ()=>{
    if(!CROP) return;
    const canvas = CROP.getCroppedCanvas({ imageSmoothingEnabled:true });
    const dataURL = canvas.toDataURL('image/png');
    setCurrent(dataURL);
    loadDataURLToCanvas(dataURL);
    await refreshInspect();
    pushHistory('Crop');
    try { CROP.destroy(); } catch {}
    dlg.close();
  });
}
