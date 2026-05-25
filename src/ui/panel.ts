// === PixPic — Panel (Figma Redesign: 背景/贴纸/画布 + floating action bar) ===

import { el, clearEl } from './dom';
import { state, updateState, updatePartial } from '../state';
import type { CanvasRatio, StickerMode, EditorTool, AdjustSubTab, OverlayShape, OverlayInstance } from '../types';
import { createSlider, createToggle, createChipGroup, createButton } from './controls';
import { triggerSegmentation } from '../modes/partial';
import {
  LIBRARY_GROUPS, getLibraryForGroup, getStickerPreviewUrl,
  getDefaultScale, getEffectUnitSize,
  pickStickerColor, clearEffectCache,
  extractPhotoPalette,
} from '../core/stickers';
import { COLOR_PALETTES } from '../core/shapes';
import type { StickerAsset } from '../core/stickers';
import { getReferenceCanvasSize, getReferencePhotoRect } from '../render/compositor';
import { uid } from '../core/math';

// === Template System (localStorage) ===
interface StickerTemplate {
  id: string;
  canvasAspect?: number;
  stickers: { assetId: string; x: number; y: number; scale: number; rotation: number; subjectAvoid: boolean }[];
}

const TEMPLATE_STORAGE_KEY = 'trace-sticker-templates';

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
  const templateAspect = tpl.canvasAspect || (3 / 4);

  let scaleX = 1, scaleY = 1;
  if (currentAspect > templateAspect) {
    scaleX = templateAspect / currentAspect;
  } else {
    scaleY = currentAspect / templateAspect;
  }

  const fitScale = Math.min(scaleX, scaleY);
  const templateColor = pickStickerColor();

  const stickers = tpl.stickers.map(s => {
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

  if (stickers.some(s => s.subjectAvoid) && !state.subjectMask && !state.subjectLoading && state.sourceImage) {
    import('../modes/partial').then(m => m.triggerSegmentation(state.sourceImage!));
  }

  updateState({ stickers, selectedStickerId: null });
}

// === Remix Icon classes for toolbar (Apple Photos tab bar style) ===
const TOOLS: { id: EditorTool; label: string; iconClass: string; activeIconClass: string }[] = [
  { id: 'adjust', label: 'Adjust', iconClass: 'ri-magic-line', activeIconClass: 'ri-magic-fill' },
  { id: 'sticker', label: 'Stickers', iconClass: 'ri-sticky-note-line', activeIconClass: 'ri-sticky-note-fill' },
  { id: 'canvas', label: 'Crop', iconClass: 'ri-crop-line', activeIconClass: 'ri-crop-fill' },
];

// === Sub-tabs for 背景 ===
const ADJUST_SUBTABS: { id: AdjustSubTab; label: string }[] = [
  { id: 'dots', label: '点样' },
  { id: 'palette', label: '色板' },
  { id: 'otherParams', label: '其他参数' },
];

// === Undo/Redo History ===
let undoStack: any[] = [];
let redoStack: any[] = [];

function pushUndo(): void {
  undoStack.push({
    stickers: JSON.parse(JSON.stringify(state.stickers)),
    partial: JSON.parse(JSON.stringify(state.partial)),
    effectMode: state.effectMode,
    overlayImages: state.overlayImages.map(o => ({ ...o })), // shallow copy (image ref stays)
    canvasRatio: state.canvasRatio,
    canvasBgColor: state.canvasBgColor,
    canvasBgPalette: state.canvasBgPalette,
    photoX: state.photoX,
    photoY: state.photoY,
    photoScale: state.photoScale,
  });
  redoStack = [];
  if (undoStack.length > 20) undoStack.shift();
}

function doUndo(): void {
  if (undoStack.length === 0) return;
  redoStack.push({
    stickers: JSON.parse(JSON.stringify(state.stickers)),
    partial: JSON.parse(JSON.stringify(state.partial)),
    effectMode: state.effectMode,
    overlayImages: state.overlayImages.map(o => ({ ...o })),
    canvasRatio: state.canvasRatio,
    canvasBgColor: state.canvasBgColor,
    canvasBgPalette: state.canvasBgPalette,
    photoX: state.photoX,
    photoY: state.photoY,
    photoScale: state.photoScale,
  });
  const prev = undoStack.pop()!;
  updateState({
    stickers: prev.stickers,
    effectMode: prev.effectMode,
    overlayImages: prev.overlayImages,
    selectedOverlayId: null,
    canvasRatio: prev.canvasRatio,
    canvasBgColor: prev.canvasBgColor,
    canvasBgPalette: prev.canvasBgPalette,
    photoX: prev.photoX,
    photoY: prev.photoY,
    photoScale: prev.photoScale,
  });
  Object.assign(state.partial, prev.partial);
}

// ===== CREATE PANEL =====
export function createPanel(): HTMLElement {
  const wrapper = el('div', { className: 'panel-wrapper' });

  // Panel sheet (white rounded-top container — all controls inside)
  const sheet = el('div', { className: 'panel-sheet' });

  // Action bar (undo/redo LEFT + tool icons RIGHT — all in one row)
  const actionBar = el('div', { className: 'action-bar' });
  sheet.appendChild(actionBar);

  // Sub-tabs row
  const subtabs = el('div', { className: 'panel-subtabs' });
  sheet.appendChild(subtabs);

  // Content area (scrollable)
  const content = el('div', { className: 'panel-content' });
  sheet.appendChild(content);

  wrapper.appendChild(sheet);

  // Main toolbar (bottom tab bar)
  const toolbar = el('div', { className: 'toolbar' });
  for (const tool of TOOLS) {
    const isActive = state.activeTool === tool.id;
    const btn = el('button', {
      className: `toolbar-btn ${isActive ? 'active' : ''}`,
      'data-tool': tool.id,
    });
    const iconEl = el('i', { className: `toolbar-icon ${isActive ? tool.activeIconClass : tool.iconClass}` });
    const labelEl = el('span', { className: 'toolbar-label' }, [tool.label]);
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    btn.addEventListener('click', () => {
      if (state.activeTool === tool.id) {
        // Already active → collapse panel
        updateState({ activeTool: 'none' });
      } else {
        updateState({ activeTool: tool.id, stickerEditOnly: false, selectedOverlayId: null });
      }
    });
    toolbar.appendChild(btn);
  }
  wrapper.appendChild(toolbar);

  return wrapper;
}

// ===== RENDER PANEL CONTENT =====
export function renderPanelContent(panelWrapper: HTMLElement): void {
  const content = panelWrapper.querySelector('.panel-content') as HTMLElement;
  const subtabs = panelWrapper.querySelector('.panel-subtabs') as HTMLElement;
  const actionBar = panelWrapper.querySelector('.action-bar') as HTMLElement;
  const panelSheet = panelWrapper.querySelector('.panel-sheet') as HTMLElement;
  if (!content || !subtabs || !actionBar) return;

  // Update toolbar active states + icon swap
  const toolBtns = panelWrapper.querySelectorAll('.toolbar-btn');
  toolBtns.forEach(btn => {
    const toolId = (btn as HTMLElement).dataset.tool;
    const isActive = toolId === state.activeTool;
    btn.classList.toggle('active', isActive);
    // Swap icon class for fill/line variant
    const iconEl = btn.querySelector('.toolbar-icon');
    if (iconEl && toolId) {
      const toolDef = TOOLS.find(t => t.id === toolId);
      if (toolDef) {
        iconEl.className = `toolbar-icon ${isActive ? toolDef.activeIconClass : toolDef.iconClass}`;
      }
    }
  });

  // Collapse: hide panel sheet when no tool active
  if (panelSheet) {
    panelSheet.classList.toggle('collapsed', state.activeTool === 'none');
  }
  if (state.activeTool === 'none') return;

  const activeTool = state.activeTool;

  // Clear dynamic sections
  clearEl(content);
  clearEl(subtabs);
  clearEl(actionBar);

  // --- Render action bar ---
  renderActionBar(actionBar, activeTool);

  // --- Render sub-tabs ---
  if (activeTool === 'adjust') {
    for (const tab of ADJUST_SUBTABS) {
      const btn = el('button', {
        className: `panel-subtab ${state.adjustSubTab === tab.id ? 'active' : ''}`,
      });
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        updateState({ adjustSubTab: tab.id });
      });
      subtabs.appendChild(btn);
    }
  } else if (activeTool === 'sticker') {
    if (state.stickerEditOnly) {
      // Edit mode sub-tabs: 点样 | 色板 | 透明度
      const editTabs = [
        { id: 'dots', label: '点样' },
        { id: 'palette', label: '色板' },
        { id: 'opacity', label: '透明度' },
      ];
      for (const tab of editTabs) {
        const btn = el('button', {
          className: `panel-subtab ${state.stickerEditTab === tab.id ? 'active' : ''}`,
        });
        btn.textContent = tab.label;
        btn.addEventListener('click', () => {
          updateState({ stickerEditTab: tab.id });
        });
        subtabs.appendChild(btn);
      }
    } else {
      // Library mode sub-tabs: 边框 | 花束 | 植物 | ...
      const tabsLeft = el('div', { className: 'subtabs-left' });
      for (const group of LIBRARY_GROUPS) {
        const btn = el('button', {
          className: `panel-subtab ${state.stickerLibraryTab === group.name ? 'active' : ''}`,
        });
        btn.textContent = group.name;
        btn.addEventListener('click', () => updateState({ stickerLibraryTab: group.name }));
        tabsLeft.appendChild(btn);
      }
      subtabs.appendChild(tabsLeft);
    }
  } else if (activeTool === 'canvas') {
    if (state.selectedOverlayId) {
      // Overlay edit mode: "形状" | "透明度" tabs
      const editTabs = [
        { id: 'shape', label: '形状' },
        { id: 'opacity', label: '透明度' },
      ];
      for (const tab of editTabs) {
        const btn = el('button', {
          className: `panel-subtab ${state.overlayEditTab === tab.id ? 'active' : ''}`,
        });
        btn.textContent = tab.label;
        btn.addEventListener('click', () => {
          updateState({ overlayEditTab: tab.id });
        });
        subtabs.appendChild(btn);
      }
    }
  }

  // --- Render content ---
  switch (activeTool) {
    case 'adjust':
      renderAdjustContent(content);
      break;
    case 'sticker':
      renderStickerContent(content);
      break;
    case 'canvas':
      renderCanvasContent(content);
      break;
  }
}

