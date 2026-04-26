import {
  canvasToBlob,
  clampByte,
  loadImageFromBlob,
  makeCanvas,
  mimeFromExtension,
} from './blob_utils.js';

function smoothingForMethod(ctx, method) {
  const key = (method || 'lanczos').toLowerCase();
  ctx.imageSmoothingEnabled = key !== 'nearest';
  ctx.imageSmoothingQuality = key === 'bilinear' ? 'medium' : 'high';
}

function withAlpha(data, mutate) {
  for (let i = 0; i < data.length; i += 4) {
    mutate(data, i);
  }
}

function applyKernel(imageData, kernel, divisor = 1, bias = 0) {
  const { width, height, data } = imageData;
  const source = new Uint8ClampedArray(data);
  const side = Math.sqrt(kernel.length);
  const half = Math.floor(side / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let ky = 0; ky < side; ky += 1) {
        for (let kx = 0; kx < side; kx += 1) {
          const px = Math.min(width - 1, Math.max(0, x + kx - half));
          const py = Math.min(height - 1, Math.max(0, y + ky - half));
          const srcIndex = (py * width + px) * 4;
          const weight = kernel[ky * side + kx];
          r += source[srcIndex] * weight;
          g += source[srcIndex + 1] * weight;
          b += source[srcIndex + 2] * weight;
        }
      }

      data[index] = clampByte(r / divisor + bias);
      data[index + 1] = clampByte(g / divisor + bias);
      data[index + 2] = clampByte(b / divisor + bias);
    }
  }

  return imageData;
}

function applyMedian(imageData, size = 3) {
  const { width, height, data } = imageData;
  const source = new Uint8ClampedArray(data);
  const radius = Math.max(1, Math.floor(size / 2));
  const bucketR = [];
  const bucketG = [];
  const bucketB = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      bucketR.length = 0;
      bucketG.length = 0;
      bucketB.length = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        for (let kx = -radius; kx <= radius; kx += 1) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const srcIndex = (py * width + px) * 4;
          bucketR.push(source[srcIndex]);
          bucketG.push(source[srcIndex + 1]);
          bucketB.push(source[srcIndex + 2]);
        }
      }
      bucketR.sort((a, b) => a - b);
      bucketG.sort((a, b) => a - b);
      bucketB.sort((a, b) => a - b);
      const mid = Math.floor(bucketR.length / 2);
      const index = (y * width + x) * 4;
      data[index] = bucketR[mid];
      data[index + 1] = bucketG[mid];
      data[index + 2] = bucketB[mid];
    }
  }

  return imageData;
}

function applyPosterize(imageData, bits) {
  const shift = 8 - Math.max(1, Math.min(8, bits));
  withAlpha(imageData.data, (data, i) => {
    data[i] = (data[i] >> shift) << shift;
    data[i + 1] = (data[i + 1] >> shift) << shift;
    data[i + 2] = (data[i + 2] >> shift) << shift;
  });
  return imageData;
}

function applySolarize(imageData, threshold) {
  withAlpha(imageData.data, (data, i) => {
    data[i] = data[i] > threshold ? 255 - data[i] : data[i];
    data[i + 1] = data[i + 1] > threshold ? 255 - data[i + 1] : data[i + 1];
    data[i + 2] = data[i + 2] > threshold ? 255 - data[i + 2] : data[i + 2];
  });
  return imageData;
}

