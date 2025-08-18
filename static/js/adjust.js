import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory } from './state.js';
import { CURRENT } from './state.js';

export function wireAdjust(){
  document.getElementById('btnAdjust')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;
    const b = parseInt(adjBright.value)/100;
    const c = parseInt(adjContrast.value)/100;
    const s = parseInt(adjSaturation.value)/100;
    const g = parseInt(adjGamma.value)/100;

    const j = await postJSON('/api/adjust', {
      image: CURRENT, brightness:b, contrast:c, saturation:s, gamma:g
    });
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();

    const pct = x => ((x-1)>=0?'+':'') + Math.round((x-1)*100) + '%';
    const gtxt = g===1 ? '' : ` γ${g.toFixed(2)}`;
    pushHistory(`Adjust: Brightness ${pct(b)} / Contrast ${pct(c)} / Saturation ${pct(s)}${gtxt}`);
  });
}
