import { postFormData } from './api.js';
import { canEncodeClientSide } from './blob_utils.js';
import { convertBlob } from './client_ops.js';
import { CURRENT, getCurrentBlob, getFileName, getMetadata, showToast } from './state.js';

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function hasMetadata(metadata) {
  return Boolean(metadata && Object.keys(metadata).length);
}

export function wireExporter() {
  document.getElementById('btnDownload')?.addEventListener('click', async () => {
    if (!CURRENT || !getCurrentBlob()) {
      showToast('No image to download', 'error');
      return;
    }

    const format = document.getElementById('exportFormat')?.value || 'png';
    const quality = parseInt(document.getElementById('exportQuality')?.value || '92', 10);
    const metadata = getMetadata();

    try {
      if (!hasMetadata(metadata) && canEncodeClientSide(format)) {
        const blob = await convertBlob(getCurrentBlob(), format, quality);
        triggerDownload(blob, `${getFileName()}.${format}`);
      } else {
        const form = new FormData();
        form.append('image', getCurrentBlob(), `${getFileName()}.png`);
        form.append('format', format);
        form.append('quality', String(quality));
        form.append('metadata', JSON.stringify(metadata));
        const blob = await postFormData('/api/export', form);
        triggerDownload(blob, `${getFileName()}.${format}`);
      }
      showToast('Download started', 'success');
    } catch (_) {
      showToast('Download failed', 'error');
    }
  });

  document.getElementById('btnCopy')?.addEventListener('click', async () => {
    if (!CURRENT || !getCurrentBlob()) {
      showToast('No image to copy', 'error');
      return;
    }

    try {
      const pngBlob = getCurrentBlob().type === 'image/png'
        ? getCurrentBlob()
        : await convertBlob(getCurrentBlob(), 'png', 100);

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);

      const button = document.getElementById('btnCopy');
      const original = button?.textContent || 'Copy';
      if (button) {
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = original;
        }, 1400);
      }

      showToast('Copied to clipboard', 'success');
    } catch (_) {
      showToast('Copy failed. The browser blocked clipboard access.', 'error');
    }
  });
}
