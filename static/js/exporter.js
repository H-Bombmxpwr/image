import { CURRENT, getFileName, showToast } from './state.js';

export function wireExporter() {
  // Download
  document.getElementById('btnDownload')?.addEventListener('click', async () => {
    if (!CURRENT) {
      showToast('No image to download', 'error');
      return;
    }
    
    const format = document.getElementById('exportFormat')?.value || 'png';
    const quality = parseInt(document.getElementById('exportQuality')?.value || '92');
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: CURRENT, format, quality })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${getFileName()}.${format}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Download started!', 'success');
    } catch (e) {
      showToast('Download failed', 'error');
    }
  });

  // Copy to clipboard
  document.getElementById('btnCopy')?.addEventListener('click', async () => {
    if (!CURRENT) {
      showToast('No image to copy', 'error');
      return;
    }
    
    try {
      // Fetch the current data URL as a blob
      const response = await fetch(CURRENT);
      const blob = await response.blob();
      
      // Try to copy as PNG (most compatible)
      const pngBlob = blob.type === 'image/png' ? blob : await convertToPng(blob);
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      
      const btn = document.getElementById('btnCopy');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 1500);
      
      showToast('Copied to clipboard!', 'success');
    } catch (e) {
      showToast('Copy failed - clipboard access denied', 'error');
    }
  });
}

// Helper to convert blob to PNG
async function convertToPng(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(resolve, 'image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
