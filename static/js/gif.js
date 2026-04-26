import { postJSON } from './api.js';
import { blobToDataURL, dataURLToBlob } from './blob_utils.js';
import {
  CURRENT,
  IS_GIF,
  getCurrentBlob,
  replaceCurrentBlob,
  setAnimationInfo,
  showToast,
} from './state.js';

function requireGif() {
  if (!CURRENT || !getCurrentBlob()) return false;
  if (!IS_GIF) {
    showToast('Load a GIF to use GIF tools.', 'info');
    return false;
  }
  return true;
}

async function fetchGifInfo(blob) {
  const info = await postJSON('/api/gif/info', {
    image: await blobToDataURL(blob),
  });
  return {
    is_animated: true,
    frame_count: info.frame_count || 1,
    loop: info.loop,
  };
}

async function applyGifDataUrl(dataUrl, label) {
  const blob = await dataURLToBlob(dataUrl);
  const info = await fetchGifInfo(blob);
  await replaceCurrentBlob(blob, {
    recordHistory: true,
    label,
    isGif: true,
    analysis: info,
  });
  setAnimationInfo(info);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function wireGif() {
  const speed = document.getElementById('gifSpeed');
  const speedVal = document.getElementById('gifSpeedVal');
  speed?.addEventListener('input', () => {
    if (speedVal) {
      speedVal.textContent = `${(parseInt(speed.value, 10) / 100).toFixed(1)}x`;
    }
  });

  document.getElementById('btnGifResize')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const width = parseInt(document.getElementById('gifResizeW')?.value || '0', 10);
    const height = parseInt(document.getElementById('gifResizeH')?.value || '0', 10);
    const keepAspect = document.getElementById('gifKeepAspect')?.checked ?? true;
    if (!width && !height) {
      showToast('Enter at least one target dimension.', 'error');
      return;
    }

    try {
      showToast('Resizing GIF...', 'info');
      const j = await postJSON('/api/gif/resize', {
        image: await blobToDataURL(getCurrentBlob()),
        width,
        height,
        keep_aspect: keepAspect,
      });
      await applyGifDataUrl(j.img, `GIF resize to ${width || 'auto'}x${height || 'auto'}`);
      showToast('GIF resized', 'success');
    } catch (_) {
      showToast('GIF resize failed', 'error');
    }
  });

  document.getElementById('btnGifTrim')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const start = parseInt(document.getElementById('gifTrimStart')?.value || '0', 10);
    const end = parseInt(document.getElementById('gifTrimEnd')?.value || '-1', 10);
    try {
      showToast('Trimming GIF...', 'info');
      const j = await postJSON('/api/gif/trim', {
        image: await blobToDataURL(getCurrentBlob()),
        start_frame: start,
        end_frame: end,
      });
      await applyGifDataUrl(j.img, `GIF trim ${start} to ${end}`);
      showToast('GIF trimmed', 'success');
    } catch (_) {
      showToast('GIF trim failed', 'error');
    }
  });

  document.getElementById('btnGifSpeed')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const factor = parseInt(document.getElementById('gifSpeed')?.value || '100', 10) / 100;
    try {
      showToast('Changing GIF speed...', 'info');
      const j = await postJSON('/api/gif/speed', {
        image: await blobToDataURL(getCurrentBlob()),
        speed_factor: factor,
      });
      await applyGifDataUrl(j.img, `GIF speed ${factor.toFixed(1)}x`);
      showToast('GIF speed updated', 'success');
    } catch (_) {
      showToast('GIF speed change failed', 'error');
    }
  });

  document.getElementById('btnGifReverse')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    try {
      showToast('Reversing GIF...', 'info');
      const j = await postJSON('/api/gif/reverse', {
        image: await blobToDataURL(getCurrentBlob()),
      });
      await applyGifDataUrl(j.img, 'GIF reversed');
      showToast('GIF reversed', 'success');
    } catch (_) {
      showToast('GIF reverse failed', 'error');
    }
  });

  document.getElementById('btnGifPingPong')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    try {
      showToast('Building ping-pong GIF...', 'info');
      const j = await postJSON('/api/gif/pingpong', {
        image: await blobToDataURL(getCurrentBlob()),
      });
      await applyGifDataUrl(j.img, 'GIF ping-pong');
      showToast('Ping-pong GIF created', 'success');
    } catch (_) {
      showToast('GIF ping-pong failed', 'error');
    }
  });

  document.getElementById('btnGifOptimize')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const colors = parseInt(document.getElementById('gifOptimizeColors')?.value || '128', 10);
    const frameStep = parseInt(document.getElementById('gifOptimizeStep')?.value || '1', 10);
    try {
      showToast('Optimizing GIF...', 'info');
      const j = await postJSON('/api/gif/optimize', {
        image: await blobToDataURL(getCurrentBlob()),
        colors,
        frame_step: frameStep,
      });
      await applyGifDataUrl(j.img, `GIF optimize ${colors} colors`);
      showToast('GIF optimized', 'success');
    } catch (_) {
      showToast('GIF optimization failed', 'error');
    }
  });

  document.getElementById('btnGifPoster')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const frame = parseInt(document.getElementById('gifPosterFrame')?.value || '0', 10);
    try {
      const j = await postJSON('/api/gif/poster', {
        image: await blobToDataURL(getCurrentBlob()),
        frame,
      });
      const blob = await dataURLToBlob(j.img);
      downloadBlob(blob, `gif-frame-${String(frame).padStart(3, '0')}.png`);
      showToast('Poster frame downloaded', 'success');
    } catch (_) {
      showToast('Poster frame export failed', 'error');
    }
  });

  document.getElementById('btnGifFramesZip')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    try {
      showToast('Packing GIF frames...', 'info');
      const j = await postJSON('/api/gif/frames_zip', {
        image: await blobToDataURL(getCurrentBlob()),
      });
      const blob = await dataURLToBlob(j.zip);
      downloadBlob(blob, 'gif-frames.zip');
      showToast('Frame ZIP downloaded', 'success');
    } catch (_) {
      showToast('GIF frame export failed', 'error');
    }
  });
}
