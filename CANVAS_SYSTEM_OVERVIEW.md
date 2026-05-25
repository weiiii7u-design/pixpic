# Trace App: Canvas Rendering & Image Positioning System

## 📚 Documentation Files

This package contains comprehensive documentation of the Trace app's canvas rendering and image positioning system:

1. **CANVAS_ANALYSIS.md** (16 KB)
   - Deep dive into DrawArea calculation
   - How all three modes use DrawArea
   - Gesture handling with coordinate transformations
   - Export function mechanics
   - CSS styling analysis
   - 9 detailed sections with code examples

2. **RENDERING_FLOW.md** (14 KB)
   - Visual flowcharts and ASCII diagrams
   - Canvas initialization & render loop
   - Coordinate transformation pipeline
   - Mode-specific rendering pipelines (Partial, Full, Stamp)
   - Display vs. Export rendering comparison
   - Gesture event flows
   - CSS layout hierarchy
   - DPR handling details

3. **CODE_REFERENCE.md** (10 KB)
   - Quick copy-paste code snippets from actual source
   - All 15 key patterns with line numbers
   - Common patterns (4 reusable patterns)
   - Common gotchas and solutions
   - Key constants table

---

## 🎯 Quick Start: Understanding the System

### The Core Concept: DrawArea

**DrawArea** is a single struct that represents the drawable region in CSS pixel space:

```typescript
interface DrawArea {
  x: number;  // always 0 (canvas origin)
  y: number;  // always 0 (canvas origin)
  w: number;  // canvas width in CSS pixels
  h: number;  // canvas height in CSS pixels
}
```

Every frame, the compositor calculates a new `drawArea` based on:
- Container dimensions
- Image aspect ratio
- Letterbox logic (fit to width OR height)

### The Three Coordinate Spaces

```
1. Screen/Client (e.clientX, e.clientY)
         ↓ subtract rect offset, scale by DPR ratio
2. CSS Pixels (matches DrawArea)
         ↓ subtract drawArea.x/y, divide by drawArea.w/h
3. Normalized (0-1) for storage
```

### The Three Modes

| Mode | Behavior | Input | Uses DrawArea For |
|------|----------|-------|-------------------|
| **Partial** | Photo + ASCII on subject | AI segmentation or brush | Fitting grid to image |
| **Full** | Pure ASCII (no photo) | Solid/gradient/transparent background | Filling entire canvas |
| **Stamp** | Photo + ASCII stickers | User-placed stickers | Converting sticker positions |

---

## 🔍 What Each Section Covers

### CANVAS_ANALYSIS.md

#### Section 1: DrawArea Calculation
- **What**: How `render()` computes DrawArea each frame
- **Key Formula**: Letterbox logic comparing aspect ratios
- **Why It Matters**: Foundation for all spatial calculations
- **Example**: 4000×3000 image in 400×600 container → DrawArea = {0,0,400,300}

#### Section 2: How Modes Use DrawArea
- **Partial**: Image position, grid density, cell sizing
- **Full**: Background filling, gradient centering
- **Stamp**: Photo background, sticker positioning
- **Pattern**: All receive `drawArea` as parameter

#### Section 3: Gesture Handling
- **Coordinate Pipeline**: Client → CSS pixels → Normalized (0-1)
- **Hit Detection**: Reverse iteration, bounding box check
- **Drag**: Calculate delta, update normalized position
- **Pinch**: Scale factor & rotation delta
- **Table**: Gesture interactions by mode

#### Section 4: Export Function
- **Mechanism**: Create off-screen canvas at full resolution
- **DrawArea Transformation**: {w: sourceImg.naturalWidth, h: sourceImg.naturalHeight}
- **Comparison Table**: Display vs. Export rendering
- **Key Insight**: Modes are resolution-independent

#### Section 5: CSS Styling
- **.canvas-container**: Flex centering, overflow hidden, padding
- **.main-canvas**: Block display, max-width/height, touch-action none
- **Layout Flow**: Navbar → Container → Mode Nav → Panel
- **Responsive**: Media queries for small screens

