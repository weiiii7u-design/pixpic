// === Trace — Segmentation (local WASM, works on all devices including mobile) ===
// Uses @imgly/background-removal running entirely in the browser.

import { removeBackground } from '@imgly/background-removal';

let cachedMask: boolean[] | null = null;
let cachedImageSrc: string | null = null;
let cachedCols = 0;
let cachedRows = 0;

// Max image dimension sent to the model — larger is wasted compute
const MAX_INPUT_DIM = 1024;

export async function segmentSubject(
  image: HTMLImageElement,
  cols: number,
  rows: number
): Promise<boolean[]> {
  if (cachedImageSrc === image.src && cachedCols === cols && cachedRows === rows && cachedMask) {
    return cachedMask;
  }

  const mask = await segmentLocal(image, cols, rows);

  cachedMask = mask;
  cachedImageSrc = image.src;
  cachedCols = cols;
  cachedRows = rows;
  return mask;
}

// === Local WASM segmentation (works on all devices) ===
async function segmentLocal(
  image: HTMLImageElement,
  cols: number,
  rows: number
): Promise<boolean[]> {
  console.log('[pixpic] Running segmentation in browser...');

  // Downscale before model inference — huge speedup
  const blob = await imageToBlob(image, MAX_INPUT_DIM);
  console.log(`[pixpic] Input image: ${(blob.size / 1024).toFixed(0)}KB`);

  const t0 = performance.now();

  const resultBlob = await removeBackground(blob, {
    model: 'medium' as any,
    device: 'cpu',
    progress: (key: string, current: number, total: number) => {
      console.log(`[pixpic segmentation] ${key}: ${current}/${total}`);
    }
  });

  console.log(`[pixpic] Segmentation done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  return decodeMaskFromPng(resultBlob, cols, rows);
}

// === Helpers ===

/** Convert image to blob, downscaling longest edge to maxDim */
async function imageToBlob(image: HTMLImageElement, maxDim: number): Promise<Blob> {
  let w = image.naturalWidth;
  let h = image.naturalHeight;

  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('无法转换图片'));
    }, 'image/jpeg', 0.85);
  });
}

async function decodeMaskFromPng(blob: Blob, cols: number, rows: number): Promise<boolean[]> {
  const resultUrl = URL.createObjectURL(blob);
  const resultImg = new Image();
  await new Promise<void>((resolve, reject) => {
    resultImg.onload = () => resolve();
    resultImg.onerror = () => reject(new Error('处理结果图片失败'));
    resultImg.src = resultUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(resultImg, 0, 0, cols, rows);

  const imageData = ctx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;
  const mask: boolean[] = [];

  for (let i = 0; i < cols * rows; i++) {
    mask[i] = pixels[i * 4 + 3] > 128;
  }

  URL.revokeObjectURL(resultUrl);
  return mask;
}

export function getCachedMask(): boolean[] | null {
  return cachedMask;
}

export function invalidateCache(): void {
  cachedMask = null;
  cachedImageSrc = null;
}
