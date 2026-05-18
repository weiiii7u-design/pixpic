// === Trace — Bottom Toolbar + Popup Panels (Layer Architecture) ===

import { el, clearEl } from './dom';
import { state, updateState, updatePartial, updateFull } from '../state';
import type {
  CharsetName, ColorMode, BackgroundMode, CanvasRatio, StickerMode, EditorTool,
} from '../types';
import { createSlider, createToggle, createChipGroup, createColorPicker, createButton } from './controls';
import { triggerSegmentation } from '../modes/partial';
import {
  LIBRARY_GROUPS, getLibraryForGroup, getStickerPreviewUrl,
  getDefaultScale, getEffectUnitSize,
  pickStickerColor, generateRandomComposition, clearEffectCache,
  extractPhotoPalette,
} from '../core/stickers';
import { COLOR_PALETTES } from '../core/shapes';
import type { StickerAsset } from '../core/stickers';
import { getReferenceCanvasSize, getReferencePhotoRect } from '../render/compositor';
import { uid } from '../core/math';

// === Template System (localStorage) ===
interface StickerTemplate {
  id: string;
  /** Aspect ratio of the canvas when the template was created (w/h) */
  canvasAspect?: number;
  stickers: { assetId: string; x: number; y: number; scale: number; rotation: number; subjectAvoid: boolean }[];
}

const TEMPLATE_STORAGE_KEY = 'trace-sticker-templates';

