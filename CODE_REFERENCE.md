# Trace App: Canvas & Positioning — Quick Code Reference

## 1. DrawArea Calculation Pattern

**Source**: `compositor.ts` lines 25-56

```typescript
const rect = container.getBoundingClientRect();
const dpr = window.devicePixelRatio || 1;

const img = state.sourceImage;
const imgAspect = img.naturalWidth / img.naturalHeight;
const containerAspect = rect.width / rect.height;

// Letterbox logic: fit to width or height
let drawW: number, drawH: number;
if (imgAspect > containerAspect) {
  // Image wider than container → fit to width
  drawW = rect.width;
  drawH = rect.width / imgAspect;
} else {
  // Image taller than container → fit to height
  drawH = rect.height;
  drawW = rect.height * imgAspect;
}

// Size canvas
canvas.style.width = `${drawW}px`;
canvas.style.height = `${drawH}px`;
canvas.width = Math.floor(drawW * dpr);
canvas.height = Math.floor(drawH * dpr);
ctx.scale(dpr, dpr);

// Create DrawArea (always at origin)
const drawArea: DrawArea = { x: 0, y: 0, w: drawW, h: drawH };
```

## 2. Pointer-to-Normalized Coordinate Conversion

**Source**: `gesture.ts` lines 42-49

```typescript
const rect = canvas.getBoundingClientRect();
const x = (e.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
const y = (e.clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1);
const drawArea = getDrawArea();

const normX = (x - drawArea.x) / drawArea.w;
const normY = (y - drawArea.y) / drawArea.h;
```

### Breakdown

```
x = (e.clientX - rect.left)  // Position relative to canvas left edge
    * (canvas.width / rect.width)  // Scale by internal:CSS ratio
    / (window.devicePixelRatio || 1);  // Normalize to CSS pixels

Result: x in CSS pixels (matches DrawArea coordinates)
```

## 3. Normalized-to-Canvas Coordinate Conversion (for stickers)

**Source**: `stamp.ts` lines 34-35

```typescript
const cx = drawArea.x + sticker.x * drawArea.w;
const cy = drawArea.y + sticker.y * drawArea.h;

ctx.translate(cx, cy);
ctx.rotate(sticker.rotation);
// ... render sticker
ctx.restore();
```

## 4. Grid Density Calculation Pattern

**Source**: `partial.ts` lines 221-224

```typescript
const cols = partial.density;  // 10-80 (user-controlled)
const cellW = drawArea.w / cols;
const cellH = cellW * 1.8;  // Account for character aspect ratio
const rows = Math.floor(drawArea.h / cellH);
```

## 5. Character Position Rendering

**Source**: `partial.ts` line 267-269

```typescript
const cx = drawArea.x + col * cellW + cellW / 2;
const cy = drawArea.y + row * cellH + cellH / 2;
ctx.fillText(char, cx, cy);
```

## 6. Image Drawing at DrawArea

**Source**: `partial.ts` line 21, `stamp.ts` line 15

```typescript
ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h);
```

## 7. Sticker Hit Detection

**Source**: `gesture.ts` lines 169-179

```typescript
function findStickerAt(normX: number, normY: number): StickerInstance | null {
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const size = 0.15 * s.scale;  // Hit box size in normalized coords
    
    if (Math.abs(normX - s.x) < size && Math.abs(normY - s.y) < size) {
      return s;
    }
  }
  return null;
}
```

## 8. Drag Sticker Update

**Source**: `gesture.ts` lines 92-100

```typescript
const dx = normX - gesture.startX;
const dy = normY - gesture.startY;

const stickers = state.stickers.map(s => {
  if (s.id === gesture.activeStickerId) {
    return { ...s, x: gesture.startStickerX + dx, y: gesture.startStickerY + dy };
  }
  return s;
});

state.stickers = stickers;
notify();
```

## 9. Pinch Scale & Rotate

**Source**: `gesture.ts` lines 146-165

```typescript
const dist = distance(t0.clientX, t0.clientY, t1.clientX, t1.clientY);
const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

const scaleFactor = dist / gesture.initialDistance;
const rotationDelta = angle - gesture.initialAngle;

const stickers = state.stickers.map(s => {
  if (s.id === state.selectedStickerId) {
    return {
      ...s,
      scale: gesture.initialScale * scaleFactor,
      rotation: gesture.initialRotation + rotationDelta,
    };
  }
  return s;
});
```

## 10. Export at Full Resolution

**Source**: `compositor.ts` lines 86-115

