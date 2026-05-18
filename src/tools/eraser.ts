// === Trace — Eraser Tool (v3) ===

import { state, notify } from '../state';
import { getGridDimensions } from '../core/ascii';
import type { DrawArea } from '../types';

export function applyEraser(
  canvasX: number,
  canvasY: number,
  drawArea: DrawArea
): void {
  const density = state.effectMode === 'full' ? state.full.density : state.partial.density;
  const { cols, rows } = getGridDimensions(density, drawArea);
  const total = cols * rows;

  // Initialize eraser mask if needed
  if (!state.eraserMask || state.eraserMask.length !== total) {
    state.eraserMask = new Array(total).fill(false);
  }

  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;

  // Convert canvas position to grid position
  const gridX = (canvasX - drawArea.x) / cellW;
  const gridY = (canvasY - drawArea.y) / cellH;

  const radiusCells = state.eraserSize / cellW;

  // Mark cells within radius
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col - gridX;
      const dy = row - gridY;
      if (dx * dx + dy * dy <= radiusCells * radiusCells) {
        state.eraserMask[row * cols + col] = true;
      }
    }
  }

  notify();
}