// ===== OVERLAY SHAPES =====
const OVERLAY_SHAPES: { id: OverlayShape; label: string }[] = [
  { id: 'circle', label: '●' },
  { id: 'roundedSquare', label: '▢' },
  { id: 'square', label: '■' },
  { id: 'heart', label: '♥' },
  { id: 'star', label: '★' },
  { id: 'hexagon', label: '⬡' },
  { id: 'diamond', label: '◆' },
  { id: 'rectangle', label: '▬' },
];

function loadOverlayImage(file: File): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const overlay: OverlayInstance = {
      id: uid(),
      image: img,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      shape: 'circle',
      opacity: 1,
    };
    pushUndo();
    updateState({
      overlayImages: [...state.overlayImages, overlay],
      selectedOverlayId: overlay.id,
    });
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ===== ACTION BAR (each mode fully self-contained) =====
function renderActionBar(actionBar: HTMLElement, activeTool: EditorTool): void {
  const isLoading = state.subjectLoading;

  if (activeTool === 'adjust') {
    // "惊喜一下 | ↩ | 清空" pill (right-aligned)
    actionBar.appendChild(createActionPill(isLoading, () => { pushUndo(); randomizeEffect(); }, () => {
      pushUndo();
      updatePartial({
        effect: 'symbols',
        colorMode: 'mono',
        monoColor: '#00ff41',
        palette: 'photo',
        density: 30,
        size: 100,
        glow: 0,
        opacity: 100,
        charset: 'standard',
        symbolSetId: 'tech',
        invert: false,
      });
      updateState({ effectMode: 'off', eraserMask: null });
    }));
  } else if (activeTool === 'sticker') {
    if (state.stickerEditOnly) {
      // "新增贴纸" left-aligned button
      const addBtn = el('button', { className: 'action-add-sticker-btn' }, ['新增贴纸']);
      addBtn.addEventListener('click', () => {
        updateState({ stickerEditOnly: false, selectedStickerId: null });
      });
      actionBar.appendChild(addBtn);
    } else {
      // Same pill — clear removes all stickers
      actionBar.appendChild(createActionPill(false, () => { pushUndo(); applyRandomTemplate(); }, () => {
        pushUndo();
        updateState({ stickers: [], selectedStickerId: null });
      }));
    }
  } else if (activeTool === 'canvas') {
    // "添加图片" pill (replaces "惊喜一下" in crop tab)
    const pill = el('div', { className: 'action-pill' });

    const addBtn = el('button', { className: 'action-pill-btn' });
    const addIcon = el('i', { className: 'ri-image-add-line' });
    const addText = el('span', {}, ['添加图片']);
    addBtn.appendChild(addIcon);
    addBtn.appendChild(addText);
    addBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) loadOverlayImage(file);
      });
      fileInput.click();
    });
    pill.appendChild(addBtn);

    const d1 = el('span', { className: 'action-pill-divider' });
    pill.appendChild(d1);

    const undoBtn = el('button', { className: 'action-pill-icon' });
    undoBtn.appendChild(el('i', { className: 'ri-arrow-go-back-line' }));
    undoBtn.addEventListener('click', () => doUndo());
    pill.appendChild(undoBtn);

    const d2 = el('span', { className: 'action-pill-divider' });
    pill.appendChild(d2);

    const clearBtn = el('button', { className: `action-pill-icon ${state.overlayImages.length === 0 ? 'disabled' : ''}` });
    clearBtn.appendChild(el('i', { className: 'ri-delete-bin-line' }));
    clearBtn.addEventListener('click', () => {
      if (state.overlayImages.length === 0) return;
      showConfirmDialog('确定清空所有叠加图片吗？', () => {
        pushUndo();
        updateState({ overlayImages: [], selectedOverlayId: null });
      });
    });
    pill.appendChild(clearBtn);

    actionBar.appendChild(pill);
  }
}

