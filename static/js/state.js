import {
  blobToDataURL,
  cloneMetadata,
  extensionFromMime,
  formatBytes,
  formatLabelFromMime,
  loadImageFromSource,
  sanitizeFileName,
} from './blob_utils.js';
import { setActivePanel } from './tabs.js';

export let CURRENT = null;
export let ORIGINAL = null;
export let FILE_NAME = 'untitled';
export let HISTORY = [];
export let FUTURE = [];
export let ASPECT = null;
export let IS_GIF = false;

let CURRENT_BLOB = null;
let ORIGINAL_BLOB = null;
let CURRENT_META = {};
let ORIGINAL_META = {};
let CURRENT_ANALYSIS = { is_animated: false, frame_count: 1 };
let currentUrl = null;
let originalUrl = null;
let inspectToken = 0;
let saveTimer = null;
let taskProgressTimer = null;
let taskProgressHideTimer = null;
let taskProgressValue = 0;
let taskProgressMessage = 'Working...';

const DB_NAME = 'imagelab-session';
const DB_STORE = 'session';
const DB_KEY = 'latest';
const MAX_HISTORY = 24;

const canvas = document.getElementById('canvas');
const ctx = canvas?.getContext('2d', { willReadFrequently: true });
const dropZone = document.getElementById('dropZone');
const dropHint = document.getElementById('dropHint');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function dispatchStateChanged(reason) {
  document.dispatchEvent(new CustomEvent('imagelab:state-changed', {
    detail: { reason },
  }));
}

function revokePreviewUrl(which) {
  if (which === 'current' && currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  if (which === 'original' && originalUrl) {
    URL.revokeObjectURL(originalUrl);
    originalUrl = null;
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btnUndo');
  const redoBtn = document.getElementById('btnRedo');
  if (undoBtn) undoBtn.disabled = HISTORY.length <= 1;
  if (redoBtn) redoBtn.disabled = FUTURE.length === 0;
}

function getSnapshot(label) {
  return {
    label,
    blob: CURRENT_BLOB,
    fileName: FILE_NAME,
    isGif: IS_GIF,
    metadata: cloneMetadata(CURRENT_META),
    analysis: deepClone(CURRENT_ANALYSIS),
  };
}

function setStageHint(visible) {
  if (dropHint) {
    dropHint.style.display = visible ? '' : 'none';
  }
}

function setTitle() {
  document.title = FILE_NAME === 'untitled' ? 'Image Lab' : `${FILE_NAME} - Image Lab`;
}

function syncFileNameInput() {
  const input = document.getElementById('fileNameInput');
  if (input && input.value !== FILE_NAME) {
    input.value = FILE_NAME;
  }
}

function queueSaveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveState();
  }, 160);
}

async function openDb() {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB unavailable');
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error('Failed to open database'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readSession() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const request = store.get(DB_KEY);
    request.onerror = () => reject(request.error || new Error('Failed to read session'));
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function writeSession(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to write session'));
    tx.objectStore(DB_STORE).put(record, DB_KEY);
  });
}

async function deleteSession() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear session'));
      tx.objectStore(DB_STORE).delete(DB_KEY);
    });
  } catch (_) {
    // Ignore persistence cleanup failures.
  }
}

function syncMetadataEditor() {
  const editor = document.getElementById('metaEditor');
  if (editor) {
    editor.value = JSON.stringify(CURRENT_META || {}, null, 2);
  }
}

function updateMetadataStatus() {
  const badge = document.getElementById('metadataStatus');
  if (!badge) return;
  const count = Object.keys(CURRENT_META || {}).length;
  badge.textContent = count ? `${count} field${count === 1 ? '' : 's'}` : 'Empty';
  badge.classList.toggle('is-filled', count > 0);
}

function isMetadataValueEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function printableRatio(text) {
  if (!text) return 1;
  let printable = 0;
  for (const char of text) {
    if (char === '\n' || char === '\r' || char === '\t' || (char >= ' ' && char !== '\x7f')) {
      printable += 1;
    }
  }
  return printable / text.length;
}

