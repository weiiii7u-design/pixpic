# Trace App: Rendering & Positioning Flow Diagrams

## Canvas Initialization & Render Loop

```
┌─────────────────────────────────────────────────────────────┐
│ initCompositor(canvas)                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Store canvas & ctx                                       │
│ 2. setupInputHandlers(canvas)  ← for brush/eraser          │
│ 3. setupGestureHandlers(canvas) ← for stickers             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ startRenderLoop()                                           │
├─────────────────────────────────────────────────────────────┤
│ function loop() {                                           │
│   render()               ← 60fps                            │
│   requestAnimationFrame(loop)                               │
│ }                                                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ render()                                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Get container dimensions                                │
│ 2. Calculate drawW, drawH (letterbox)                       │
│ 3. Set canvas.style.width/height (CSS)                      │
│ 4. Set canvas.width/height (device pixels × DPR)            │
│ 5. ctx.scale(dpr, dpr)                                      │
│ 6. Create currentDrawArea = {x:0, y:0, w:drawW, h:drawH}   │
│ 7. ctx.clearRect(0, 0, drawW, drawH)                        │
│ 8. Call renderXxxMode(ctx, img, drawArea) based on mode     │
└─────────────────────────────────────────────────────────────┘
```

## DrawArea Calculation Logic

```
User Image (naturalWidth × naturalHeight)
│
├─ Example: 4000×3000 (4:3)
│
Container (400×600 = 2:3)
│
▼
┌─────────────────────────────────────┐
│ imgAspect = 4000/3000 ≈ 1.33        │
│ containerAspect = 400/600 ≈ 0.67    │
│                                     │
│ imgAspect > containerAspect? YES ✓  │
│ → Image is WIDER than container     │
│ → Fit to container WIDTH            │
│                                     │
│ drawW = 400        (container width)│
│ drawH = 400/1.33 = 300              │
└─────────────────────────────────────┘
         │
         ▼
    Canvas in Browser
    ┌─────────────────────┐
    │                     │  600px (container height)
    │  ┌───────────────┐  │
    │  │  Canvas       │  │  300px (drawH)
    │  │  400×300      │  │
    │  └───────────────┘  │
    │                     │
    └─────────────────────┘
    400px (container width)

DrawArea = { x: 0, y: 0, w: 400, h: 300 }
```

## Coordinate Transformation: Pointer Event

```
User touches/clicks canvas
│
│ PointerEvent: e.clientX = 250, e.clientY = 180
│
▼
┌─────────────────────────────────────────────┐
│ rect = canvas.getBoundingClientRect()       │
│ → {left: 100, top: 150, ...}                │
├─────────────────────────────────────────────┤
│ STEP 1: Relative to canvas element         │
│ x = e.clientX - rect.left = 250 - 100 = 150│
│ y = e.clientY - rect.top = 180 - 150 = 30  │
├─────────────────────────────────────────────┤
│ STEP 2: Account for device pixel ratio      │
│ x *= canvas.width / rect.width              │
│   = 150 * (800 / 400) = 150 * 2 = 300      │
│ y *= canvas.height / rect.height            │
│   = 30 * (600 / 300) = 30 * 2 = 60         │
├─────────────────────────────────────────────┤
│ STEP 3: Normalize to CSS pixels (÷ DPR)     │
│ x /= 2 (DPR) = 150                          │
│ y /= 2 (DPR) = 30                           │
│ → (150, 30) in CSS pixels                   │
└─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│ STEP 4: Normalize to DrawArea (0-1)         │
│ drawArea = {x: 0, y: 0, w: 400, h: 300}    │
│                                             │
│ normX = (150 - 0) / 400 = 0.375            │
│ normY = (30 - 0) / 300 = 0.1               │
│ → (0.375, 0.1) in normalized coords         │
└─────────────────────────────────────────────┘
```

## Sticker Position in Three Spaces

