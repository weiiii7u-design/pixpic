// === Trace — Type Definitions (v4: Layer Architecture) ===

// --- Editor ---
export type EditorTool = 'none' | 'adjust' | 'sticker' | 'canvas';
export type EffectMode = 'off' | 'partial' | 'full';

// --- Partial Effect ---
export type PartialTarget = 'auto' | 'brush';
export type EffectType = 'ascii' | 'symbols';

// --- Full Effect ---
export type BackgroundMode = 'solid' | 'gradient' | 'transparent';

// --- Shared ---
export type ColorMode = 'original' | 'mono' | 'multi';
export type CharsetName = 'standard' | 'shades' | 'dots' | 'steps' | 'numbers' | 'complex';
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
  colorMode: ColorMode;
  monoColor: string;
  palette: string;
  density: number;
  size: number;
  glow: number;
  charset: CharsetName;
  symbolSetId: string;
  invert: boolean;
}

// --- Full Config ---
export interface FullConfig {
  colorMode: ColorMode;
  monoColor: string;
  background: BackgroundMode;
  bgColor: string;
  bgGradient: [string, string];
  bgGradientDirection: number;
  density: number;
  brightness: number;
  contrast: number;
  charset: CharsetName;
  glow: number;
}

// --- Sticker ---
export type StickerMode = 'dots' | 'ascii';

export interface StickerInstance {
  id: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  color: string;
  mode: StickerMode;
  opacity: number;
  effectUnitSize: number;
  subjectAvoid: boolean;
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
  activeTool: EditorTool;       // which tool panel is open
  effectMode: EffectMode;       // bottom layer effect (off / partial / full)

  sourceImage: HTMLImageElement | null;
  imageFileName: string;

  partial: PartialConfig;
  full: FullConfig;

  // Stickers (always present, layered on top of effects)
  stickers: StickerInstance[];
  selectedStickerId: string | null;
  stampOpacity: number;
  stickerMode: StickerMode;
  stickerPalette: string;
  stickerColor: string;           // current selected color for stickers
  customColors: string[];         // user-saved custom colors
  stickerLibraryTab: string;
  stickerEditOnly: boolean;       // true = show only adjust controls (no library)
  alignGuides: { h: boolean; v: boolean };
  subjectAvoid: boolean;

  // Masks
  subjectMask: boolean[] | null;
  brushMask: boolean[] | null;
  eraserMask: boolean[] | null;

  // Tools
  eraserActive: boolean;
  brushActive: boolean;
  brushSize: number;
  eraserSize: number;
  adjustParam: string;           // currently selected adjust parameter icon
  subjectLoading: boolean;
  subjectError: string | null;

  // Canvas
  canvasRatio: CanvasRatio;
  photoX: number;
  photoY: number;
  photoScale: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasBgPalette: string;
  canvasBgColor: string;
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offscreen: HTMLCanvasElement;
  offCtx: CanvasRenderingContext2D;
}
