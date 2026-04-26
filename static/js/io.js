import { postFormData } from './api.js';
import { detectMimeForFile, isLikelyGifMime } from './blob_utils.js';
import { bootPreview, openEditorBlob, showToast } from './state.js';

async function inspectFile(file) {
  const formData = new FormData();
  formData.append('image', file, file.name || 'upload');
  return postFormData('/api/inspect_upload', formData);
}

export function wireOpeners() {
  const dropZone = document.getElementById('dropZone');
  const dropHint = document.getElementById('dropHint');
  const fileInput = document.getElementById('fileInput');
  const pasteOverlay = document.getElementById('pasteOverlay');

  async function openFile(file) {
    try {
      const mime = await detectMimeForFile(file);
      const normalized = file.type === mime
        ? file
        : new File([await file.arrayBuffer()], file.name || 'image', { type: mime });
      const isGif = isLikelyGifMime(mime, normalized.name || '');

      let inspect = {
        meta: {
          is_animated: isGif,
          frame_count: isGif ? 1 : 1,
        },
        exif: {},
      };

      try {
        inspect = await inspectFile(normalized);
      } catch (error) {
        console.warn('Metadata inspection failed:', error);
      }

      const baseName = (normalized.name || 'untitled').replace(/\.[^.]+$/, '') || 'untitled';
      await openEditorBlob(normalized, {
        fileName: baseName,
        isGif,
        metadata: inspect.exif || {},
        originalMetadata: inspect.exif || {},
        analysis: inspect.meta || {
          is_animated: isGif,
          frame_count: isGif ? 1 : 1,
        },
      });

      document.dispatchEvent(new CustomEvent('imagelab:new-image', {
        detail: {
          meta: inspect.meta || {},
          exif: inspect.exif || {},
        },
      }));

      if (dropHint) dropHint.style.display = 'none';
      showToast(`Opened ${normalized.name || 'image'}`, 'success');
    } catch (error) {
      console.error('Failed to open file:', error);
      showToast(`Failed to open file: ${error.message}`, 'error');
    }
  }

  window.openImageFile = openFile;

  fileInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) await openFile(file);
    event.target.value = '';
  });

  dropZone?.addEventListener('click', (event) => {
    if (event.target === dropZone || event.target === dropHint || dropHint?.contains(event.target)) {
      fileInput?.click();
    }
  });

  document.getElementById('btnReset')?.addEventListener('click', () => {
    if (confirm('Clear the current image and start fresh?')) {
      bootPreview();
      showToast('Workspace cleared', 'success');
    }
  });

  document.getElementById('btnPaste')?.addEventListener('click', async () => {
    if (navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              await openFile(new File([blob], `pasted.${type.split('/')[1] || 'png'}`, { type }));
              return;
            }
          }
        }
        showToast('No image found in clipboard', 'error');
        return;
      } catch (_) {
        // Fall back to the overlay for blocked clipboard access.
      }
    }

    pasteOverlay?.classList.remove('hidden');
  });

  pasteOverlay?.addEventListener('click', () => {
    pasteOverlay.classList.add('hidden');
  });

  window.addEventListener('paste', async (event) => {
    pasteOverlay?.classList.add('hidden');
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          await openFile(new File([blob], `pasted.${item.type.split('/')[1] || 'png'}`, {
            type: blob.type || 'image/png',
          }));
        }
        return;
      }
    }
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone?.addEventListener('drop', async (event) => {
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await openFile(files[0]);
    }
  });

  window.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    if (event.target === dropZone || dropZone?.contains(event.target)) return;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await openFile(files[0]);
    }
  });
}