```
Sticker coordinates in AppState:
  sticker.x = 0.5 (center of image, normalized)
  sticker.y = 0.5

Rendering (CSS pixel space):
  drawArea = { x: 0, y: 0, w: 400, h: 300 }
  
  canvasX = drawArea.x + sticker.x * drawArea.w
          = 0 + 0.5 * 400 = 200
  
  canvasY = drawArea.y + sticker.y * drawArea.h
          = 0 + 0.5 * 300 = 150
  
  Sticker center drawn at (200, 150) in CSS pixels
  
Device pixel space (on 2× DPR screen):
  deviceX = canvasX * DPR = 200 * 2 = 400
  deviceY = canvasY * DPR = 150 * 2 = 300

Screen space:
  screenX = rect.left + canvasX = 100 + 200 = 300
  screenY = rect.top + canvasY = 150 + 150 = 300
```

## Mode Rendering Pipelines

### Partial Mode: Photo + ASCII on Subject

```
renderPartialMode(ctx, sourceImg, drawArea)
│
├─ 1. Draw photo background
│  └─ ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h)
│
├─ 2. Determine mask
│  ├─ If brush target:
│  │  └─ Use state.brushMask (user-painted)
│  │
│  └─ If auto target:
│     ├─ If error/loading:
│     │  └─ renderErrorOverlay() or renderLoadingOverlay()
│     │
│     └─ Else:
│        ├─ Get state.subjectMask (from AI segmentation)
│        └─ mapMaskToGrid(subjectMask, partial, drawArea)
│           → resample to match grid density
│
├─ 3. Render effect layer
│  ├─ If ASCII:
│  │  └─ renderPartialAscii(ctx, sourceImg, drawArea, mask)
│  │     └─ renderAsciiRegion() or renderMultiColorAscii()
│  │
│  └─ If Symbols:
│     └─ renderPartialSymbols()
│        └─ renderSymbolsGrid()
│
└─ Result: Photo with ASCII/symbols overlaid on subject or background
```

### Full Mode: Pure ASCII (No Photo)

```
renderFullMode(ctx, sourceImg, drawArea)
│
├─ 1. drawBackground(ctx, drawArea)
│  ├─ Solid: fillRect with color
│  ├─ Gradient: createLinearGradient → fillRect
│  └─ Transparent: drawCheckerboard()
│
├─ 2. renderFullAscii(ctx, sourceImg, drawArea)
│  └─ renderAsciiRegion() across entire drawArea
│     └─ Sample image for luminance
│     └─ Map luminance → characters
│
└─ Result: ASCII art on background (no photo visible)
```

### Stamp Mode: Photo + ASCII Stickers

```
renderStampMode(ctx, sourceImg, drawArea)
│
├─ 1. Draw photo background
│  └─ ctx.drawImage(sourceImg, drawArea.x, drawArea.y, drawArea.w, drawArea.h)
│
├─ 2. For each sticker in state.stickers
│  └─ renderStickerAsAscii(ctx, sourceImg, sticker, drawArea)
│     │
│     ├─ Calculate sticker size in pixels
│     │  └─ stickerW = drawArea.w * (0.3 * sticker.scale)
│     │  └─ stickerH = drawArea.h * (0.3 * sticker.scale)
│     │
│     ├─ Map sticker position to canvas
│     │  └─ cx = drawArea.x + sticker.x * drawArea.w
│     │  └─ cy = drawArea.y + sticker.y * drawArea.h
│     │
│     ├─ ctx.save()
│     ├─ ctx.translate(cx, cy)
│     ├─ ctx.rotate(sticker.rotation)
│     │
│     ├─ Sample source image at sticker region
│     ├─ Render ASCII halftone within sticker bounds
│     │
│     ├─ ctx.restore()
│     │
│     └─ Draw selection highlight if selected
│
└─ Result: Photo with ASCII stickers overlaid (draggable, rotatable, scalable)
```

## Export vs. Display Rendering

```
DISPLAY RENDERING
─────────────────
1. Container size: ~400×300 (screen visible area)
2. Canvas resolution: 800×600 (device pixels, 2× DPR)
3. DrawArea: {x:0, y:0, w:400, h:300} (CSS pixels)
4. Grid cells: e.g., 40 columns × 25 rows
5. Export: None

─────────────────────────────────────────────────

EXPORT RENDERING
────────────────
1. Create new off-screen canvas
2. Canvas resolution: 4000×3000 (native image size, no DPR)
3. DrawArea: {x:0, y:0, w:4000, h:3000} (full image)
4. Grid cells: 40 columns × 25 rows (same # but 10× larger)
5. Result: High-resolution PNG saved to disk

───────────────────────────────────────────────

Key insight: modes are RESOLUTION-INDEPENDENT
They work at any DrawArea size → export is automatic upscaling
```