function cleanMetadataText(value, limit = 240) {
  const stripped = String(value).replace(/\u0000/g, '').trim();
  if (!stripped) return '';

  if (printableRatio(stripped) < 0.9) {
    const preview = stripped
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72);
    return preview
      ? `<binary-like text; preview: ${preview}>`
      : `<binary-like text; ${String(value).length} chars>`;
  }

  if (stripped.length > limit) {
    return `${stripped.slice(0, limit)}... (${stripped.length} chars)`;
  }

  return stripped;
}

function normalizeMetadataDisplayValue(value) {
  if (typeof value === 'string') {
    return cleanMetadataText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMetadataDisplayValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => !isMetadataValueEmpty(item))
        .map(([key, item]) => [key, normalizeMetadataDisplayValue(item)]),
    );
  }
  return value;
}

function metadataSortWeight(key) {
  const priority = [
    'Artist',
    'Copyright',
    'ImageDescription',
    'DateTimeOriginal',
    'DateTimeDigitized',
    'DateTime',
    'Make',
    'Model',
    'Orientation',
    'FNumber',
    'ExposureTime',
    'ISOSpeedRatings',
    'FocalLength',
    'XResolution',
    'YResolution',
  ];
  const index = priority.indexOf(key);
  return index === -1 ? priority.length + 1 : index;
}

function formatMetadataValue(value) {
  const normalized = normalizeMetadataDisplayValue(value);
  if (typeof normalized === 'string') {
    return normalized;
  }
  return JSON.stringify(normalized, null, 2);
}

function updateExif(exif) {
  const content = document.getElementById('exifContent');
  if (!content) return;

  const entries = Object.entries(exif || {})
    .filter(([key, value]) => key !== 'error' && !isMetadataValueEmpty(value))
    .sort(([a], [b]) => {
      const weightDiff = metadataSortWeight(a) - metadataSortWeight(b);
      return weightDiff || a.localeCompare(b);
    });

  if (!entries.length) {
    content.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'metadata-empty';
    empty.textContent = 'No metadata loaded';
    content.appendChild(empty);
    updateMetadataStatus();
    return;
  }

  const table = document.createElement('table');
  table.className = 'metadata-table';
  const body = document.createElement('tbody');

  entries.forEach(([key, rawValue]) => {
    const row = document.createElement('tr');
    const keyCell = document.createElement('td');
    const valueCell = document.createElement('td');
    const keyLabel = document.createElement('span');
    const valueLabel = document.createElement('div');

    keyLabel.className = 'metadata-key';
    keyLabel.textContent = key;
    valueLabel.className = 'metadata-value';
    valueLabel.textContent = formatMetadataValue(rawValue);

    keyCell.appendChild(keyLabel);
    valueCell.appendChild(valueLabel);
    row.appendChild(keyCell);
    row.appendChild(valueCell);
    body.appendChild(row);
  });

  table.appendChild(body);
  content.replaceChildren(table);
  updateMetadataStatus();
}

