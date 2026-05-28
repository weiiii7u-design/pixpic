// === Trace — Partial Mode (ASCII on part of photo, using AI subject detection) ===

import { state, updateState } from '../state';
import { getCharset } from '../core/ascii';
import { renderSymbolsGrid } from '../core/symbols';
import { segmentSubject } from '../core/segmentation';
import { getPalette } from '../core/shapes';
import type { DrawArea } from '../types';

// Reusable offscreen canvas for sampling (avoids GC pressure)
let _partialSampleCanvas: HTMLCanvasElement | null = null;
let _partialSampleCtx: CanvasRenderingContext2D | null = null;

function getPartialSampleCanvas(w: number, h: number): CanvasRenderingContext2D {
  if (!_partialSampleCanvas) {
    _partialSampleCanvas = document.createElement('canvas');
    _partialSampleCtx = _partialSampleCanvas.getContext('2d')!;
  }
  if (_partialSampleCanvas.width !== w || _partialSampleCanvas.height !== h) {
    _partialSampleCanvas.width = w;
    _partialSampleCanvas.height = h;
  }
  return _partialSampleCtx!;
}

// Fixed resolution for subject mask — independent of render grid
const MASK_RESOLUTION = 320;

export function renderPartialMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  const { partial } = state;

  // 1. Background layer: draw photo if bgImageEnabled, otherwise solid color
  if (partial.bgImageEnabled) {
    ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h);
  } else {
    ctx.fillStyle = state.canvasBgColor || '#000000';
    ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
  }

  // 2. Segmentation mask (only if segEnabled)
  let mask: boolean[] | null = null;

  if (partial.segEnabled) {
    // If loading or error, show photo with overlay indicator
    if (state.subjectError) {
      renderErrorOverlay(ctx, drawArea);
      return;
    }

    if (state.subjectLoading) {
      renderLoadingOverlay(ctx, drawArea);
      return;
    }

    if (!state.subjectMask) {
      // Auto-trigger segmentation silently
      triggerSegmentation(sourceImg);
      renderLoadingOverlay(ctx, drawArea);
      return;
    }

    mask = mapMaskToGrid(state.subjectMask, partial, drawArea);
  }
  // If segEnabled is false, mask stays null → effect renders on entire image

  // 3. Render effect layer
  switch (partial.effect) {
    case 'ascii':
      renderPartialAscii(ctx, sourceImg, drawArea, mask);
      break;
    case 'symbols':
      renderPartialSymbols(ctx, sourceImg, drawArea, mask);
      break;
  }
}

/**
 * Map the fixed-resolution subject mask to the current render grid.
 * The subject mask is always MASK_RESOLUTION x MASK_RESOLUTION.
 * We need to map it to whatever grid the current effect uses.
 */
function mapMaskToGrid(
  subjectMask: boolean[],
  partial: typeof state.partial,
  drawArea: DrawArea
): boolean[] {
  const aspect = drawArea.w / drawArea.h;
  const maskCols = MASK_RESOLUTION;
  const maskRows = Math.round(MASK_RESOLUTION / aspect);

  // Calculate target grid dimensions based on effect type
  let targetCols: number, targetRows: number;

  if (partial.effect === 'ascii') {
    targetCols = partial.density;
    const cellW = drawArea.w / targetCols;
    const cellH = cellW * 1.8;
    targetRows = Math.floor(drawArea.h / cellH);
  } else {
    // symbols: use 1.8x vertical spacing (matching renderSymbolsGrid)
    targetCols = partial.density;
    const cellSize = drawArea.w / targetCols;
    const rowSpacing = cellSize * 1.8;
    targetRows = Math.floor(drawArea.h / rowSpacing);
  }

  const result: boolean[] = [];

  for (let row = 0; row < targetRows; row++) {
    for (let col = 0; col < targetCols; col++) {
      // Map target grid position to mask position
      const maskCol = Math.floor((col / targetCols) * maskCols);
      const maskRow = Math.floor((row / targetRows) * maskRows);
      const maskIdx = maskRow * maskCols + maskCol;

      const isSubject = maskIdx < subjectMask.length ? subjectMask[maskIdx] : false;

      // Default: ASCII on background (NOT subject). Invert flips it.
      result.push(partial.invert ? isSubject : !isSubject);
    }
  }

  return result;
}