// Built-in templates (hardcoded)
const BUILTIN_TEMPLATES: StickerTemplate[] = [
  {
    id: 'builtin-1',
    canvasAspect: 0.75,
    stickers: [
      { assetId: 'asset-13', x: 0.2242, y: 0.2835, scale: 1.259, rotation: 0.03, subjectAvoid: false },
      { assetId: 'asset-14', x: 0.162, y: 0.8724, scale: 0.728, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-32', x: 0.8789, y: 0.0834, scale: 0.443, rotation: -6.47, subjectAvoid: false },
      { assetId: 'asset-11', x: 0.7446, y: 0.8944, scale: 1.129, rotation: 8, subjectAvoid: false },
      { assetId: 'asset-36', x: 0.8358, y: 0.3427, scale: 0.301, rotation: 8.16, subjectAvoid: false },
      { assetId: 'asset-39', x: 0.8163, y: 0.5, scale: 0.339, rotation: 0.86, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-2',
    canvasAspect: 0.75,
    stickers: [
      { assetId: 'asset-18', x: 0.5, y: 0.5, scale: 1.557, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-38', x: 0.1724, y: 0.1085, scale: 0.0895, rotation: -1.75, subjectAvoid: false },
      { assetId: 'asset-23', x: 0.2692, y: 0.245, scale: 0.228, rotation: 25.2, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.7259, y: 0.77, scale: 0.172, rotation: 29.1, subjectAvoid: false },
      { assetId: 'asset-27', x: 0.6443, y: 0.3709, scale: 0.421, rotation: 24.77, subjectAvoid: false },
      { assetId: 'asset-22', x: 0.296, y: 0.779, scale: 0.293, rotation: 2.87, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-3',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-05', x: 0.1472, y: 0.4549, scale: 1.93, rotation: 0.02, subjectAvoid: false },
      { assetId: 'asset-39', x: 0.8637, y: 0.1124, scale: 0.2465, rotation: 3.54, subjectAvoid: false },
      { assetId: 'asset-16', x: 0.7637, y: 0.6996, scale: 1.302, rotation: -0.27, subjectAvoid: true },
    ],
  },
  {
    id: 'builtin-4',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-26', x: 0.4021, y: 0.1128, scale: 1.119, rotation: 0.04, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.9518, y: 0.8064, scale: 0.728, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-27', x: 0.9113, y: 0.5264, scale: 0.419, rotation: 7.18, subjectAvoid: false },
      { assetId: 'asset-24', x: 0.1401, y: 0.8098, scale: 0.612, rotation: -2.56, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-5',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-28', x: 0.5, y: 0.8589, scale: 0.334, rotation: -0.88, subjectAvoid: false },
      { assetId: 'asset-30', x: -0.1596, y: 0.5153, scale: 1.77, rotation: 0.04, subjectAvoid: false },
      { assetId: 'asset-30', x: 1.1521, y: 0.5169, scale: 1.72, rotation: 0.09, subjectAvoid: false },
      { assetId: 'asset-36', x: 0.5, y: 0.117, scale: 0.309, rotation: 0.3, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-6',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-13', x: 0.238, y: 0.2799, scale: 1.105, rotation: 0.03, subjectAvoid: true },
      { assetId: 'asset-14', x: 0.1829, y: 0.9109, scale: 1.105, rotation: -0.52, subjectAvoid: false },
      { assetId: 'asset-32', x: 0.9084, y: 0.2265, scale: 0.703, rotation: -3.92, subjectAvoid: false },
      { assetId: 'asset-11', x: 0.7092, y: 0.8644, scale: 1.322, rotation: -0.68, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-7',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-04', x: 0.5, y: 0.5, scale: 1.752, rotation: 0, subjectAvoid: true },
      { assetId: 'asset-25', x: 0.8745, y: 0.1194, scale: 0.134, rotation: 2.54, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.0743, y: 0.8129, scale: 0.193, rotation: 25.91, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.9041, y: 0.4299, scale: 0.131, rotation: 59.1, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.0695, y: 0.2334, scale: 0.107, rotation: 29.31, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-8',
    canvasAspect: 0.658,
    stickers: [
      { assetId: 'asset-25', x: 0.1725, y: 0.1388, scale: 0.32, rotation: 8.26, subjectAvoid: false },
      { assetId: 'asset-27', x: 0.7875, y: 0.3682, scale: 0.335, rotation: -8.89, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.8786, y: 0.2396, scale: 0.113, rotation: 40.45, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.8653, y: 0.876, scale: 0.179, rotation: -0.06, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.8002, y: 0.5, scale: 0.085, rotation: 55.06, subjectAvoid: false },
      { assetId: 'asset-38', x: 0.324, y: 0.1214, scale: 0.109, rotation: -9.04, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.1259, y: 0.9146, scale: 0.112, rotation: 45.47, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.1879, y: 0.8754, scale: 0.09, rotation: 27.35, subjectAvoid: false },
      { assetId: 'asset-35', x: 0.2396, y: 0.7647, scale: 0.303, rotation: 15.33, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-9',
    canvasAspect: 1.333,
    stickers: [
      { assetId: 'asset-38', x: 0.0649, y: 0.1162, scale: 0.05, rotation: -1.75, subjectAvoid: false },
      { assetId: 'asset-23', x: 0.3702, y: 0.245, scale: 0.128, rotation: 25.2, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.9285, y: 0.8997, scale: 0.097, rotation: 29.1, subjectAvoid: false },
      { assetId: 'asset-22', x: 0.8583, y: 0.6996, scale: 0.164, rotation: 16.26, subjectAvoid: false },
      { assetId: 'asset-15', x: 0.5748, y: 0.8888, scale: 0.773, rotation: -10.72, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.118, y: 0.4195, scale: 0.08, rotation: 50.23, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.9241, y: 0.5912, scale: 0.08, rotation: 11.55, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.0639, y: 0.5, scale: 0.08, rotation: 66.25, subjectAvoid: false },
      { assetId: 'asset-34', x: 0.1552, y: 0.8143, scale: 0.287, rotation: 5.9, subjectAvoid: false },
      { assetId: 'asset-25', x: 0.3276, y: 0.7485, scale: 0.08, rotation: 23.67, subjectAvoid: false },
    ],
  },
  {
    id: 'builtin-10',
    canvasAspect: 1,
    stickers: [
      { assetId: 'asset-32', x: 0.0592, y: 0.318, scale: 0.584, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-37', x: 0.8936, y: 0.9214, scale: 0.584, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-13', x: 0.2278, y: 0.9789, scale: 0.584, rotation: 0, subjectAvoid: false },
      { assetId: 'asset-21', x: 0.8168, y: 0.1771, scale: 0.395, rotation: 0.6, subjectAvoid: false },
    ],
  },
];

function getSavedTemplates(): StickerTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const userTemplates: StickerTemplate[] = raw ? JSON.parse(raw) : [];
    // Merge builtin + user, deduplicate by id
    const all = [...BUILTIN_TEMPLATES, ...userTemplates];
    const seen = new Set<string>();
    return all.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  } catch { return [...BUILTIN_TEMPLATES]; }
}

function saveTemplate(template: StickerTemplate): void {
  // Only save user templates (not builtins) to localStorage
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const userTemplates: StickerTemplate[] = raw ? JSON.parse(raw) : [];
    userTemplates.push(template);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(userTemplates));
  } catch { /* ignore */ }
}

function saveCurrentAsTemplate(): void {
  if (state.stickers.length === 0) return;
  const canvasSize = getReferenceCanvasSize();
  const template: StickerTemplate = {
    id: uid(),
    canvasAspect: canvasSize.w / canvasSize.h,
    stickers: state.stickers.map(s => ({
      assetId: s.assetId,
      x: s.x,
      y: s.y,
      scale: s.scale,
      rotation: s.rotation,
      subjectAvoid: s.subjectAvoid,
    })),
  };
  saveTemplate(template);
  updateState({});
}

function applyRandomTemplate(): void {
  const templates = getSavedTemplates();
  if (templates.length === 0) return;
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  const canvasSize = getReferenceCanvasSize();
  const unitSize = getEffectUnitSize(canvasSize.w, canvasSize.h);

  const currentAspect = canvasSize.w / canvasSize.h;
  const templateAspect = tpl.canvasAspect || (3 / 4); // default to 3:4 portrait

  // Calculate how to fit the template's layout into the current canvas.
  // Template coords are normalized 0-1 in its original canvas.
  // If the current canvas is wider/shorter, we need to shrink the layout
  // so all stickers fit within 0-1 range on both axes.
  let scaleX = 1, scaleY = 1;
  if (currentAspect > templateAspect) {
    // Current is wider than template was — height is the constraint
    // Template's vertical spread fits, but horizontal positions need compression
    scaleX = templateAspect / currentAspect;
  } else {
    // Current is taller than template was — width is the constraint
    scaleY = currentAspect / templateAspect;
  }

  const fitScale = Math.min(scaleX, scaleY);

  // All stickers in a template use the same color (单色)
  const templateColor = pickStickerColor();

  const stickers = tpl.stickers.map(s => {
    // Remap coordinates: center the layout and scale to fit
    const x = 0.5 + (s.x - 0.5) * scaleX;
    const y = 0.5 + (s.y - 0.5) * scaleY;

    return {
      id: uid(),
      assetId: s.assetId,
      x,
      y,
      scale: s.scale * fitScale,
      rotation: s.rotation,
      color: templateColor,
      mode: state.stickerMode,
      opacity: 1,
      effectUnitSize: unitSize,
      subjectAvoid: s.subjectAvoid ?? false,
    };
  });

  // If any sticker has subjectAvoid and no mask yet, trigger segmentation
  if (stickers.some(s => s.subjectAvoid) && !state.subjectMask && !state.subjectLoading && state.sourceImage) {
    import('../modes/partial').then(m => m.triggerSegmentation(state.sourceImage!));
  }

  updateState({ stickers, selectedStickerId: null });
}

// Snapshot for cancel (✕) support
let stateSnapshot: Record<string, unknown> | null = null;

function takeSnapshot(): void {
  stateSnapshot = {
    effectMode: state.effectMode,
    partial: { ...state.partial },
    full: { ...state.full },
    stickers: state.stickers.map(s => ({ ...s })),
    selectedStickerId: state.selectedStickerId,
    stampOpacity: state.stampOpacity,
    stickerMode: state.stickerMode,
    stickerPalette: state.stickerPalette,
    canvasRatio: state.canvasRatio,
    photoX: state.photoX,
    photoY: state.photoY,
    photoScale: state.photoScale,
    subjectAvoid: state.subjectAvoid,
    brushMask: state.brushMask,
    eraserMask: state.eraserMask,
    subjectMask: state.subjectMask,
  };
}

function restoreSnapshot(): void {
  if (!stateSnapshot) return;
  Object.assign(state.partial, stateSnapshot.partial);
  Object.assign(state.full, stateSnapshot.full);
  updateState({
    effectMode: stateSnapshot.effectMode as any,
    stickers: stateSnapshot.stickers as any,
    selectedStickerId: stateSnapshot.selectedStickerId as any,
    stampOpacity: stateSnapshot.stampOpacity as any,
    stickerMode: stateSnapshot.stickerMode as any,
    stickerPalette: stateSnapshot.stickerPalette as any,
    canvasRatio: stateSnapshot.canvasRatio as any,
    photoX: stateSnapshot.photoX as any,
    photoY: stateSnapshot.photoY as any,
    photoScale: stateSnapshot.photoScale as any,
    subjectAvoid: stateSnapshot.subjectAvoid as any,
    brushMask: stateSnapshot.brushMask as any,
    eraserMask: stateSnapshot.eraserMask as any,
    subjectMask: stateSnapshot.subjectMask as any,
  });
  stateSnapshot = null;
}

const TOOLS: { id: EditorTool; label: string; icon: string }[] = [
  { id: 'adjust', label: '调整', icon: '◎' },
  { id: 'sticker', label: '贴纸', icon: '✦' },
  { id: 'canvas', label: '画布', icon: '▢' },
];

export function createPanel(): HTMLElement {
  const wrapper = el('div', { className: 'panel-wrapper' });

  // Popup panel (hidden by default)
  const panel = el('div', { className: 'panel panel-hidden' });

  // Panel header with ✕ and ✓ (and optional random/template buttons)
  const header = el('div', { className: 'panel-header' });
  const cancelBtn = el('button', { className: 'panel-header-btn panel-cancel' }, ['✕']);
  const titleEl = el('span', { className: 'panel-header-title' }, ['']);
  const headerRight = el('div', { className: 'panel-header-right' });
  const randomBtn = el('button', { className: 'panel-random-btn panel-btn-hidden' }, ['随机生成']);
  const templateBtn = el('button', { className: 'panel-random-btn panel-btn-hidden panel-template-btn' }, ['随机模版']);
  const autoBtn = el('button', { className: 'panel-area-btn panel-btn-hidden', 'data-area': 'auto' });
  autoBtn.innerHTML = '<span class="area-icon">⊙</span><span class="area-text">自动</span>';
  const brushBtn = el('button', { className: 'panel-area-btn panel-btn-hidden', 'data-area': 'brush' });
  brushBtn.innerHTML = '<span class="area-icon">◉</span><span class="area-text">画笔</span>';
  const confirmBtn = el('button', { className: 'panel-header-btn panel-confirm' }, ['✓']);

  cancelBtn.addEventListener('click', () => {
    restoreSnapshot();
    updateState({ activeTool: 'none', stickerEditOnly: false });
  });
  confirmBtn.addEventListener('click', () => {
    stateSnapshot = null;
    updateState({ activeTool: 'none', stickerEditOnly: false });
  });

  header.appendChild(cancelBtn);
  header.appendChild(titleEl);
  headerRight.appendChild(randomBtn);
  headerRight.appendChild(templateBtn);
  headerRight.appendChild(autoBtn);
  headerRight.appendChild(brushBtn);
  headerRight.appendChild(confirmBtn);
  header.appendChild(headerRight);
  panel.appendChild(header);

  const content = el('div', { className: 'panel-content' });
  panel.appendChild(content);

  wrapper.appendChild(panel);

  // Bottom toolbar (always visible)
  const toolbar = el('div', { className: 'toolbar' });
  for (const tool of TOOLS) {
    const btn = el('button', {
      className: `toolbar-btn ${state.activeTool === tool.id ? 'active' : ''}`,
      'data-tool': tool.id,
    });
    const iconEl = el('span', { className: 'toolbar-icon' }, [tool.icon]);
    const labelEl = el('span', { className: 'toolbar-label' }, [tool.label]);
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => {
      if (state.activeTool === tool.id) {
        // Close panel (confirm)
        stateSnapshot = null;
        updateState({ activeTool: 'none', stickerEditOnly: false });
      } else {
        // Open panel (toolbar always opens full panel)
        takeSnapshot();
        updateState({ activeTool: tool.id, stickerEditOnly: false });
      }
    });
    toolbar.appendChild(btn);
  }
  wrapper.appendChild(toolbar);

  return wrapper;
}

export function renderPanelContent(panelWrapper: HTMLElement): void {
  const panel = panelWrapper.querySelector('.panel') as HTMLElement;
  const content = panelWrapper.querySelector('.panel-content') as HTMLElement;
  const titleEl = panelWrapper.querySelector('.panel-header-title') as HTMLElement;
  const randomBtn = panelWrapper.querySelector('.panel-random-btn') as HTMLElement;
  if (!panel || !content) return;

  // Update toolbar active states
  const toolBtns = panelWrapper.querySelectorAll('.toolbar-btn');
  toolBtns.forEach(btn => {
    const toolId = (btn as HTMLElement).dataset.tool;
    btn.classList.toggle('active', toolId === state.activeTool);
  });

  // Show/hide panel
  const isOpen = state.activeTool !== 'none';
  panel.classList.toggle('panel-hidden', !isOpen);

  if (!isOpen) return;

  clearEl(content);

  // Set title
  const toolDef = TOOLS.find(t => t.id === state.activeTool);
  if (titleEl && toolDef) titleEl.textContent = toolDef.label;

  // Show random button only for full sticker panel (not edit-only)
  if (randomBtn) {
    randomBtn.classList.toggle('panel-btn-hidden', state.activeTool !== 'sticker' || state.stickerEditOnly);
    // Re-attach click handler (clone trick to remove old listeners)
    const newRandomBtn = randomBtn.cloneNode(true) as HTMLElement;
    randomBtn.replaceWith(newRandomBtn);
    newRandomBtn.addEventListener('click', () => {
      const canvasSize = getReferenceCanvasSize();
      const composition = generateRandomComposition(canvasSize.w, canvasSize.h);
      if (composition.length > 0) {
        updateState({
          stickers: composition,
          selectedStickerId: null,
        });
      }
    });
  }

  // Show template button only for full sticker panel
  const templateBtnEl = panelWrapper.querySelector('.panel-template-btn') as HTMLElement;
  if (templateBtnEl) {
    const hasTemplates = getSavedTemplates().length > 0;
    templateBtnEl.classList.toggle('panel-btn-hidden', state.activeTool !== 'sticker' || state.stickerEditOnly || !hasTemplates);
    const newTemplateBtn = templateBtnEl.cloneNode(true) as HTMLElement;
    templateBtnEl.replaceWith(newTemplateBtn);
    newTemplateBtn.addEventListener('click', () => {
      applyRandomTemplate();
    });
  }

  // Show area buttons (自动/画笔) only for adjust panel + partial mode
  const showAreaBtns = state.activeTool === 'adjust' && state.effectMode === 'partial';
  panelWrapper.querySelectorAll('.panel-area-btn').forEach(btn => {
    const b = btn as HTMLElement;
    // Clone to remove old listeners
    const newBtn = b.cloneNode(true) as HTMLElement;
    b.replaceWith(newBtn);
    // Apply visibility AFTER clone
    newBtn.classList.toggle('panel-btn-hidden', !showAreaBtns);
    newBtn.classList.toggle('active', newBtn.dataset.area === state.partial.target);
    newBtn.addEventListener('click', () => {
      const area = newBtn.dataset.area as 'auto' | 'brush';
      updateState({ subjectMask: null, subjectLoading: false, subjectError: null });
      if (area === 'brush') {
        updateState({ brushActive: true });
      } else if (area === 'auto' && state.sourceImage) {
        triggerSegmentation(state.sourceImage);
      }
      updatePartial({ target: area });
    });
  });

  switch (state.activeTool) {
    case 'adjust':
      renderAdjustPanel(content);
      break;
    case 'sticker':
      renderStickerPanel(content);
      break;
    case 'canvas':
      renderCanvasPanel(content);
      break;
  }
}

// ===== ADJUST PANEL =====
function renderAdjustPanel(container: HTMLElement): void {
  // Effect mode selector: off / partial / full
  container.appendChild(createChipGroup('效果', [
    { value: 'off', label: '关闭' },
    { value: 'partial', label: '局部' },
    { value: 'full', label: '全图' },
  ], state.effectMode, (v) => {
    updateState({
      effectMode: v as any,
      subjectMask: null,
      brushMask: null,
      eraserMask: null,
      subjectLoading: false,
      subjectError: null,
    });
    // Auto-trigger segmentation for partial auto mode
    if (v === 'partial' && state.partial.target === 'auto' && state.sourceImage) {
      triggerSegmentation(state.sourceImage);
    }
  }));

  // Status banner for auto segmentation
  if (state.effectMode === 'partial' && state.partial.target === 'auto') {
    if (state.subjectLoading) {
      const banner = el('div', { className: 'status-banner status-loading' }, ['正在识别主体...']);
      container.appendChild(banner);
    } else if (state.subjectError) {
      const banner = el('div', { className: 'status-banner status-error' });
      const msg = el('span', {}, [`识别失败: ${state.subjectError}`]);
      const retryBtn = el('button', { className: 'banner-btn' }, ['重试']);
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.sourceImage) triggerSegmentation(state.sourceImage);
      });
      banner.appendChild(msg);
      banner.appendChild(retryBtn);
      container.appendChild(banner);
    }
  }

  if (state.effectMode === 'partial') {
    renderPartialControls(container);
  } else if (state.effectMode === 'full') {
    renderFullControls(container);
  }
}