function setInfoField(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateGifInfoLabel() {
  const gifInfo = document.getElementById('gifInfo');
  if (!gifInfo) return;

  if (!CURRENT_BLOB) {
    gifInfo.textContent = 'Load a GIF to see animation details';
    return;
  }

  if (!IS_GIF) {
    gifInfo.textContent = 'Current image is static';
    return;
  }

  const frameCount = CURRENT_ANALYSIS.frame_count || 1;
  const loop = CURRENT_ANALYSIS.loop;
  const loopText = typeof loop === 'number'
    ? (loop === 0 ? 'Loops forever' : `Loops ${loop}x`)
    : 'Animated';
  gifInfo.textContent = `${frameCount} frame${frameCount === 1 ? '' : 's'} - ${loopText}`;
}

function updateCompareButtonState() {
  const btn = document.getElementById('btnCompare');
  if (btn) {
    btn.disabled = !CURRENT_BLOB || !ORIGINAL_BLOB || CURRENT_BLOB === ORIGINAL_BLOB;
  }
}

function updateGifTabVisibility() {
  const gifTab = document.querySelector('.tab[data-panel="gif"]');
  const gifPanel = document.getElementById('panel-gif');
  if (!gifTab || !gifPanel) return;

  const shouldShow = Boolean(IS_GIF && CURRENT_BLOB);
  gifTab.classList.toggle('hidden', !shouldShow);
  gifPanel.classList.toggle('hidden', !shouldShow);

  if (!shouldShow && gifTab.classList.contains('active')) {
    setActivePanel('basic');
  }
}

async function setCurrentBlobInternal(blob, options = {}) {
  CURRENT_BLOB = blob || null;
  CURRENT_ANALYSIS = deepClone(options.analysis || CURRENT_ANALYSIS || { is_animated: false, frame_count: 1 });
  IS_GIF = Boolean(options.isGif);

  revokePreviewUrl('current');
  CURRENT = null;

  if (!CURRENT_BLOB) {
    renderEmptyStage();
    updateCompareButtonState();
    updateUndoRedoButtons();
    updateGifTabVisibility();
    return;
  }

  currentUrl = URL.createObjectURL(CURRENT_BLOB);
  CURRENT = currentUrl;
  setStageHint(false);
  loadDataURLToCanvas(CURRENT);
  await refreshInspect();
  updateCompareButtonState();
  updateUndoRedoButtons();
  updateGifTabVisibility();
}

function renderEmptyStage() {
  hideGifPreview();
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }
  setStageHint(true);
  setInfoField('infoFormat', '-');
  setInfoField('infoMode', '-');
  setInfoField('infoDim', '-');
  setInfoField('infoAspect', '-');
  setInfoField('infoSize', '-');
  setInfoField('infoAvg', '-');
  updateExif({});
  updateGifInfoLabel();
  updateGifTabVisibility();
}

function getTaskProgressElements() {
  return {
    shell: document.getElementById('taskProgress'),
    label: document.getElementById('taskProgressLabel'),
    value: document.getElementById('taskProgressValue'),
    track: document.querySelector('#taskProgress .task-progress-track'),
    bar: document.getElementById('taskProgressBar'),
  };
}

function stopTaskProgressTimers() {
  clearInterval(taskProgressTimer);
  clearTimeout(taskProgressHideTimer);
  taskProgressTimer = null;
  taskProgressHideTimer = null;
}

function renderTaskProgress(status = 'working') {
  const { shell, label, value, track, bar } = getTaskProgressElements();
  if (!shell || !label || !value || !track || !bar) return;

  const normalized = Math.max(0, Math.min(100, taskProgressValue));
  shell.classList.remove('is-success', 'is-error');
  if (status === 'success') shell.classList.add('is-success');
  if (status === 'error') shell.classList.add('is-error');
  shell.classList.add('is-visible');
  shell.setAttribute('aria-hidden', 'false');
  label.textContent = taskProgressMessage;
  value.textContent = `${Math.round(normalized)}%`;
  track.setAttribute('aria-valuenow', String(Math.round(normalized)));
  bar.style.width = `${normalized}%`;
}

function hideTaskProgress() {
  stopTaskProgressTimers();
  const { shell, label, value, track, bar } = getTaskProgressElements();
  if (!shell || !label || !value || !track || !bar) return;

  shell.classList.remove('is-visible', 'is-success', 'is-error');
  shell.setAttribute('aria-hidden', 'true');
  taskProgressHideTimer = setTimeout(() => {
    taskProgressValue = 0;
    taskProgressMessage = 'Working...';
    label.textContent = taskProgressMessage;
    value.textContent = '0%';
    track.setAttribute('aria-valuenow', '0');
    bar.style.width = '0%';
  }, 220);
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return null;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  };
  setTimeout(dismiss, 2600);
  return { dismiss };
}

