// === PixPic — Main Render Compositor (v4: Canvas Ratio + Photo Transform) ===

import { state, updateState, subscribe } from '../state';
import { renderPartialMode } from '../modes/partial';
import { renderStampMode } from '../modes/stamp';
import { applyEraser } from '../tools/eraser';
import { setupGestureHandlers } from '../tools/gesture';
import type { DrawArea, CanvasRatio, OverlayShape, OverlayInstance } from '../types';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animFrame = 0;
let renderDirty = true;
let currentDrawArea: DrawArea = { x: 0, y: 0, w: 0, h: 0 };
let currentCanvasW = 0;
let currentCanvasH = 0;
/** Canvas size when no panel is open — the "full" reference size for sticker dimensions */
let referenceCanvasW = 0;
/** Cached offscreen canvas for subject-avoidance rendering */
let offscreenCache: HTMLCanvasElement | null = null;
let offscreenCacheW = 0;
let offscreenCacheH = 0;

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

/** Return the full (panel-closed) canvas size for scale calculations.
 *  When a panel is open the canvas is smaller; sticker default scale
 *  should be computed against the full size so displayScale works correctly. */
export function getReferenceCanvasSize(): { w: number; h: number } {
  const w = referenceCanvasW > 0 ? referenceCanvasW : currentCanvasW;
  // Derive height from width using same aspect ratio
  const h = currentCanvasH > 0 && currentCanvasW > 0
    ? w * (currentCanvasH / currentCanvasW)
    : w;
  return { w, h };
}

export function getPhotoRect(): { w: number; h: number } {
  return { w: currentDrawArea.w, h: currentDrawArea.h };
}

/** Photo rect at full (panel-closed) canvas size */
export function getReferencePhotoRect(): { w: number; h: number } {
  const ref = getReferenceCanvasSize();
  const pr = calcPhotoRect(ref.w, ref.h);
  return { w: pr.w, h: pr.h };
}

/** How much the canvas has shrunk from its full (panel-closed) size.
 *  Used to scale sticker dimensions proportionally. */
export function getStickerDisplayScale(): number {
  if (referenceCanvasW <= 0) return 1;
  return currentCanvasW / referenceCanvasW;
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
  if (state.canvasBgColor && state.canvasRatio !== 'original') {
    // User-selected canvas background color
    ctx.fillStyle = state.canvasBgColor;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, w, h);
}