/** Shared "惊喜一下 | ↩ | 清空" pill component */
function createActionPill(disabled: boolean, onSurprise: () => void, onClear: () => void): HTMLElement {
  const pill = el('div', { className: 'action-pill' });

  const surpriseBtn = el('button', { className: `action-pill-btn ${disabled ? 'disabled' : ''}` });
  const sparkIcon = el('i', { className: 'ri-sparkling-line' });
  const sparkText = el('span', {}, ['惊喜一下']);
  surpriseBtn.appendChild(sparkIcon);
  surpriseBtn.appendChild(sparkText);
  if (!disabled) surpriseBtn.addEventListener('click', onSurprise);
  pill.appendChild(surpriseBtn);

  const d1 = el('span', { className: 'action-pill-divider' });
  pill.appendChild(d1);

  const undoBtn = el('button', { className: `action-pill-icon ${disabled ? 'disabled' : ''}` });
  undoBtn.appendChild(el('i', { className: 'ri-arrow-go-back-line' }));
  if (!disabled) undoBtn.addEventListener('click', () => doUndo());
  pill.appendChild(undoBtn);

  const d2 = el('span', { className: 'action-pill-divider' });
  pill.appendChild(d2);

  const clearBtn = el('button', { className: `action-pill-icon ${disabled ? 'disabled' : ''}` });
  clearBtn.appendChild(el('i', { className: 'ri-delete-bin-line' }));
  if (!disabled) clearBtn.addEventListener('click', () => {
    showConfirmDialog('确定清空当前效果吗？', onClear);
  });
  pill.appendChild(clearBtn);

  return pill;
}

