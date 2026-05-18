// === Trace — Image Sticker Library + Effect Rendering ===
// Replaces old SVG stickers with PNG image stickers from manifest.json.
// Supports dots and ASCII rendering modes (ported from sticker-prototype).

import { uid } from './math';
import { state } from '../state';
import { notify } from '../state';
import { COLOR_PALETTES } from './shapes';

// === Types ===

export interface StickerAsset {
  id: string;           // "asset-01"
  category: string;     // "边框"
  name: string;         // "01"
  url: string;          // "/stickers/边框/01.png"
  image: HTMLImageElement;
}

export interface LibrarySection {
  title: string;
  categories: string[];
}

export interface LibraryGroup {
  name: string;
  sections: LibrarySection[];
}

// === Constants ===

export const LIBRARY_GROUPS: LibraryGroup[] = [
  {
    name: '边框',
    sections: [
      { title: '边框', categories: ['边框', '酸性'] },
    ],
  },
  {
    name: '花束',
    sections: [
      { title: '花束', categories: ['花束'] },
    ],
  },
  {
    name: '植物',
    sections: [
      { title: '植物', categories: ['单个植物'] },
    ],
  },
  {
    name: '动物',
    sections: [
      { title: '动物', categories: ['动物'] },
    ],
  },
  {
    name: 'Y2k',
    sections: [
      { title: 'Y2k', categories: ['Y2k'] },
    ],
  },
  {
    name: '装饰',
    sections: [
      { title: '装饰', categories: ['装饰元素'] },
    ],
  },
];

// Assets that should override their library placement
const LIBRARY_SECTION_OVERRIDES: Record<string, { group: string; section: string }> = {
  'asset-32': { group: '花束', section: '花束' },
};

// Default scales for specific assets (tuned for 1080px canvas in prototype)
// These are relative to BASE_DISPLAY_SIZE — will be canvas-adapted below
const DEFAULT_SCALES: Record<string, number> = {
  'asset-24': 3.15, 'asset-25': 1.25, 'asset-26': 2.9, 'asset-27': 1.55,
  'asset-20': 1.3, 'asset-21': 0.85, 'asset-22': 3,
};

const LARGE_ASSET_IDS = new Set(['asset-04', 'asset-08', 'asset-10', 'asset-22', 'asset-24', 'asset-26']);
const BOTTOM_ASSET_IDS = new Set(['asset-15']);

const EFFECT_UNIT_RATIO = 0.0038;
const BASE_DISPLAY_SIZE = 330; // prototype baseline at 1080px canvas

// === State ===

let library: StickerAsset[] = [];
let libraryReady = false;

// Caches
const effectCache = new Map<string, HTMLCanvasElement>();
const previewCache = new Map<string, string>();

// === Init ===

