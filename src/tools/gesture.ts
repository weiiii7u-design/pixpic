// === Trace — Gesture Handler (Sticker select/move/resize/rotate + Photo pan/zoom) ===
// Sticker x/y are normalized to CANVAS (0-1).

import { state, updateState, notify } from '../state';
import type { StickerInstance, DrawArea } from '../types';
import { distance } from '../core/math';
import { getStickerDimensions } from '../core/stickers';
import { stickerToCanvas, canvasToSticker } from '../modes/stamp';
import { getStickerDisplayScale } from '../render/compositor';

type Action = 'none' | 'sticker-move' | 'sticker-resize' | 'sticker-rotate' | 'photo-pan';

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
const DELETE_R = 18;  // hit radius for × delete button
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
  if (state.effectMode === 'partial' && state.partial.target === 'brush' && state.brushActive) return true;
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
  const ds = getStickerDisplayScale();
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const { width, height } = getStickerDimensions(s.assetId, s.scale);
    const w = width * ds, h = height * ds;
    const { lx, ly } = toLocal(cx, cy, s, cw, ch);
    if (Math.abs(lx) <= w / 2 + 8 && Math.abs(ly) <= h / 2 + 8) return s;
  }
  return null;
}

function hitResizeCorner(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const ds = getStickerDisplayScale();
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const w = width * ds, h = height * ds;
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  // Top-right and bottom-left are resize-only handles (top-left is delete, bottom-right is rotate)
  for (const [hx, hy] of [[w / 2, -h / 2], [-w / 2, h / 2]]) {
    if (Math.abs(lx - hx) < HANDLE_R && Math.abs(ly - hy) < HANDLE_R) return true;
  }
  return false;
}

function hitRotateCorner(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const ds = getStickerDisplayScale();
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const w = width * ds, h = height * ds;
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  // Bottom-right corner is rotate+resize
  return Math.abs(lx - w / 2) < HANDLE_R && Math.abs(ly - h / 2) < HANDLE_R;
}

function hitSubjectAvoidButton(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const ds = getStickerDisplayScale();
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const w = width * ds, h = height * ds;
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  // Bottom-left corner — circle button
  const dx = lx - (-w / 2);
  const dy = ly - (h / 2);
  return dx * dx + dy * dy <= DELETE_R * DELETE_R;
}

function hitDeleteButton(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const ds = getStickerDisplayScale();
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const w = width * ds, h = height * ds;
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  const dx = lx - (-w / 2);
  const dy = ly - (-h / 2);
  return dx * dx + dy * dy <= DELETE_R * DELETE_R;
}

function hitEditButton(cx: number, cy: number, cw: number, ch: number): boolean {
  const sel = state.stickers.find(s => s.id === state.selectedStickerId);
  if (!sel) return false;
  const ds = getStickerDisplayScale();
  const { width, height } = getStickerDimensions(sel.assetId, sel.scale);
  const w = width * ds, h = height * ds;
  const { lx, ly } = toLocal(cx, cy, sel, cw, ch);
  const btnCX = w / 2;
  const btnCY = -h / 2;
  return Math.abs(lx - btnCX) < 24 && Math.abs(ly - btnCY) < 16;
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

    // Sticker interactions (always available when stickers exist)
    if (state.stickers.length > 0) {
      // Delete button (× at top-left of selected sticker)
      if (state.selectedStickerId && hitDeleteButton(p.x, p.y, cw, ch)) {
        updateState({
          stickers: state.stickers.filter(s => s.id !== state.selectedStickerId),
          selectedStickerId: null,
        });
        return;
      }

      // Edit button (top-right of selected sticker → open sticker edit panel)
      if (state.selectedStickerId && hitEditButton(p.x, p.y, cw, ch)) {
        updateState({ activeTool: 'sticker', stickerEditOnly: true });
        return;
      }

      // Subject avoid toggle (bottom-left)
      if (state.selectedStickerId && hitSubjectAvoidButton(p.x, p.y, cw, ch)) {
        const s = state.stickers.find(s => s.id === state.selectedStickerId);
        if (s) {
          const toggled = !s.subjectAvoid;
          // Trigger segmentation if enabling and no mask yet
          if (toggled && !state.subjectMask && !state.subjectLoading && state.sourceImage) {
            import('../modes/partial').then(m => m.triggerSegmentation(state.sourceImage!));
          }
          const stickers = state.stickers.map(st =>
            st.id === state.selectedStickerId ? { ...st, subjectAvoid: toggled } : st
          );
          updateState({ stickers });
        }
        return;
      }

      // Rotate handle (bottom-right corner → resize + rotate)
      if (state.selectedStickerId && hitRotateCorner(p.x, p.y, cw, ch)) {
        const sel = state.stickers.find(s => s.id === state.selectedStickerId)!;
        const { px, py } = stickerToCanvas(sel, cw, ch);
        g.action = 'sticker-rotate';
        g.pointerId = e.pointerId;
        g.stickerId = sel.id;
        g.centerDist = Math.max(1, Math.hypot(p.x - px, p.y - py));
        g.centerAngle = Math.atan2(p.y - py, p.x - px);
        g.startScale = sel.scale;
        g.startRotation = sel.rotation;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Resize handles (top-right, bottom-left corners → scale only, no rotate)
      if (state.selectedStickerId && hitResizeCorner(p.x, p.y, cw, ch)) {
        const sel = state.stickers.find(s => s.id === state.selectedStickerId)!;
        const { px, py } = stickerToCanvas(sel, cw, ch);
        g.action = 'sticker-resize';
        g.pointerId = e.pointerId;
        g.stickerId = sel.id;
        g.centerDist = Math.max(1, Math.hypot(p.x - px, p.y - py));
        g.startScale = sel.scale;
        g.startRotation = sel.rotation;
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Sticker body → select + move (do NOT auto-open panel)
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
        s.scale = Math.min(8, Math.max(0.08, g.startScale * (dist / g.centerDist)));
        // No rotation change — resize only
        notify();
      }
    }

    if (g.action === 'sticker-rotate') {
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
    if (state.selectedStickerId) {
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
      if (state.selectedStickerId) {
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
      if (state.selectedStickerId) {
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
