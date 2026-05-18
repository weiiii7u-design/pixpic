// === Trace — Segmentation (hybrid: server API for mobile, local WASM for desktop) ===
// Optimized: downscale before inference, medium model, compact mask resolution.

import { removeBackground } from '@imgly/background-removal';

let cachedMask: boolean[] | null = null;
let cachedImageSrc: string | null = null;
let cachedCols = 0;
let cachedRows = 0;

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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

  const mask = isMobile
    ? await segmentViaServer(image, cols, rows)
    : await segmentLocal(image, cols, rows);

  cachedMask = mask;
  cachedImageSrc = image.src;
  cachedCols = cols;
  cachedRows = rows;
  return mask;
}

// === Server-side segmentation (mobile) ===
async function segmentViaServer(
  image: HTMLImageElement,
  cols: number,
  rows: number
): Promise<boolean[]> {
  console.log('[Trace] Using server-side segmentation...');

  // Downscale before sending to server
  const blob = await imageToBlob(image, MAX_INPUT_DIM);
  console.log(`[Trace] Sending ${(blob.size / 1024).toFixed(0)}KB to server`);

  const res = await fetch(`/api/segment?cols=${cols}&rows=${rows}`, {
    method: 'POST',
    body: blob,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '服务端识别失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return data.mask as boolean[];
  } else {
    const resultBlob = await res.blob();
    return decodeMaskFromPng(resultBlob, cols, rows);
  }
}

// === Local WASM segmentation (desktop) ===
async function segmentLocal(
  image: HTMLImageElement,
  cols: number,
  rows: number
): Promise<boolean[]> {
  console.log('[Trace] Using local WASM segmentation...');

  // Downscale before model inference — huge speedup
  const blob = await imageToBlob(image, MAX_INPUT_DIM);
  console.log(`[Trace] Input image: ${(blob.size / 1024).toFixed(0)}KB`);

  const t0 = performance.now();

  const resultBlob = await removeBackground(blob, {
    model: 'medium' as any,  // isnet_fp16 — good balance of speed & quality
    device: 'cpu',
    progress: (key: string, current: number, total: number) => {
      console.log(`[Trace segmentation] ${key}: ${current}/${total}`);
    }
  });

  console.log(`[Trace] Segmentation done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  return decodeMaskFromPng(resultBlob, cols, rows);
}

// === Helpers ===

/** Convert image to blob, downscaling longest edge to maxDim */
async function imageToBlob(image: HTMLImageElement, maxDim: number): Promise<Blob> {
  let w = image.naturalWidth;
  let h = image.naturalHeight;

  // Downscale if needed
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
    }, 'image/jpeg', 0.85);  // JPEG is much smaller than PNG
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
