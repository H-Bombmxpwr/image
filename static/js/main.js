import { initStateFromStorage, bootPreview, saveOnUnload, setFileName, pushHistory } from './state.js';
import { wireOpeners }          from './io.js';
import { wireTabs }             from './tabs.js';
import { wireAspectCoupling }   from './aspect.js';
import { wireBasic }            from './basic.js';
import { wireAdjust }           from './adjust.js';
import { wireFilters }          from './filters.js';
import { wireAdvanced }         from './advanced.js';
import { wireCropper }          from './cropper.js';
import { wireExporter }         from './exporter.js';

(async function start(){
  const restored = initStateFromStorage();   // restore session if present

  // Wire UI
  wireOpeners();
  wireTabs();
  wireAspectCoupling();
  wireBasic();
  wireAdjust();
  wireFilters();
  wireAdvanced();
  wireCropper();
  wireExporter();

  // Boot checkerboard exactly like your app.js
  if(!restored) bootPreview();

  // Support direct rename event from basic.js
  window.addEventListener('rename-file', (ev)=>{
    setFileName(ev.detail.name);
    pushHistory(`Rename to "${document.getElementById('fileName')?.textContent || ev.detail.name}"`);
  });

  saveOnUnload();
})();
