import { initStateFromStorage, bootPreview, saveOnUnload, setFileName, pushHistory } from './state.js';
import { wireOpeners } from './io.js';
import { wireTabs } from './tabs.js';
import { wireAspectCoupling } from './aspect.js';
import { wireBasic } from './basic.js';
import { wireAdjust } from './adjust.js';
import { wireFilters } from './filters.js';
import { wireAdvanced } from './advanced.js';
import { wireGif } from './gif.js';
import { wireCropper } from './cropper.js';
import { wireExporter } from './exporter.js';

(async function start() {
  // Try to restore session
  const restored = initStateFromStorage();

  // Wire all UI modules
  wireOpeners();
  wireTabs();
  wireAspectCoupling();
  wireBasic();
  wireAdjust();
  wireFilters();
  wireAdvanced();
  wireGif();
  wireCropper();
  wireExporter();

  // Boot with checkerboard if no session restored
  if (!restored) {
    bootPreview();
  }

  // Support rename event from basic.js
  window.addEventListener('rename-file', (ev) => {
    setFileName(ev.detail.name);
    pushHistory(`Rename to "${document.getElementById('fileName')?.textContent || ev.detail.name}"`);
  });

  // Auto-save on unload
  saveOnUnload();

  console.log('Image Lab initialized');
})();