function renderPartialControls(container: HTMLElement): void {
  // Effect presets (模版效果)
  container.appendChild(renderEffectPresets());

  // Unified style grid (charsets + symbol sets combined)
  container.appendChild(renderStyleGrid());

  // Color palette + swatches (like canvas panel)
  container.appendChild(createChipGroup('色板', [
    { value: 'photo', label: '原图选色' },
    { value: 'dream', label: '千禧梦境' },
    { value: 'happy', label: '开心五彩' },
    { value: 'nature', label: '自然色系' },
    { value: 'neon', label: '亚比荧光' },
  ], state.partial.palette, (v) => {
    // Clicking a palette chip → multi-color mode (uses all palette colors)
    updatePartial({ palette: v, colorMode: 'multi' });
  }));

  container.appendChild(renderPartialColorSwatches());

  container.appendChild(createToggle('反转', state.partial.invert, (v) => updatePartial({ invert: v })));

  // --- Icon-based parameter adjustment ---
  const params = [
    { id: 'density', label: '密度', icon: '▦' },
    { id: 'size', label: '大小', icon: '⊡' },
    { id: 'glow', label: '辉光', icon: '✧' },
    ...(state.partial.target === 'brush' ? [{ id: 'brushSize', label: '画笔', icon: '◉' }] : []),
    { id: 'eraserSize', label: '橡皮', icon: '◎' },
  ];

  container.appendChild(renderParamIcons(params));
}

