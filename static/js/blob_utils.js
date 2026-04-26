const MIME_BY_EXTENSION = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const EXTENSION_BY_MIME = Object.entries(MIME_BY_EXTENSION)
  .reduce((acc, [ext, mime]) => {
    if (!acc[mime]) acc[mime] = ext;
    return acc;
  }, {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
  });

export function cloneMetadata(metadata) {
  return JSON.parse(JSON.stringify(metadata || {}));
}

export function sanitizeFileName(name) {
  return (name || 'untitled').replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

export function extensionFromMime(mime, fallback = 'png') {
  return EXTENSION_BY_MIME[(mime || '').toLowerCase()] || fallback;
}

export function mimeFromExtension(ext, fallback = 'image/png') {
  return MIME_BY_EXTENSION[(ext || '').toLowerCase()] || fallback;
}

export function formatLabelFromMime(mime, fallback = 'PNG') {
  const ext = extensionFromMime(mime, fallback.toLowerCase());
  return ext.toUpperCase();
}

export function formatBytes(numBytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(numBytes || 0);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(size >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL) {
  const response = await fetch(dataURL);
  return response.blob();
}

export async function fileToDataURL(file) {
  return blobToDataURL(file);
}

export async function loadImageFromSource(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = source;
  });
}

export async function loadImageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImageFromSource(url);
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasToBlob(canvas, mime = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode canvas'));
          return;
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function clampByte(value) {
  return Math.max(0, Math.min(255, value));
}

export function guessMimeFromBytes(bytes, fallback = 'image/png') {
  if (!bytes || bytes.length < 12) return fallback;

  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/tiff';
  }

  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  const box = String.fromCharCode(...bytes.slice(4, 12));
  if (box === 'ftypheic' || box === 'ftypheix' || box === 'ftyphevc' || box === 'ftypheim') {
    return 'image/heic';
  }
  if (box === 'ftypmif1' || box === 'ftypmsf1') {
    return 'image/heif';
  }
  if (box === 'ftypavif' || box === 'ftypavis') {
    return 'image/avif';
  }

  return fallback;
}

export async function detectMimeForFile(file) {
  if (file?.type && file.type !== 'application/octet-stream') {
    return file.type;
  }

  const ext = (file?.name?.split('.').pop() || '').toLowerCase();
  const fromExt = mimeFromExtension(ext, '');
  if (fromExt) return fromExt;

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return guessMimeFromBytes(head, 'image/png');
}

export function isLikelyGifMime(mime, fileName = '') {
  return mime === 'image/gif' || fileName.toLowerCase().endsWith('.gif');
}

export function canEncodeClientSide(format) {
  return ['png', 'jpg', 'jpeg', 'webp'].includes((format || '').toLowerCase());
}
