// === Trace — Gesture Handler (Sticker select/move/resize/rotate + Photo pan/zoom) ===
// Sticker x/y are normalized to CANVAS (0-1).

import { state, updateState, notify } from '../state';
import type { StickerInstance, DrawArea } from '../types';
import { distance } from '../core/math';
import { getStickerDimensions } from '../core/stickers';
import { stickerToCanvas, canvasToSticker } from '../modes/stamp';

type Action = 'none' | 'sticker-move' | 'sticker-resize' | 'photo-pan';

const g = {
  action: 'none' as Action,
  pointerId: -1,
  stickerId: null as string | null,
  startNX: 0, startNY: 0,
  startObjNX: 0, startObjNY: 0,
  centerDist: 1, centerAngle: 0,
  startScale: 1, startRotation: 0,
  startClientNX: 0, startClientNY: 0,
  startPhotoX: 0.5, startPhotoY: 0.5,
  pinchDist: 0,
  pinchStickerScale: 1, pinchStickerAngle: 0, pinchStickerRotation: 0,
  pinchPhotoScale: 1,
};

const HANDLE_R = 24;
const SNAP_THRESHOLD = 0.015;
let lastVibrated = 0;

function tryVibrate() {
  const now = Date.now();
  if (now - lastVibrated > 100 && navigator.vibrate) {
    navigator.vibrate(8);
    lastVibrated = now;
  }
}

function isBrushOrEraser(): boolean {
  if (state.mode === 'partial' && state.partial.target === 'brush' && state.brushActive) return true;
  if (state.eraserActive) return true;
  return false;
}

function pt(e: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width / dpr,
    y: ((e.clientY - r.top) / r.height) * canvas.height / dpr,
  };
}

function getCSSDims(canvas: HTMLCanvasElement): { cw: number; ch: number } {
  const dpr = window.devicePixelRatio || 1;
  return { cw: canvas.width / dpr, ch: canvas.height / dpr };
}

function toLocal(cx: number, cy: number, s: StickerInstance, cw: number, ch: number) {
  const { px, py } = stickerToCanvas(s, cw, ch);
  const a = (-s.rotation * Math.PI) / 180;
  const dx = cx - px, dy = cy - py;
  return { lx: dx * Math.cos(a) - dy * Math.sin(a), ly: dx * Math.sin(a) + dy * Math.cos(a) };
}

function hitSticker(cx: number, cy: number, cw: number, ch: number): StickerInstance | null {
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const { width, height } = getStickerDimensions(s.assetId, s.scale);
    const { lx, ly } = toLocal(cx, cy, s, cw, ch);
    if (Math.abs(lx) <= width / 2 + 8 && Math.abs(ly) <= height / 2 + 8) return s;
  }
  return null;
}

function hitCorner(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  for (const [hx, hy] of [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]) {
    if (Math.abs(lx - hx) < HANDLE_R && Math.abs(ly - hy) < HANDLE_R) return true;
  }
  return false;
}

