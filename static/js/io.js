import {
  refreshInspect, setFileName, renderHistory, saveState,
  pushHistory, loadDataURLToCanvas, setCurrent, setOriginal,
  clearHistory, getFileName, bootPreview, showToast, setIsGif
} from './state.js';
import { postJSON } from './api.js';

// Map file extensions to MIME types for formats browsers don't recognize well
const MIME_MAP = {
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'bmp': 'image/bmp',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'heic': 'image/heic',
  'heif': 'image/heif',
};

// Formats that browsers can't display natively and need server conversion
const NEEDS_CONVERSION = ['image/tiff', 'image/heic', 'image/heif', 'image/bmp'];

export function wireOpeners() {
  const dropHint = document.getElementById('dropHint');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const pasteOverlay = document.getElementById('pasteOverlay');

  // Open file function
  async function openFile(file) {
    try {
      // Determine MIME type - browsers often fail on TIFF, BMP etc.
      let mimeType = file.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = file.name.split('.').pop().toLowerCase();
        mimeType = MIME_MAP[ext] || 'image/png';
      }
      
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      
      // Build data URL with correct MIME type
      let dataURL = `data:${mimeType};base64,` + 
        btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      // Check if GIF
      const isGif = mimeType === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
      setIsGif(isGif);
      
      // Store original for export
      const originalDataURL = dataURL;
      
      // For formats browsers can't display, convert to PNG via server
      let displayDataURL = dataURL;
      if (NEEDS_CONVERSION.includes(mimeType)) {
        try {
          showToast('Converting image for display...', 'info');
          const result = await postJSON('/api/normalize', { image: dataURL });
          displayDataURL = result.img;
        } catch (e) {
          console.warn('Could not normalize image, trying direct display:', e);
        }
      }
      
      // Clear old state before setting new
      setCurrent(null);
      setOriginal(null);
      
      // Set new image - store original for export, display converted version
      setCurrent(displayDataURL);
      setOriginal(originalDataURL);
      
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setFileName(baseName);
      
      if (dropHint) dropHint.style.display = 'none';
      
      // Load to canvas (this also handles GIF preview)
      loadDataURLToCanvas(displayDataURL);
      clearHistory();
      pushHistory(`Opened "${getFileName()}"`);
      
      await refreshInspect();
      saveState();

      document.dispatchEvent(new CustomEvent('imagelab:new-image'));
      showToast(`Opened: ${file.name}`, 'success');
    } catch (e) {
      console.error('Failed to open file:', e);
      showToast('Failed to open file: ' + e.message, 'error');
    }
  }
  
  // Expose for testing
  window.openImageFile = openFile;

  // File input change
  fileInput?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = ''; // Reset for same file selection
  });

  // Click drop zone to open picker
  dropZone?.addEventListener('click', (e) => {
    if (e.target === dropZone || e.target === dropHint || dropHint?.contains(e.target)) {
      fileInput?.click();
    }
  });

  // Reset button
  document.getElementById('btnReset')?.addEventListener('click', () => {
    if (confirm('Clear the current image and start fresh?')) {
      bootPreview();
      localStorage.removeItem('imagelab-session-v2');
      showToast('Reset complete');
    }
  });

  // Paste button
  document.getElementById('btnPaste')?.addEventListener('click', async () => {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const file = new File([blob], 'pasted', { type });
              await openFile(file);
              return;
            }
          }
        }
        showToast('No image in clipboard', 'error');
        return;
      } catch (e) {
        // Fall through to overlay method
        console.log('Clipboard API failed, using fallback');
      }
    }
    
    // Show paste overlay as fallback
    if (pasteOverlay) {
      pasteOverlay.classList.remove('hidden');
    }
  });

  // Paste overlay click to dismiss
  pasteOverlay?.addEventListener('click', () => {
    pasteOverlay.classList.add('hidden');
  });

  // Global paste handler
  window.addEventListener('paste', async (e) => {
    // Hide overlay if shown
    if (pasteOverlay) {
      pasteOverlay.classList.add('hidden');
    }
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], 'pasted', { type: blob.type || 'image/png' });
          await openFile(file);
        }
        return;
      }
    }
  });

  // Drag and drop
  ['dragenter', 'dragover'].forEach(ev => {
    dropZone?.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dropZone?.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      await openFile(files[0]);
    }
  });

  // Also handle drops on the entire window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.target === dropZone || dropZone?.contains(e.target)) return; // Already handled
    
    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      await openFile(files[0]);
    }
  });
}
