// === Trace — Stamp Mode (Image Sticker + Dots/ASCII Rendering) ===
// Sticker x/y are normalized to CANVAS (0-1).

import { state } from '../state';
import { getStickerAsset, getStickerDimensions, createEffectCanvas } from '../core/stickers';
import { getStickerDisplayScale } from '../render/compositor';
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
  sizeScale = 1,
  stickerOverride?: StickerInstance[]
): void {
  const dpr = sizeScale === 1 ? (window.devicePixelRatio || 1) : 1;
  const canvasW = ctx.canvas.width / dpr;
  const canvasH = ctx.canvas.height / dpr;
  const stickers = stickerOverride ?? state.stickers;

  for (const sticker of stickers) {
    drawStickerArtwork(ctx, sticker, canvasW, canvasH, sizeScale, sourceImg, photoRect);
  }

  if (sizeScale === 1 && !stickerOverride) {
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

  // When rendering on screen (sizeScale===1), apply display scale so stickers
  // shrink proportionally when the canvas shrinks (panel open).
  const displayScale = sizeScale === 1 ? getStickerDisplayScale() : 1;

  const { width, height } = getStickerDimensions(sticker.assetId, sticker.scale);
  const w = width * sizeScale * displayScale;
  const h = height * sizeScale * displayScale;
  const unitSize = sticker.effectUnitSize * sizeScale * displayScale;

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
  const displayScale = getStickerDisplayScale();
  const { width: rawW, height: rawH } = getStickerDimensions(sticker.assetId, sticker.scale);
  const width = rawW * displayScale;
  const height = rawH * displayScale;
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

  // Corner handles layout:
  //  [×  delete]  ───────  [编辑 edit]
  //  |                              |
  //  |                              |
  //  [⊘ subjectAvoid]  ─────  [↻ rotate]

  // Top-right: resize handle
  const hs = 10;
  ctx.fillStyle = '#2B2BD4';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(width / 2 - hs / 2, -height / 2 - hs / 2, hs, hs, 3);
  ctx.fill();
  ctx.stroke();

  // Delete button — top-left corner (× icon in circle)
  const btnR = 12;
  const delX = -width / 2;
  const delY = -height / 2;

  ctx.beginPath();
  ctx.arc(delX, delY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const crossSize = 5;
  ctx.beginPath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.moveTo(delX - crossSize, delY - crossSize);
  ctx.lineTo(delX + crossSize, delY + crossSize);
  ctx.moveTo(delX + crossSize, delY - crossSize);
  ctx.lineTo(delX - crossSize, delY + crossSize);
  ctx.stroke();

  // Edit button — top-right corner (only show when NOT already in edit mode)
  if (!state.stickerEditOnly) {
    const editX = width / 2;
    const editY = -height / 2;
    const pillW = 36;
    const pillH = 20;
    const pillR = pillH / 2;

    ctx.beginPath();
    ctx.roundRect(editX - pillW / 2, editY - pillH / 2, pillW, pillH, pillR);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('编辑', editX, editY);
  }

  // Subject avoid button — bottom-left corner (circle, blue when active)
  const avoidX = -width / 2;
  const avoidY = height / 2;
  const isAvoidOn = sticker.subjectAvoid;

  ctx.beginPath();
  ctx.arc(avoidX, avoidY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = isAvoidOn ? '#2B2BD4' : 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw a person icon (simplified)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#ffffff';
  // Head
  ctx.beginPath();
  ctx.arc(avoidX, avoidY - 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.beginPath();
  ctx.moveTo(avoidX, avoidY - 1.5);
  ctx.lineTo(avoidX, avoidY + 4);
  ctx.moveTo(avoidX - 3.5, avoidY + 1);
  ctx.lineTo(avoidX + 3.5, avoidY + 1);
  ctx.stroke();

  // Rotate handle — bottom-right corner (circle with ↻ icon)
  const rotX = width / 2;
  const rotY = height / 2;

  ctx.beginPath();
  ctx.arc(rotX, rotY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw rotate arrow icon
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(rotX, rotY, 5, -Math.PI * 0.8, Math.PI * 0.5);
  ctx.stroke();
  // Arrowhead
  const arrowTip = Math.PI * 0.5;
  const ax = rotX + 5 * Math.cos(arrowTip);
  const ay = rotY + 5 * Math.sin(arrowTip);
  ctx.beginPath();
  ctx.moveTo(ax - 3, ay - 1);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + 1, ay - 3);
  ctx.stroke();

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