function renderFullControls(container: HTMLElement): void {
  // Style chips
  container.appendChild(createChipGroup('颜色', [
    { value: 'original', label: '原色' },
    { value: 'mono', label: '单色' },
  ], state.full.colorMode, (v) => updateFull({ colorMode: v as ColorMode })));

  if (state.full.colorMode === 'mono') {
    container.appendChild(createColorPicker('字符颜色', state.full.monoColor, (v) => updateFull({ monoColor: v })));
  }

  container.appendChild(createChipGroup('背景', [
    { value: 'solid', label: '纯色' },
    { value: 'gradient', label: '渐变' },
    { value: 'transparent', label: '透明' },
  ], state.full.background, (v) => updateFull({ background: v as BackgroundMode })));

  if (state.full.background === 'solid') {
    container.appendChild(createColorPicker('背景色', state.full.bgColor, (v) => updateFull({ bgColor: v })));
  }
  if (state.full.background === 'gradient') {
    container.appendChild(createColorPicker('颜色1', state.full.bgGradient[0], (v) => updateFull({ bgGradient: [v, state.full.bgGradient[1]] })));
    container.appendChild(createColorPicker('颜色2', state.full.bgGradient[1], (v) => updateFull({ bgGradient: [state.full.bgGradient[0], v] })));
    container.appendChild(createSlider('方向', 0, 360, state.full.bgGradientDirection, 1, (v) => updateFull({ bgGradientDirection: v })));
  }

  container.appendChild(createChipGroup('字符集', [
    { value: 'standard', label: '标准' },
    { value: 'shades', label: '阴影' },
    { value: 'dots', label: '圆点' },
    { value: 'steps', label: '阶梯' },
    { value: 'complex', label: '复杂' },
  ], state.full.charset, (v) => updateFull({ charset: v as CharsetName })));

  // --- Icon-based parameter adjustment ---
  const params = [
    { id: 'density', label: '密度', icon: '▦' },
    { id: 'brightness', label: '亮度', icon: '☀' },
    { id: 'contrast', label: '对比', icon: '◑' },
    { id: 'glow', label: '辉光', icon: '✧' },
    { id: 'eraserSize', label: '橡皮', icon: '◎' },
  ];

  container.appendChild(renderParamIcons(params));
}