#### Sections 6-9: Context
- Responsive behavior on window resize
- Three-layer coordinate mapping diagram
- Summary table of all DrawArea aspects
- Design principles & performance notes

---

### RENDERING_FLOW.md

#### Visual Diagrams
- **Canvas Initialization**: initCompositor → render loop
- **DrawArea Calculation**: Step-by-step aspect ratio logic
- **Coordinate Transformation**: Pointer event conversion with examples
- **Sticker Positions**: How positions map across three spaces
- **Mode Pipelines**: Tree diagrams for Partial/Full/Stamp rendering
- **Export vs Display**: Side-by-side comparison
- **Gesture Flows**: Single-tap and pinch-zoom sequences
- **Input Handler Priority**: Event routing by mode
- **CSS Layout**: Component hierarchy
- **DPR Handling**: 2× DPR example with calculations

#### Use Case
- **When to use**: Need to visualize relationships
- **Format**: ASCII diagrams, pseudocode, annotations
- **Audience**: Visual learners, system designers

---

### CODE_REFERENCE.md

#### 15 Code Snippets
1. DrawArea Calculation Pattern
2. Pointer-to-Normalized Conversion
3. Normalized-to-Canvas Conversion
4. Grid Density Calculation
5. Character Position Rendering
6. Image Drawing at DrawArea
7. Sticker Hit Detection
8. Drag Sticker Update
9. Pinch Scale & Rotate
10. Export at Full Resolution
11. Sticker Size Calculation
12. Mask Mapping to Grid
13. Background Gradient
14. Checkerboard Pattern
15. CSS Styling

#### Supporting Tables
- **Constants**: MASK_RESOLUTION, stickerSize, hitBoxSize, etc.
- **Common Patterns**: 4 reusable patterns with snippets
- **Gotchas**: 6 common mistakes and solutions

#### Use Case
- **When to use**: Implementing similar features
- **Format**: Copy-paste ready with line references
- **Audience**: Developers adding new functionality

---

## 🧭 Navigation Guide

### I want to understand...

**How canvas sizing works**
1. Read CANVAS_ANALYSIS.md §1 (DrawArea Calculation)
2. View RENDERING_FLOW.md "DrawArea Calculation Logic" diagram
3. Reference CODE_REFERENCE.md §1 (DrawArea Calculation Pattern)

**How sticker positioning works**
1. Read CANVAS_ANALYSIS.md §2 (Stamp Mode)
2. View RENDERING_FLOW.md "Sticker Position in Three Spaces"
3. Reference CODE_REFERENCE.md §3 (Normalized-to-Canvas Conversion)

**How touch/pointer events map to coordinates**
1. Read CANVAS_ANALYSIS.md §3 (Gesture Handling)
2. View RENDERING_FLOW.md "Coordinate Transformation Pipeline"
3. Reference CODE_REFERENCE.md §2 (Pointer-to-Normalized Conversion)

**How the export works**
1. Read CANVAS_ANALYSIS.md §4 (Export Function)
2. View RENDERING_FLOW.md "Export vs. Display Rendering"
3. Reference CODE_REFERENCE.md §10 (Export at Full Resolution)

**How all three modes differ**
1. Read CANVAS_ANALYSIS.md §2 (How Modes Use DrawArea)
2. View RENDERING_FLOW.md "Mode Rendering Pipelines"
3. Compare the mode-specific sections

---

## 💡 Key Insights

### 1. Single Source of Truth
DrawArea is calculated once per frame in `compositor.render()` and passed to all rendering functions. This ensures consistency across all coordinate calculations.

### 2. Aspect Ratio Preservation
The letterbox algorithm compares image and container aspect ratios, then fits to the more restrictive dimension. This prevents distortion regardless of image orientation.

### 3. Resolution Independence
Mode rendering functions don't know about screen resolution. They work at any DrawArea size:
- Display: DrawArea = container size (~400×300)
- Export: DrawArea = image size (~4000×3000)

The same rendering code produces both screen display and high-resolution PNG.

### 4. Three Coordinate Systems
Apps need to translate between screen coordinates (events), CSS pixels (rendering), and normalized coordinates (storage). The system does this consistently:
- Events use `canvas.getBoundingClientRect()` + DPR math
- Rendering uses DrawArea for positioning
- Storage uses normalized (0-1) space for flexibility

