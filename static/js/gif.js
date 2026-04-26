import { postJSON } from './api.js';
import { blobToDataURL, dataURLToBlob } from './blob_utils.js';
import {
  CURRENT,
  IS_GIF,
  getCurrentBlob,
  replaceCurrentBlob,
  setAnimationInfo,
  showLoadingToast,
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

async function runGifOp({ loadingMessage, successMessage, failMessage, request, postLabel }) {
  const loading = loadingMessage ? showLoadingToast(loadingMessage) : null;
  try {
    const j = await postJSON(request.url, request.body);
    if (postLabel) {
      await applyGifDataUrl(j.img, postLabel);
    }
    loading?.dismiss();
    if (successMessage) showToast(successMessage, 'success');
    return j;
  } catch (_) {
    loading?.dismiss();
    showToast(failMessage, 'error');
    return null;
  }
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
    await runGifOp({
      loadingMessage: 'Resizing GIF...',
      successMessage: 'GIF resized',
      failMessage: 'GIF resize failed',
      request: {
        url: '/api/gif/resize',
        body: {
          image: await blobToDataURL(getCurrentBlob()),
          width,
          height,
          keep_aspect: keepAspect,
        },
      },
      postLabel: `GIF resize to ${width || 'auto'}x${height || 'auto'}`,
    });
  });

  document.getElementById('btnGifTrim')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const start = parseInt(document.getElementById('gifTrimStart')?.value || '0', 10);
    const end = parseInt(document.getElementById('gifTrimEnd')?.value || '-1', 10);
    await runGifOp({
      loadingMessage: 'Trimming GIF...',
      successMessage: 'GIF trimmed',
      failMessage: 'GIF trim failed',
      request: {
        url: '/api/gif/trim',
        body: {
          image: await blobToDataURL(getCurrentBlob()),
          start_frame: start,
          end_frame: end,
        },
      },
      postLabel: `GIF trim ${start} to ${end}`,
    });
  });

  document.getElementById('btnGifSpeed')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const factor = parseInt(document.getElementById('gifSpeed')?.value || '100', 10) / 100;
    await runGifOp({
      loadingMessage: 'Changing GIF speed...',
      successMessage: 'GIF speed updated',
      failMessage: 'GIF speed change failed',
      request: {
        url: '/api/gif/speed',
        body: {
          image: await blobToDataURL(getCurrentBlob()),
          speed_factor: factor,
        },
      },
      postLabel: `GIF speed ${factor.toFixed(1)}x`,
    });
  });

  document.getElementById('btnGifReverse')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    await runGifOp({
      loadingMessage: 'Reversing GIF...',
      successMessage: 'GIF reversed',
      failMessage: 'GIF reverse failed',
      request: {
        url: '/api/gif/reverse',
        body: { image: await blobToDataURL(getCurrentBlob()) },
      },
      postLabel: 'GIF reversed',
    });
  });

  document.getElementById('btnGifPingPong')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    await runGifOp({
      loadingMessage: 'Building ping-pong GIF...',
      successMessage: 'Ping-pong GIF created',
      failMessage: 'GIF ping-pong failed',
      request: {
        url: '/api/gif/pingpong',
        body: { image: await blobToDataURL(getCurrentBlob()) },
      },
      postLabel: 'GIF ping-pong',
    });
  });

  document.getElementById('btnGifOptimize')?.addEventListener('click', async () => {
    if (!requireGif()) return;
    const colors = parseInt(document.getElementById('gifOptimizeColors')?.value || '128', 10);
    const frameStep = parseInt(document.getElementById('gifOptimizeStep')?.value || '1', 10);
    await runGifOp({
      loadingMessage: 'Optimizing GIF...',
      successMessage: 'GIF optimized',
      failMessage: 'GIF optimization failed',
      request: {
        url: '/api/gif/optimize',
        body: {
          image: await blobToDataURL(getCurrentBlob()),
          colors,
          frame_step: frameStep,
        },
      },
      postLabel: `GIF optimize ${colors} colors`,
    });
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
    const loading = showLoadingToast('Packing GIF frames...');
    try {
      const j = await postJSON('/api/gif/frames_zip', {
        image: await blobToDataURL(getCurrentBlob()),
      });
      const blob = await dataURLToBlob(j.zip);
      downloadBlob(blob, 'gif-frames.zip');
      loading.dismiss();
      showToast('Frame ZIP downloaded', 'success');
    } catch (_) {
      loading.dismiss();
      showToast('GIF frame export failed', 'error');
    }
  });
}