function applyGammaAndTemperature(imageData, gamma = 1, temperature = 0) {
  const lut = gamma && Math.abs(gamma - 1) > 0.001
    ? Array.from({ length: 256 }, (_, value) => clampByte(((value / 255) ** (1 / gamma)) * 255))
    : null;
  const tempShift = (temperature / 100) * 28;

  withAlpha(imageData.data, (data, i) => {
    if (lut) {
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
    if (Math.abs(tempShift) > 0.1) {
      data[i] = clampByte(data[i] + tempShift);
      data[i + 2] = clampByte(data[i + 2] - tempShift);
    }
  });

  return imageData;
}

function buildFilterString(values) {
  const parts = [];
  if (Math.abs((values.brightness ?? 1) - 1) > 0.001) {
    parts.push(`brightness(${Math.max(0, values.brightness)})`);
  }
  if (Math.abs((values.contrast ?? 1) - 1) > 0.001) {
    parts.push(`contrast(${Math.max(0, values.contrast)})`);
  }
  if (Math.abs((values.saturation ?? 1) - 1) > 0.001) {
    parts.push(`saturate(${Math.max(0, values.saturation)})`);
  }
  if (Math.abs(values.hue || 0) > 0.001) {
    parts.push(`hue-rotate(${values.hue}deg)`);
  }
  if (values.grayscale) parts.push('grayscale(1)');
  if (values.sepia) parts.push('sepia(1)');
  if (values.invert) parts.push('invert(1)');
  if (values.gaussian) {
    parts.push(`blur(${Math.max(0, values.gaussian_radius || 1.5)}px)`);
  }
  return parts.length ? parts.join(' ') : 'none';
}

async function renderBase(blob, options = {}) {
  const img = await loadImageFromBlob(blob);
  const canvas = makeCanvas(options.width || img.width, options.height || img.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (options.filter) {
    ctx.filter = options.filter;
  }
  if (options.smoothingMethod) {
    smoothingForMethod(ctx, options.smoothingMethod);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  return { canvas, ctx, img };
}

export async function rotateBlob(blob, degrees, expand = true) {
  const img = await loadImageFromBlob(blob);
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = expand ? img.width * cos + img.height * sin : img.width;
  const height = expand ? img.width * sin + img.height * cos : img.height;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvasToBlob(canvas, 'image/png');
}

export async function flipBlob(blob, axis) {
  const img = await loadImageFromBlob(blob);
  const canvas = makeCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.translate(axis === 'h' ? img.width : 0, axis === 'v' ? img.height : 0);
  ctx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

export async function resizeBlob(blob, width, height, keepAspect = true, method = 'lanczos') {
  const img = await loadImageFromBlob(blob);
  let targetW = Math.max(1, Math.round(width || img.width));
  let targetH = Math.max(1, Math.round(height || img.height));
  if (keepAspect) {
    const ratio = img.width / img.height;
    if (width && !height) {
      targetH = Math.round(targetW / ratio);
    } else if (height && !width) {
      targetW = Math.round(targetH * ratio);
    } else {
      const scale = Math.min(targetW / img.width, targetH / img.height);
      targetW = Math.max(1, Math.round(img.width * scale));
      targetH = Math.max(1, Math.round(img.height * scale));
    }
  }

  const canvas = makeCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  smoothingForMethod(ctx, method);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvasToBlob(canvas, 'image/png');
}

export async function cropCanvasToBlob(canvas) {
  return canvasToBlob(canvas, 'image/png');
}

export async function convertBlob(blob, format, quality = 92) {
  const ext = (format || 'png').toLowerCase();
  const mime = mimeFromExtension(ext);
  const img = await loadImageFromBlob(blob);
  const canvas = makeCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');

  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, mime, Math.max(0.1, Math.min(1, quality / 100)));
}

export async function adjustBlob(blob, values) {
  const filter = buildFilterString(values);
  const { canvas, ctx } = await renderBase(blob, { filter });
  if (Math.abs((values.gamma ?? 1) - 1) > 0.001 || Math.abs(values.temperature || 0) > 0.1) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyGammaAndTemperature(imageData, values.gamma ?? 1, values.temperature ?? 0);
    ctx.putImageData(imageData, 0, 0);
  }
  return canvasToBlob(canvas, 'image/png');
}

export async function filterBlob(blob, values) {
  const filter = buildFilterString(values);
  const { canvas, ctx } = await renderBase(blob, { filter });
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (values.median) {
    imageData = applyMedian(imageData, values.median_size || 3);
  }
  if (values.sharpen) {
    imageData = applyKernel(imageData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
  }
  if (values.edge) {
    imageData = applyKernel(imageData, [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1, 128);
  }
  if (values.emboss) {
    imageData = applyKernel(imageData, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128);
  }
  if (values.contour) {
    imageData = applyKernel(imageData, [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1, 96);
  }
  if (values.smooth) {
    imageData = applyKernel(imageData, [1, 1, 1, 1, 5, 1, 1, 1, 1], 13);
  }
  if ((values.posterize || 0) > 0) {
    imageData = applyPosterize(imageData, values.posterize);
  }
  if ((values.solarize || 0) > 0) {
    imageData = applySolarize(imageData, values.solarize);
  }
  ctx.putImageData(imageData, 0, 0);

  if ((values.pixelate || 1) > 1) {
    const pixelSize = Math.max(1, Number(values.pixelate));
    const source = makeCanvas(canvas.width, canvas.height);
    source.getContext('2d').drawImage(canvas, 0, 0);
    const tiny = makeCanvas(
      Math.max(1, Math.round(canvas.width / pixelSize)),
      Math.max(1, Math.round(canvas.height / pixelSize))
    );
    const tinyCtx = tiny.getContext('2d');
    tinyCtx.imageSmoothingEnabled = false;
    tinyCtx.drawImage(source, 0, 0, tiny.width, tiny.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
  }

  return canvasToBlob(canvas, 'image/png');
}

export async function autoEnhanceBlob(blob) {
  const { canvas, ctx } = await renderBase(blob);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const lows = [255, 255, 255];
  const highs = [0, 0, 0];

  withAlpha(data, (pixels, i) => {
    lows[0] = Math.min(lows[0], pixels[i]);
    lows[1] = Math.min(lows[1], pixels[i + 1]);
    lows[2] = Math.min(lows[2], pixels[i + 2]);
    highs[0] = Math.max(highs[0], pixels[i]);
    highs[1] = Math.max(highs[1], pixels[i + 1]);
    highs[2] = Math.max(highs[2], pixels[i + 2]);
  });

  withAlpha(data, (pixels, i) => {
    for (let channel = 0; channel < 3; channel += 1) {
      const low = lows[channel];
      const high = highs[channel];
      const range = Math.max(1, high - low);
      pixels[i + channel] = clampByte(((pixels[i + channel] - low) / range) * 255);
    }
  });

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

export async function histEqualizeBlob(blob) {
  const { canvas, ctx } = await renderBase(blob);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Array(256).fill(0);
  const { data } = imageData;

  withAlpha(data, (pixels, i) => {
    const y = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    histogram[y] += 1;
  });

  const cdf = new Array(256).fill(0);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i += 1) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }
  const first = cdf.find((value) => value > 0) || 0;
  const total = cdf[255] || 1;

  withAlpha(data, (pixels, i) => {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const mapped = clampByte(((cdf[y] - first) / Math.max(1, total - first)) * 255);
    const scale = y ? mapped / y : 1;
    pixels[i] = clampByte(r * scale);
    pixels[i + 1] = clampByte(g * scale);
    pixels[i + 2] = clampByte(b * scale);
  });

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

export async function vignetteBlob(blob, strength = 0.5) {
  const { canvas, ctx } = await renderBase(blob);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const idx = (y * canvas.width + x) * 4;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxDist;
      const factor = Math.max(0, 1 - (dist ** 2) * strength);
      data[idx] = clampByte(data[idx] * factor);
      data[idx + 1] = clampByte(data[idx + 1] * factor);
      data[idx + 2] = clampByte(data[idx + 2] * factor);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

export async function addBorderBlob(blob, size, color) {
  const img = await loadImageFromBlob(blob);
  const border = Math.max(1, Math.round(size));
  const canvas = makeCanvas(img.width + border * 2, img.height + border * 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color || '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, border, border);
  return canvasToBlob(canvas, 'image/png');
}

export async function addWatermarkBlob(blob, options) {
  const img = await loadImageFromBlob(blob);
  const canvas = makeCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const text = (options.text || '').trim();
  if (!text) {
    return canvasToBlob(canvas, 'image/png');
  }

  const fontSize = Math.max(14, Math.round(Math.min(img.width, img.height) / 18));
  ctx.font = `600 ${fontSize}px "Space Grotesk", sans-serif`;
  ctx.globalAlpha = Math.max(0.1, Math.min(1, options.opacity || 0.5));
  ctx.fillStyle = options.color || '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(2, fontSize * 0.08);
  ctx.textBaseline = 'top';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.1;
  const pad = Math.max(16, Math.round(fontSize * 0.6));
  const positions = {
    'top-left': [pad, pad],
    'top-right': [canvas.width - textWidth - pad, pad],
    'bottom-left': [pad, canvas.height - textHeight - pad],
    'bottom-right': [canvas.width - textWidth - pad, canvas.height - textHeight - pad],
    center: [(canvas.width - textWidth) / 2, (canvas.height - textHeight) / 2],
  };
  const [x, y] = positions[options.position] || positions['bottom-right'];
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
  return canvasToBlob(canvas, 'image/png');
}
