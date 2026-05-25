# Trace App: Canvas Rendering & Image Positioning Analysis

## 1. DrawArea Calculation in `compositor.ts`

### How `drawArea` is Calculated

**Location**: `src/render/compositor.ts` lines 25-56

```typescript
render(): void {
  // Get container dimensions
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Get image native dimensions
  const img = state.sourceImage;
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const containerAspect = rect.width / rect.height;

  // Calculate draw dimensions (CSS pixels)
  let drawW: number, drawH: number;
  if (imgAspect > containerAspect) {
    // Image is wider → fit to container width
    drawW = rect.width;
    drawH = rect.width / imgAspect;
  } else {
    // Image is taller → fit to container height
    drawH = rect.height;
    drawW = rect.height * imgAspect;
  }

  // Size canvas
  canvas.style.width = `${drawW}px`;    // CSS size
  canvas.style.height = `${drawH}px`;
  canvas.width = Math.floor(drawW * dpr);   // Internal resolution
  canvas.height = Math.floor(drawH * dpr);

  // Scale 2D context for DPR
  ctx.scale(dpr, dpr);

  // Create DrawArea (always starts at 0,0 - canvas-relative)
  currentDrawArea = { x: 0, y: 0, w: drawW, h: drawH };
}
```

### Key Characteristics

- **Aspect Ratio Preservation**: Image always maintains its aspect ratio
- **Contain Mode**: Image is "contained" within the container (letterboxed if needed)
- **DrawArea Structure**:
  - `x, y`: Always `0, 0` (top-left of canvas)
  - `w, h`: Same as CSS pixel dimensions (`drawW`, `drawH`)
- **Coordinate Systems**:
  - CSS pixels: used for `canvas.style.width/height` and DrawArea
  - Device pixels: used for internal `canvas.width/height` (multiplied by DPR)
  - Context is scaled by DPR to map CSS pixels → device pixels

---

## 2. How Modes Use `drawArea`

### Pattern: All modes receive `drawArea` and use it consistently

#### **Partial Mode** (`src/modes/partial.ts`)

```typescript
export function renderPartialMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  // 1. Draw photo as background
  ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h);

  // 2. Calculate grid based on drawArea dimensions
  // ASCII grid calculation
  const cols = partial.density;
  const cellW = drawArea.w / cols;
  const cellH = cellW * 1.8;  // Character aspect ratio
  const rows = Math.floor(drawArea.h / cellH);

  // 3. Render characters at positions relative to drawArea
  const cx = drawArea.x + col * cellW + cellW / 2;
  const cy = drawArea.y + row * cellH + cellH / 2;
  ctx.fillText(char, cx, cy);
}
```

**Key points**:
- Image drawn within `drawArea` bounds
- Grid density calculated from `drawArea` width
- All character positions offset by `drawArea.x` and `drawArea.y`
- Mask mapping respects `drawArea` aspect ratio

#### **Full Mode** (`src/modes/full.ts`)

```typescript
export function renderFullMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  // Background fills entire drawArea
  drawBackground(ctx, drawArea);
  
  // ASCII renders across full drawArea
  renderFullAscii(ctx, sourceImg, drawArea);
}

function drawBackground(ctx: CanvasRenderingContext2D, drawArea: DrawArea): void {
  switch (full.background) {
    case 'solid':
      ctx.fillRect(drawArea.x, drawArea.y, drawArea.w, drawArea.h);
      break;
    case 'gradient':
      // Gradient centered on drawArea
      const cx = drawArea.x + drawArea.w / 2;
      const cy = drawArea.y + drawArea.h / 2;
      // ... gradient calculation
      break;
    case 'transparent':
      // Checkerboard fills drawArea
      drawCheckerboard(ctx, drawArea);
      break;
  }
}
```

**Key points**:
- No photo visible; background replaces it
- Grid fills entire `drawArea`
- All backgrounds and gradients respect `drawArea` bounds

#### **Stamp Mode** (`src/modes/stamp.ts`)

```typescript
export function renderStampMode(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  drawArea: DrawArea
): void {
  // Photo background
  ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h);

  // Render stickers (positioned in normalized 0-1 coords)
  for (const sticker of state.stickers) {
    renderStickerAsAscii(ctx, sourceImg, sticker, drawArea);
  }
}

function renderStickerAsAscii(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  sticker: StickerInstance,
  drawArea: DrawArea
): void {
  // Sticker size as % of drawArea
  const stickerW = drawArea.w * stickerSize;
  const stickerH = drawArea.h * stickerSize;

  // Position: sticker coords (0-1) mapped to drawArea
  const cx = drawArea.x + sticker.x * drawArea.w;
  const cy = drawArea.y + sticker.y * drawArea.h;

  // Sticker rendered at this center position
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sticker.rotation);
  // ... render sticker
  ctx.restore();
}
```

**Key points**:
- Sticker coordinates stored in normalized (0-1) space
- Convert to canvas coords: `drawArea.x + normalizedPos * drawArea.w`
- Allows stickers to scale with `drawArea` size