export function showLoadingToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return { dismiss: () => {} };

  const toast = document.createElement('div');
  toast.className = 'toast info is-loading';
  toast.textContent = message;
  container.appendChild(toast);

  return {
    dismiss() {
      if (!toast.isConnected) return;
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    },
  };
}

export function startTaskProgress(message, options = {}) {
  const startAt = Math.max(4, Math.min(35, options.startAt ?? 8));
  const maxAuto = Math.max(startAt + 8, Math.min(96, options.maxAuto ?? 92));
  const intervalMs = Math.max(180, options.intervalMs ?? 280);

  stopTaskProgressTimers();
  taskProgressValue = startAt;
  taskProgressMessage = message || 'Working...';
  renderTaskProgress('working');

  taskProgressTimer = setInterval(() => {
    const remaining = maxAuto - taskProgressValue;
    if (remaining <= 0.35) return;
    taskProgressValue = Math.min(maxAuto, taskProgressValue + Math.max(0.8, remaining * 0.12));
    renderTaskProgress('working');
  }, intervalMs);

  return {
    setMessage(nextMessage) {
      taskProgressMessage = nextMessage || taskProgressMessage;
      renderTaskProgress('working');
    },
    setProgress(nextValue) {
      taskProgressValue = Math.max(0, Math.min(100, nextValue));
      renderTaskProgress('working');
    },
    complete(nextMessage = 'Done') {
      stopTaskProgressTimers();
      taskProgressMessage = nextMessage;
      taskProgressValue = 100;
      renderTaskProgress('success');
      taskProgressHideTimer = setTimeout(() => {
        hideTaskProgress();
      }, 650);
    },
    fail(nextMessage = 'Task failed') {
      stopTaskProgressTimers();
      taskProgressMessage = nextMessage;
      taskProgressValue = Math.max(taskProgressValue, 96);
      renderTaskProgress('error');
      taskProgressHideTimer = setTimeout(() => {
        hideTaskProgress();
      }, 900);
    },
    dismiss() {
      hideTaskProgress();
    },
  };
}

export async function saveState() {
  if (!CURRENT_BLOB) {
    await deleteSession();
    return;
  }

  try {
    await writeSession({
      fileName: FILE_NAME,
      isGif: IS_GIF,
      metadata: cloneMetadata(CURRENT_META),
      originalMetadata: cloneMetadata(ORIGINAL_META),
      analysis: deepClone(CURRENT_ANALYSIS),
      currentBlob: CURRENT_BLOB,
      originalBlob: ORIGINAL_BLOB || CURRENT_BLOB,
    });
  } catch (error) {
    console.warn('Failed to persist session:', error);
  }
}

export async function initStateFromStorage() {
  try {
    const session = await readSession();
    if (!session?.currentBlob) {
      return false;
    }

    FILE_NAME = sanitizeFileName(session.fileName || 'untitled');
    CURRENT_META = cloneMetadata(session.metadata || {});
    ORIGINAL_META = cloneMetadata(session.originalMetadata || session.metadata || {});
    ORIGINAL_BLOB = session.originalBlob || session.currentBlob;
    IS_GIF = Boolean(session.isGif);
    CURRENT_ANALYSIS = deepClone(session.analysis || { is_animated: IS_GIF, frame_count: 1 });

    revokePreviewUrl('original');
    originalUrl = URL.createObjectURL(ORIGINAL_BLOB);
    ORIGINAL = originalUrl;
    await setCurrentBlobInternal(session.currentBlob, {
      isGif: IS_GIF,
      analysis: CURRENT_ANALYSIS,
    });
    HISTORY = [getSnapshot('Restored previous session')];
    FUTURE = [];
    syncFileNameInput();
    setTitle();
    renderHistory();
    syncMetadataEditor();
    updateExif(CURRENT_META);
    queueSaveState();
    return true;
  } catch (error) {
    console.warn('Failed to restore session:', error);
    return false;
  }
}

