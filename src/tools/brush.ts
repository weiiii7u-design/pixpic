// === Trace — Brush Tool (v3: for Partial mode brush target) ===

import { state, notify } from '../state';
import { getGridDimensions } from '../core/ascii';
import type { DrawArea } from '../types';

/**
 * Apply brush in partial mode (target='brush').
 * Marks cells in brushMask=true to render ASCII in those areas.
 */
export function applyBrush(
  canvasX: number,
  canvasY: number,
  drawArea: DrawArea
): void {
  const density = state.partial.density;
  const { cols, rows } = getGridDimensions(density, drawArea);
  const total = cols * rows;

  // Initialize brush mask if needed
  if (!state.brushMask || state.brushMask.length !== total) {
    state.brushMask = new Array(total).fill(false);
  }

  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;

  // Convert canvas position to grid position
  const gridX = (canvasX - drawArea.x) / cellW;
  const gridY = (canvasY - drawArea.y) / cellH;

  const radiusCells = state.brushSize / cellW;

  // Mark cells within radius as "painted"
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col - gridX;
      const dy = row - gridY;
      if (dx * dx + dy * dy <= radiusCells * radiusCells) {
        state.brushMask[row * cols + col] = true;
      }
    }
  }

  notify();
}

/**
 * Erase brush strokes (undo painted areas in partial brush mode).
 */
export function eraseBrush(
  canvasX: number,
  canvasY: number,
  drawArea: DrawArea
): void {
  if (!state.brushMask) return;

  const density = state.partial.density;
  const { cols, rows } = getGridDimensions(density, drawArea);
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;

  const gridX = (canvasX - drawArea.x) / cellW;
  const gridY = (canvasY - drawArea.y) / cellH;

  const radiusCells = state.eraserSize / cellW;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dx = col - gridX;
      const dy = row - gridY;
      if (dx * dx + dy * dy <= radiusCells * radiusCells) {
        state.brushMask[row * cols + col] = false;
      }
    }
  }

  notify();
}
