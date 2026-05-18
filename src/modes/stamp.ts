// === Trace — Stamp Mode (Image Sticker + Dots/ASCII Rendering) ===
// Sticker x/y are normalized to CANVAS (0-1).

import { state } from '../state';
import { getStickerAsset, getStickerDimensions, createEffectCanvas } from '../core/stickers';
import type { DrawArea, StickerInstance } from '../types';

/** Convert sticker's normalized canvas coords to canvas pixel coords */
export function stickerToCanvas(sticker: StickerInstance, canvasW: number, canvasH: number): { px: number; py: number } {
  return { px: sticker.x * canvasW, py: sticker.y * canvasH };
}

/** Convert canvas pixel coords to sticker's normalized canvas coords */
export function canvasToSticker(canvasX: number, canvasY: number, canvasW: number, canvasH: number): { nx: number; ny: number } {
  return { nx: canvasX / canvasW, ny: canvasY / canvasH };
}

export function renderStampMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  photoRect: DrawArea,
  sizeScale = 1
): void {
  const dpr = sizeScale === 1 ? (window.devicePixelRatio || 1) : 1;
  const canvasW = ctx.canvas.width / dpr;
  const canvasH = ctx.canvas.height / dpr;

  for (const sticker of state.stickers) {
    drawStickerArtwork(ctx, sticker, canvasW, canvasH, sizeScale, sourceImg, photoRect);
  }

  if (sizeScale === 1) {
    const selected = state.stickers.find(s => s.id === state.selectedStickerId);
    if (selected) drawStickerControls(ctx, selected, canvasW, canvasH);
    drawAlignGuides(ctx, canvasW, canvasH);
  }
}

function drawStickerArtwork(
  ctx: CanvasRenderingContext2D,
  sticker: StickerInstance,
  canvasW: number,
  canvasH: number,
  sizeScale: number,
  _sourceImg: HTMLImageElement,
  _photoRect: DrawArea
): void {
  const asset = getStickerAsset(sticker.assetId);
  if (!asset) return;

  const { width, height } = getStickerDimensions(sticker.assetId, sticker.scale);
  const w = width * sizeScale;
  const h = height * sizeScale;
  const unitSize = sticker.effectUnitSize * sizeScale;

  const px = sticker.x * canvasW;
  const py = sticker.y * canvasH;

  const dpr = sizeScale === 1 ? (window.devicePixelRatio || 1) : 1;
  const effect = createEffectCanvas(
    asset.image,
    Math.round(w * dpr), Math.round(h * dpr),
    sticker.color, sticker.mode, unitSize * dpr
  );

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((sticker.rotation * Math.PI) / 180);
  ctx.globalAlpha = sticker.opacity;
  ctx.drawImage(effect, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawStickerControls(
  ctx: CanvasRenderingContext2D,
  sticker: StickerInstance,
  canvasW: number,
  canvasH: number
): void {
  const { width, height } = getStickerDimensions(sticker.assetId, sticker.scale);
  const { px, py } = stickerToCanvas(sticker, canvasW, canvasH);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((sticker.rotation * Math.PI) / 180);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2B2BD4';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.setLineDash([]);

  const hs = 10;
  ctx.fillStyle = '#2B2BD4';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (const [hx, hy] of [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]) {
    ctx.beginPath();
    ctx.roundRect(hx - hs / 2, hy - hs / 2, hs, hs, 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawAlignGuides(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
  const { h, v } = state.alignGuides;
  if (!h && !v) return;

  ctx.save();
  ctx.strokeStyle = '#2B2BD4';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.6;

  if (v) { ctx.beginPath(); ctx.moveTo(canvasW / 2, 0); ctx.lineTo(canvasW / 2, canvasH); ctx.stroke(); }
  if (h) { ctx.beginPath(); ctx.moveTo(0, canvasH / 2); ctx.lineTo(canvasW, canvasH / 2); ctx.stroke(); }

  ctx.setLineDash([]);
  ctx.restore();
}
