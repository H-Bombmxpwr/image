import { postJSON } from './api.js';
import { setCurrent, loadDataURLToCanvas, refreshInspect, pushHistory, showToast, CURRENT } from './state.js';

export function wireFilters() {
  document.getElementById('btnFilters')?.addEventListener('click', async () => {
    if (!CURRENT) return;
    
    const payload = {
      image: CURRENT,
      grayscale: document.getElementById('fGrayscale')?.checked || false,
      sepia: document.getElementById('fSepia')?.checked || false,
      invert: document.getElementById('fInvert')?.checked || false,
      sharpen: document.getElementById('fSharpen')?.checked || false,
      edge: document.getElementById('fEdge')?.checked || false,
      emboss: document.getElementById('fEmboss')?.checked || false,
      contour: document.getElementById('fContour')?.checked || false,
      smooth: document.getElementById('fSmooth')?.checked || false,
      gaussian: document.getElementById('fGaussian')?.checked || false,
      gaussian_radius: parseFloat(document.getElementById('fGaussR')?.value || '1.5'),
      median: document.getElementById('fMedian')?.checked || false,
      median_size: parseInt(document.getElementById('fMedianSize')?.value || '3'),
      posterize: parseInt(document.getElementById('fPoster')?.value || '0'),
      pixelate: parseInt(document.getElementById('fPixel')?.value || '1'),
      solarize: parseInt(document.getElementById('fSolarize')?.value || '0'),
    };
    
    try {
      const j = await postJSON('/api/filters', payload);
      setCurrent(j.img);
      loadDataURLToCanvas(j.img);
      await refreshInspect();
      
      // Build description
      const parts = [];
      if (payload.grayscale) parts.push('Grayscale');
      if (payload.sepia) parts.push('Sepia');
      if (payload.invert) parts.push('Invert');
      if (payload.sharpen) parts.push('Sharpen');
      if (payload.edge) parts.push('Edges');
      if (payload.emboss) parts.push('Emboss');
      if (payload.contour) parts.push('Contour');
      if (payload.smooth) parts.push('Smooth');
      if (payload.gaussian) parts.push(`Gaussian(${payload.gaussian_radius})`);
      if (payload.median) parts.push(`Median(${payload.median_size})`);
      if (payload.posterize > 0) parts.push(`Posterize(${payload.posterize})`);
      if (payload.pixelate > 1) parts.push(`Pixelate(${payload.pixelate})`);
      if (payload.solarize > 0) parts.push(`Solarize(${payload.solarize})`);
      
      pushHistory(`Filters: ${parts.join(', ') || 'none'}`);
      
      // Reset checkboxes
      ['fGrayscale', 'fSepia', 'fInvert', 'fSharpen', 'fEdge', 'fEmboss', 
       'fContour', 'fSmooth', 'fGaussian', 'fMedian'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      
      // Reset number inputs
      document.getElementById('fPoster').value = 0;
      document.getElementById('fPixel').value = 1;
      document.getElementById('fSolarize').value = 0;
      
    } catch (e) {
      showToast('Filter application failed', 'error');
    }
  });
}
