// === Trace — Global Reactive State (v3: Partial / Full / Stamp) ===

import type { AppState, PartialConfig, FullConfig, CanvasRatio } from './types';

type Listener = () => void;

const listeners: Listener[] = [];

export const state: AppState = {
  screen: 'welcome',
  mode: 'partial',
  panelTab: 'style',

  sourceImage: null,
  imageFileName: '',

  partial: {
    target: 'auto',
    effect: 'symbols',
    colorMode: 'mono',
    monoColor: '#00ff41',
    palette: 'dream',
    density: 30,
    size: 100,
    glow: 10,
    charset: 'standard',
    symbolSetId: 'tech',
    invert: false,
  },

  full: {
    colorMode: 'mono',
    monoColor: '#1a1a1a',
    background: 'solid',
    bgColor: '#c1ff72',
    bgGradient: ['#ff6baa', '#2B2BD4'],
    bgGradientDirection: 180,
    density: 30,
    brightness: 20,
    contrast: 30,
    charset: 'dots',
    glow: 0,
  },

  stickers: [],
  selectedStickerId: null,
  stampOpacity: 100,
  stickerMode: 'dots',
  stickerPalette: 'dream',
  stickerLibraryTab: '边框',
  alignGuides: { h: false, v: false },
  subjectAvoid: false,

  subjectMask: null,
  brushMask: null,
  eraserMask: null,

  eraserActive: false,
  brushActive: true,
  brushSize: 30,
  eraserSize: 30,
  subjectLoading: false,
  subjectError: null,

  canvasRatio: 'original' as CanvasRatio,
  photoX: 0.5,
  photoY: 0.5,
  photoScale: 1,
  canvasWidth: 0,
  canvasHeight: 0,
};

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function notify(): void {
  for (const fn of listeners) {
    fn();
  }
}

export function updateState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
  notify();
}

export function updatePartial(changes: Partial<PartialConfig>): void {
  Object.assign(state.partial, changes);
  notify();
}

export function updateFull(changes: Partial<FullConfig>): void {
  Object.assign(state.full, changes);
  notify();
}
