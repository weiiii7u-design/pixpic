// === Trace — Core ASCII Rendering Engine ===

import type { CharsetName, DrawArea } from '../types';
import { clamp } from './math';

// Internal color mode for ASCII rendering (different from global ColorMode)
export type AsciiColorMode = 'bw' | 'matrix' | 'amber' | 'colored';

export interface AsciiConfig {
  density: number;       // 10-80 columns
  size: number;          // 50-200, font size as % of cell (100 = normal)
  brightness: number;    // -100 to 100
  contrast: number;      // -100 to 100
  threshold: number;     // 0-255
  gamma: number;         // 0.1 to 3.0
  charset: CharsetName;
  colorMode: AsciiColorMode;
  invert: boolean;
}

const CHARSETS: Record<CharsetName, string> = {
  standard: '.:-=+*#%@',
  shades: '.░▒▓█',
  dots: '·•●○◌◎',
  steps: '▁▂▃▄▅▆▇█',
  numbers: '0123456789',
  complex: ".'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuv",
};

export function getCharset(name: CharsetName): string {
  return CHARSETS[name];
}

function applyBrightnessContrast(lum: number, brightness: number, contrast: number): number {
  // Brightness: shift
  let v = lum + brightness / 100;
  // Contrast: S-curve around 0.5
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  v = factor * (v - 0.5) + 0.5;
  return clamp(v, 0, 1);
}

function applyGamma(lum: number, gamma: number): number {
  return Math.pow(clamp(lum, 0, 1), 1 / gamma);
}

function getColorForMode(colorMode: AsciiColorMode, r: number, g: number, b: number): string {
  switch (colorMode) {
    case 'bw': return '#ffffff';
    case 'matrix': return '#00ff41';
    case 'amber': return '#ffb000';
    case 'colored': return `rgb(${r},${g},${b})`;
  }
}

export function renderAsciiRegion(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  mask: boolean[] | null,
  eraserMask: boolean[] | null,
  config: AsciiConfig,
  drawArea: DrawArea
): void {
  const { density, size, brightness, contrast, threshold, gamma, charset, colorMode, invert } = config;
  const sizeScale = (size || 100) / 100;
  const chars = getCharset(charset);

  const cols = density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8; // character aspect ratio
  const rows = Math.floor(drawArea.h / cellH);

  // Sample source image
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  const fontSize = Math.max(cellW * 1.2 * sizeScale, 4);
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;

      // Skip if masked out
      if (mask !== null && !mask[idx]) continue;
      // Skip if erased
      if (eraserMask !== null && eraserMask[idx]) continue;

      const pixIdx = idx * 4;
      const r = pixels[pixIdx];
      const g = pixels[pixIdx + 1];
      const b = pixels[pixIdx + 2];

      // Calculate luminance
      let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Apply adjustments
      lum = applyBrightnessContrast(lum, brightness, contrast);
      lum = applyGamma(lum, gamma);

      // Apply threshold (hard cutoff)
      if (threshold > 0) {
        const threshNorm = threshold / 255;
        if (lum < threshNorm) lum = 0;
      }

      // Invert
      if (invert) lum = 1 - lum;

      // Map luminance to character
      const charIdx = Math.floor(lum * (chars.length - 1));
      const char = chars[clamp(charIdx, 0, chars.length - 1)];

      if (char === ' ') continue;

      // Get color
      const color = getColorForMode(colorMode, r, g, b);
      ctx.fillStyle = color;

      // Draw character
      const cx = drawArea.x + col * cellW + cellW / 2;
      const cy = drawArea.y + row * cellH + cellH / 2;
      ctx.fillText(char, cx, cy);
    }
  }

}

/** Get grid dimensions for a given config and area */
export function getGridDimensions(density: number, drawArea: DrawArea): { cols: number; rows: number } {
  const cols = density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;
  const rows = Math.floor(drawArea.h / cellH);
  return { cols, rows };
}