// === Effect Presets (模版效果) ===
interface EffectPreset {
  id: string;
  name: string;
  density: number;
  size: number;
  glow: number;
  colorMode: 'mono' | 'multi';
  monoColor: string;
  palette?: string;
}

const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'white-glow', name: '纯白辉光', density: 30, size: 85, glow: 4, colorMode: 'mono', monoColor: '#ffffff' },
];

function renderEffectPresets(): HTMLElement {
  const wrapper = el('div', { className: 'style-grid-wrapper' });
  const row = el('div', { className: 'style-grid' });

  for (const preset of EFFECT_PRESETS) {
    const card = el('button', { className: 'style-card' });
    const nameEl = el('span', { className: 'style-card-name' }, [preset.name]);
    card.appendChild(nameEl);
    card.addEventListener('click', () => {
      updatePartial({
        density: preset.density,
        size: preset.size,
        glow: preset.glow,
        colorMode: preset.colorMode,
        monoColor: preset.monoColor,
        ...(preset.palette ? { palette: preset.palette } : {}),
      });
    });
    row.appendChild(card);
  }

  wrapper.appendChild(row);
  return wrapper;
}

// === Unified Style Grid (charsets + symbol sets) ===
interface StyleOption {
  id: string;
  type: 'ascii' | 'symbols';
  name: string;
  preview: string; // characters to show in the card
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'standard', type: 'ascii', name: '标准', preview: '.:-=+*#%@' },
  { id: 'shades', type: 'ascii', name: '阴影', preview: '.░▒▓█' },
  { id: 'dots', type: 'ascii', name: '圆点', preview: '·•●○◌◎' },
  { id: 'steps', type: 'ascii', name: '阶梯', preview: '▁▂▃▄▅▆▇█' },
  { id: 'complex', type: 'ascii', name: '复杂', preview: ".:;Il!i~+_?" },
  { id: 'tech', type: 'symbols', name: '科技', preview: '✦+○×·★' },
  { id: 'nature', type: 'symbols', name: '自然', preview: '✿❀✾❁✻·' },
  { id: 'minimal', type: 'symbols', name: '极简', preview: '· • ○ ◦' },
  { id: 'geo', type: 'symbols', name: '几何', preview: '△□○◇×+' },
  { id: 'stars', type: 'symbols', name: '星辰', preview: '✦✧★☆✶·' },
];

function getCurrentStyleId(): string {
  if (state.partial.effect === 'ascii') return state.partial.charset;
  return state.partial.symbolSetId;
}