```typescript
export function exportCanvas(): void {
  if (!canvas) return;

  // Create off-screen canvas at full image resolution
  const exportCanvas = document.createElement('canvas');
  const img = state.sourceImage!;
  exportCanvas.width = img.naturalWidth;
  exportCanvas.height = img.naturalHeight;
  const exportCtx = exportCanvas.getContext('2d')!;

  // Full-resolution DrawArea
  const exportArea: DrawArea = { 
    x: 0, 
    y: 0, 
    w: img.naturalWidth, 
    h: img.naturalHeight 
  };

  // Re-render with full resolution
  switch (state.mode) {
    case 'partial':
      renderPartialMode(exportCtx, img, exportArea);
      break;
    case 'full':
      renderFullMode(exportCtx, img, exportArea);
      break;
    case 'stamp':
      renderStampMode(exportCtx, img, exportArea);
      break;
  }

  // Download PNG
  const dataUrl = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `trace-${state.imageFileName || 'photo'}.png`;
  link.href = dataUrl;
  link.click();
}
```

## 11. Sticker Size Calculation

**Source**: `stamp.ts` lines 29-31

```typescript
const stickerSize = 0.3 * sticker.scale;  // 30% of canvas by default
const stickerW = drawArea.w * stickerSize;
const stickerH = drawArea.h * stickerSize;
```

## 12. Mask Mapping to Grid

**Source**: `partial.ts` lines 68-109

```typescript
function mapMaskToGrid(
  subjectMask: boolean[],
  partial: typeof state.partial,
  drawArea: DrawArea
): boolean[] {
  const aspect = drawArea.w / drawArea.h;
  const maskCols = MASK_RESOLUTION;  // 200
  const maskRows = Math.round(MASK_RESOLUTION / aspect);

  // Calculate target grid based on effect type
  let targetCols: number, targetRows: number;
  if (partial.effect === 'ascii') {
    targetCols = partial.density;
    const cellW = drawArea.w / targetCols;
    const cellH = cellW * 1.8;
    targetRows = Math.floor(drawArea.h / cellH);
  } else {
    targetCols = partial.density;
    const cellSize = drawArea.w / targetCols;
    targetRows = Math.floor(drawArea.h / cellSize);
  }

  const result: boolean[] = [];
  for (let row = 0; row < targetRows; row++) {
    for (let col = 0; col < targetCols; col++) {
      const maskCol = Math.floor((col / targetCols) * maskCols);
      const maskRow = Math.floor((row / targetRows) * maskRows);
      const maskIdx = maskRow * maskCols + maskCol;
      const isSubject = maskIdx < subjectMask.length ? subjectMask[maskIdx] : false;
      result.push(partial.invert ? isSubject : !isSubject);
    }
  }
  return result;
}
```

## 13. Background Gradient Centered on DrawArea

**Source**: `full.ts` lines 31-46

```typescript
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
```

## 14. Checkerboard Pattern

**Source**: `full.ts` lines 106-115

```typescript
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
```

## 15. CSS: Canvas Container

```css
.canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 8px;
  min-height: 0;
}

.main-canvas {
  display: block;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  max-width: 100%;
  max-height: 100%;
  touch-action: none;
}
```

## Key Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `MASK_RESOLUTION` | 200 | `partial.ts` | Fixed size for AI subject mask |
| `stickerSize` | 0.3 | `stamp.ts` | Default sticker size as % of canvas |
| `hitBoxSize` | 0.15 | `gesture.ts` | Sticker touch target radius |
| Character aspect | 1.8 | `partial.ts` | cellH = cellW × 1.8 |
| Checkerboard size | 10 | `full.ts` | Transparent background pattern |
| Canvas padding | 8px | `style.css` | `.canvas-container` margin |

## Common Patterns

### Pattern 1: DrawArea-Relative Positioning

```typescript
// Position (0-1) → Canvas position
const screenX = drawArea.x + normPos.x * drawArea.w;
const screenY = drawArea.y + normPos.y * drawArea.h;
```

### Pattern 2: Grid Cell Iteration

```typescript
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const x = drawArea.x + col * cellW + cellW / 2;
    const y = drawArea.y + row * cellH + cellH / 2;
    // render at (x, y)
  }
}
```

### Pattern 3: Coordinate Frame Stack (for stickers)

```typescript
ctx.save();
ctx.translate(centerX, centerY);
ctx.rotate(rotation);
ctx.globalAlpha = opacity / 100;
// Render relative to (0, 0)
ctx.restore();
```

### Pattern 4: Input Event Coordinate Conversion

```typescript
const rect = canvas.getBoundingClientRect();
const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width) / dpr;
const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height) / dpr;
const normX = (canvasX - drawArea.x) / drawArea.w;
const normY = (canvasY - drawArea.y) / drawArea.h;
```

## Common Gotchas

1. **DrawArea always at (0,0)**: Canvas origin, not offset
2. **DPR in pointer events**: Must divide by DPR after scaling
3. **Stickers in normalized space**: Store as 0-1, convert during render
4. **Character aspect ratio**: 1.8× to account for typography
5. **ctx.scale(dpr, dpr)**: Applied once per frame, affects all rendering
6. **Export resolution**: Uses full image size, no DPR scaling

