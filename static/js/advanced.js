import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory } from './state.js';
import { CURRENT } from './state.js';

export function wireAdvanced(){
  document.getElementById('btnHistEq')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const j = await postJSON('/api/histeq', { image: CURRENT });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory('Histogram equalization');
  });

  document.getElementById('btnBgRemove')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const tol = parseInt(document.getElementById('bgTol').value);
    const j = await postJSON('/api/background_remove', { image: CURRENT, tolerance: tol });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();
    pushHistory(`Background remove (tol ${tol})`);
  });

  // Seam carving live (debounced) + single commit on release
  const seamSlider = document.getElementById('seamSlider');
  const seamLbl    = document.getElementById('seamW');
  const seamBusy   = document.getElementById('seamBusy');
  let seamTimer = null, seamReqId = 0, seamLastCommitted = null;

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
        if (myId !== seamReqId) return;
        setCurrent(j.img);
        loadDataURLToCanvas(j.img);
        await refreshInspect();
      } catch (e) {
        console.warn('Seam carve failed', e);
      } finally {
        if (myId === seamReqId) setBusy(false);
      }
    };

    const debounced = ()=>{ clearTimeout(seamTimer); seamTimer = setTimeout(runSeam, 250); };
    seamSlider.addEventListener('input', debounced);

    const commit = async () => {
      const target = parseInt(seamSlider.value, 10);
      if (seamLastCommitted !== target && CURRENT) {
        pushHistory(`Seam carve width → ${target}px`);
        seamLastCommitted = target;
      }
    };
    seamSlider.addEventListener('change',  commit);
    seamSlider.addEventListener('mouseup', commit);
    seamSlider.addEventListener('touchend', commit);
  }
}
