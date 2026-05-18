// === Trace — Full Mode (Entire photo becomes ASCII art) ===
// No photo visible — pure ASCII art with solid/gradient/transparent background.

import { state } from '../state';
import { renderAsciiRegion } from '../core/ascii';
import type { DrawArea } from '../types';

export function renderFullMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  // 1. Draw background
  drawBackground(ctx, drawArea);

  // 2. Render ASCII over entire image using luminance from source
  renderFullAscii(ctx, sourceImg, drawArea);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  drawArea: DrawArea
): void {
  const { full } = state;

  switch (full.background) {
    case 'solid':
      ctx.fillStyle = full.bgColor;
      ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
      break;
    case 'gradient': {
      const [color1, color2] = full.bgGradient;
      const angle = full.bgGradientDirection * (Math.PI / 180);
      const cx = drawArea.x + drawArea.w / 2;
      const cy = drawArea.y + drawArea.h / 2;
      const len = Math.max(drawArea.w, drawArea.h);
      const x1 = cx - Math.cos(angle) * len / 2;
      const y1 = cy - Math.sin(angle) * len / 2;
      const x2 = cx + Math.cos(angle) * len / 2;
      const y2 = cy + Math.sin(angle) * len / 2;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
      break;
    }
    case 'transparent':
      drawCheckerboard(ctx, drawArea);
      break;
  }
}

function renderFullAscii(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  const { full } = state;

  // Map colorMode to ASCII engine's color mode
  let effectiveColorMode: 'bw' | 'matrix' | 'amber' | 'colored';
  if (full.colorMode === 'original') {
    effectiveColorMode = 'colored';
  } else {
    // mono — pick based on color
    if (full.monoColor === '#00ff41') {
      effectiveColorMode = 'matrix';
    } else if (full.monoColor === '#ffb000') {
      effectiveColorMode = 'amber';
    } else {
      effectiveColorMode = 'bw';
    }
  }

  // Setup glow
  if (full.glow > 0) {
    ctx.shadowBlur = full.glow;
    ctx.shadowColor = full.monoColor;
  }

  renderAsciiRegion(
    ctx,
    sourceImg,
    null,
    state.eraserMask,
    {
      density: full.density,
      size: 100,
      brightness: full.brightness,
      contrast: full.contrast,
      threshold: 0,
      gamma: 1.0,
      charset: full.charset,
      colorMode: effectiveColorMode,
      glow: full.glow,
      invert: false,
    },
    drawArea
  );

  // Reset shadow
  ctx.shadowBlur = 0;
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, drawArea: DrawArea): void {
  const size = 10;
  for (let y = 0; y < drawArea.h; y += size) {
    for (let x = 0; x < drawArea.w; x += size) {
      const isLight = ((Math.floor(x / size) + Math.floor(y / size)) % 2) === 0;
      ctx.fillStyle = isLight ? '#ffffff' : '#e0e0e0';
      ctx.fillRect(drawArea.x + x, drawArea.y + y, size, size);
    }
  }
}