// ===== RANDOMIZE EFFECT =====
function randomizeEffect(): void {
  const randomStyle = STYLE_OPTIONS[Math.floor(Math.random() * STYLE_OPTIONS.length)];
  const palettes = ['photo', 'dream', 'happy', 'nature', 'neon'];
  const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
  const randomDensity = 15 + Math.floor(Math.random() * 55);
  const randomSize = 60 + Math.floor(Math.random() * 120);

  if (randomStyle.type === 'ascii') {
    updatePartial({
      effect: 'ascii',
      charset: randomStyle.id as any,
      palette: randomPalette,
      colorMode: 'multi',
      density: randomDensity,
      size: randomSize,
      glow: 0,
    });
  } else {
    updatePartial({
      effect: 'symbols',
      symbolSetId: randomStyle.id,
      palette: randomPalette,
      colorMode: 'multi',
      density: randomDensity,
      size: randomSize,
      glow: 0,
    });
  }

  if (state.effectMode === 'off') {
    updateState({ effectMode: 'partial' });
    if (state.sourceImage) triggerSegmentation(state.sourceImage);
  }
}

// ===== ADJUST TAB CONTENT =====
function renderAdjustContent(container: HTMLElement): void {
  switch (state.adjustSubTab) {
    case 'dots':
      renderDotsTab(container);
      break;
    case 'palette':
      renderPaletteTab(container);
      break;
    case 'otherParams':
      renderOtherParamsTab(container);
      break;
  }
}