export function saveOnUnload() {
  window.addEventListener('pagehide', () => {
    saveState();
  });
  window.addEventListener('beforeunload', () => {
    saveState();
  });
}

export function setFileName(name, options = {}) {
  FILE_NAME = sanitizeFileName(name);
  const fileName = document.getElementById('fileName');
  if (fileName) fileName.textContent = FILE_NAME;
  syncFileNameInput();
  setTitle();
  if (!options.skipSave) {
    queueSaveState();
  }
}

export function getFileName() {
  return FILE_NAME;
}

export function getCurrentBlob() {
  return CURRENT_BLOB;
}

export function getCurrentMime() {
  return CURRENT_BLOB?.type || 'image/png';
}

export async function getCurrentDataURL() {
  return CURRENT_BLOB ? blobToDataURL(CURRENT_BLOB) : null;
}

export function getMetadata() {
  return cloneMetadata(CURRENT_META);
}

export function setMetadata(metadata, options = {}) {
  CURRENT_META = cloneMetadata(metadata || {});
  if (options.replaceOriginal) {
    ORIGINAL_META = cloneMetadata(CURRENT_META);
  }
  syncMetadataEditor();
  updateExif(CURRENT_META);
  if (!options.skipSave) {
    queueSaveState();
  }
}

export function setAnimationInfo(info = {}) {
  CURRENT_ANALYSIS = {
    ...CURRENT_ANALYSIS,
    ...deepClone(info),
  };
  updateGifInfoLabel();
  updateGifTabVisibility();
}

export function setIsGif(value) {
  IS_GIF = Boolean(value);
  updateGifInfoLabel();
  updateGifTabVisibility();
}

export async function openEditorBlob(blob, options = {}) {
  if (!blob) {
    bootPreview();
    return;
  }

  setFileName(options.fileName || FILE_NAME, { skipSave: true });
  CURRENT_META = cloneMetadata(options.metadata || {});
  ORIGINAL_META = cloneMetadata(options.originalMetadata || CURRENT_META);
  CURRENT_ANALYSIS = deepClone(options.analysis || {
    is_animated: Boolean(options.isGif),
    frame_count: 1,
  });
  IS_GIF = Boolean(options.isGif);

  revokePreviewUrl('original');
  ORIGINAL_BLOB = blob;
  originalUrl = URL.createObjectURL(ORIGINAL_BLOB);
  ORIGINAL = originalUrl;

  await setCurrentBlobInternal(blob, {
    isGif: IS_GIF,
    analysis: CURRENT_ANALYSIS,
  });

  HISTORY = [];
  FUTURE = [];
  pushHistory(options.historyLabel || `Opened "${FILE_NAME}"`);
  syncMetadataEditor();
  updateExif(CURRENT_META);
  renderHistory();
  queueSaveState();
}

export async function replaceCurrentBlob(blob, options = {}) {
  if (!blob) return;

  if (options.metadata) {
    CURRENT_META = cloneMetadata(options.metadata);
  }

  if (typeof options.isGif === 'boolean') {
    IS_GIF = options.isGif;
  }

  if (options.analysis) {
    CURRENT_ANALYSIS = deepClone(options.analysis);
  } else if (!IS_GIF) {
    CURRENT_ANALYSIS = { is_animated: false, frame_count: 1 };
  }

  await setCurrentBlobInternal(blob, {
    isGif: IS_GIF,
    analysis: CURRENT_ANALYSIS,
  });

  if (options.recordHistory && options.label) {
    pushHistory(options.label);
  } else {
    renderHistory();
  }

  syncMetadataEditor();
  updateExif(CURRENT_META);
  if (options.resetRedo !== false) {
    FUTURE = [];
    updateUndoRedoButtons();
  }
  queueSaveState();
  if (options.recordHistory) {
    dispatchStateChanged('replace');
  }
}

