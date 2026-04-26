import { postJSON } from './api.js';
import { canEncodeClientSide, dataURLToBlob } from './blob_utils.js';
import { convertBlob, flipBlob, resizeBlob, rotateBlob } from './client_ops.js';
import {
  CURRENT,
  IS_GIF,
  getCurrentBlob,
  getCurrentDataURL,
  replaceCurrentBlob,
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

export function wireBasic() {
  document.getElementById('btnRotNeg90')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      const blob = await rotateBlob(getCurrentBlob(), -90, true);
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'Rotate -90deg' });
    } catch (_) {
      showToast('Rotation failed', 'error');
    }
  });

  document.getElementById('btnRotPos90')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      const blob = await rotateBlob(getCurrentBlob(), 90, true);
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'Rotate +90deg' });
    } catch (_) {
      showToast('Rotation failed', 'error');
    }
  });

  document.getElementById('btnRotate')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const degrees = parseFloat(document.getElementById('rotateDeg')?.value || '0');
    try {
      const blob = await rotateBlob(getCurrentBlob(), degrees, true);
      await replaceCurrentBlob(blob, { recordHistory: true, label: `Rotate ${degrees}deg` });
    } catch (_) {
      showToast('Rotation failed', 'error');
    }
  });

  document.getElementById('btnFlipH')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      const blob = await flipBlob(getCurrentBlob(), 'h');
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'Flip horizontal' });
    } catch (_) {
      showToast('Flip failed', 'error');
    }
  });

  document.getElementById('btnFlipV')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    try {
      const blob = await flipBlob(getCurrentBlob(), 'v');
      await replaceCurrentBlob(blob, { recordHistory: true, label: 'Flip vertical' });
    } catch (_) {
      showToast('Flip failed', 'error');
    }
  });

  document.getElementById('btnResize')?.addEventListener('click', async () => {
    if (!requireStaticImage()) return;
    const width = parseInt(document.getElementById('resizeW')?.value || '0', 10);
    const height = parseInt(document.getElementById('resizeH')?.value || '0', 10);
    const keepAspect = document.getElementById('keepAspect')?.checked ?? true;
    const method = document.getElementById('resampleMethod')?.value || 'lanczos';

    if (!width || !height) {
      showToast('Please enter valid dimensions.', 'error');
      return;
    }

    try {
      const blob = await resizeBlob(getCurrentBlob(), width, height, keepAspect, method);
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: `Resize to ${width}x${height} (${method})`,
      });
    } catch (_) {
      showToast('Resize failed', 'error');
    }
  });

  document.getElementById('btnConvert')?.addEventListener('click', async () => {
    if (!CURRENT || !getCurrentBlob()) return;
    const to = document.getElementById('convertTo')?.value || 'png';
    const quality = parseInt(document.getElementById('convertQuality')?.value || '92', 10);

    try {
      if (!IS_GIF && canEncodeClientSide(to)) {
        const blob = await convertBlob(getCurrentBlob(), to, quality);
        await replaceCurrentBlob(blob, {
          recordHistory: true,
          label: `Convert to ${to.toUpperCase()}`,
          isGif: false,
        });
      } else {
        const j = await postJSON('/api/convert', {
          image: await getCurrentDataURL(),
          to,
          quality,
        });
        const blob = await dataURLToBlob(j.img);
        await replaceCurrentBlob(blob, {
          recordHistory: true,
          label: `Convert to ${to.toUpperCase()}`,
          isGif: to === 'gif',
        });
      }
      showToast(`Converted to ${to.toUpperCase()}`, 'success');
    } catch (_) {
      showToast('Conversion failed', 'error');
    }
  });

  document.getElementById('btnRename')?.addEventListener('click', () => {
    const input = document.getElementById('fileNameInput');
    input?.focus();
    input?.select?.();
  });
}