function renderStyleGrid(): HTMLElement {
  const wrapper = el('div', { className: 'style-grid-wrapper' });
  const grid = el('div', { className: 'style-grid' });

  const currentId = getCurrentStyleId();

  for (const style of STYLE_OPTIONS) {
    const isActive = style.id === currentId;
    const card = el('button', { className: `style-card ${isActive ? 'active' : ''}` });

    const previewEl = el('span', { className: 'style-card-preview' }, [style.preview]);
    const nameEl = el('span', { className: 'style-card-name' }, [style.name]);
    card.appendChild(previewEl);
    card.appendChild(nameEl);

    card.addEventListener('click', () => {
      if (style.type === 'ascii') {
        updatePartial({ effect: 'ascii', charset: style.id as any });
      } else {
        updatePartial({ effect: 'symbols', symbolSetId: style.id });
      }
    });

    grid.appendChild(card);
  }

  wrapper.appendChild(grid);
  return wrapper;
}

/** Render icon-based slider UI: icons row + active slider above */
function renderParamIcons(params: { id: string; label: string; icon: string }[]): HTMLElement {
  const wrapper = el('div', { className: 'param-icons-wrapper' });

  // Slider area (only shows for selected param)
  const sliderArea = el('div', { className: 'param-slider-area' });
  const activeParam = params.find(p => p.id === state.adjustParam) || params[0];

  // Render slider for active param
  const slider = getSliderForParam(activeParam.id);
  if (slider) sliderArea.appendChild(slider);
  wrapper.appendChild(sliderArea);

  // Icons row
  const iconsRow = el('div', { className: 'param-icons-row' });
  for (const param of params) {
    const isActive = param.id === (state.adjustParam || params[0].id);
    const btn = el('button', { className: `param-icon-btn ${isActive ? 'active' : ''}` });
    const iconEl = el('span', { className: 'param-icon' }, [param.icon]);
    const labelEl = el('span', { className: 'param-icon-label' }, [param.label]);
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    btn.addEventListener('click', () => {
      updateState({ adjustParam: param.id });
    });
    iconsRow.appendChild(btn);
  }
  wrapper.appendChild(iconsRow);

  return wrapper;
}

function getSliderForParam(paramId: string): HTMLElement | null {
  switch (paramId) {
    // Partial params
    case 'density':
      if (state.effectMode === 'partial') {
        return createSlider('密度', 10, 80, state.partial.density, 1, (v) => {
          updateState({ subjectMask: null });
          updatePartial({ density: v });
        });
      }
      return createSlider('密度', 10, 80, state.full.density, 1, (v) => updateFull({ density: v }));
    case 'size':
      return createSlider('大小', 50, 200, state.partial.size, 5, (v) => updatePartial({ size: v }));
    case 'glow':
      if (state.effectMode === 'partial') {
        return createSlider('辉光', 0, 40, state.partial.glow, 1, (v) => updatePartial({ glow: v }));
      }
      return createSlider('辉光', 0, 20, state.full.glow, 1, (v) => updateFull({ glow: v }));
    case 'brushSize':
      return createSlider('画笔大小', 10, 100, state.brushSize, 1, (v) => updateState({ brushSize: v }));
    case 'eraserSize':
      return createSlider('橡皮大小', 10, 100, state.eraserSize, 1, (v) => updateState({ eraserSize: v }));
    // Full params
    case 'brightness':
      return createSlider('亮度', -100, 100, state.full.brightness, 1, (v) => updateFull({ brightness: v }));
    case 'contrast':
      return createSlider('对比度', -100, 100, state.full.contrast, 1, (v) => updateFull({ contrast: v }));
    default:
      return null;
  }
}

// ===== STICKER PANEL =====
function renderStickerPanel(container: HTMLElement): void {
  if (state.stickerEditOnly) {
    // ---- Edit mode: only adjust controls for selected sticker ----
    // Render mode
    container.appendChild(createChipGroup('效果', [
      { value: 'dots', label: 'Dots' },
      { value: 'ascii', label: 'ASCII' },
    ], state.stickerMode, (v) => {
      clearEffectCache();
      updateState({ stickerMode: v as StickerMode });
      const stickers = state.stickers.map(s => ({ ...s, mode: v as StickerMode }));
      updateState({ stickers });
    }));

    // Palette selector
    container.appendChild(createChipGroup('色板', [
      { value: 'photo', label: '原图选色' },
      { value: 'dream', label: '千禧梦境' },
      { value: 'happy', label: '开心五彩' },
      { value: 'nature', label: '自然色系' },
      { value: 'neon', label: '亚比荧光' },
    ], state.stickerPalette, (v) => {
      clearEffectCache();
      updateState({ stickerPalette: v, stickerColor: '' });
    }));

    // Color swatches for current palette + black/white + custom
    container.appendChild(renderColorSwatches());

    // Opacity
    container.appendChild(createSlider('透明度', 10, 100, state.stampOpacity, 1, (v) => {
      updateState({ stampOpacity: v });
      if (state.selectedStickerId) {
        const stickers = state.stickers.map(s =>
          s.id === state.selectedStickerId ? { ...s, opacity: v / 100 } : s
        );
        updateState({ stickers });
      }
    }));
  } else {
    // ---- Full mode: library + clear ----
    // Category tabs
    container.appendChild(createChipGroup('', LIBRARY_GROUPS.map(g => ({
      value: g.name,
      label: g.name,
    })), state.stickerLibraryTab, (v) => updateState({ stickerLibraryTab: v })));

    // Sticker grid
    const sections = getLibraryForGroup(state.stickerLibraryTab);
    for (const { section, items } of sections) {
      if (sections.length > 1) {
        const sectionTitle = el('div', { className: 'control-label sticker-section-label' }, [section.title]);
        container.appendChild(sectionTitle);
      }

      const grid = el('div', { className: 'sticker-grid' });
      for (const asset of items) {
        const btn = el('button', { className: 'sticker-btn', title: `${section.title} ${asset.name}` });
        const img = el('img', { src: getStickerPreviewUrl(asset), alt: asset.name });
        btn.appendChild(img);
        btn.addEventListener('click', () => addStickerFromAsset(asset));
        grid.appendChild(btn);
      }
      container.appendChild(grid);
    }

    // Save as template
    if (state.stickers.length > 0) {
      container.appendChild(createButton('保存为模版', () => {
        saveCurrentAsTemplate();
      }, 'btn-secondary'));
    }

    // Export templates
    if (getSavedTemplates().length > 0) {
      container.appendChild(createButton('导出模版', () => {
        const json = JSON.stringify(getSavedTemplates(), null, 2);
        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.style.cssText = 'position:fixed;top:10%;left:5%;width:90%;height:60%;z-index:9999;font-size:11px;padding:12px;border-radius:12px;border:2px solid #2B2BD4;background:#fff;';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.cssText = 'position:fixed;top:5%;right:5%;z-index:10000;padding:8px 20px;background:#2B2BD4;color:#fff;border:none;border-radius:20px;font-size:14px;';
        closeBtn.onclick = () => { textarea.remove(); closeBtn.remove(); };
        document.body.appendChild(textarea);
        document.body.appendChild(closeBtn);
        textarea.select();
      }, 'btn-secondary'));
    }

    // Clear all
    container.appendChild(createButton('全部清除', () => {
      updateState({ stickers: [], selectedStickerId: null });
    }, 'btn-secondary'));
  }
}