// --- Sub-tab: 点样 ---
function renderDotsTab(container: HTMLElement): void {
  container.appendChild(renderStyleGrid());
}

// --- Sub-tab: 色板 ---
function renderPaletteTab(container: HTMLElement): void {
  // Color swatch row (single colors)
  container.appendChild(renderPartialColorSwatches());

  // Palette preset cards
  container.appendChild(renderPaletteCards());
}

// --- Sub-tab: 其他参数 ---
function renderOtherParamsTab(container: HTMLElement): void {
  const paramsWrapper = el('div', { className: 'params-all-sliders' });

  // All sliders visible at once
  paramsWrapper.appendChild(createSlider('密度', 10, 80, state.partial.density, 1, (v) => {
    updateState({ subjectMask: null });
    updatePartial({ density: v });
  }));

  paramsWrapper.appendChild(createSlider('大小', 50, 200, state.partial.size, 5, (v) => updatePartial({ size: v })));

  paramsWrapper.appendChild(createSlider('透明度', 10, 100, state.partial.opacity, 1, (v) => updatePartial({ opacity: v })));

  container.appendChild(paramsWrapper);

  // Toggle row: 抠图 (ON=背景效果) + 背景图 (ON=保留原图)
  const toggleRow = el('div', { className: 'toggle-row' });
  toggleRow.appendChild(createToggle('抠图', state.partial.segEnabled, (v) => {
    updatePartial({ segEnabled: v });
    if (v && state.sourceImage && !state.subjectMask && !state.subjectLoading) {
      triggerSegmentation(state.sourceImage);
    }
    if (!v) {
      // Clear mask when disabled
      updateState({ subjectMask: null, subjectLoading: false, subjectError: null });
    }
  }));
  toggleRow.appendChild(createToggle('背景图', state.partial.bgImageEnabled, (v) => {
    updatePartial({ bgImageEnabled: v });
  }));
  container.appendChild(toggleRow);
}

// ===== STICKER TAB =====
function renderStickerContent(container: HTMLElement): void {
  if (state.stickerEditOnly) {
    // Edit mode: only editing controls, NO sticker grid below
    switch (state.stickerEditTab) {
      case 'dots':
        container.appendChild(createChipGroup('效果', [
          { value: 'dots', label: 'Dots' },
          { value: 'ascii', label: 'ASCII' },
        ], state.stickerMode, (v) => {
          clearEffectCache();
          updateState({ stickerMode: v as StickerMode });
          const stickers = state.stickers.map(s => ({ ...s, mode: v as StickerMode }));
          updateState({ stickers });
        }));
        break;
      case 'palette':
        // Same layout as adjust 色板: palette cards + color swatches
        container.appendChild(renderStickerPaletteCards());
        container.appendChild(renderColorSwatches());
        break;
      case 'opacity':
        container.appendChild(createSlider('透明度', 10, 100, state.stampOpacity, 1, (v) => {
          updateState({ stampOpacity: v });
          if (state.selectedStickerId) {
            const stickers = state.stickers.map(s =>
              s.id === state.selectedStickerId ? { ...s, opacity: v / 100 } : s
            );
            updateState({ stickers });
          }
        }));
        break;
    }
  } else {
    // Library mode: sticker grid
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
        btn.addEventListener('click', () => {
          pushUndo();
          addStickerFromAsset(asset);
        });
        grid.appendChild(btn);
      }
      container.appendChild(grid);
    }

    if (state.stickers.length > 0) {
      container.appendChild(createButton('保存为模版', () => {
        saveCurrentAsTemplate();
      }, 'btn-secondary'));
    }
  }
}
// ===== CANVAS TAB =====
function renderCanvasContent(container: HTMLElement): void {
  // Overlay edit mode: show shape or opacity controls
  if (state.selectedOverlayId) {
    const selectedOverlay = state.overlayImages.find(o => o.id === state.selectedOverlayId);
    if (!selectedOverlay) return;

    if (state.overlayEditTab === 'shape') {
      // Shape chips in content area
      const row = el('div', { className: 'chip-row' });
      for (const shape of OVERLAY_SHAPES) {
        const isActive = selectedOverlay.shape === shape.id;
        const chip = el('button', { className: `chip ${isActive ? 'active' : ''}` }, [shape.label]);
        chip.style.fontSize = '1.1rem';
        chip.style.padding = '10px 14px';
        chip.addEventListener('click', () => {
          pushUndo();
          const overlays = state.overlayImages.map(o =>
            o.id === state.selectedOverlayId ? { ...o, shape: shape.id } : o
          );
          updateState({ overlayImages: overlays });
        });
        row.appendChild(chip);
      }
      container.appendChild(row);
    } else if (state.overlayEditTab === 'opacity') {
      // Opacity slider
      const currentOpacity = Math.round((selectedOverlay.opacity ?? 1) * 100);
      container.appendChild(createSlider('透明度', 10, 100, currentOpacity, 1, (v) => {
        const overlays = state.overlayImages.map(o =>
          o.id === state.selectedOverlayId ? { ...o, opacity: v / 100 } : o
        );
        updateState({ overlayImages: overlays });
      }));
    }
    return;
  }

  // Normal canvas mode
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
      eraserMask: null,
    });
  }));

  if (state.canvasRatio !== 'original') {
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

// ===== HELPER: Style Grid =====
interface StyleOption {
  id: string;
  type: 'ascii' | 'symbols';
  name: string;
  preview: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'standard', type: 'ascii', name: '标准', preview: '.:-=+*#%@' },
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
      pushUndo();
      if (style.type === 'ascii') {
        updatePartial({ effect: 'ascii', charset: style.id as any });
      } else {
        updatePartial({ effect: 'symbols', symbolSetId: style.id });
      }
      if (state.effectMode === 'off') {
        updateState({ effectMode: 'partial' });
        if (state.sourceImage) triggerSegmentation(state.sourceImage);
      }
    });

    grid.appendChild(card);
  }

  wrapper.appendChild(grid);
  return wrapper;
}

