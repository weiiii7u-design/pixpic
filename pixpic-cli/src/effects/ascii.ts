// === pixpic-cli: ASCII Effect Renderer ===

import { createCanvas, type Canvas } from '@napi-rs/canvas';
import type { RenderConfig } from '../types.js';

// Charset definitions (same as pixpic browser)
const CHARSETS: Record<string, string> = {
  standard: '.:-=+*#%@',
  shades: '.░▒▓█',
  dots: '·•●○◌◎',
  steps: '▁▂▃▄▅▆▇█',
  numbers: '0123456789',
  complex: ".'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuv",
};

function getCharset(name: string, customCharset?: string): string {
  if (name === 'custom') {
    if (customCharset && customCharset.length >= 2) return customCharset;
    return CHARSETS.standard;
  }
  return CHARSETS[name] || CHARSETS.standard;
}

/**
 * Render ASCII art effect on a canvas
 */
export function renderAscii(
  sourceCanvas: Canvas,
  config: RenderConfig
): Canvas {
  const { width: srcW, height: srcH } = sourceCanvas;
  const outputW = config.width || srcW;
  const outputH = config.height || srcH;

  const output = createCanvas(outputW, outputH);
  const ctx = output.getContext('2d');

  // Fill background
  ctx.fillStyle = config.bgColor;
  ctx.fillRect(0, 0, outputW, outputH);

  const chars = getCharset(config.charset, config.customCharset);
  const cols = config.density;
  const cellW = outputW / cols;
  const cellH = cellW * 1.8;
  const rows = Math.floor(outputH / cellH);

  if (cols <= 0 || rows <= 0) return output;

  // Sample source at grid resolution
  const sampleCanvas = createCanvas(cols, rows);
  const sCtx = sampleCanvas.getContext('2d');
  sCtx.drawImage(sourceCanvas, 0, 0, cols, rows);
  const imageData = sCtx.getImageData(0, 0, cols, rows);
  const pixels = imageData.data;

  // Configure text rendering
  const sizeScale = (config.size || 100) / 100;
  const fontSize = Math.max(cellW * 1.2 * sizeScale, 4);
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = (row * cols + col) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Map brightness to character
      const charIdx = Math.min(chars.length - 1, Math.floor(lum * chars.length));
      const char = chars[charIdx] || '.';

      // Set color based on mode
      if (config.colorMode === 'original') {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else if (config.colorMode === 'mono') {
        ctx.fillStyle = config.monoColor;
      } else {
        // multi - use palette colors
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }

      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      ctx.fillText(char, cx, cy);
    }
  }

  return output;
}