## Gesture Event Handling Flow

### Single Tap (Stamp Mode)

```
pointerdown event
│
├─ Check: mode === 'stamp' && !eraserActive
│
├─ Convert to canvas coords
│  └─ (e.clientX, e.clientY) → CSS pixels
│
├─ Normalize to DrawArea (0-1)
│  └─ normX = (x - drawArea.x) / drawArea.w
│  └─ normY = (y - drawArea.y) / drawArea.h
│
├─ Hit test: findStickerAt(normX, normY)
│  │
│  ├─ Search reverse (topmost first)
│  └─ Check: |normX - s.x| < 0.15*scale && |normY - s.y| < 0.15*scale
│
├─ If hit:
│  └─ Start drag: gesture.isDragging = true
│  └─ Select sticker: updateState({selectedStickerId})
│
└─ If miss:
   └─ Add new sticker at tap position
   └─ newSticker.x = normX
   └─ newSticker.y = normY
```

### Two-Finger Pinch

```
touchstart event (2 fingers)
│
└─ Record initial state:
   ├─ gesture.initialDistance = distance(touch0, touch1)
   ├─ gesture.initialScale = sticker.scale
   ├─ gesture.initialAngle = atan2(touch1 - touch0)
   ├─ gesture.initialRotation = sticker.rotation

touchmove event (2 fingers)
│
├─ Calculate current distance & angle
│  ├─ dist = distance(e.touches[0], e.touches[1])
│  └─ angle = atan2(...)
│
├─ Calculate deltas
│  ├─ scaleFactor = dist / gesture.initialDistance
│  └─ rotationDelta = angle - gesture.initialAngle
│
└─ Update sticker
   ├─ sticker.scale = gesture.initialScale * scaleFactor
   └─ sticker.rotation = gesture.initialRotation + rotationDelta

touchend / touchcancel
│
└─ Finalize state
```

## Input Handler Priority (Compositor)

```
pointerdown event on canvas
│
├─ PARTIAL mode + auto target
│  ├─ If error exists: clear error, return
│  ├─ If loading: cancel loading, return
│  └─ Else: continue to gesture handlers
│
├─ STAMP mode + !eraserActive
│  └─ Return (handled by gesture handlers)
│
└─ Otherwise: handleInteraction()
   │
   ├─ If PARTIAL + brush target + brushActive
   │  └─ applyBrush(pos.x, pos.y, drawArea)
   │
   └─ If eraserActive + (PARTIAL or FULL)
      └─ applyEraser(pos.x, pos.y, drawArea)
```

## CSS Container Layout

```
#app (max-width: 430px, flex column)
│
├─ .navbar (flex-shrink: 0)
│  └─ height: auto (navbar height + safe area)
│
├─ .canvas-container (flex: 1, overflow: hidden, padding: 8px)
│  │
│  │ display: flex
│  │ align-items: center
│  │ justify-content: center
│  │
│  └─ .main-canvas
│     └─ max-width: 100%
│     └─ max-height: 100%
│     └─ (actual size set by compositor.ts)
│
├─ .mode-nav (flex-shrink: 0)
│  └─ height: ~40px
│
└─ .panel (flex-shrink: 0)
   └─ max-height: 260px
   └─ overflow-y: auto
```

## DPR (Device Pixel Ratio) Handling

```
2× DPR (Retina display)
─────────────────────

Container: 400×300 CSS pixels

Canvas creation:
  canvas.style.width = "400px"
  canvas.style.height = "300px"
  canvas.width = 800  (400 × 2)
  canvas.height = 600 (300 × 2)

Context scaling:
  ctx.scale(2, 2)

Result: Rendering at 2× resolution internally
        Displayed at 1× size on screen
        Sharp text & edges on high-DPI displays


DrawArea always uses CSS pixels:
  DrawArea = { x: 0, y: 0, w: 400, h: 300 }

Rendering math uses CSS pixel coordinates:
  Character position: cx = x_css_pixel
  ctx.fillText(char, cx, cy)  ← Already scaled by ctx.scale()
```