function applyPartialColor(color: string): void {
  updatePartial({ colorMode: 'mono', monoColor: color });
}

function renderPartialColorSwatches(): HTMLElement {
  const wrapper = el('div', { className: 'color-swatches-wrapper' });

  let paletteColors: string[];
  if (state.partial.palette === 'photo') {
    const img = state.sourceImage;
    paletteColors = img ? extractPhotoPalette(img) : ['#888888', '#AAAAAA', '#666666', '#BBBBBB', '#999999', '#777777'];
  } else {
    const palette = COLOR_PALETTES.find(p => p.id === state.partial.palette);
    paletteColors = palette ? palette.colors : COLOR_PALETTES[0].colors;
  }

  const isMono = state.partial.colorMode === 'mono';
  const row = el('div', { className: 'color-swatch-row' });

  for (const color of paletteColors) {
    const isActive = isMono && state.partial.monoColor === color;
    const swatch = el('button', { className: `color-swatch ${isActive ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyPartialColor(color));
    row.appendChild(swatch);
  }

  const black = el('button', { className: `color-swatch ${isMono && state.partial.monoColor === '#000000' ? 'active' : ''}` });
  black.style.background = '#000000';
  black.addEventListener('click', () => applyPartialColor('#000000'));
  row.appendChild(black);

  const white = el('button', { className: `color-swatch color-swatch-border ${isMono && state.partial.monoColor === '#ffffff' ? 'active' : ''}` });
  white.style.background = '#ffffff';
  white.addEventListener('click', () => applyPartialColor('#ffffff'));
  row.appendChild(white);

  for (const color of state.customColors) {
    const isActive = isMono && state.partial.monoColor === color;
    const swatch = el('button', { className: `color-swatch ${isActive ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyPartialColor(color));
    row.appendChild(swatch);
  }

  const addBtn = el('button', { className: 'color-swatch color-swatch-add' }, ['+']);
  const hiddenInput = el('input', { type: 'color', value: state.partial.monoColor || '#ff0000', className: 'hidden-input' });
  addBtn.appendChild(hiddenInput);
  addBtn.addEventListener('click', () => { (hiddenInput as HTMLInputElement).click(); });
  hiddenInput.addEventListener('input', () => {
    applyPartialColor((hiddenInput as HTMLInputElement).value);
  });
  hiddenInput.addEventListener('change', () => {
    const v = (hiddenInput as HTMLInputElement).value;
    if (!state.customColors.includes(v)) {
      updateState({ customColors: [...state.customColors, v] });
    }
  });
  row.appendChild(addBtn);

  wrapper.appendChild(row);
  return wrapper;
}

function applyColorToSelected(color: string): void {
  clearEffectCache();
  updateState({ stickerColor: color });
  if (state.selectedStickerId) {
    const stickers = state.stickers.map(s =>
      s.id === state.selectedStickerId ? { ...s, color } : s
    );
    updateState({ stickers });
  }
}

function renderColorSwatches(): HTMLElement {
  const wrapper = el('div', { className: 'color-swatches-wrapper' });

  // Get palette colors
  let paletteColors: string[];
  if (state.stickerPalette === 'photo') {
    const img = state.sourceImage;
    paletteColors = img ? extractPhotoPalette(img) : ['#888888', '#AAAAAA', '#666666', '#BBBBBB', '#999999', '#777777'];
  } else {
    const palette = COLOR_PALETTES.find(p => p.id === state.stickerPalette);
    paletteColors = palette ? palette.colors : COLOR_PALETTES[0].colors;
  }

  const row = el('div', { className: 'color-swatch-row' });

  // Palette colors
  for (const color of paletteColors) {
    const swatch = el('button', { className: `color-swatch ${state.stickerColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyColorToSelected(color));
    row.appendChild(swatch);
  }

  // Black
  const black = el('button', { className: `color-swatch ${state.stickerColor === '#000000' ? 'active' : ''}` });
  black.style.background = '#000000';
  black.addEventListener('click', () => applyColorToSelected('#000000'));
  row.appendChild(black);

  // White
  const white = el('button', { className: `color-swatch color-swatch-border ${state.stickerColor === '#ffffff' ? 'active' : ''}` });
  white.style.background = '#ffffff';
  white.addEventListener('click', () => applyColorToSelected('#ffffff'));
  row.appendChild(white);

  // Custom saved colors
  for (const color of state.customColors) {
    const swatch = el('button', { className: `color-swatch ${state.stickerColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyColorToSelected(color));
    row.appendChild(swatch);
  }

  // "+" custom color picker
  const addBtn = el('button', { className: 'color-swatch color-swatch-add' }, ['+']);
  const hiddenInput = el('input', { type: 'color', value: '#ff0000', className: 'hidden-input' });
  addBtn.appendChild(hiddenInput);
  addBtn.addEventListener('click', () => { (hiddenInput as HTMLInputElement).click(); });
  hiddenInput.addEventListener('input', () => {
    const v = (hiddenInput as HTMLInputElement).value;
    applyColorToSelected(v);
  });
  // Save custom color on change (when picker closes)
  hiddenInput.addEventListener('change', () => {
    const v = (hiddenInput as HTMLInputElement).value;
    if (!state.customColors.includes(v)) {
      updateState({ customColors: [...state.customColors, v] });
    }
  });
  row.appendChild(addBtn);

  wrapper.appendChild(row);
  return wrapper;
}

function applyCanvasBgColor(color: string): void {
  updateState({ canvasBgColor: color });
}

function renderCanvasBgSwatches(): HTMLElement {
  const wrapper = el('div', { className: 'color-swatches-wrapper' });

  let paletteColors: string[];
  if (state.canvasBgPalette === 'photo') {
    const img = state.sourceImage;
    paletteColors = img ? extractPhotoPalette(img) : ['#888888', '#AAAAAA', '#666666', '#BBBBBB', '#999999', '#777777'];
  } else {
    const palette = COLOR_PALETTES.find(p => p.id === state.canvasBgPalette);
    paletteColors = palette ? palette.colors : COLOR_PALETTES[0].colors;
  }

  const row = el('div', { className: 'color-swatch-row' });

  for (const color of paletteColors) {
    const swatch = el('button', { className: `color-swatch ${state.canvasBgColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyCanvasBgColor(color));
    row.appendChild(swatch);
  }

  const black = el('button', { className: `color-swatch ${state.canvasBgColor === '#000000' ? 'active' : ''}` });
  black.style.background = '#000000';
  black.addEventListener('click', () => applyCanvasBgColor('#000000'));
  row.appendChild(black);

  const white = el('button', { className: `color-swatch color-swatch-border ${state.canvasBgColor === '#ffffff' ? 'active' : ''}` });
  white.style.background = '#ffffff';
  white.addEventListener('click', () => applyCanvasBgColor('#ffffff'));
  row.appendChild(white);

  for (const color of state.customColors) {
    const swatch = el('button', { className: `color-swatch ${state.canvasBgColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyCanvasBgColor(color));
    row.appendChild(swatch);
  }

  const addBtn = el('button', { className: 'color-swatch color-swatch-add' }, ['+']);
  const hiddenInput = el('input', { type: 'color', value: '#ff0000', className: 'hidden-input' });
  addBtn.appendChild(hiddenInput);
  addBtn.addEventListener('click', () => { (hiddenInput as HTMLInputElement).click(); });
  hiddenInput.addEventListener('input', () => {
    applyCanvasBgColor((hiddenInput as HTMLInputElement).value);
  });
  hiddenInput.addEventListener('change', () => {
    const v = (hiddenInput as HTMLInputElement).value;
    if (!state.customColors.includes(v)) {
      updateState({ customColors: [...state.customColors, v] });
    }
  });
  row.appendChild(addBtn);

  wrapper.appendChild(row);
  return wrapper;
}

function addStickerFromAsset(asset: StickerAsset): void {
  // Use reference (full/panel-closed) sizes so displayScale handles shrinking
  const canvasSize = getReferenceCanvasSize();
  const photoSize = getReferencePhotoRect();
  const scale = getDefaultScale(asset, canvasSize.w, canvasSize.h, photoSize.w, photoSize.h);
  const unitSize = getEffectUnitSize(canvasSize.w, canvasSize.h);

  const sticker = {
    id: uid(),
    assetId: asset.id,
    x: 0.5,
    y: 0.5,
    scale,
    rotation: 0,
    color: pickStickerColor(),
    mode: state.stickerMode,
    opacity: state.stampOpacity / 100,
    effectUnitSize: unitSize,
    subjectAvoid: false,
  };

  updateState({
    stickers: [...state.stickers, sticker],
    selectedStickerId: sticker.id,
  });
}

// ===== CANVAS PANEL =====
function renderCanvasPanel(container: HTMLElement): void {
  container.appendChild(createChipGroup('画布比例', [
    { value: 'original', label: '原始' },
    { value: '1:1', label: '1:1' },
    { value: '4:5', label: '4:5' },
    { value: '3:4', label: '3:4' },
    { value: '9:16', label: '9:16' },
    { value: '16:9', label: '16:9' },
    { value: '4:3', label: '4:3' },
  ], state.canvasRatio, (v) => {
    updateState({
      canvasRatio: v as CanvasRatio,
      photoX: 0.5,
      photoY: 0.5,
      photoScale: 1,
      subjectMask: null,
      brushMask: null,
      eraserMask: null,
    });
  }));

  if (state.canvasRatio !== 'original') {
    container.appendChild(createButton('重置位置', () => {
      updateState({ photoX: 0.5, photoY: 0.5, photoScale: 1 });
    }, 'btn-secondary'));

    // Canvas background color
    container.appendChild(createChipGroup('背景色板', [
      { value: 'photo', label: '原图选色' },
      { value: 'dream', label: '千禧梦境' },
      { value: 'happy', label: '开心五彩' },
      { value: 'nature', label: '自然色系' },
      { value: 'neon', label: '亚比荧光' },
    ], state.canvasBgPalette, (v) => {
      updateState({ canvasBgPalette: v, canvasBgColor: '' });
    }));

    container.appendChild(renderCanvasBgSwatches());
  }
}