export function render(): void {
  if (!canvas || !ctx || !state.sourceImage) return;

  const container = canvas.parentElement;
  if (!container) return;

  // Use content box dimensions (subtract padding) to avoid CSS max-width distortion
  const style = getComputedStyle(container);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const padT = parseFloat(style.paddingTop) || 0;
  const padB = parseFloat(style.paddingBottom) || 0;
  const availW = container.clientWidth - padL - padR;
  const availH = container.clientHeight - padT - padB;
  if (availW <= 0 || availH <= 0) return; // Not laid out yet
  const dpr = window.devicePixelRatio || 1;

  // Calculate canvas dimensions based on ratio
  const canvasAspect = getCanvasAspect();
  const containerAspect = availW / availH;

  let canvasW: number, canvasH: number;
  if (canvasAspect > containerAspect) {
    canvasW = availW;
    canvasH = availW / canvasAspect;
  } else {
    canvasH = availH;
    canvasW = availH * canvasAspect;
  }

  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  const newW = Math.floor(canvasW * dpr);
  const newH = Math.floor(canvasH * dpr);
  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width = newW;
    canvas.height = newH;
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  currentCanvasW = canvasW;
  currentCanvasH = canvasH;

  // Track reference (panel-closed) canvas size for sticker scaling
  if (state.activeTool === 'none') {
    referenceCanvasW = canvasW;
  }
  // Ensure reference is always at least as large as current
  if (referenceCanvasW <= 0) {
    referenceCanvasW = canvasW;
  }

  // 1. Draw canvas background
  drawCanvasBackground(ctx, canvasW, canvasH);

  // 2. Calculate photo rect
  const photoRect = calcPhotoRect(canvasW, canvasH);
  currentDrawArea = photoRect;

  // 3. Layered rendering: effect (bottom) + stickers (top)
  const img = state.sourceImage;

  // Layer 1: Photo + effect (clipped to photoRect)
  ctx.save();
  ctx.beginPath();
  ctx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
  ctx.clip();

  if (state.effectMode === 'partial') {
    renderPartialMode(ctx, img, photoRect);
  } else {
    // No effect — just draw photo
    ctx.drawImage(img, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
  }

  ctx.restore();

  // Layer 2: Overlay images (above photo, below stickers)
  if (state.overlayImages.length > 0 || state.selectedOverlayId) {
    renderOverlays(ctx, canvasW, canvasH, 1);
  }

  // Layer 3: Stickers (always rendered, on full canvas)
  if (state.stickers.length > 0 || state.selectedStickerId) {
    const hasAnyAvoid = state.stickers.some(s => s.subjectAvoid) && state.subjectMask;
    if (hasAnyAvoid) {
      // Reuse cached offscreen canvas (avoid creating one every frame)
      if (!offscreenCache || offscreenCacheW !== canvas.width || offscreenCacheH !== canvas.height) {
        offscreenCache = document.createElement('canvas');
        offscreenCacheW = canvas.width;
        offscreenCacheH = canvas.height;
      }
      offscreenCache.width = canvas.width;
      offscreenCache.height = canvas.height;
      const offCtx = offscreenCache.getContext('2d')!;
      offCtx.scale(dpr, dpr);
      renderStampMode(offCtx, img, photoRect, 1);
      // Only erase subject for stickers that have subjectAvoid enabled
      // (eraseSubjectFromCanvas applies to the whole offscreen canvas, which is correct
      //  because stickers without avoid are already composited — we need per-sticker approach)
      // Simple approach: render avoid stickers separately
      offCtx.clearRect(0, 0, canvasW, canvasH);

      // Pass 1: non-avoid stickers directly to main ctx
      const nonAvoid = state.stickers.filter(s => !s.subjectAvoid);
      const avoid = state.stickers.filter(s => s.subjectAvoid);

      if (nonAvoid.length > 0) {
        renderStampMode(ctx, img, photoRect, 1, nonAvoid);
      }

      // Pass 2: avoid stickers on offscreen, erase subject, composite
      if (avoid.length > 0) {
        renderStampMode(offCtx, img, photoRect, 1, avoid);
        eraseSubjectFromCanvas(offCtx, img, photoRect, canvasW, canvasH);
        ctx.drawImage(offscreenCache!, 0, 0, canvasW, canvasH);
      }
    } else {
      renderStampMode(ctx, img, photoRect, 1);
    }
  }
}

export function startRenderLoop(): void {
  subscribe(() => { renderDirty = true; });
  window.addEventListener('resize', () => { renderDirty = true; });
  function loop(): void {
    if (renderDirty) {
      renderDirty = false;
      render();
    }
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

/** Mark render as dirty (call from gesture handlers etc.) */
export function markDirty(): void {
  renderDirty = true;
}

export function stopRenderLoop(): void {
  cancelAnimationFrame(animFrame);
}

export function exportCanvas(): void {
  if (!canvas || !state.sourceImage) return;

  // Temporarily deselect sticker/overlay so selection UI doesn't appear in export
  const savedSelectedId = state.selectedStickerId;
  const savedOverlayId = state.selectedOverlayId;
  state.selectedStickerId = null;
  state.selectedOverlayId = null;

  const img = state.sourceImage;
  const canvasAspect = getCanvasAspect();

  // Export at high resolution (capped to avoid browser canvas limits)
  // iOS Safari: ~16MP max, most browsers: ~32MP
  const MAX_PIXELS = 16_000_000;
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
  let exportW: number, exportH: number;
  if (canvasAspect >= 1) {
    exportW = maxDim;
    exportH = Math.round(maxDim / canvasAspect);
  } else {
    exportH = maxDim;
    exportW = Math.round(maxDim * canvasAspect);
  }

  // Scale down if exceeding pixel limit
  const totalPixels = exportW * exportH;
  if (totalPixels > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / totalPixels);
    exportW = Math.round(exportW * scale);
    exportH = Math.round(exportH * scale);
  }

  const exportEl = document.createElement('canvas');
  exportEl.width = exportW;
  exportEl.height = exportH;
  const exportCtx = exportEl.getContext('2d')!;

  // Draw background
  drawCanvasBackground(exportCtx, exportW, exportH);

  // Photo
  const photoRect = calcPhotoRect(exportW, exportH);

  // Layer 1: Photo + effect (clipped to photoRect)
  exportCtx.save();
  exportCtx.beginPath();
  exportCtx.rect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
  exportCtx.clip();

  if (state.effectMode === 'partial') {
    renderPartialMode(exportCtx, img, photoRect);
  } else {
    exportCtx.drawImage(img, photoRect.x, photoRect.y, photoRect.w, photoRect.h);
  }

  exportCtx.restore();

  // Layer 2: Overlay images
  if (state.overlayImages.length > 0) {
    renderOverlays(exportCtx, exportW, exportH, exportW / (referenceCanvasW > 0 ? referenceCanvasW : currentCanvasW));
  }

  // Layer 3: Stickers (always rendered)
  if (state.stickers.length > 0) {
    const hasAnyAvoid = state.stickers.some(s => s.subjectAvoid) && state.subjectMask;
    // Use referenceCanvasW (full panel-closed size) for correct proportional scaling
    const refW = referenceCanvasW > 0 ? referenceCanvasW : currentCanvasW;
    const stickerScale = exportW / refW;

    if (hasAnyAvoid) {
      const nonAvoid = state.stickers.filter(s => !s.subjectAvoid);
      const avoid = state.stickers.filter(s => s.subjectAvoid);

      if (nonAvoid.length > 0) {
        const sc = document.createElement('canvas');
        sc.width = exportW; sc.height = exportH;
        const sCtx = sc.getContext('2d')!;
        renderStampMode(sCtx, img, photoRect, stickerScale, nonAvoid);
        exportCtx.drawImage(sc, 0, 0);
      }

      if (avoid.length > 0) {
        const sc = document.createElement('canvas');
        sc.width = exportW; sc.height = exportH;
        const sCtx = sc.getContext('2d')!;
        renderStampMode(sCtx, img, photoRect, stickerScale, avoid);
        eraseSubjectFromCanvas(sCtx, img, photoRect, exportW, exportH);
        exportCtx.drawImage(sc, 0, 0);
      }
    } else {
      const stickerCanvas = document.createElement('canvas');
      stickerCanvas.width = exportW;
      stickerCanvas.height = exportH;
      const stickerCtx = stickerCanvas.getContext('2d')!;
      renderStampMode(stickerCtx, img, photoRect, stickerScale);
      exportCtx.drawImage(stickerCanvas, 0, 0);
    }
  }

  // Restore selection
  state.selectedStickerId = savedSelectedId;
  state.selectedOverlayId = savedOverlayId;

  // Add watermark
  const wmSize = Math.max(14, Math.round(exportW * 0.018));
  exportCtx.save();
  exportCtx.font = `${wmSize}px "JetBrains Mono", monospace`;
  exportCtx.textAlign = 'right';
  exportCtx.textBaseline = 'bottom';
  exportCtx.globalAlpha = 0.4;
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillText('pixpic', exportW - wmSize * 0.8, exportH - wmSize * 0.6);
  exportCtx.fillStyle = '#000000';
  exportCtx.fillText('pixpic', exportW - wmSize * 0.8 - 1, exportH - wmSize * 0.6 - 1);
  exportCtx.restore();

  // Save
  const fileName = `pixpic-${state.imageFileName || 'photo'}.png`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    exportEl.toBlob(async (blob) => {
      if (!blob) return;
      // Try Web Share API first (works reliably on iOS Safari)
      if (navigator.share && navigator.canShare?.({ files: [new File([], '')] })) {
        const file = new File([blob], fileName, { type: 'image/png' });
        try {
          await navigator.share({ files: [file] });
          return;
        } catch { /* User cancelled or not supported, fall through */ }
      }
      // Fallback: create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  } else {
    const link = document.createElement('a');
    link.download = fileName;
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

/** Render overlay images with shape clipping */
function renderOverlays(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  sizeScale: number
): void {
  const displayScale = sizeScale === 1 ? getStickerDisplayScale() : 1;

  for (const overlay of state.overlayImages) {
    const imgW = overlay.image.naturalWidth;
    const imgH = overlay.image.naturalHeight;
    if (imgW === 0 || imgH === 0) continue;

    // Default size: ~40% of canvas width, maintaining aspect ratio
    const baseW = canvasW * 0.4 * overlay.scale * displayScale * sizeScale;
    const baseH = baseW * (imgH / imgW);

    const px = overlay.x * canvasW;
    const py = overlay.y * canvasH;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((overlay.rotation * Math.PI) / 180);
    ctx.globalAlpha = overlay.opacity ?? 1;

    // Apply shape clip
    applyShapeClip(ctx, overlay.shape, baseW, baseH);
    ctx.drawImage(overlay.image, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();

    // Draw selection controls
    if (sizeScale === 1 && overlay.id === state.selectedOverlayId) {
      drawOverlayControls(ctx, overlay, canvasW, canvasH, baseW, baseH);
    }
  }
}

/** Get overlay dimensions for hit testing */
export function getOverlayDimensions(overlay: OverlayInstance, canvasW: number, _canvasH: number): { w: number; h: number } {
  const imgW = overlay.image.naturalWidth;
  const imgH = overlay.image.naturalHeight;
  if (imgW === 0) return { w: 0, h: 0 };
  const displayScale = getStickerDisplayScale();
  const baseW = canvasW * 0.4 * overlay.scale * displayScale;
  const baseH = baseW * (imgH / imgW);
  return { w: baseW, h: baseH };
}

/** Apply geometric shape as clip path */
function applyShapeClip(ctx: CanvasRenderingContext2D, shape: OverlayShape, w: number, h: number): void {
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.rect(-w / 2, -h / 2, w, h);
      break;
    case 'roundedSquare':
      ctx.roundRect(-w / 2, -h / 2, w, h, r * 0.3);
      break;
    case 'heart': {
      const s = r * 0.9;
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s * 0.1, -s * 0.1, -s, -s * 0.4, -s * 0.5, -s * 0.8);
      ctx.bezierCurveTo(-s * 0.1, -s * 1.1, 0, -s * 0.8, 0, -s * 0.5);
      ctx.bezierCurveTo(0, -s * 0.8, s * 0.1, -s * 1.1, s * 0.5, -s * 0.8);
      ctx.bezierCurveTo(s, -s * 0.4, s * 0.1, -s * 0.1, 0, s * 0.4);
      break;
    }
    case 'star': {
      const outerR = r;
      const innerR = r * 0.4;
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? outerR : innerR;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(0, h / 2);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      break;
    }
    case 'rectangle': {
      // 16:9 landscape rectangle
      const rw = Math.min(w, h) * (16 / 9) * 0.5;
      const rh = Math.min(w, h) * 0.5;
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 4);
      break;
    }
  }
  ctx.clip();
}

/** Draw selection border + controls for selected overlay */
function drawOverlayControls(
  ctx: CanvasRenderingContext2D,
  overlay: OverlayInstance,
  canvasW: number,
  canvasH: number,
  w: number,
  h: number
): void {
  const px = overlay.x * canvasW;
  const py = overlay.y * canvasH;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((overlay.rotation * Math.PI) / 180);

  // Dashed selection border
  ctx.strokeStyle = '#CDFF48';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);

  const btnR = 12;

  // Delete button (top-left)
  const delX = -w / 2;
  const delY = -h / 2;
  ctx.beginPath();
  ctx.arc(delX, delY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const cs = 5;
  ctx.beginPath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.moveTo(delX - cs, delY - cs);
  ctx.lineTo(delX + cs, delY + cs);
  ctx.moveTo(delX + cs, delY - cs);
  ctx.lineTo(delX - cs, delY + cs);
  ctx.stroke();

  // Rotate handle (bottom-right)
  const rotX = w / 2;
  const rotY = h / 2;
  ctx.beginPath();
  ctx.arc(rotX, rotY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(rotX, rotY, 5, -Math.PI * 0.8, Math.PI * 0.5);
  ctx.stroke();

  // Resize handle (top-right)
  const hs = 10;
  ctx.fillStyle = '#CDFF48';
  ctx.strokeStyle = '#0B0B0B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(w / 2 - hs / 2, -h / 2 - hs / 2, hs, hs, 3);
  ctx.fill();
  ctx.stroke();

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
    if (state.effectMode === 'partial') {
      if (state.subjectError) {
        updateState({ subjectError: null, subjectMask: null, subjectLoading: false });
        return;
      }
      if (state.subjectLoading) {
        updateState({ subjectLoading: false, subjectError: '已取消' });
        return;
      }
    }
    if (state.activeTool === 'sticker' && !state.eraserActive) return; // handled by gesture
    isPointerDown = true;
    handleInteraction(e);
  });

  canvasEl.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    if (state.activeTool === 'sticker' && !state.eraserActive) return;
    handleInteraction(e);
  });

  canvasEl.addEventListener('pointerup', () => { isPointerDown = false; });
  canvasEl.addEventListener('pointercancel', () => { isPointerDown = false; });

  canvasEl.addEventListener('touchstart', (e) => {
    if (state.activeTool === 'sticker' || e.touches.length > 1 || state.eraserActive) {
      e.preventDefault();
    }
  }, { passive: false });
  canvasEl.addEventListener('touchmove', (e) => {
    if (state.activeTool === 'sticker' || e.touches.length > 1 || state.eraserActive) {
      e.preventDefault();
    }
  }, { passive: false });

  function handleInteraction(e: PointerEvent): void {
    const pos = getCanvasPos(e);

    if (state.eraserActive && state.effectMode === 'partial') {
      applyEraser(pos.x, pos.y, currentDrawArea);
    }
  }
}