export function setupGestureHandlers(
  canvas: HTMLCanvasElement,
  _getDrawArea: () => DrawArea,
  _getCanvasSize: () => { w: number; h: number }
): void {

  canvas.addEventListener('pointerdown', (e) => {
    if (isBrushOrEraser()) return;
    const p = pt(e, canvas);
    const { cw, ch } = getCSSDims(canvas);

    if (state.mode === 'stamp') {
      // Corner handle → resize+rotate
      if (state.selectedStickerId && hitCorner(p.x, p.y, cw, ch)) {
        const sel = state.stickers.find(s => s.id === state.selectedStickerId)!;
        const { px, py } = stickerToCanvas(sel, cw, ch);
        g.action = 'sticker-resize';
        g.pointerId = e.pointerId;
        g.stickerId = sel.id;
        g.centerDist = Math.max(1, Math.hypot(p.x - px, p.y - py));
        g.centerAngle = Math.atan2(p.y - py, p.x - px);
        g.startScale = sel.scale;
        g.startRotation = sel.rotation;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Sticker body → select + move
      const hit = hitSticker(p.x, p.y, cw, ch);
      if (hit) {
        const norm = canvasToSticker(p.x, p.y, cw, ch);
        g.action = 'sticker-move';
        g.pointerId = e.pointerId;
        g.stickerId = hit.id;
        g.startNX = norm.nx;
        g.startNY = norm.ny;
        g.startObjNX = hit.x;
        g.startObjNY = hit.y;
        updateState({ selectedStickerId: hit.id });
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Empty area → deselect
      if (state.selectedStickerId) {
        updateState({ selectedStickerId: null });
        return;
      }
    }

    // Photo pan
    if (state.canvasRatio !== 'original') {
      const r = canvas.getBoundingClientRect();
      g.action = 'photo-pan';
      g.pointerId = e.pointerId;
      g.startClientNX = e.clientX / r.width;
      g.startClientNY = e.clientY / r.height;
      g.startPhotoX = state.photoX;
      g.startPhotoY = state.photoY;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (g.action === 'none' || e.pointerId !== g.pointerId) return;
    const p = pt(e, canvas);
    const { cw, ch } = getCSSDims(canvas);

    if (g.action === 'sticker-move') {
      const s = state.stickers.find(s => s.id === g.stickerId);
      if (s) {
        const norm = canvasToSticker(p.x, p.y, cw, ch);
        let nx = g.startObjNX + (norm.nx - g.startNX);
        let ny = g.startObjNY + (norm.ny - g.startNY);

        // Snap to canvas center
        let snapH = false, snapV = false;
        if (Math.abs(nx - 0.5) < SNAP_THRESHOLD) { nx = 0.5; snapV = true; }
        if (Math.abs(ny - 0.5) < SNAP_THRESHOLD) { ny = 0.5; snapH = true; }
        if ((snapH || snapV) && (!state.alignGuides.h && snapH || !state.alignGuides.v && snapV)) {
          tryVibrate();
        }

        s.x = nx;
        s.y = ny;
        state.alignGuides = { h: snapH, v: snapV };
        notify();
      }
    }

    if (g.action === 'sticker-resize') {
      const s = state.stickers.find(s => s.id === g.stickerId);
      if (s) {
        const { px, py } = stickerToCanvas(s, cw, ch);
        const dist = Math.max(1, Math.hypot(p.x - px, p.y - py));
        const angle = Math.atan2(p.y - py, p.x - px);
        s.scale = Math.min(8, Math.max(0.08, g.startScale * (dist / g.centerDist)));
        s.rotation = g.startRotation + ((angle - g.centerAngle) * 180) / Math.PI;
        notify();
      }
    }

    if (g.action === 'photo-pan') {
      const r = canvas.getBoundingClientRect();
      updateState({
        photoX: Math.max(0, Math.min(1, g.startPhotoX + (e.clientX / r.width - g.startClientNX))),
        photoY: Math.max(0, Math.min(1, g.startPhotoY + (e.clientY / r.height - g.startClientNY))),
      });
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId === g.pointerId) {
      g.action = 'none'; g.stickerId = null; g.pointerId = -1;
      state.alignGuides = { h: false, v: false };
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointercancel', (e) => {
    if (e.pointerId === g.pointerId) {
      g.action = 'none'; g.stickerId = null; g.pointerId = -1;
      state.alignGuides = { h: false, v: false };
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    }
  });

  // Scroll wheel → scale sticker or photo
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    if (state.mode === 'stamp' && state.selectedStickerId) {
      const s = state.stickers.find(s => s.id === state.selectedStickerId);
      if (s) { s.scale = Math.min(8, Math.max(0.08, s.scale * factor)); notify(); }
    } else if (state.canvasRatio !== 'original') {
      updateState({ photoScale: Math.max(0.2, Math.min(5, state.photoScale * factor)) });
    }
  }, { passive: false });

  // Touch pinch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      g.pinchDist = distance(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY);
      if (state.mode === 'stamp' && state.selectedStickerId) {
        const s = state.stickers.find(s => s.id === state.selectedStickerId);
        if (s) {
          g.pinchStickerScale = s.scale;
          g.pinchStickerAngle = Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX);
          g.pinchStickerRotation = s.rotation;
        }
      } else if (!isBrushOrEraser()) {
        g.pinchPhotoScale = state.photoScale;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = distance(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY);
      if (state.mode === 'stamp' && state.selectedStickerId) {
        const s = state.stickers.find(s => s.id === state.selectedStickerId);
        if (s) {
          const a = Math.atan2(e.touches[1].clientY - e.touches[0].clientY, e.touches[1].clientX - e.touches[0].clientX);
          s.scale = Math.min(8, Math.max(0.08, g.pinchStickerScale * (d / g.pinchDist)));
          s.rotation = g.pinchStickerRotation + ((a - g.pinchStickerAngle) * 180) / Math.PI;
          notify();
        }
      } else if (!isBrushOrEraser()) {
        updateState({ photoScale: Math.max(0.2, Math.min(5, g.pinchPhotoScale * (d / g.pinchDist))) });
      }
    }
  }, { passive: false });
}
