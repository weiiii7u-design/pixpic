// === Trace — Dot Pattern Rendering Engine ===

import type { DrawArea, ColorMode } from '../types';
import { rng } from './math';

function getColorForPixel(
  colorMode: ColorMode,
  monoColor: string,
  _palette: string[],
  r: number,
  g: number,
  b: number,
  _rngFn: () => number
): string {
  switch (colorMode) {
    case 'original':
      return `rgb(${r},${g},${b})`;
    case 'mono':
      return monoColor;
    default:
      return monoColor;
  }
}

export function renderDotsGrid(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  config: {
    density: number;
    colorMode: ColorMode;
    monoColor: string;
    palette: string[];
    dotSize: number;
    opacity: number;
  },
  drawArea: DrawArea,
  mask: boolean[] | null,
  eraserMask: boolean[] | null
): void {
  const cols = config.density;
  const spacing = drawArea.w / cols;
  const rows = Math.floor(drawArea.h / spacing);

  if (cols <= 0 || rows <= 0) return;

  // Sample source image
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  ctx.globalAlpha = config.opacity / 100;
  const random = rng(123);

  const baseRadius = config.dotSize / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;

      // Skip if masked out
      if (mask !== null && !mask[idx]) continue;
      // Skip if erased/revealed
      if (eraserMask !== null && eraserMask[idx]) continue;

      const pixIdx = idx * 4;
      const r = pixels[pixIdx];
      const g = pixels[pixIdx + 1];
      const b = pixels[pixIdx + 2];

      // Color
      const color = getColorForPixel(
        config.colorMode,
        config.monoColor,
        config.palette,
        r, g, b,
        random
      );

      // Slight size jitter
      const jitter = 0.8 + random() * 0.4;
      const radius = baseRadius * jitter;

      const cx = drawArea.x + col * spacing + spacing / 2;
      const cy = drawArea.y + row * spacing + spacing / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

/** Get grid dimensions for dots */
export function getDotsGridDimensions(density: number, drawArea: DrawArea): { cols: number; rows: number } {
  const cols = density;
  const spacing = drawArea.w / cols;
  const rows = Math.floor(drawArea.h / spacing);
  return { cols, rows };
}
