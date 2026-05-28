// === pixpic-cli: Symbol Effect Renderer ===

import { createCanvas, GlobalFonts, type Canvas } from '@napi-rs/canvas';
import type { RenderConfig } from '../types.js';

// Register CJK font
GlobalFonts.registerFromPath('/System/Library/Fonts/PingFang.ttc', 'PingFang');
const FONT_FAMILY = 'PingFang, monospace';

// Symbol sets (same as pixpic browser, ordered light→heavy)
const SYMBOL_SETS: Record<string, string[]> = {
  tech:    ['·', '×', '+', '○', '✦', '★'],
  nature:  ['·', '✻', '✾', '❁', '❀', '✿'],
  minimal: ['◦', '·', '•', '○'],
  geo:     ['+', '×', '◇', '○', '□', '△'],
  stars:   ['·', '✧', '☆', '✶', '✦', '★'],
};

/**
 * Render symbol art effect on a canvas
 */
export function renderSymbols(
  sourceCanvas: Canvas,
  config: RenderConfig
): Canvas {
  const { width: srcW, height: srcH } = sourceCanvas;
  const outputW = config.width || srcW;
  const outputH = config.height || srcH;

  const output = createCanvas(outputW, outputH);
  const ctx = output.getContext('2d');

  // Draw background: original image (with dark overlay) or solid color
  if (config.bgColor === 'image') {
    ctx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, outputW, outputH);
  } else {
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, outputW, outputH);
  }

  const symbols = SYMBOL_SETS[config.symbolSetId] || SYMBOL_SETS.tech;
  const cols = config.density;
  const spacing = outputW / cols;
  const rowSpacing = spacing * 1.8;
  const rows = Math.floor(outputH / rowSpacing);

  if (cols <= 0 || rows <= 0) return output;

  // Sample source
  const sampleCanvas = createCanvas(cols, rows);
  const sCtx = sampleCanvas.getContext('2d');
  sCtx.drawImage(sourceCanvas, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  const sizeScale = (config.size || 100) / 100;
  const fontSize = spacing * 0.7 * sizeScale;
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Map brightness to symbol
      const symIdx = Math.min(symbols.length - 1, Math.floor(lum * symbols.length));
      const symbol = symbols[symIdx];

      // Color
      if (config.colorMode === 'original') {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else if (config.colorMode === 'mono') {
        ctx.fillStyle = config.monoColor;
      } else {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }

      const cx = col * spacing + spacing / 2;
      const cy = row * rowSpacing + rowSpacing / 2;
      ctx.fillText(symbol, cx, cy);
    }
  }

  return output;
}