export async function triggerSegmentation(sourceImg: HTMLImageElement): Promise<void> {
  if (state.subjectLoading) return;
  updateState({ subjectLoading: true, subjectError: null });

  // Always segment at fixed resolution (independent of render grid)
  const aspect = sourceImg.naturalWidth / sourceImg.naturalHeight;
  const cols = MASK_RESOLUTION;
  const rows = Math.round(MASK_RESOLUTION / aspect);

  try {
    const mask = await segmentSubject(sourceImg, cols, rows);
    updateState({ subjectMask: mask, subjectLoading: false, subjectError: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '识别失败';
    console.error('[Trace] Segmentation failed:', msg);
    updateState({
      subjectMask: null,
      subjectLoading: false,
      subjectError: msg,
    });
  }
}

function renderLoadingOverlay(ctx: CanvasRenderingContext2D, drawArea: DrawArea): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dots = '.'.repeat(Math.floor(Date.now() / 500) % 4);
  ctx.fillText(`正在识别主体${dots}`, drawArea.x + drawArea.w / 2, drawArea.y + drawArea.h / 2);
}

function renderErrorOverlay(ctx: CanvasRenderingContext2D, drawArea: DrawArea): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('识别失败，点击重试', drawArea.x + drawArea.w / 2, drawArea.y + drawArea.h / 2);
}

function renderPartialAscii(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea,
  mask: boolean[] | null
): void {
  const { partial } = state;

  if (partial.colorMode === 'multi') {
    // Multi-color: render ASCII with random palette colors per character
    renderMultiColorAscii(ctx, sourceImg, drawArea, mask);
  } else {
    // Mono: always use monoColor directly via custom rendering
    renderMonoColorAscii(ctx, sourceImg, drawArea, mask);
  }
}

/** Render ASCII in a single user-chosen color */
function renderMonoColorAscii(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea,
  mask: boolean[] | null
): void {
  const { partial } = state;
  const chars = getCharset(partial.charset, partial.customCharset);

  const cols = partial.density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;
  const rows = Math.floor(drawArea.h / cellH);

  const sCtx = getPartialSampleCanvas(cols, rows);
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  ctx.globalAlpha = (partial.opacity || 100) / 100;

  const sizeScale = (partial.size || 100) / 100;
  const fontSize = Math.max(cellW * 1.2 * sizeScale, 4);
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = partial.monoColor;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (mask !== null && !mask[idx]) continue;
      if (state.eraserMask !== null && state.eraserMask[idx]) continue;

      const pixIdx = idx * 4;
      const r = pixels[pixIdx], g = pixels[pixIdx + 1], b = pixels[pixIdx + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      const charIdx = Math.min(chars.length - 1, Math.floor(lum * chars.length));
      const char = chars[charIdx] || '.';

      const cx = drawArea.x + col * cellW + cellW / 2;
      const cy = drawArea.y + row * cellH + cellH / 2;
      ctx.fillText(char, cx, cy);
    }
  }

  ctx.globalAlpha = 1;
}

/** Render ASCII characters with random colors from a palette */
function renderMultiColorAscii(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea,
  mask: boolean[] | null
): void {
  const { partial } = state;
  const palette = getPalette(partial.palette);
  const chars = getCharset(partial.charset, partial.customCharset);

  const cols = partial.density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;
  const rows = Math.floor(drawArea.h / cellH);

  // Sample image for luminance
  const sCtx = getPartialSampleCanvas(cols, rows);
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  ctx.globalAlpha = (partial.opacity || 100) / 100;

  const sizeScale = (partial.size || 100) / 100;
  const fontSize = Math.max(cellW * 1.2 * sizeScale, 4);
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let colorIdx = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (mask !== null && !mask[idx]) continue;
      if (state.eraserMask !== null && state.eraserMask[idx]) continue;

      const pixIdx = idx * 4;
      const r = pixels[pixIdx], g = pixels[pixIdx + 1], b = pixels[pixIdx + 2];
      let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lum = Math.max(0, Math.min(1, lum));

      const charIdx = Math.floor(lum * (chars.length - 1));
      const char = chars[Math.max(0, Math.min(charIdx, chars.length - 1))];
      if (char === ' ') continue;

      // Pick color from palette (cycling through)
      ctx.fillStyle = palette[colorIdx % palette.length];
      colorIdx++;

      const cx = drawArea.x + col * cellW + cellW / 2;
      const cy = drawArea.y + row * cellH + cellH / 2;
      ctx.fillText(char, cx, cy);
    }
  }
  ctx.globalAlpha = 1;
}

function renderPartialSymbols(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea,
  mask: boolean[] | null
): void {
  const { partial } = state;
  const palette = partial.colorMode === 'multi' ? getPalette(partial.palette) : [partial.monoColor];

  renderSymbolsGrid(
    ctx,
    sourceImg,
    {
      density: partial.density,
      colorMode: partial.colorMode,
      monoColor: partial.monoColor,
      palette,
      symbolSetId: partial.symbolSetId,
      opacity: partial.opacity,
      size: partial.size,
    },
    drawArea,
    mask,
    state.eraserMask
  );
}