export async function initStickers(): Promise<void> {
  try {
    const res = await fetch('/stickers/manifest.json');
    const manifest: { id: string; category: string; filename: string }[] = await res.json();

    // Load images individually — don't let one failure block all
    const results = await Promise.allSettled(
      manifest.map(async (item) => {
        const url = `/stickers/${encodeURIComponent(item.category)}/${encodeURIComponent(item.filename)}`;
        const image = await loadImage(url);
        const numStr = item.id.replace('asset-', '');
        return {
          id: item.id,
          category: item.category,
          name: numStr.padStart(2, '0'),
          url,
          image,
        } as StickerAsset;
      })
    );

    library = results
      .filter((r): r is PromiseFulfilledResult<StickerAsset> => r.status === 'fulfilled')
      .map(r => r.value);

    libraryReady = true;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Trace] Loaded ${library.length} sticker assets${failed ? `, ${failed} failed` : ''}`);
    notify(); // Refresh panel to show stickers
  } catch (err) {
    console.error('[Trace] Failed to load sticker library:', err);
    libraryReady = true;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// === Accessors ===

export function getStickerLibrary(): StickerAsset[] {
  return library;
}

export function getStickerAsset(id: string): StickerAsset | null {
  return library.find(a => a.id === id) || null;
}

export function isLibraryReady(): boolean {
  return libraryReady;
}

export function getLibraryForGroup(groupName: string): { section: LibrarySection; items: StickerAsset[] }[] {
  const group = LIBRARY_GROUPS.find(g => g.name === groupName);
  if (!group) return [];

  return group.sections.map(section => ({
    section,
    items: library.filter(item => {
      const override = LIBRARY_SECTION_OVERRIDES[item.id];
      if (override) {
        return override.group === groupName && override.section === section.title;
      }
      return section.categories.includes(item.category);
    }),
  })).filter(s => s.items.length > 0);
}

// === Sticker Dimensions ===

export function getStickerDimensions(assetId: string, scale: number): { width: number; height: number } {
  const asset = getStickerAsset(assetId);
  if (!asset) return { width: 100, height: 100 };

  const maxDim = Math.max(asset.image.width, asset.image.height);
  const baseScale = BASE_DISPLAY_SIZE / maxDim;
  return {
    width: asset.image.width * baseScale * scale,
    height: asset.image.height * baseScale * scale,
  };
}

/**
 * Scale for manually added stickers.
 * Borders: 95% of photo height, or 95% photo width if overflow.
 * Others: large and prominent (~60% of canvas).
 */
export function getDefaultScale(asset: StickerAsset, canvasW: number, canvasH: number, photoW?: number, photoH?: number): number {
  const maxDim = Math.max(asset.image.width, asset.image.height);
  const baseScale = BASE_DISPLAY_SIZE / maxDim;
  const baseW = asset.image.width * baseScale;
  const baseH = asset.image.height * baseScale;

  // Borders + Acid: height = 95% photo, if width overflows photo then width = 95% photo
  if (asset.category === '边框' || asset.category === '酸性') {
    const pw = (photoW && photoW > 0) ? photoW : canvasW;
    const ph = (photoH && photoH > 0) ? photoH : canvasH;
    const scaleByH = (ph * 0.95) / baseH;
    if (baseW * scaleByH > pw) {
      return (pw * 0.95) / baseW;
    }
    return scaleByH;
  }

  // All other stickers: ~60% of shortest canvas dimension
  const targetSize = Math.min(canvasW, canvasH) * 0.6;
  return targetSize / BASE_DISPLAY_SIZE;
}

/**
 * Scale for random composition — can be bigger, more dramatic.
 * Borders go full, decorative items scatter at varying sizes.
 */
export function getRandomScale(asset: StickerAsset, canvasW: number, canvasH: number): number {
  const maxDim = Math.max(asset.image.width, asset.image.height);
  const baseScale = BASE_DISPLAY_SIZE / maxDim;
  const baseW = asset.image.width * baseScale;
  const baseH = asset.image.height * baseScale;

  // Borders: 85% contain-fit for dramatic framing
  if (asset.category === '边框') {
    const scaleByH = (canvasH * 0.85) / baseH;
    const widthAtThat = baseW * scaleByH;
    if (widthAtThat > canvasW * 0.85) return (canvasW * 0.85) / baseW;
    return scaleByH;
  }

  if (asset.category === '酸性') return (canvasH * 0.9) / baseH;
  if (BOTTOM_ASSET_IDS.has(asset.id)) return (canvasW * 0.8) / baseW;

  if (DEFAULT_SCALES[asset.id]) {
    const refScale = DEFAULT_SCALES[asset.id];
    const canvasFactor = Math.min(canvasW, canvasH) / 1080;
    return refScale * canvasFactor;
  }

  // Small stickers: random size between 18-35% of canvas
  const minFrac = 0.18;
  const maxFrac = 0.35;
  const frac = minFrac + Math.random() * (maxFrac - minFrac);
  const targetSize = Math.min(canvasW, canvasH) * frac;
  return targetSize / BASE_DISPLAY_SIZE;
}

export function getEffectUnitSize(canvasW: number, canvasH: number): number {
  return Math.max(1.5, Math.max(canvasW, canvasH) * EFFECT_UNIT_RATIO);
}

// === Color ===

let photoPaletteCache: { src: string; colors: string[] } | null = null;

/** Extract 6 vibrant, high-saturation colors from an image that look good as overlays */
export function extractPhotoPalette(img: HTMLImageElement): string[] {
  if (photoPaletteCache && photoPaletteCache.src === img.src) return photoPaletteCache.colors;

  // Sample image at low res
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Convert pixels to HSL and score them
  interface PixelHSL { r: number; g: number; b: number; h: number; s: number; l: number; score: number; }
  const pixels: PixelHSL[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h, s, l } = rgbToHsl(r, g, b);

    // Skip very dark, very bright, or very desaturated pixels
    if (l < 0.12 || l > 0.92 || s < 0.15) continue;

    // Score: prefer high saturation + medium-high lightness (vibrant, visible)
    const satScore = s; // 0-1, higher is better
    const lumScore = 1 - Math.abs(l - 0.55) * 2; // peaks at 0.55 lightness
    const score = satScore * 0.7 + lumScore * 0.3;

    pixels.push({ r, g, b, h, s, l, score });
  }

  if (pixels.length === 0) {
    const fallback = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    photoPaletteCache = { src: img.src, colors: fallback };
    return fallback;
  }

  // Sort by score descending, take top candidates
  pixels.sort((a, b) => b.score - a.score);
  const candidates = pixels.slice(0, Math.min(200, pixels.length));

  // Pick 6 diverse colors: high score + hue diversity + contrast with each other
  const picked: PixelHSL[] = [];
  const HUE_DIST = 25; // minimum hue difference between picks

  for (const px of candidates) {
    if (picked.length >= 6) break;

    // Check hue diversity
    const tooClose = picked.some(p => {
      const hueDiff = Math.min(Math.abs(px.h - p.h), 360 - Math.abs(px.h - p.h));
      return hueDiff < HUE_DIST;
    });
    if (tooClose) continue;

    picked.push(px);
  }

  // If not enough diverse colors, fill with top-scored remaining
  if (picked.length < 6) {
    for (const px of candidates) {
      if (picked.length >= 6) break;
      if (picked.includes(px)) continue;
      picked.push(px);
    }
  }

  // Boost saturation and lightness slightly to ensure they pop as overlays
  const result = picked.slice(0, 6).map(px => {
    let { h, s, l } = px;
    // Boost saturation toward vibrant
    s = Math.min(1, s * 1.2 + 0.1);
    // Push lightness toward 0.5-0.65 range (visible on most backgrounds)
    if (l < 0.4) l = l * 0.5 + 0.3;
    if (l > 0.75) l = l * 0.6 + 0.25;
    return hslToHex(h, s, l);
  });

  while (result.length < 6) result.push(result[0] || '#FF6B6B');

  photoPaletteCache = { src: img.src, colors: result };
  return result;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function pickStickerColor(): string {
  if (state.stickerPalette === 'photo') {
    const img = state.sourceImage;
    if (img) {
      const palette = extractPhotoPalette(img);
      return palette[Math.floor(Math.random() * palette.length)];
    }
    return '#888888';
  }
  const palette = COLOR_PALETTES.find(p => p.id === state.stickerPalette);
  if (!palette) return '#E8CFEE';
  return palette.colors[Math.floor(Math.random() * palette.colors.length)];
}

// === Effect Rendering (dots / ASCII) ===

export function createEffectCanvas(
  image: HTMLImageElement,
  displayWidth: number,
  displayHeight: number,
  color: string,
  mode: 'dots' | 'ascii',
  unitSize: number
): HTMLCanvasElement {
  const width = Math.max(24, Math.round(displayWidth));
  const height = Math.max(24, Math.round(displayHeight));
  const key = `${image.src}-${color}-${mode}-${width}x${height}`;
  const cached = effectCache.get(key);
  if (cached) return cached;

  // Sample alpha from sticker image
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  maskCtx.drawImage(image, 0, 0, width, height);
  const alpha = maskCtx.getImageData(0, 0, width, height).data;

  // Create output
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const out = output.getContext('2d')!;
  out.fillStyle = color;

  function cellCoverage(cx: number, cy: number, size: number): number {
    const half = Math.floor(size / 2);
    let total = 0;
    let count = 0;
    const startX = Math.max(0, Math.floor(cx - half));
    const endX = Math.min(width - 1, Math.floor(cx + half));
    const startY = Math.max(0, Math.floor(cy - half));
    const endY = Math.min(height - 1, Math.floor(cy + half));
    for (let y = startY; y <= endY; y += 2) {
      for (let x = startX; x <= endX; x += 2) {
        total += alpha[(y * width + x) * 4 + 3];
        count += 1;
      }
    }
    return count ? total / count / 255 : 0;
  }

  if (mode === 'dots') {
    const step = unitSize * 1.175;
    const dotRadius = unitSize / 2;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const value = cellCoverage(x, y, step);
        if (value > 0.12) {
          out.globalAlpha = 1;
          out.beginPath();
          out.arc(x, y, dotRadius, 0, Math.PI * 2);
          out.fill();
        }
      }
    }
  } else {
    const chars = '@#&*+=:.';
    const step = unitSize * 1.275;
    out.textAlign = 'center';
    out.textBaseline = 'middle';
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        const value = cellCoverage(x, y, step);
        if (value > 0.12) {
          const fontSize = Math.round(unitSize * 1.55);
          out.font = `800 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
          out.globalAlpha = 1;
          out.fillText(
            chars[Math.min(chars.length - 1, Math.floor((1 - value) * chars.length))],
            x, y
          );
        }
      }
    }
  }

  out.globalAlpha = 1;
  effectCache.set(key, output);
  return output;
}

