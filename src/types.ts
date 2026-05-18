// === Trace — Type Definitions (v3: Partial / Full / Stamp) ===

export type AppMode = 'partial' | 'full' | 'stamp';

// --- Partial Mode: ASCII on part of the photo ---
export type PartialTarget = 'auto' | 'brush';
export type EffectType = 'ascii' | 'symbols';

// --- Full Mode: Entire photo becomes ASCII ---
export type BackgroundMode = 'solid' | 'gradient' | 'transparent';

// --- Shared ---
export type ColorMode = 'original' | 'mono' | 'multi';
export type CharsetName = 'standard' | 'shades' | 'dots' | 'steps' | 'numbers' | 'complex';
export type PanelTab = 'style' | 'adjust';
export type CanvasRatio = 'original' | '1:1' | '4:5' | '3:4' | '9:16' | '16:9' | '4:3';

// --- Symbol Sets ---
export interface SymbolSet {
  id: string;
  name: string;
  symbols: string[];
}

// --- Partial Config ---
export interface PartialConfig {
  target: PartialTarget;
  effect: EffectType;
  colorMode: ColorMode;         // mono / multi / original
  monoColor: string;            // hex color when mono
  palette: string;              // palette id when multi
  density: number;              // 10-80, grid columns
  size: number;                 // 50-200, char size as % of cell
  glow: number;                 // 0-40, glow blur radius
  charset: CharsetName;
  symbolSetId: string;
  invert: boolean;
}

// --- Full Config ---
export interface FullConfig {
  colorMode: ColorMode;
  monoColor: string;
  background: BackgroundMode;   // what replaces the photo
  bgColor: string;              // for solid background
  bgGradient: [string, string]; // for gradient background
  bgGradientDirection: number;  // degrees
  density: number;              // 10-80
  brightness: number;           // -100 to 100
  contrast: number;             // -100 to 100
  charset: CharsetName;
  glow: number;                 // 0-20
}

// --- Sticker Render Mode ---
export type StickerMode = 'dots' | 'ascii';

// --- Sticker Instance ---
export interface StickerInstance {
  id: string;
  assetId: string;        // references StickerAsset.id
  x: number;              // pixel x on canvas
  y: number;              // pixel y on canvas
  scale: number;
  rotation: number;       // degrees
  color: string;
  mode: StickerMode;
  opacity: number;        // 0-1
  effectUnitSize: number;
}

// --- Draw Area ---
export interface DrawArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- App State ---
export interface AppState {
  screen: 'welcome' | 'editor';
  mode: AppMode;
  panelTab: PanelTab;

  sourceImage: HTMLImageElement | null;
  imageFileName: string;

  partial: PartialConfig;
  full: FullConfig;

  // Stamp
  stickers: StickerInstance[];
  selectedStickerId: string | null;
  stampOpacity: number;
  stickerMode: StickerMode;
  stickerPalette: string;
  stickerLibraryTab: string;
  alignGuides: { h: boolean; v: boolean };  // alignment guide lines visible
  subjectAvoid: boolean;                    // stickers avoid subject

  // Masks
  subjectMask: boolean[] | null;    // AI-detected subject
  brushMask: boolean[] | null;      // user-painted area (partial brush mode)
  eraserMask: boolean[] | null;     // erased areas

  // Tools
  eraserActive: boolean;
  brushActive: boolean;
  brushSize: number;
  eraserSize: number;
  subjectLoading: boolean;
  subjectError: string | null;

  // Canvas
  canvasRatio: CanvasRatio;
  photoX: number;         // photo center X in canvas (0~1, 0.5=centered)
  photoY: number;         // photo center Y in canvas (0~1, 0.5=centered)
  photoScale: number;     // 1 = longest edge fills canvas
  canvasWidth: number;
  canvasHeight: number;
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  offCtx: CanvasRenderingContext2D;
}
