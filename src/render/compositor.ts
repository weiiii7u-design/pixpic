// === Trace — Main Render Compositor (v4: Canvas Ratio + Photo Transform) ===

import { state, updateState } from '../state';
import { renderPartialMode } from '../modes/partial';
import { renderFullMode } from '../modes/full';
import { renderStampMode } from '../modes/stamp';
import { applyEraser } from '../tools/eraser';
import { applyBrush } from '../tools/brush';
import { setupGestureHandlers } from '../tools/gesture';
import type { DrawArea, CanvasRatio } from '../types';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animFrame = 0;
let currentDrawArea: DrawArea = { x: 0, y: 0, w: 0, h: 0 };
let currentCanvasW = 0;
let currentCanvasH = 0;

const RATIO_MAP: Record<CanvasRatio, number | null> = {
  'original': null,
  '1:1': 1,
  '4:5': 4 / 5,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
};

export function initCompositor(canvasEl: HTMLCanvasElement): void {
  canvas = canvasEl;
  ctx = canvas.getContext('2d')!;

  setupInputHandlers(canvas);
  setupGestureHandlers(canvas, () => currentDrawArea, () => ({ w: currentCanvasW, h: currentCanvasH }));
}

export function getCanvasSize(): { w: number; h: number } {
  return { w: currentCanvasW, h: currentCanvasH };
}

function getCanvasAspect(): number {
  const img = state.sourceImage;
  if (!img) return 1;

  const ratioValue = RATIO_MAP[state.canvasRatio];
  if (ratioValue === null) {
    // original: use photo aspect
    return img.naturalWidth / img.naturalHeight;
  }
  return ratioValue;
}

/** Calculate where the photo sits inside the canvas (in CSS pixels).
 *  Photo size is fixed based on its own aspect ratio — it doesn't shrink
 *  when the canvas ratio changes. Only position and scale adjust it. */
function calcPhotoRect(canvasW: number, canvasH: number): DrawArea {
  const img = state.sourceImage;
  if (!img) return { x: 0, y: 0, w: canvasW, h: canvasH };

  const imgAspect = img.naturalWidth / img.naturalHeight;

  // Photo base size: fit to the canvas using contain logic,
  // but the reference is always the photo's own aspect — so changing
  // canvas ratio doesn't resize the photo, it only adds margin.
  let refW: number, refH: number;
  // Calculate what the canvas size would be at 'original' ratio
  // while fitting in the same container dimension (use max of canvasW/canvasH as reference)
  if (imgAspect > canvasW / canvasH) {
    // Container is taller than photo — photo width is the constraint
    refW = canvasW;
    refH = canvasW / imgAspect;
  } else {
    refH = canvasH;
    refW = canvasH * imgAspect;
  }

  const w = refW * state.photoScale;
  const h = refH * state.photoScale;

  // photoX/Y: 0.5 = centered
  const cx = canvasW * state.photoX;
  const cy = canvasH * state.photoY;

  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

function drawCanvasBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (state.mode === 'full') {
    // Full mode: use its background setting
    const { full } = state;
    if (full.background === 'gradient') {
      const rad = (full.bgGradientDirection * Math.PI) / 180;
      const x1 = w / 2 - Math.cos(rad) * w / 2;
      const y1 = h / 2 - Math.sin(rad) * h / 2;
      const x2 = w / 2 + Math.cos(rad) * w / 2;
      const y2 = h / 2 + Math.sin(rad) * h / 2;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, full.bgGradient[0]);
      grad.addColorStop(1, full.bgGradient[1]);
      ctx.fillStyle = grad;
    } else if (full.background === 'solid') {
      ctx.fillStyle = full.bgColor;
    } else {
      ctx.fillStyle = '#ffffff';
    }
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, w, h);
}