// ===== HELPER: Palette Cards =====
function renderPaletteCards(): HTMLElement {
  const wrapper = el('div', { className: 'palette-cards-wrapper' });

  const palettes = [
    { id: 'dream', name: '千禧梦境' },
    { id: 'happy', name: '开心五彩' },
    { id: 'nature', name: '自然色系' },
    { id: 'neon', name: '亚比荧光' },
  ];

  const cardsRow = el('div', { className: 'palette-cards-row' });

  for (const p of palettes) {
    const isActive = state.partial.palette === p.id && state.partial.colorMode === 'multi';
    const card = el('button', { className: `palette-card ${isActive ? 'active' : ''}` });

    // 2x3 dot grid preview
    const dotsGrid = el('div', { className: 'palette-card-dots' });
    const palette = COLOR_PALETTES.find(cp => cp.id === p.id);
    const colors = palette ? palette.colors.slice(0, 6) : ['#ccc', '#ccc', '#ccc', '#ccc', '#ccc', '#ccc'];
    for (const color of colors) {
      const dot = el('span', { className: 'palette-dot' });
      dot.style.background = color;
      dotsGrid.appendChild(dot);
    }
    card.appendChild(dotsGrid);

    const nameEl = el('span', { className: 'palette-card-name' }, [p.name]);
    card.appendChild(nameEl);

    card.addEventListener('click', () => {
      updatePartial({ palette: p.id, colorMode: 'multi' });
    });
    cardsRow.appendChild(card);
  }

  wrapper.appendChild(cardsRow);
  return wrapper;
}

// ===== HELPER: Partial Color Swatches =====
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

  // "+" add button first
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

  wrapper.appendChild(row);
  return wrapper;
}

// ===== HELPER: Sticker Color Swatches =====
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

