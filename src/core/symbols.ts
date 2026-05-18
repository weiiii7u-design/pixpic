// === Trace — Symbol Grid Rendering Engine ===

import type { DrawArea, ColorMode } from '../types';
import type { SymbolSet } from '../types';
import { rng } from './math';

export const SYMBOL_SETS: SymbolSet[] = [
  { id: 'tech', name: '科技', symbols: ['✦', '+', '○', '×', '·', '★'] },
  { id: 'nature', name: '自然', symbols: ['✿', '❀', '✾', '❁', '✻', '·'] },
  { id: 'minimal', name: '极简', symbols: ['·', '•', '○', '◦'] },
  { id: 'geo', name: '几何', symbols: ['△', '□', '○', '◇', '×', '+'] },
  { id: 'stars', name: '星辰', symbols: ['✦', '✧', '★', '☆', '✶', '·'] },
];

export function getSymbolSet(id: string): SymbolSet {
  return SYMBOL_SETS.find(s => s.id === id) || SYMBOL_SETS[0];
}

function mapDensityToSpacing(density: number, drawAreaW: number): number {
  // density 10 = very sparse (large spacing), 80 = very dense (small spacing)
  const cols = density;
  return drawAreaW / cols;
}

function getColorForPixel(
  colorMode: ColorMode,
  monoColor: string,
  palette: string[],
  r: number,
  g: number,
  b: number,
  rngFn: () => number
): string {
  switch (colorMode) {
    case 'original':
      return `rgb(${r},${g},${b})`;
    case 'mono':
      return monoColor;
    case 'multi':
      return palette[Math.floor(rngFn() * palette.length)] || monoColor;
    default:
      return monoColor;
  }
}

export function renderSymbolsGrid(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  config: {
    density: number;
    colorMode: ColorMode;
    monoColor: string;
    palette: string[];
    symbolSetId: string;
    opacity: number;
    size?: number;    // 50-200, font size as % (default 100)
    glow?: number;    // 0-40, shadowBlur
  },
  drawArea: DrawArea,
  mask: boolean[] | null,
  eraserMask: boolean[] | null
): void {
  const symbolSet = getSymbolSet(config.symbolSetId);
  const symbols = symbolSet.symbols;
  const spacing = mapDensityToSpacing(config.density, drawArea.w);
  const cols = Math.floor(drawArea.w / spacing);
  const rows = Math.floor(drawArea.h / spacing);

  if (cols <= 0 || rows <= 0) return;

  // Sample source image for color picking
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(sourceImg, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  const sizeScale = (config.size || 100) / 100;
  const fontSize = spacing * 0.7 * sizeScale;
  ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = config.opacity / 100;

  // Glow — always white for visibility
  if (config.glow && config.glow > 0) {
    ctx.shadowBlur = config.glow;
    ctx.shadowColor = '#ffffff';
  } else {
    ctx.shadowBlur = 0;
  }

  const random = rng(42);

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

      // Pick random symbol
      const symbol = symbols[Math.floor(random() * symbols.length)];

      // Pick color
      const color = getColorForPixel(
        config.colorMode,
        config.monoColor,
        config.palette,
        r, g, b,
        random
      );
      ctx.fillStyle = color;

      // Draw symbol at grid position
      const cx = drawArea.x + col * spacing + spacing / 2;
      const cy = drawArea.y + row * spacing + spacing / 2;
      ctx.fillText(symbol, cx, cy);
    }
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** Get grid dimensions for symbols (uniform square grid) */
export function getSymbolGridDimensions(density: number, drawArea: DrawArea): { cols: number; rows: number } {
  const spacing = mapDensityToSpacing(density, drawArea.w);
  const cols = Math.floor(drawArea.w / spacing);
  const rows = Math.floor(drawArea.h / spacing);
  return { cols, rows };
}