// === Preview ===

export function getStickerPreviewUrl(asset: StickerAsset): string {
  const cached = previewCache.get(asset.id);
  if (cached) return cached;

  const width = 116;
  const height = 76;
  const maxW = 108;
  const maxH = 68;
  const scale = Math.min(maxW / asset.image.width, maxH / asset.image.height);
  const dw = Math.max(8, Math.round(asset.image.width * scale));
  const dh = Math.max(8, Math.round(asset.image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(asset.image, (width - dw) / 2, (height - dh) / 2, dw, dh);

  const url = canvas.toDataURL('image/png');
  previewCache.set(asset.id, url);
  return url;
}

// === Random Composition ===

const RANDOM_CORNER_ZONES = [
  { x: [0.14, 0.34] as [number, number], y: [0.14, 0.34] as [number, number] },
  { x: [0.66, 0.88] as [number, number], y: [0.12, 0.36] as [number, number] },
  { x: [0.1, 0.36] as [number, number], y: [0.62, 0.88] as [number, number] },
  { x: [0.62, 0.9] as [number, number], y: [0.64, 0.9] as [number, number] },
];

function randomBetween([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function getStickerBox(x: number, y: number, w: number, h: number) {
  return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
}

function boxesOverlap(
  a: ReturnType<typeof getStickerBox>,
  b: ReturnType<typeof getStickerBox>,
  padding = 28
): boolean {
  return !(a.right + padding < b.left || a.left - padding > b.right ||
           a.bottom + padding < b.top || a.top - padding > b.bottom);
}

function isInsideCanvas(box: ReturnType<typeof getStickerBox>, canvasW: number, canvasH: number): boolean {
  // Allow stickers to be mostly inside — up to 30% can overhang
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  return box.right > w * 0.7 &&
         box.left < canvasW - w * 0.7 &&
         box.bottom > h * 0.5 &&
         box.top < canvasH - h * 0.5;
}

export function generateRandomComposition(canvasW: number, canvasH: number): import('../types').StickerInstance[] {
  const pool = [...library].sort(() => Math.random() - 0.5);
  const largePool = pool.filter(a => a.category === '边框' || LARGE_ASSET_IDS.has(a.id));
  const smallPool = pool.filter(a => !largePool.includes(a));
  const usedIds = new Set<string>();
  const unitSize = getEffectUnitSize(canvasW, canvasH);

  // Work in pixel space for collision, convert to normalized at the end
  interface TempSticker { assetId: string; px: number; py: number; scale: number; rotation: number; color: string; opacity: number; }
  const placed: TempSticker[] = [];

  function makeTempSticker(asset: StickerAsset, px: number, py: number): TempSticker {
    const scale = getDefaultScale(asset, canvasW, canvasH);
    return {
      assetId: asset.id, px, py, scale,
      rotation: (Math.random() - 0.5) * 24,
      color: pickStickerColor(),
      opacity: 1,
    };
  }

  function getBox(t: TempSticker) {
    const { width, height } = getStickerDimensions(t.assetId, t.scale);
    return getStickerBox(t.px, t.py, width, height);
  }

  // 55% chance: one large sticker anchored to a side
  const useLarge = largePool.length > 0 && Math.random() < 0.55;
  if (useLarge) {
    const asset = largePool[Math.floor(Math.random() * largePool.length)];
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const t = makeTempSticker(asset, canvasW / 2, canvasH * randomBetween([0.4, 0.6]));
    t.rotation = 0;
    t.opacity = 1;
    const { width } = getStickerDimensions(asset.id, t.scale);
    t.px = side === 'left' ? width * 0.3 : canvasW - width * 0.3;
    placed.push(t);
    usedIds.add(asset.id);
  }

  // Fill corners
  const zones = [...RANDOM_CORNER_ZONES]
    .filter(zone => !placed.length || (placed[0].px < canvasW / 2 ? zone.x[0] > 0.5 : zone.x[1] < 0.5))
    .sort(() => Math.random() - 0.5);

  const targetCount = placed.length ? 3 : 4;
  for (const zone of zones) {
    if (placed.length >= targetCount) break;
    for (let attempt = 0; attempt < 80; attempt++) {
      const asset = smallPool.find(a => !usedIds.has(a.id));
      if (!asset) break;
      const px = canvasW * randomBetween(zone.x);
      const py = canvasH * randomBetween(zone.y);
      const t = makeTempSticker(asset, px, py);
      const box = getBox(t);
      const overlaps = placed.some(existing => boxesOverlap(box, getBox(existing)));
      if (isInsideCanvas(box, canvasW, canvasH) && !overlaps) {
        placed.push(t);
        usedIds.add(asset.id);
        break;
      } else {
        smallPool.push(smallPool.shift()!);
      }
    }
  }

  // Convert pixel positions to normalized photo coordinates
  // Random composition assumes photo fills the canvas, so normalize by canvas size
  return placed.map(t => ({
    id: uid(),
    assetId: t.assetId,
    x: t.px / canvasW,    // normalized 0-1
    y: t.py / canvasH,
    scale: t.scale,
    rotation: t.rotation,
    color: t.color,
    mode: state.stickerMode,
    opacity: t.opacity,
    effectUnitSize: unitSize,
    subjectAvoid: false,
  }));
}

// === Cache management ===

export function clearEffectCache(): void {
  effectCache.clear();
}
