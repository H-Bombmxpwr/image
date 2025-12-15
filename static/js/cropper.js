import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, CURRENT } from './state.js';

export function wireCropper() {
  let CROP = null;
  const dlg = document.getElementById('cropDialog');

  document.getElementById('openCropper')?.addEventListener('click', () => {
    if (!CURRENT) return;
    const img = document.getElementById('cropImage');
    if (!img) return;
    
    img.src = CURRENT;
    dlg?.showModal();
    
    setTimeout(() => {
      try { CROP?.destroy?.(); } catch {}
      CROP = new Cropper(img, {
        viewMode: 1,
        autoCropArea: 0.85,
        background: false,
        movable: true,
        zoomable: true,
        responsive: true
      });
    }, 50);
  });

  // Cancel buttons
  const cancelCrop = () => {
    try { CROP?.destroy?.(); } catch {}
    CROP = null;
    dlg?.close();
  };
  
  document.getElementById('cropCancel')?.addEventListener('click', cancelCrop);
  document.getElementById('cropCancelBtn')?.addEventListener('click', cancelCrop);

  // Apply crop
  document.getElementById('cropApply')?.addEventListener('click', async () => {
    if (!CROP) return;
    
    const canvas = CROP.getCroppedCanvas({ imageSmoothingEnabled: true });
    const dataURL = canvas.toDataURL('image/png');
    
    setCurrent(dataURL);
    loadDataURLToCanvas(dataURL);
    await refreshInspect();
    pushHistory('Crop');
    
    try { CROP.destroy(); } catch {}
    CROP = null;
    dlg?.close();
  });

  // Close on backdrop click
  dlg?.addEventListener('click', (e) => {
    if (e.target === dlg) {
      cancelCrop();
    }
  });
}