export function pushHistory(label, options = {}) {
  if (!CURRENT_BLOB) return;
  const snapshot = getSnapshot(label);

  if (!options.force && HISTORY.length && HISTORY[HISTORY.length - 1].blob === CURRENT_BLOB) {
    HISTORY[HISTORY.length - 1] = snapshot;
  } else {
    HISTORY.push(snapshot);
    if (HISTORY.length > MAX_HISTORY) {
      HISTORY = HISTORY.slice(HISTORY.length - MAX_HISTORY);
    }
  }

  FUTURE = [];
  renderHistory();
  queueSaveState();
}

export function clearHistory() {
  HISTORY = [];
  FUTURE = [];
  renderHistory();
}

async function restoreSnapshot(snapshot) {
  setFileName(snapshot.fileName || 'untitled', { skipSave: true });
  CURRENT_META = cloneMetadata(snapshot.metadata || {});
  CURRENT_ANALYSIS = deepClone(snapshot.analysis || { is_animated: false, frame_count: 1 });
  IS_GIF = Boolean(snapshot.isGif);
  await setCurrentBlobInternal(snapshot.blob, {
    isGif: IS_GIF,
    analysis: CURRENT_ANALYSIS,
  });
  syncMetadataEditor();
  updateExif(CURRENT_META);
  renderHistory();
  queueSaveState();
  dispatchStateChanged('restore');
}

export async function undo() {
  if (HISTORY.length <= 1) return;
  const current = HISTORY.pop();
  FUTURE.push(current);
  await restoreSnapshot(HISTORY[HISTORY.length - 1]);
}

export async function redo() {
  if (!FUTURE.length) return;
  const snapshot = FUTURE.pop();
  HISTORY.push(snapshot);
  await restoreSnapshot(snapshot);
}

export function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  list.innerHTML = '';
  const currentIndex = HISTORY.length - 1;

  for (let i = HISTORY.length - 1; i >= 0; i -= 1) {
    const item = document.createElement('div');
    item.className = `history-item${i === currentIndex ? ' is-current' : ''}`;
    item.innerHTML = `
      <span class="history-label">${HISTORY[i].label}</span>
      <button class="btn btn-sm" data-idx="${i}">${i === currentIndex ? 'Current' : 'Restore'}</button>
    `;

    const button = item.querySelector('button');
    button.disabled = i === currentIndex;
    button.addEventListener('click', async (event) => {
      const idx = Number(event.currentTarget.dataset.idx);
      const oldHistory = HISTORY.slice();
      HISTORY = oldHistory.slice(0, idx + 1);
      FUTURE = oldHistory.slice(idx + 1).reverse();
      await restoreSnapshot(HISTORY[HISTORY.length - 1]);
      showToast(`Restored "${HISTORY[HISTORY.length - 1].label}"`, 'success');
    });

    list.appendChild(item);
  }

  updateUndoRedoButtons();
  updateCompareButtonState();
  updateGifTabVisibility();
}

export function setCanvasFromImage(img) {
  if (!canvas || !ctx || !dropZone) return;

  const maxW = Math.max(220, dropZone.clientWidth - 24);
  const maxH = Math.max(220, Math.min(window.innerHeight * 0.72, dropZone.clientHeight - 24));
  let width = img.width;
  let height = img.height;
  const ratio = Math.min(maxW / width, maxH / height, 1);

  width = Math.max(1, Math.floor(width * ratio));
  height = Math.max(1, Math.floor(height * ratio));

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
}

export function dataURLFromCanvas() {
  return canvas?.toDataURL('image/png') || '';
}

let gifPreviewImg = null;
let gifPlaying = true;

export function loadDataURLToCanvas(source) {
  hideGifPreview();

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (!source) {
    renderEmptyStage();
    return;
  }

  if (IS_GIF) {
    showGifPreview(source);
    return;
  }

  loadImageFromSource(source)
    .then((img) => {
      if (canvas) canvas.style.display = 'block';
      setCanvasFromImage(img);
    })
    .catch(() => {
      console.error('Failed to load image preview');
    });
}

