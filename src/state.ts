// === PixPic — Global Reactive State ===

import type { AppState, PartialConfig, CanvasRatio, OverlayInstance } from './types';
import type { CanvasSubTab } from './types';

type Listener = () => void;

const listeners: Listener[] = [];

export const state: AppState = {
  screen: 'welcome',
  activeTool: 'none',
  effectMode: 'off',
  adjustSubTab: 'dots',
  canvasSubTab: 'ratio' as CanvasSubTab,

  sourceImage: null,
  imageFileName: '',

  partial: {
    effect: 'symbols',
    colorMode: 'mono',
    monoColor: '#00ff41',
    palette: 'photo',
    density: 30,
    size: 100,
    glow: 0,
    opacity: 100,
    charset: 'standard',
    customCharset: '',
    symbolSetId: 'tech',
    invert: false,
    segEnabled: false,
    bgImageEnabled: true,
  },

  stickers: [],
  selectedStickerId: null,
  stampOpacity: 100,
  stickerMode: 'dots',
  stickerPalette: 'photo',
  stickerColor: '',
  customColors: [],
  stickerLibraryTab: '边框',
  stickerEditOnly: false,
  stickerEditTab: 'dots',
  alignGuides: { h: false, v: false },

  overlayImages: [] as OverlayInstance[],
  selectedOverlayId: null,
  overlayEditTab: 'shape',

  subjectMask: null,
  eraserMask: null,

  eraserActive: false,
  eraserSize: 30,
  adjustParam: 'density',
  subjectLoading: false,
  subjectError: null,

  canvasRatio: 'original' as CanvasRatio,
  photoX: 0.5,
  photoY: 0.5,
  photoScale: 1,
  canvasWidth: 0,
  canvasHeight: 0,
  canvasBgPalette: 'dream',
  canvasBgColor: '',
};

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function notify(): void {
  for (const fn of listeners) fn();
}

export function updateState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
  notify();
}

export function updatePartial(changes: Partial<PartialConfig>): void {
  Object.assign(state.partial, changes);
  notify();
}
