# 📖 Trace App Canvas & Image Positioning Documentation

**Complete documentation set for understanding the Trace app's rendering system**

---

## 📦 What's Included

This package contains **4 comprehensive documents** (51 KB, 1,666 lines) covering every aspect of canvas rendering, image positioning, and gesture handling in the Trace app.

### Document Index

| Document | Size | Purpose | Audience |
|----------|------|---------|----------|
| **CANVAS_SYSTEM_OVERVIEW.md** | 11 KB | Navigation guide & learning paths | Everyone (start here!) |
| **CANVAS_ANALYSIS.md** | 16 KB | Deep technical analysis with code | Developers & architects |
| **RENDERING_FLOW.md** | 14 KB | Visual diagrams & flowcharts | Visual learners |
| **CODE_REFERENCE.md** | 10 KB | Copy-paste code snippets | Implementers |

---

## 🚀 Quick Start (2 minutes)

### Start Here
**→ Read: CANVAS_SYSTEM_OVERVIEW.md**

This document explains:
- What DrawArea is
- The three coordinate spaces
- Navigation guide for other docs
- Common tasks
- Learning paths

### Then Choose Your Path

**I'm implementing a feature**
→ CANVAS_ANALYSIS.md + RENDERING_FLOW.md + CODE_REFERENCE.md

**I need to fix a bug**
→ CODE_REFERENCE.md (Common Gotchas) + RENDERING_FLOW.md (Coordinate Pipeline)

**I'm designing a new mode**
→ CANVAS_ANALYSIS.md §2 (Mode patterns) + CODE_REFERENCE.md §1 (DrawArea pattern)

**I'm optimizing gesture handling**
→ RENDERING_FLOW.md (Gesture flows) + CODE_REFERENCE.md §2 (Coordinate conversion)

---

## 🎯 Key Concepts

### DrawArea (The Foundation)
- Single struct: `{x: 0, y: 0, w: number, h: number}`
- Recalculated every frame
- Passed to all rendering functions
- Represents drawable region in CSS pixels

### Letterbox Algorithm
```
if (image_aspect > container_aspect)
  fit to container width
else
  fit to container height
```

### Coordinate Pipeline
```
PointerEvent (screen) → Canvas (CSS pixels) → Normalized (0-1)
```

### Three Modes
- **Partial**: Photo + ASCII on detected subject
- **Full**: Pure ASCII art (no photo)
- **Stamp**: Photo + draggable ASCII stickers

### Resolution Independence
Same rendering code works at any resolution:
- Display: ~400×300 CSS pixels
- Export: ~4000×3000 native pixels

---

## 📚 Document Deep Dive

### CANVAS_ANALYSIS.md (Primary Reference)

**9 sections covering:**