function showGifPreview(source) {
  const zone = document.getElementById('dropZone');
  if (!zone) return;

  if (canvas) canvas.style.display = 'none';

  let container = document.getElementById('gifPreviewContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'gifPreviewContainer';
    container.className = 'gif-preview-container';
    zone.appendChild(container);
  }

  if (!gifPreviewImg) {
    gifPreviewImg = document.createElement('img');
    gifPreviewImg.id = 'gifPreview';
    gifPreviewImg.className = 'gif-preview';
    container.appendChild(gifPreviewImg);
  }

  let playBtn = document.getElementById('gifPlayPauseBtn');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.id = 'gifPlayPauseBtn';
    playBtn.className = 'btn btn-soft gif-play-btn';
    playBtn.textContent = 'Pause animation';
    playBtn.addEventListener('click', toggleGifPlayback);
    container.appendChild(playBtn);
  }

  gifPlaying = true;
  playBtn.textContent = 'Pause animation';
  playBtn.style.display = 'inline-flex';
  gifPreviewImg.src = source;
  container.style.display = 'flex';
}

function hideGifPreview() {
  const container = document.getElementById('gifPreviewContainer');
  if (container) container.style.display = 'none';
  if (canvas) canvas.style.display = 'block';
  gifPlaying = true;
  const playBtn = document.getElementById('gifPlayPauseBtn');
  if (playBtn) {
    playBtn.textContent = 'Pause animation';
  }
}

function toggleGifPlayback() {
  const playBtn = document.getElementById('gifPlayPauseBtn');
  if (!gifPreviewImg || !playBtn) return;

  if (gifPlaying) {
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = gifPreviewImg.naturalWidth || gifPreviewImg.width;
    frameCanvas.height = gifPreviewImg.naturalHeight || gifPreviewImg.height;
    const frameCtx = frameCanvas.getContext('2d');
    frameCtx.drawImage(gifPreviewImg, 0, 0);
    gifPreviewImg.src = frameCanvas.toDataURL('image/png');
    playBtn.textContent = 'Resume animation';
    gifPlaying = false;
  } else {
    gifPreviewImg.src = CURRENT;
    playBtn.textContent = 'Pause animation';
    gifPlaying = true;
  }
}

export function isGifPlaying() {
  return gifPlaying;
}

export function updateInfo(meta, exif) {
  if (!meta) return;

  setInfoField('infoFormat', meta.format || '-');
  setInfoField('infoMode', meta.mode || '-');
  setInfoField('infoDim', `${meta.width} x ${meta.height}`);
  setInfoField('infoSize', meta.file_size_str || '-');

  if (meta.mean_rgb) {
    const [r, g, b] = meta.mean_rgb;
    const avgEl = document.getElementById('infoAvg');
    if (avgEl) {
      avgEl.innerHTML = `<span class="avg-chip" style="background:rgb(${r}, ${g}, ${b})"></span>rgb(${r}, ${g}, ${b})`;
    }
  }

  const gcd = (a, b) => {
    let x = a;
    let y = b;
    while (y) [x, y] = [y, x % y];
    return x || 1;
  };
  const divisor = gcd(meta.width, meta.height);
  setInfoField('infoAspect', `${meta.width / divisor}:${meta.height / divisor}`);
  ASPECT = meta.width / meta.height;

  const resizeW = document.getElementById('resizeW');
  const resizeH = document.getElementById('resizeH');
  if (resizeW) resizeW.value = meta.width;
  if (resizeH) resizeH.value = meta.height;

  const gifResizeW = document.getElementById('gifResizeW');
  const gifResizeH = document.getElementById('gifResizeH');
  if (gifResizeW) gifResizeW.value = meta.width;
  if (gifResizeH) gifResizeH.value = meta.height;

  const seamSlider = document.getElementById('seamSlider');
  const seamLabel = document.getElementById('seamW');
  if (seamSlider && seamLabel) {
    seamSlider.min = Math.max(10, Math.floor(meta.width * 0.25));
    seamSlider.max = Math.floor(meta.width * 1.5);
    seamSlider.value = meta.width;
    seamLabel.textContent = `${meta.width} px`;
  }

  updateExif(exif || CURRENT_META || {});
  updateGifInfoLabel();
}

