import { bootPreview, initStateFromStorage, saveOnUnload, wireStateUI } from './state.js';
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
import { wireMetadata } from './metadata.js';

(async function start() {
  wireStateUI();
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
  wireMetadata();

  const restored = await initStateFromStorage();
  if (!restored) {
    bootPreview();
  }

  saveOnUnload();
  console.log('Image Lab initialized');
})();