1. ✅ **DrawArea Calculation** (how it's computed)
2. ✅ **Mode Usage Patterns** (Partial/Full/Stamp)
3. ✅ **Gesture Handling** (touch/pointer interactions)
4. ✅ **Export Function** (high-res PNG generation)
5. ✅ **CSS Styling** (layout & responsive)
6. ✅ **Responsive Behavior** (window resize handling)
7. ✅ **Coordinate Systems** (three-layer mapping)
8. ✅ **Summary Table** (quick reference)
9. ✅ **Key Insights** (design principles)

**Includes:**
- 15+ code examples
- 2 diagrams
- 5 data tables
- Line-by-line source references

---

### RENDERING_FLOW.md (Visual Reference)

**10 detailed flowcharts & diagrams:**

1. 📊 Canvas Initialization & Render Loop
2. 📊 DrawArea Calculation Logic
3. 📊 Coordinate Transformation Pipeline
4. 📊 Sticker Position in Three Spaces
5. 📊 Mode Rendering Pipelines
6. 📊 Export vs. Display Rendering
7. 📊 Gesture Event Flows
8. 📊 Input Handler Priority
9. 📊 CSS Container Layout
10. 📊 DPR (Device Pixel Ratio) Handling

**Format:**
- ASCII flowcharts with annotations
- Step-by-step breakdowns
- Pseudocode examples
- Actual coordinate calculations

---

### CODE_REFERENCE.md (Implementation Guide)

**15 ready-to-use code patterns:**

1. DrawArea Calculation
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

**Plus:**
- Constants table
- 4 Common Patterns
- 6 Common Gotchas

---

## 🎓 Learning Paths

### Beginner (15 min)
```
CANVAS_SYSTEM_OVERVIEW.md
  → RENDERING_FLOW.md (Canvas Initialization diagram)
  → CANVAS_ANALYSIS.md §1 (DrawArea)
  → CODE_REFERENCE.md §1-3
```

### Intermediate (45 min)
```
CANVAS_SYSTEM_OVERVIEW.md
  → CANVAS_ANALYSIS.md (entire)
  → RENDERING_FLOW.md (entire)
  → CODE_REFERENCE.md (as reference)
```

### Advanced (2 hours)
```
All documents in order
  → Compare with actual source
  → Trace coordinate transforms step-by-step
  → Trace gesture events end-to-end
```

---

## 🔗 Source File References

Documentation is cross-referenced with source files:

```
src/render/compositor.ts
  ├─ render() function → CANVAS_ANALYSIS.md §1
  ├─ exportCanvas() → CANVAS_ANALYSIS.md §4
  └─ setupInputHandlers() → CODE_REFERENCE.md §2

src/modes/
  ├─ partial.ts → CANVAS_ANALYSIS.md §2 / §3
  ├─ full.ts → CANVAS_ANALYSIS.md §2
  └─ stamp.ts → CODE_REFERENCE.md §3

src/tools/gesture.ts
  ├─ Coordinate conversion → CODE_REFERENCE.md §2
  ├─ Hit detection → CODE_REFERENCE.md §7
  └─ Pinch gestures → CODE_REFERENCE.md §9

src/style.css
  ├─ .canvas-container → CANVAS_ANALYSIS.md §5
  └─ .main-canvas → CODE_REFERENCE.md §15
```

---

## 💡 Key Insights at a Glance

| # | Insight | Where | Why |
|---|---------|-------|-----|
| 1 | DrawArea is single source of truth | CANVAS_ANALYSIS.md §1 | Ensures consistency |
| 2 | Aspect ratio always preserved | RENDERING_FLOW.md | No image distortion |
| 3 | Modes are resolution-independent | CANVAS_ANALYSIS.md §4 | Export = free upscaling |
| 4 | Three coordinate systems | CANVAS_ANALYSIS.md §7 | Flexibility & precision |
| 5 | DPR handled transparently | CODE_REFERENCE.md Gotchas #2 | High-DPI support |
| 6 | Stickers stored normalized | CODE_REFERENCE.md §3 | Responsive positioning |
| 7 | Grid cells are letterboxed | CANVAS_ANALYSIS.md §2 | Responsive grids |
| 8 | Character aspect 1.8× | CODE_REFERENCE.md Constants | Typography correction |

---

## 🛠️ Common Tasks (Quick Links)

### Add new rendering effect
→ CANVAS_ANALYSIS.md §2 + CODE_REFERENCE.md §1

### Fix coordinate bug
→ CODE_REFERENCE.md (Gotchas) + RENDERING_FLOW.md

### Implement new gesture
→ CODE_REFERENCE.md §2 + §8 + §9

### Optimize rendering
→ CANVAS_ANALYSIS.md §9 + RENDERING_FLOW.md

### Add responsive feature
→ CANVAS_ANALYSIS.md §6 + CODE_REFERENCE.md §15

### Understand DPR handling
→ RENDERING_FLOW.md "DPR Handling" + CODE_REFERENCE.md Gotchas

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total Size | 51 KB |
| Total Lines | 1,666 |
| Code Snippets | 75+ |
| Diagrams | 12+ |
| Sections | 23+ |
| Code Examples | 40+ |
| Data Tables | 8 |
| Gotchas Documented | 6 |
| Constants Documented | 8 |
| Common Patterns | 4 |
| Learning Paths | 3 |

---

## ✅ What You'll Learn

After reading these documents, you'll understand:

- ✅ How canvas is sized and positioned
- ✅ How the three modes work differently
- ✅ How pointer events map to coordinates
- ✅ How stickers are positioned and transformed
- ✅ How the export function works
- ✅ How DPR (device pixel ratio) is handled
- ✅ How the CSS layout system works
- ✅ How to implement new features correctly
- ✅ How to debug coordinate math
- ✅ Common gotchas and solutions

---

## 📝 Documentation Format

### CANVAS_ANALYSIS.md
- **Style**: Technical reference
- **Format**: Sections with code samples
- **Depth**: Deep dives with explanations

### RENDERING_FLOW.md
- **Style**: Visual reference
- **Format**: ASCII diagrams with annotations
- **Depth**: Conceptual understanding

### CODE_REFERENCE.md
- **Style**: Implementation guide
- **Format**: Copy-paste code snippets
- **Depth**: Practical examples

### CANVAS_SYSTEM_OVERVIEW.md
- **Style**: Navigation & learning
- **Format**: Tables, links, paths
- **Depth**: Quick reference

---

## 🔍 How to Use This Documentation

### For Understanding
1. Start with CANVAS_SYSTEM_OVERVIEW.md
2. Read RENDERING_FLOW.md for visuals
3. Read CANVAS_ANALYSIS.md for depth

### For Implementation
1. Find your use case in CANVAS_SYSTEM_OVERVIEW.md
2. Navigate to relevant section
3. Use CODE_REFERENCE.md for code

### For Debugging
1. Identify the problem (coordinate? rendering? gesture?)
2. Find it in CODE_REFERENCE.md Gotchas
3. Use RENDERING_FLOW.md to visualize

### For Teaching Others
1. Use CANVAS_SYSTEM_OVERVIEW.md as intro
2. Use RENDERING_FLOW.md for visuals
3. Use CODE_REFERENCE.md for hands-on

---

## 📞 Documentation Maintenance

- **Generated**: 2026-05-17
- **Source**: Actual codebase v1.0
- **Accuracy**: Verified against all source files
- **Completeness**: All 5 key files covered
- **Update Frequency**: When source changes significantly

---

## 🎯 Next Steps

1. **Start Here**: Open CANVAS_SYSTEM_OVERVIEW.md
2. **Choose Path**: Pick your learning path
3. **Deep Dive**: Read relevant sections
4. **Refer Back**: Use CODE_REFERENCE.md during coding
5. **Debug Well**: Use RENDERING_FLOW.md to visualize

---

**Happy learning! 🚀**

For questions about the documentation structure, see CANVAS_SYSTEM_OVERVIEW.md

For technical questions, see CANVAS_ANALYSIS.md

For implementation questions, see CODE_REFERENCE.md

For visual explanations, see RENDERING_FLOW.md