---

## 3. Gesture Handling in `gesture.ts`

### Touch/Pointer Interaction Flow

**Location**: `src/tools/gesture.ts`

#### **Coordinate Transformation Pipeline**

```typescript
canvas.addEventListener('pointerdown', (e) => {
  // Step 1: Convert from client coords to canvas coords
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1);
  
  // Breakdown:
  // - (e.clientX - rect.left) = position relative to canvas element
  // - (canvas.width / rect.width) = scale factor (device pixels / CSS pixels)
  // - ÷ DPR = normalize back to CSS pixels (where DrawArea lives)
  // Result: x, y in CSS pixels

  // Step 2: Get drawArea
  const drawArea = getDrawArea();

  // Step 3: Normalize to 0-1 within drawArea
  const normX = (x - drawArea.x) / drawArea.w;
  const normY = (y - drawArea.y) / drawArea.h;
  
  // Now normX, normY ∈ [0, 1] for coordinates within the image
});
```

#### **Sticker Hit Detection**

```typescript
function findStickerAt(normX: number, normY: number): StickerInstance | null {
  // Search in reverse order (topmost sticker first)
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i];
    const size = 0.15 * s.scale; // ~15% of canvas in normalized coords
    
    // Check if pointer is within sticker bounds
    if (Math.abs(normX - s.x) < size && Math.abs(normY - s.y) < size) {
      return s;
    }
  }
  return null;
}
```

**Key points**:
- Stickers found by z-order (reverse iteration)
- Hit box: ±(0.15 * scale) from sticker center
- All math in normalized (0-1) space

#### **Drag Operation**

```typescript
canvas.addEventListener('pointermove', (e) => {
  // Convert pointer position
  const x = (e.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1);
  const drawArea = getDrawArea();

  // Normalize
  const normX = (x - drawArea.x) / drawArea.w;
  const normY = (y - drawArea.y) / drawArea.h;

  // Calculate delta from start
  const dx = normX - gesture.startX;
  const dy = normY - gesture.startY;

  // Update sticker position (in normalized space)
  sticker.x = gesture.startStickerX + dx;
  sticker.y = gesture.startStickerY + dy;
});
```

#### **Two-Finger Pinch (Scale & Rotate)**

```typescript
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    
    // Distance between fingers
    const dist = distance(t0.clientX, t0.clientY, t1.clientX, t1.clientY);
    
    // Angle between fingers
    const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

    // Scale factor
    const scaleFactor = dist / gesture.initialDistance;
    
    // Rotation delta
    const rotationDelta = angle - gesture.initialAngle;

    // Update sticker
    sticker.scale = gesture.initialScale * scaleFactor;
    sticker.rotation = gesture.initialRotation + rotationDelta;
  }
});
```

**Key points**:
- Scale uses distance ratio (dimension-agnostic)
- Rotation uses angle difference (always in radians)
- No DrawArea calculations needed for pinch (operates in screen coords)

### Gesture Interactions by Mode

| Event | Partial | Full | Stamp |
|-------|---------|------|-------|
| `pointerdown` on tap | Retry segmentation | Ignored | Add/select sticker |
| `pointermove` drag | Paint brush mask | N/A | Move sticker |
| `touchmove` (2-finger) | N/A | N/A | Scale & rotate |
| Eraser active | Erase pixels | Erase pixels | Ignored (handled in compositor) |

---

## 4. Export Function

**Location**: `src/render/compositor.ts` lines 86-115

### Export Process

```typescript
export function exportCanvas(): void {
  if (!canvas) return;

  // 1. Create off-screen canvas at FULL resolution (native image size)
  const exportCanvas = document.createElement('canvas');
  const img = state.sourceImage!;
  exportCanvas.width = img.naturalWidth;
  exportCanvas.height = img.naturalHeight;
  const exportCtx = exportCanvas.getContext('2d')!;

  // 2. Create DrawArea covering entire canvas
  const exportArea: DrawArea = { 
    x: 0, 
    y: 0, 
    w: img.naturalWidth,    // Full resolution
    h: img.naturalHeight
  };

  // 3. Re-render using same mode rendering function
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

  // 4. Convert to PNG and trigger download
  const dataUrl = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `trace-${state.imageFileName || 'photo'}.png`;
  link.href = dataUrl;
  link.click();
}
```

### Key Differences: Display vs. Export

| Aspect | Display Render | Export Render |
|--------|---|---|
| **Canvas Resolution** | Screen-fitted (e.g., 360×480px) | Full image (e.g., 4000×3000px) |
| **DrawArea** | Fitted to container | Full image dimensions |
| **DPR Scaling** | Applied (`ctx.scale(dpr, dpr)`) | Not applied |
| **Grid Density** | Same number of cells | Same number of cells (but larger) |
| **Quality** | On-screen display | High-resolution PNG |

**Mechanism**:
- All modes receive `drawArea` as parameter
- Export re-uses mode functions with full-resolution `drawArea`
- No special export-specific code in rendering functions
- Modes automatically scale grid density proportionally