### 5. DPR Transparency
High-DPI displays are handled automatically via `ctx.scale(dpr, dpr)`. All rendering math uses CSS pixels, and the 2D context scales internally.

---

## 🔧 Common Tasks

### Adding a new rendering effect

1. **Create mode function** taking `(ctx, img, drawArea)`
2. **Use drawArea for positioning**:
   ```typescript
   const cellW = drawArea.w / density;
   const cellH = drawArea.h / rows;
   const cx = drawArea.x + col * cellW + cellW / 2;
   ```
3. **Call from compositor** switch statement
4. **Register in exportCanvas**

Example: See CANVAS_ANALYSIS.md §2 (Partial/Full mode patterns)

### Fixing coordinate math bugs

1. **Identify coordinate space** (screen, CSS pixels, or normalized)
2. **Use transformation pipeline** in CODE_REFERENCE.md §4 (Coordinate Conversion)
3. **Check DPR handling** in CODE_REFERENCE.md Gotchas #2

### Implementing new gesture

1. **Convert pointer to normalized coords** (CODE_REFERENCE.md §2)
2. **Update state in normalized space** (CODE_REFERENCE.md §8)
3. **Rendering automatically uses normalized coords** (CODE_REFERENCE.md §3)

---

## 📊 File Organization

```
trace-app/
├── CANVAS_SYSTEM_OVERVIEW.md    ← You are here
├── CANVAS_ANALYSIS.md            ← Deep technical analysis
├── RENDERING_FLOW.md             ← Visual diagrams
├── CODE_REFERENCE.md             ← Copy-paste snippets
│
├── src/
│   ├── render/
│   │   └── compositor.ts         ← DrawArea calculation (§1)
│   ├── modes/
│   │   ├── partial.ts            ← Mode usage (§2)
│   │   ├── full.ts
│   │   └── stamp.ts
│   ├── tools/
│   │   └── gesture.ts            ← Gesture handling (§3)
│   └── style.css                 ← CSS analysis (§5)
```

---

## 🚀 Quick Reference

### DrawArea Origin
Always `(0, 0)` — canvas top-left corner

### DrawArea Dimensions
CSS pixels, calculated each frame from container and image aspect ratios

### Coordinate Pipeline
`e.clientX` → CSS pixels → Normalized (0-1)

### Sticker Storage
Normalized (0-1) within DrawArea

### Export Resolution
`{w: img.naturalWidth, h: img.naturalHeight}`

### DPR Scaling
Applied once via `ctx.scale(dpr, dpr)` after canvas creation

### Character Aspect Ratio
1.8× (cellW × 1.8 = cellH)

---

## 📖 Document Statistics

| Document | Size | Sections | Code Snippets | Diagrams |
|----------|------|----------|---------------|----------|
| CANVAS_ANALYSIS.md | 16 KB | 9 | 15+ | 2 |
| RENDERING_FLOW.md | 14 KB | 10 | 20+ | 10 |
| CODE_REFERENCE.md | 10 KB | 4 | 40+ | 0 |
| **Total** | **40 KB** | **23** | **75+** | **12** |

---

## 🎓 Learning Path

### Beginner: "I want to understand the basics"
1. Read this overview (you are here!)
2. View RENDERING_FLOW.md "Canvas Initialization" diagram
3. Read CANVAS_ANALYSIS.md §1 (DrawArea)
4. Skim CODE_REFERENCE.md §1-3

**Time**: ~15 minutes

### Intermediate: "I'm implementing a feature"
1. Read CANVAS_ANALYSIS.md (entire)
2. View RENDERING_FLOW.md (entire)
3. Reference CODE_REFERENCE.md as needed

**Time**: ~45 minutes

### Advanced: "I'm debugging complex issues"
1. All documents from start to finish
2. Compare against actual source files
3. Trace through coordinate transformations step-by-step

**Time**: ~2 hours

---

Generated: 2026-05-17
Last Updated: 2026-05-17
Version: 1.0