/** Sticker palette cards — same format as adjust tab's renderPaletteCards */
function renderStickerPaletteCards(): HTMLElement {
  const wrapper = el('div', { className: 'palette-cards-wrapper' });
  const cardsRow = el('div', { className: 'palette-cards-row' });

  const palettes = [
    { id: 'photo', name: '原图选色' },
    { id: 'dream', name: '千禧梦境' },
    { id: 'happy', name: '开心五彩' },
    { id: 'nature', name: '自然色系' },
    { id: 'neon', name: '亚比荧光' },
  ];

  for (const p of palettes) {
    const isActive = state.stickerPalette === p.id;
    const card = el('button', { className: `palette-card ${isActive ? 'active' : ''}` });

    // 2x3 dot grid preview
    const dotsGrid = el('div', { className: 'palette-card-dots' });
    if (p.id === 'photo') {
      // Photo palette: extract colors from source image
      const img = state.sourceImage;
      const colors = img ? extractPhotoPalette(img).slice(0, 6) : ['#888', '#aaa', '#666', '#bbb', '#999', '#777'];
      for (const color of colors) {
        const dot = el('span', { className: 'palette-dot' });
        dot.style.background = color;
        dotsGrid.appendChild(dot);
      }
    } else {
      const palette = COLOR_PALETTES.find(cp => cp.id === p.id);
      const colors = palette ? palette.colors.slice(0, 6) : ['#ccc', '#ccc', '#ccc', '#ccc', '#ccc', '#ccc'];
      for (const color of colors) {
        const dot = el('span', { className: 'palette-dot' });
        dot.style.background = color;
        dotsGrid.appendChild(dot);
      }
    }
    card.appendChild(dotsGrid);

    const nameEl = el('span', { className: 'palette-card-name' }, [p.name]);
    card.appendChild(nameEl);

    card.addEventListener('click', () => {
      clearEffectCache();
      updateState({ stickerPalette: p.id, stickerColor: '' });
    });
    cardsRow.appendChild(card);
  }

  wrapper.appendChild(cardsRow);
  return wrapper;
}

function renderColorSwatches(): HTMLElement {
  const wrapper = el('div', { className: 'color-swatches-wrapper' });

  let paletteColors: string[];
  if (state.stickerPalette === 'photo') {
    const img = state.sourceImage;
    paletteColors = img ? extractPhotoPalette(img) : ['#888888', '#AAAAAA', '#666666', '#BBBBBB', '#999999', '#777777'];
  } else {
    const palette = COLOR_PALETTES.find(p => p.id === state.stickerPalette);
    paletteColors = palette ? palette.colors : COLOR_PALETTES[0].colors;
  }

  const row = el('div', { className: 'color-swatch-row' });

  for (const color of paletteColors) {
    const swatch = el('button', { className: `color-swatch ${state.stickerColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyColorToSelected(color));
    row.appendChild(swatch);
  }

  const black = el('button', { className: `color-swatch ${state.stickerColor === '#000000' ? 'active' : ''}` });
  black.style.background = '#000000';
  black.addEventListener('click', () => applyColorToSelected('#000000'));
  row.appendChild(black);

  const white = el('button', { className: `color-swatch color-swatch-border ${state.stickerColor === '#ffffff' ? 'active' : ''}` });
  white.style.background = '#ffffff';
  white.addEventListener('click', () => applyColorToSelected('#ffffff'));
  row.appendChild(white);

  for (const color of state.customColors) {
    const swatch = el('button', { className: `color-swatch ${state.stickerColor === color ? 'active' : ''}` });
    swatch.style.background = color;
    swatch.addEventListener('click', () => applyColorToSelected(color));
    row.appendChild(swatch);
  }

  const addBtn = el('button', { className: 'color-swatch color-swatch-add' }, ['+']);
  const hiddenInput = el('input', { type: 'color', value: '#ff0000', className: 'hidden-input' });
  addBtn.appendChild(hiddenInput);
  addBtn.addEventListener('click', () => { (hiddenInput as HTMLInputElement).click(); });
  hiddenInput.addEventListener('input', () => {
    const v = (hiddenInput as HTMLInputElement).value;
    applyColorToSelected(v);
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

// ===== HELPER: Canvas Background Swatches =====
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

// ===== HELPER: Add Sticker =====
function addStickerFromAsset(asset: StickerAsset): void {
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
    stickerEditOnly: true, // Auto-enter edit mode after adding
  });
}

// ===== CONFIRM DIALOG (iOS Action Sheet style) =====
function showConfirmDialog(message: string, onConfirm: () => void): void {
  const overlay = el('div', { className: 'confirm-overlay' });
  const dialog = el('div', { className: 'confirm-dialog' });

  const msg = el('p', { className: 'confirm-message' }, [message]);
  dialog.appendChild(msg);

  const actions = el('div', { className: 'confirm-actions' });

  const confirmBtn = el('button', { className: 'confirm-btn confirm-destructive' }, ['清空']);
  confirmBtn.addEventListener('click', () => {
    onConfirm();
    overlay.remove();
  });

  const cancelBtn = el('button', { className: 'confirm-btn confirm-cancel' }, ['取消']);
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('app')!.appendChild(overlay);
}
