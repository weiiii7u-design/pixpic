// === Trace — Text Fill Rendering Engine ===

import type { DrawArea, ColorMode } from '../types';

function getColorForPixel(
  colorMode: ColorMode,
  monoColor: string,
  r: number,
  g: number,
  b: number
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

export function renderTextFill(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  mask: boolean[] | null,
  eraserMask: boolean[] | null,
  config: {
    text: string;
    textFontSize: number;
    colorMode: ColorMode;
    monoColor: string;
    density: number;
  },
  drawArea: DrawArea
): void {
  const { text, textFontSize, colorMode, monoColor, density } = config;

  if (!text || text.length === 0) return;

  const fontSize = Math.max(textFontSize, 10);
  ctx.font = `bold ${fontSize}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Add shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = fontSize * 0.15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const lineHeight = fontSize * 1.4;
  const charWidth = fontSize * 0.6;

  // Calculate grid for mask checking
  const cols = density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;
  const maskRows = Math.floor(drawArea.h / cellH);

  // Sample source image for color (at full resolution)
  const sampleCanvas = document.createElement('canvas');
  const sampleW = Math.floor(drawArea.w);
  const sampleH = Math.floor(drawArea.h);
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const sCtx = sampleCanvas.getContext('2d')!;
  sCtx.drawImage(sourceImg, 0, 0, sampleW, sampleH);
  const imageData = sCtx.getImageData(0, 0, sampleW, sampleH);
  const pixels = imageData.data;

  // How many rows of text can fit
  const textRows = Math.floor(drawArea.h / lineHeight);
  const charsPerRow = Math.floor(drawArea.w / charWidth);

  // Build repeating text
  let textIdx = 0;

  for (let row = 0; row < textRows; row++) {
    for (let ch = 0; ch < charsPerRow; ch++) {
      const px = ch * charWidth;
      const py = row * lineHeight;

      // Map pixel position to mask grid
      if (mask !== null) {
        const maskCol = Math.floor(px / cellW);
        const maskRow = Math.floor(py / cellH);
        if (maskCol >= 0 && maskCol < cols && maskRow >= 0 && maskRow < maskRows) {
          const maskIdx = maskRow * cols + maskCol;
          if (!mask[maskIdx]) continue;
          if (eraserMask !== null && eraserMask[maskIdx]) continue;
        } else {
          continue;
        }
      } else {
        // No mask, check eraser at pixel level
        if (eraserMask !== null) {
          const maskCol = Math.floor(px / cellW);
          const maskRow = Math.floor(py / cellH);
          if (maskCol >= 0 && maskCol < cols && maskRow >= 0 && maskRow < maskRows) {
            const maskIdx = maskRow * cols + maskCol;
            if (eraserMask[maskIdx]) continue;
          }
        }
      }

      // Get character from repeating text
      const char = text[textIdx % text.length];
      textIdx++;

      // Skip spaces and newlines for visual density
      if (char === '\n') continue;

      // Get color from source image
      const sampleX = Math.min(Math.floor(px), sampleW - 1);
      const sampleY = Math.min(Math.floor(py), sampleH - 1);
      const pixIdx = (sampleY * sampleW + sampleX) * 4;
      const r = pixels[pixIdx];
      const g = pixels[pixIdx + 1];
      const b = pixels[pixIdx + 2];

      const color = getColorForPixel(colorMode, monoColor, r, g, b);
      ctx.fillStyle = color;

      ctx.fillText(char, drawArea.x + px, drawArea.y + py);
    }
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}
