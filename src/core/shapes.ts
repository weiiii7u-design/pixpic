// === Trace — Shape Pattern Rendering Engine ===

import type { DrawArea, ColorMode } from '../types';
import { rng } from './math';

// ShapeType is local since it's no longer in the global types
type ShapeType = 'flower' | 'star' | 'diamond';

export const COLOR_PALETTES = [
  { id: 'dream', name: '千禧梦境', colors: ['#E8CFEE', '#C9E3F7', '#F7C6D8', '#D4EDD4', '#F9EEC5', '#F0F0FF'] },
  { id: 'happy', name: '开心五彩', colors: ['#FF4D6D', '#FF9F1C', '#2EC4B6', '#3A86FF', '#8338EC', '#06D6A0'] },
  { id: 'nature', name: '自然色系', colors: ['#4A7C59', '#C8D96A', '#D9BF6A', '#FBF5DC', '#6BAAB8', '#8B3A2A'] },
  { id: 'neon', name: '亚比荧光', colors: ['#CCFF00', '#FF2D78', '#00F5D4', '#FF6B00', '#B400FF', '#00FF85'] },
];

export function getPalette(id: string): string[] {
  const p = COLOR_PALETTES.find(p => p.id === id);
  return p ? p.colors : COLOR_PALETTES[0].colors;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  shapeType: ShapeType,
  color: string
): void {
  ctx.fillStyle = color;
  const s = size * 0.4;

  switch (shapeType) {
    case 'flower': {
      // Draw a simple flower shape (5 petals + center)
      const petalR = s * 0.45;
      const centerR = s * 0.2;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(angle) * s * 0.3;
        const py = cy + Math.sin(angle) * s * 0.3;
        ctx.beginPath();
        ctx.arc(px, py, petalR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'star': {
      // 5-point star
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? s * 0.5 : s * 0.2;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'diamond': {
      // Simple diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.3, cy);
      ctx.lineTo(cx, cy + s * 0.4);
      ctx.lineTo(cx - s * 0.3, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

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

export function renderShapesGrid(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  config: {
    density: number;
    colorMode: ColorMode;
    monoColor: string;
    palette: string[];
    shapeType: ShapeType;
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

  // Sample source image for color
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  ctx.globalAlpha = config.opacity / 100;
  const random = rng(77);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;

      if (mask !== null && !mask[idx]) continue;
      if (eraserMask !== null && eraserMask[idx]) continue;

      const pixIdx = idx * 4;
      const r = pixels[pixIdx];
      const g = pixels[pixIdx + 1];
      const b = pixels[pixIdx + 2];

      const color = getColorForPixel(
        config.colorMode,
        config.monoColor,
        config.palette,
        r, g, b,
        random
      );

      const cx = drawArea.x + col * spacing + spacing / 2;
      const cy = drawArea.y + row * spacing + spacing / 2;

      drawShape(ctx, cx, cy, spacing, config.shapeType, color);
    }
  }

  ctx.globalAlpha = 1;
}

/** Get grid dimensions for shapes */
export function getShapesGridDimensions(density: number, drawArea: DrawArea): { cols: number; rows: number } {
  const cols = density;
  const spacing = drawArea.w / cols;
  const rows = Math.floor(drawArea.h / spacing);
  return { cols, rows };
}