---

## 5. CSS for Canvas Container

**Location**: `src/style.css` lines 189-206

### Container Styles

```css
/* ===== Canvas Container ===== */
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

### Analysis

#### `.canvas-container`
- **`flex: 1`**: Takes remaining space in flex column layout
- **`display: flex`**: Centers canvas within container
- **`align-items: center; justify-content: center`**: Centers canvas both axes
- **`overflow: hidden`**: Clips any overflowing content
- **`padding: 8px`**: 8px margin around canvas
- **`min-height: 0`**: Allows flex shrinking below content height

#### `.main-canvas`
- **`display: block`**: No inline spacing issues
- **`border-radius: 8px`**: Rounded corners (cosmetic)
- **`box-shadow`**: Subtle shadow for depth
- **`max-width: 100%; max-height: 100%`**: Respects container bounds
- **`touch-action: none`**: Prevents browser touch behaviors (scrolling, pinch)

### Layout Flow

```
#app (max-width: 430px)
  ├─ .navbar
  ├─ .canvas-container (flex: 1)
  │   └─ .main-canvas (centered via flexbox)
  ├─ .mode-nav
  └─ .panel
```

The canvas is always:
1. Centered within `.canvas-container`
2. Aspect-ratio preserved (handled by `compositor.ts`)
3. Clipped by container overflow
4. Sized within 8px padding

---

## 6. Responsive Behavior

### Breakpoints

```css
@media (max-height: 700px) {
  .panel {
    max-height: 200px;
    min-height: 160px;
  }
  .canvas-container {
    padding: 4px;  /* Reduced from 8px */
  }
}

@media (min-width: 431px) {
  #app {
    border-left: 1px solid #ECEAE6;
    border-right: 1px solid #ECEAE6;
  }
}
```

### Behavior on Resize

When window resizes:
1. `container.getBoundingClientRect()` returns new dimensions
2. `render()` recalculates `drawW`, `drawH`
3. Canvas is resized to new dimensions
4. Next frame re-renders with new DrawArea
5. All positions (stickers, grid) automatically scale

---

## 7. Coordinate System Summary

### Three-Layer Coordinate Mapping

```
┌─────────────────────────────────────────────┐
│ 1. Screen/Client Coordinates                │
│    (e.clientX, e.clientY from events)      │
│    └─ Subtract canvas.getBoundingClientRect()
│       └─ Account for DPR scaling
│          └─ Divide by DPR
│                        │
│                        ▼
├─────────────────────────────────────────────┤
│ 2. CSS Pixel Coordinates                    │
│    (Canvas CSS pixels, matches DrawArea)   │
│    └─ Subtract drawArea.x, drawArea.y
│    └─ Divide by drawArea.w, drawArea.h
│                        │
│                        ▼
├─────────────────────────────────────────────┤
│ 3. Normalized Coordinates (0-1)             │
│    (Image-relative, for sticker positions) │
└─────────────────────────────────────────────┘
```

### DrawArea Role

**DrawArea** is the bridge between:
- **Physical canvas** (device pixels, internal resolution)
- **Rendering space** (CSS pixels, where grid is calculated)
- **Normalized space** (0-1, where sticker positions are stored)

---

## 8. Summary Table

| Aspect | Details |
|--------|---------|
| **DrawArea Origin** | Always `(0, 0)` on canvas |
| **DrawArea Size** | Fitted to container, maintains image aspect ratio |
| **Calculation** | Letterbox logic: fit to width or height |
| **Update Frequency** | Every frame (in `render()`) |
| **Used By** | All modes, gestures, export |
| **Coordinate Precision** | CSS pixels (1/DPR of device pixels) |
| **Canvas Scaling** | DPR-aware via `ctx.scale(dpr, dpr)` |
| **Sticker Storage** | Normalized (0-1) within DrawArea |
| **Export** | Re-renders with DrawArea = full image size |
| **Gesture Hit Test** | Normalized coords vs. sticker.x/y |
| **Grid Calculation** | Density × DrawArea.w determines cell count |

---

## 9. Key Insights

### Design Principles

1. **Single Source of Truth**: DrawArea calculated once per frame, passed to all functions
2. **Aspect Ratio Preservation**: Letterbox approach ensures image is never distorted
3. **Resolution Independence**: DrawArea dimensions used for all spatial calculations
4. **Normalized Sticker Coords**: Allows stickers to scale with window size
5. **DPR Transparency**: High-DPI displays handled automatically via `ctx.scale()`

### Performance Considerations

- DrawArea recalculated every frame (necessary for responsive resizing)
- No caching needed; calculation is O(1)
- Mode rendering functions scale with grid density, not canvas size
- Export uses same rendering pipeline (efficient reuse)

### Potential Pain Points

- Coordinate transformation is repeated in three places (compositor, gesture, eraser)
- Could be extracted to shared utility function
- DrawArea always at (0,0); if canvas ever needs offset, all transforms must change

