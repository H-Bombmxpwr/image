import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory } from './state.js';
import { CURRENT } from './state.js';

export function wireFilters(){
  document.getElementById('btnFilters')?.addEventListener('click', async ()=>{
    if(!CURRENT) return;

    const payload = {
      image: CURRENT,
      grayscale: fGrayscale.checked,
      sepia:     fSepia.checked,
      invert:    fInvert.checked,
      sharpen:   fSharpen.checked,
      edge:      fEdge.checked,
      emboss:    fEmboss.checked,
      gaussian:  fGaussian.checked,
      gaussian_radius: parseFloat(fGaussR.value||'1.5'),
      median:    fMedian.checked,
      median_size: parseInt(fMedianSize.value||'3'),
      posterize: parseInt(fPoster.value||'0'),
      pixelate:  parseInt(fPixel.value||'1')
    };

    const j = await postJSON('/api/filters', payload);
    setCurrent(j.img); loadDataURLToCanvas(j.img); await refreshInspect();

    const parts = [];
    if(payload.grayscale) parts.push('Grayscale');
    if(payload.sepia)     parts.push('Sepia');
    if(payload.invert)    parts.push('Invert');
    if(payload.sharpen)   parts.push('Sharpen');
    if(payload.edge)      parts.push('Edges');
    if(payload.emboss)    parts.push('Emboss');
    if(payload.gaussian)  parts.push(`Gaussian r=${payload.gaussian_radius}`);
    if(payload.median)    parts.push(`Median ${payload.median_size}×${payload.median_size}`);
    if(payload.posterize>0) parts.push(`Posterize ${payload.posterize} bits`);
    if(payload.pixelate>1) parts.push(`Pixelate ${payload.pixelate}px`);

    pushHistory(`Filters: ${parts.join(', ') || 'none'}`);
  });
}
