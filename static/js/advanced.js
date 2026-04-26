import { postJSON } from './api.js';
import { blobToDataURL, dataURLToBlob } from './blob_utils.js';
import {
  addBorderBlob,
  addWatermarkBlob,
  histEqualizeBlob,
  vignetteBlob,
} from './client_ops.js';
import {
  CURRENT,
  IS_GIF,
  getCurrentBlob,
  replaceCurrentBlob,
  setAnimationInfo,
  showToast,
} from './state.js';

function requireStaticImage() {
  if (!CURRENT || !getCurrentBlob()) return false;
  if (IS_GIF) {
    showToast('Use the GIF panel to preserve animation.', 'info');
    return false;
  }
  return true;
}

export function wireAdvanced() {
  document.getElementById('btnHistEq')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      const blob = await histEqualizeBlob(getCurrentBlob());
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'Histogram equalization' });
    } catch (_) {
      showToast('Histogram equalization failed', 'error');
    }
  });

  const bgTol = document.getElementById('bgTol');
  const bgTolVal = document.getElementById('bgTolVal');
  bgTol?.addEventListener('input', () => {
    if (bgTolVal) bgTolVal.textContent = bgTol.value;
  });

  document.getElementById('btnBgRemove')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const tolerance = parseInt(document.getElementById('bgTol')?.value || '18', 10);
    try {
      showToast('Removing background...', 'info');
      const j = await postJSON('/api/background_remove', {
        image: await blobToDataURL(getCurrentBlob()),
        tolerance,
      });
      const blob = await dataURLToBlob(j.img);
      await replaceCurrentBlob(blob, { recordHistory: true, label: `Background remove (${tolerance})` });
      showToast('Background removed', 'success');
    } catch (_) {
      showToast('Background removal failed', 'error');
    }
  });

  document.getElementById('btnBgRemoveAI')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      showToast('Running local AI cutout...', 'info');
      const j = await postJSON('/api/background_remove_ai', {
        image: await blobToDataURL(getCurrentBlob()),
      });
      const blob = await dataURLToBlob(j.img);
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'AI background removal' });
      showToast('Background removed', 'success');
    } catch (_) {
      showToast('AI background removal failed', 'error');
    }
  });

  const vignette = document.getElementById('vignetteStrength');
  const vignetteVal = document.getElementById('vignetteVal');
  vignette?.addEventListener('input', () => {
    if (vignetteVal) vignetteVal.textContent = `${vignette.value}%`;
  });

  document.getElementById('btnVignette')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const strength = parseInt(document.getElementById('vignetteStrength')?.value || '50', 10) / 100;
    try {
      const blob = await vignetteBlob(getCurrentBlob(), strength);
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: `Vignette ${Math.round(strength * 100)}%`,
      });
    } catch (_) {
      showToast('Vignette failed', 'error');
    }
  });

  document.getElementById('btnBorder')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const size = parseInt(document.getElementById('borderSize')?.value || '10', 10);
    const color = document.getElementById('borderColor')?.value || '#000000';
    try {
      const blob = await addBorderBlob(getCurrentBlob(), size, color);
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: `Border ${size}px`,
      });
    } catch (_) {
      showToast('Border failed', 'error');
    }
  });

  const watermarkOpacity = document.getElementById('watermarkOpacity');
  const watermarkOpacityVal = document.getElementById('watermarkOpacityVal');
  watermarkOpacity?.addEventListener('input', () => {
    if (watermarkOpacityVal) watermarkOpacityVal.textContent = `${watermarkOpacity.value}%`;
  });

  document.getElementById('btnWatermark')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const text = document.getElementById('watermarkText')?.value || '';
    if (!text.trim()) {
      showToast('Enter watermark text first.', 'error');
      return;
    }
    const position = document.getElementById('watermarkPos')?.value || 'bottom-right';
    const opacity = parseInt(document.getElementById('watermarkOpacity')?.value || '50', 10) / 100;
    const color = document.getElementById('watermarkColor')?.value || '#ffffff';

    try {
      const blob = await addWatermarkBlob(getCurrentBlob(), {
        text,
        position,
        opacity,
        color,
      });
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: `Watermark "${text.trim()}"`,
      });
    } catch (_) {
      showToast('Watermark failed', 'error');
    }
  });

  const seamSlider = document.getElementById('seamSlider');
  const seamLabel = document.getElementById('seamW');
  const seamBusy = document.getElementById('seamBusy');
  let seamBaseBlob = null;
  let seamTimer = null;
  let seamToken = 0;
  let seamLastValue = null;

  if (seamSlider && seamLabel) {
    const setBusy = (busy) => {
      seamBusy?.classList.toggle('hidden', !busy);
      seamSlider.disabled = busy;
    };

    const runSeam = async () => {
      if (!CURRENT || !getCurrentBlob() || IS_GIF) return;
      const target = parseInt(seamSlider.value, 10);
      seamLabel.textContent = `${target} px`;
      if (!seamBaseBlob) seamBaseBlob = getCurrentBlob();
      const token = ++seamToken;
      setBusy(true);

      try {
        const j = await postJSON('/api/seam_carve', {
          image: await blobToDataURL(seamBaseBlob),
          target_width: target,
          order: 'width-first',
          energy_mode: 'backward',
        });
        if (token !== seamToken) return;
        const blob = await dataURLToBlob(j.img);
        await replaceCurrentBlob(blob, { recordHistory: false, resetRedo: false });
      } catch (_) {
        showToast('Seam carve failed', 'error');
      } finally {
        if (token === seamToken) {
          setBusy(false);
        }
      }
    };

    seamSlider.addEventListener('pointerdown', () => {
      seamBaseBlob = getCurrentBlob();
    });

    seamSlider.addEventListener('input', () => {
      clearTimeout(seamTimer);
      seamLabel.textContent = `${seamSlider.value} px`;
      seamTimer = setTimeout(runSeam, 240);
    });

    const commitSeam = async () => {
      const target = parseInt(seamSlider.value, 10);
      if (target === seamLastValue || !getCurrentBlob()) return;
      seamLastValue = target;
      await replaceCurrentBlob(getCurrentBlob(), {
        recordHistory: true,
        label: `Seam carve to ${target}px`,
      });
      seamBaseBlob = getCurrentBlob();
    };

    ['change', 'mouseup', 'touchend', 'pointerup'].forEach((eventName) => {
      seamSlider.addEventListener(eventName, commitSeam);
    });
  }

  document.addEventListener('imagelab:new-image', (event) => {
    seamBaseBlob = null;
    const detail = event.detail?.meta;
    if (detail) {
      setAnimationInfo(detail);
    }
  });
}