export async function refreshInspect() {
  const myToken = ++inspectToken;
  if (!CURRENT_BLOB || !CURRENT) {
    renderEmptyStage();
    return;
  }

  try {
    const img = await loadImageFromSource(CURRENT);
    if (myToken !== inspectToken) return;

    const sampleScale = Math.min(1, 96 / Math.max(img.width, img.height));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = Math.max(1, Math.round(img.width * sampleScale));
    sampleCanvas.height = Math.max(1, Math.round(img.height * sampleScale));
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(img, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      totalR += pixels[i];
      totalG += pixels[i + 1];
      totalB += pixels[i + 2];
      count += 1;
    }

    updateInfo({
      format: formatLabelFromMime(CURRENT_BLOB.type, extensionFromMime(CURRENT_BLOB.type).toUpperCase()),
      mode: CURRENT_BLOB.type === 'image/gif' ? 'Animated' : 'RGBA',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      mean_rgb: count ? [
        Math.round(totalR / count),
        Math.round(totalG / count),
        Math.round(totalB / count),
      ] : [0, 0, 0],
      file_size_str: formatBytes(CURRENT_BLOB.size || 0),
    }, CURRENT_META);
  } catch (error) {
    console.error('Failed to inspect image:', error);
  }
}

export function bootPreview() {
  revokePreviewUrl('current');
  revokePreviewUrl('original');
  CURRENT = null;
  ORIGINAL = null;
  CURRENT_BLOB = null;
  ORIGINAL_BLOB = null;
  CURRENT_META = {};
  ORIGINAL_META = {};
  CURRENT_ANALYSIS = { is_animated: false, frame_count: 1 };
  FILE_NAME = 'untitled';
  HISTORY = [];
  FUTURE = [];
  IS_GIF = false;
  syncFileNameInput();
  setTitle();
  renderEmptyStage();
  renderHistory();
  syncMetadataEditor();
  deleteSession();
  updateGifTabVisibility();
}

export function wireStateUI() {
  const input = document.getElementById('fileNameInput');
  let previousName = FILE_NAME;
  input?.addEventListener('focus', () => {
    previousName = FILE_NAME;
  });
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });
  input?.addEventListener('blur', () => {
    const next = sanitizeFileName(input.value);
    setFileName(next);
    if (CURRENT_BLOB && next !== previousName) {
      pushHistory(`Rename to "${next}"`, { force: true });
      showToast(`Filename updated to ${next}`, 'success');
    }
  });

  document.getElementById('btnUndo')?.addEventListener('click', () => undo());
  document.getElementById('btnRedo')?.addEventListener('click', () => redo());

  const compareButton = document.getElementById('btnCompare');
  const showOriginal = async () => {
    if (!ORIGINAL || !CURRENT_BLOB || !ORIGINAL_BLOB || CURRENT_BLOB === ORIGINAL_BLOB) return;
    loadDataURLToCanvas(ORIGINAL);
    compareButton?.classList.add('is-active');
  };
  const hideOriginal = () => {
    if (!CURRENT) return;
    loadDataURLToCanvas(CURRENT);
    compareButton?.classList.remove('is-active');
  };
  ['mousedown', 'touchstart'].forEach((eventName) => {
    compareButton?.addEventListener(eventName, showOriginal);
  });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'blur'].forEach((eventName) => {
    compareButton?.addEventListener(eventName, hideOriginal);
  });
  window.addEventListener('pointerup', hideOriginal);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!CURRENT || IS_GIF) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      loadDataURLToCanvas(CURRENT);
    }, 120);
  });

  document.addEventListener('keydown', async (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const isMeta = event.ctrlKey || event.metaKey;
    if (!isMeta) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      await undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      await redo();
    }
  });

  updateUndoRedoButtons();
  updateCompareButtonState();
}
