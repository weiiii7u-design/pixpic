// === PixPic — Type Definitions ===

// --- Editor ---
export type EditorTool = 'none' | 'adjust' | 'sticker' | 'canvas';
export type EffectMode = 'off' | 'partial';
export type AdjustSubTab = 'dots' | 'palette' | 'otherParams';
export type CanvasSubTab = 'ratio' | 'palette';

// --- Partial Effect ---
export type EffectType = 'ascii' | 'symbols';

// --- Shared ---
export type ColorMode = 'original' | 'mono' | 'multi';
export type CharsetName = 'standard' | 'shades' | 'dots' | 'steps' | 'numbers' | 'complex' | 'custom';
export type CanvasRatio = 'original' | '1:1' | '4:5' | '3:4' | '9:16' | '16:9' | '4:3';

// --- Symbol Sets ---
export interface SymbolSet {
  id: string;
  name: string;
  symbols: string[];
}

// --- Partial Config ---
export interface PartialConfig {
  effect: EffectType;
  colorMode: ColorMode;
  monoColor: string;
  palette: string;
  density: number;
  size: number;
  glow: number;
  opacity: number;
  charset: CharsetName;
  customCharset: string;
  symbolSetId: string;
  invert: boolean;
  segEnabled: boolean;
  bgImageEnabled: boolean;
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

// --- Overlay Image ---
export type OverlayShape = 'circle' | 'square' | 'roundedSquare' | 'heart' | 'star' | 'hexagon' | 'diamond' | 'rectangle';

export interface OverlayInstance {
  id: string;
  image: HTMLImageElement;
  x: number;       // normalized 0-1 (canvas coords)
  y: number;
  scale: number;
  rotation: number;
  shape: OverlayShape;
  opacity: number; // 0-1
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
  activeTool: EditorTool;
  effectMode: EffectMode;
  adjustSubTab: AdjustSubTab;
  canvasSubTab: CanvasSubTab;

  sourceImage: HTMLImageElement | null;
  imageFileName: string;

  partial: PartialConfig;

  // Stickers
  stickers: StickerInstance[];
  selectedStickerId: string | null;
  stampOpacity: number;
  stickerMode: StickerMode;
  stickerPalette: string;
  stickerColor: string;
  customColors: string[];
  stickerLibraryTab: string;
  stickerEditOnly: boolean;
  stickerEditTab: string;
  alignGuides: { h: boolean; v: boolean };

  // Overlay Images
  overlayImages: OverlayInstance[];
  selectedOverlayId: string | null;
  overlayEditTab: string;

  // Masks
  subjectMask: boolean[] | null;
  eraserMask: boolean[] | null;

  // Tools
  eraserActive: boolean;
  eraserSize: number;
  adjustParam: string;
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
