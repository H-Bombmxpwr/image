import {
  refreshInspect, setFileName, renderHistory, saveState,
  pushHistory, loadDataURLToCanvas, setCurrent, setOriginal,
  clearHistory, getFileName, bootPreview, showToast, setIsGif
} from './state.js';

export function wireOpeners() {
  const dropHint = document.getElementById('dropHint');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const pasteOverlay = document.getElementById('pasteOverlay');

  // Open file function
  async function openFile(file) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const dataURL = `data:${file.type || 'image/png'};base64,` + 
        btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      // Check if GIF
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
      setIsGif(isGif);
      
      setCurrent(dataURL);
      setOriginal(dataURL);
      
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setFileName(baseName);
      
      if (dropHint) dropHint.style.display = 'none';
      
      loadDataURLToCanvas(dataURL);
      clearHistory();
      pushHistory(`Opened "${getFileName()}"`);
      
      await refreshInspect();
      saveState();
      
      showToast(`Opened: ${file.name}`, 'success');
    } catch (e) {
      console.error('Failed to open file:', e);
      showToast('Failed to open file', 'error');
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