export function render(): void {
  if (!canvas || !ctx || !state.sourceImage) return;

  const container = canvas.parentElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Calculate canvas dimensions based on ratio
  const canvasAspect = getCanvasAspect();
  const containerAspect = rect.width / rect.height;

  let canvasW: number, canvasH: number;
  if (canvasAspect > containerAspect) {
    canvasW = rect.width;
    canvasH = rect.width / canvasAspect;
  } else {
    canvasH = rect.height;
    canvasW = rect.height * canvasAspect;
  }

  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  canvas.width = Math.floor(canvasW * dpr);
  canvas.height = Math.floor(canvasH * dpr);
  ctx.scale(dpr, dpr);

  currentCanvasW = canvasW;
  currentCanvasH = canvasH;

  // 1. Draw canvas background
  drawCanvasBackground(ctx, canvasW, canvasH);

  // 2. Calculate photo rect
  const photoRect = calcPhotoRect(canvasW, canvasH);
  currentDrawArea = photoRect;

  // 3. Render mode
  const img = state.sourceImage;

  if (state.mode === 'stamp') {
    // Stamp: photo clipped to photoRect, but stickers can extend to full canvas
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    ctx.clip();
    ctx.drawImage(img, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    ctx.restore();

    // Render stickers
    if (state.subjectAvoid && state.subjectMask) {
      // Offscreen: render stickers → erase subject → composite
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d')!;
      offCtx.scale(dpr, dpr);
      renderStampMode(offCtx, img, photoRect, 1);
      eraseSubjectFromCanvas(offCtx, img, photoRect, canvasW, canvasH);
      ctx.drawImage(offscreen, 0, 0, canvasW, canvasH);
    } else {
      renderStampMode(ctx, img, photoRect, 1);
    }
  } else {
    // Partial/Full: everything clipped to photo rect
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    ctx.clip();

    switch (state.mode) {
      case 'partial':
        renderPartialMode(ctx, img, photoRect);
        break;
      case 'full':
        renderFullMode(ctx, img, photoRect);
        break;
    }

    ctx.restore();
  }
}

export function startRenderLoop(): void {
  function loop(): void {
    render();
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

export function stopRenderLoop(): void {
  cancelAnimationFrame(animFrame);
}

export function exportCanvas(): void {
  if (!canvas || !state.sourceImage) return;

  // Temporarily deselect sticker so selection UI doesn't appear in export
  const savedSelectedId = state.selectedStickerId;
  state.selectedStickerId = null;

  const img = state.sourceImage;
  const canvasAspect = getCanvasAspect();

  // Export at high resolution
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
  let exportW: number, exportH: number;
  if (canvasAspect >= 1) {
    exportW = maxDim;
    exportH = Math.round(maxDim / canvasAspect);
  } else {
    exportH = maxDim;
    exportW = Math.round(maxDim * canvasAspect);
  }

  const exportEl = document.createElement('canvas');
  exportEl.width = exportW;
  exportEl.height = exportH;
  const exportCtx = exportEl.getContext('2d')!;

  // Draw background
  drawCanvasBackground(exportCtx, exportW, exportH);

  // Photo
  const photoRect = calcPhotoRect(exportW, exportH);

  // For stamp mode: render photo first, then stickers separately
  if (state.mode === 'stamp') {
    exportCtx.save();
    exportCtx.beginPath();
    exportCtx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    exportCtx.clip();
    exportCtx.drawImage(img, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    exportCtx.restore();

    // Render stickers: use a temp canvas at export size, sizeScale=1 (canvas IS the export size)
    const stickerCanvas = document.createElement('canvas');
    stickerCanvas.width = exportW;
    stickerCanvas.height = exportH;
    const stickerCtx = stickerCanvas.getContext('2d')!;
    // renderStampMode with sizeScale = exportW / currentCanvasW so sticker dimensions scale up
    renderStampMode(stickerCtx, img, photoRect, exportW / currentCanvasW);

    if (state.subjectAvoid && state.subjectMask) {
      // Erase subject from sticker layer
      eraseSubjectFromCanvas(stickerCtx, img, photoRect, exportW, exportH);
    }

    exportCtx.drawImage(stickerCanvas, 0, 0);
  } else {
    exportCtx.save();
    exportCtx.beginPath();
    exportCtx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    exportCtx.clip();
    switch (state.mode) {
      case 'partial': renderPartialMode(exportCtx, img, photoRect); break;
      case 'full': renderFullMode(exportCtx, img, photoRect); break;
    }
    exportCtx.restore();
  }

  // Restore selection
  state.selectedStickerId = savedSelectedId;

  // Save
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    exportEl.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  } else {
    const link = document.createElement('a');
    link.download = `trace-${state.imageFileName || 'photo'}.png`;
    link.href = exportEl.toDataURL('image/png');
    link.click();
  }
}

/** Erase subject region from a sticker canvas using destination-out */
function eraseSubjectFromCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  photoRect: DrawArea,
  _canvasW: number,
  _canvasH: number
): void {
  const mask = state.subjectMask;
  if (!mask) return;

  const aspect = img.naturalWidth / img.naturalHeight;
  const maskCols = 320;
  const maskRows = Math.round(maskCols / aspect);

  // Build mask image at photoRect size
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = Math.round(photoRect.w);
  maskCanvas.height = Math.round(photoRect.h);
  const maskCtx = maskCanvas.getContext('2d')!;

  const cellW = photoRect.w / maskCols;
  const cellH = photoRect.h / maskRows;
  maskCtx.fillStyle = '#ffffff';
  for (let row = 0; row < maskRows; row++) {
    for (let col = 0; col < maskCols; col++) {
      const idx = row * maskCols + col;
      if (idx < mask.length && mask[idx]) {
        maskCtx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
      }
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(maskCanvas, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
  ctx.restore();
}

function setupInputHandlers(canvasEl: HTMLCanvasElement): void {
  let isPointerDown = false;

  const getCanvasPos = (e: PointerEvent): { x: number; y: number } => {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasEl.width / rect.width) / (window.devicePixelRatio || 1),
      y: (e.clientY - rect.top) * (canvasEl.height / rect.height) / (window.devicePixelRatio || 1),
    };
  };

  canvasEl.addEventListener('pointerdown', (e) => {
    // Retry/cancel segmentation on tap
    if (state.mode === 'partial' && state.partial.target === 'auto') {
      if (state.subjectError) {
        updateState({ subjectError: null, subjectMask: null, subjectLoading: false });
        return;
      }
      if (state.subjectLoading) {
        updateState({ subjectLoading: false, subjectError: '已取消' });
        return;
      }
    }
    if (state.mode === 'stamp' && !state.eraserActive) return; // handled by gesture
    isPointerDown = true;
    handleInteraction(e);
  });

  canvasEl.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    if (state.mode === 'stamp' && !state.eraserActive) return;
    handleInteraction(e);
  });

  canvasEl.addEventListener('pointerup', () => { isPointerDown = false; });
  canvasEl.addEventListener('pointercancel', () => { isPointerDown = false; });

  canvasEl.addEventListener('touchstart', (e) => {
    if (state.mode === 'stamp' || e.touches.length > 1 || state.brushActive || state.eraserActive) {
      e.preventDefault();
    }
  }, { passive: false });
  canvasEl.addEventListener('touchmove', (e) => {
    if (state.mode === 'stamp' || e.touches.length > 1 || state.brushActive || state.eraserActive) {
      e.preventDefault();
    }
  }, { passive: false });

  function handleInteraction(e: PointerEvent): void {
    const pos = getCanvasPos(e);

    if (state.mode === 'partial' && state.partial.target === 'brush' && state.brushActive) {
      applyBrush(pos.x, pos.y, currentDrawArea);
    } else if (state.eraserActive && (state.mode === 'partial' || state.mode === 'full')) {
      applyEraser(pos.x, pos.y, currentDrawArea);
    }
  }
}
