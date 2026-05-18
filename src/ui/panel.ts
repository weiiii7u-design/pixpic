// === Trace — Bottom Panel with Tabs (v4: Image Stickers) ===

import { el, clearEl } from './dom';
import { state, updateState, updatePartial, updateFull } from '../state';
import type {
  PanelTab, CharsetName, ColorMode, PartialTarget, EffectType, BackgroundMode, CanvasRatio, StickerMode,
} from '../types';
import { createSlider, createToggle, createChipGroup, createColorPicker, createButton } from './controls';
import { SYMBOL_SETS } from '../core/symbols';
import { triggerSegmentation } from '../modes/partial';
import {
  LIBRARY_GROUPS, getLibraryForGroup, getStickerPreviewUrl,
  getDefaultScale, getEffectUnitSize,
  pickStickerColor, generateRandomComposition, clearEffectCache,
} from '../core/stickers';
import type { StickerAsset } from '../core/stickers';
import { getCanvasSize } from '../render/compositor';
import { uid } from '../core/math';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'style', label: '风格' },
  { id: 'adjust', label: '调节' },
];

export function createPanel(): HTMLElement {
  const panel = el('div', { className: 'panel' });

  const tabBar = el('div', { className: 'panel-tabs' });
  for (const tab of TABS) {
    const btn = el('button', {
      className: `panel-tab ${state.panelTab === tab.id ? 'active' : ''}`,
      'data-tab': tab.id,
    }, [tab.label]);
    btn.addEventListener('click', () => {
      updateState({ panelTab: tab.id });
    });
    tabBar.appendChild(btn);
  }
  panel.appendChild(tabBar);

  const content = el('div', { className: 'panel-content' });
  panel.appendChild(content);

  return panel;
}

export function renderPanelContent(panel: HTMLElement): void {
  const content = panel.querySelector('.panel-content') as HTMLElement;
  if (!content) return;
  clearEl(content);

  // Update tab active states
  const tabs = panel.querySelectorAll('.panel-tab');
  tabs.forEach(tab => {
    const tabId = (tab as HTMLElement).dataset.tab;
    tab.classList.toggle('active', tabId === state.panelTab);
  });

  // Global status banner for auto segmentation (visible on ALL tabs)
  if (state.mode === 'partial' && state.partial.target === 'auto') {
    if (state.subjectLoading) {
      const banner = el('div', { className: 'status-banner status-loading' }, ['正在识别主体...']);
      content.appendChild(banner);
    } else if (state.subjectError) {
      const banner = el('div', { className: 'status-banner status-error' });
      const msg = el('span', {}, [`识别失败: ${state.subjectError}`]);
      const retryBtn = el('button', { className: 'banner-btn' }, ['重试']);
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.sourceImage) {
          triggerSegmentation(state.sourceImage);
        }
      });
      banner.appendChild(msg);
      banner.appendChild(retryBtn);
      content.appendChild(banner);
    }
  }

  switch (state.panelTab) {
    case 'style':
      renderStyleTab(content);
      break;
    case 'adjust':
      renderAdjustTab(content);
      break;
  }
}

// ===== STYLE TAB =====
function renderStyleTab(container: HTMLElement): void {
  switch (state.mode) {
    case 'partial':
      renderPartialStyleTab(container);
      break;
    case 'full':
      renderFullStyleTab(container);
      break;
    case 'stamp':
      renderStampStyleTab(container);
      break;
  }
}

function renderPartialStyleTab(container: HTMLElement): void {
  container.appendChild(createChipGroup('区域', [
    { value: 'auto', label: '自动识别' },
    { value: 'brush', label: '画笔' },
  ], state.partial.target, (v) => {
    updateState({ subjectMask: null, subjectLoading: false, subjectError: null });
    if (v === 'brush') {
      updateState({ brushActive: true });
    }
    updatePartial({ target: v as PartialTarget });
  }));

  container.appendChild(createChipGroup('效果', [
    { value: 'ascii', label: '字符' },
    { value: 'symbols', label: '符号' },
  ], state.partial.effect, (v) => updatePartial({ effect: v as EffectType })));

  container.appendChild(createChipGroup('颜色', [
    { value: 'mono', label: '单色' },
    { value: 'multi', label: '色板' },
  ], state.partial.colorMode, (v) => updatePartial({ colorMode: v as ColorMode })));

  if (state.partial.colorMode === 'mono') {
    container.appendChild(createColorPicker('颜色', state.partial.monoColor, (v) => updatePartial({ monoColor: v })));
  }

  if (state.partial.colorMode === 'multi') {
    container.appendChild(createChipGroup('色板', [
      { value: 'dream', label: '千禧梦境' },
      { value: 'happy', label: '开心五彩' },
      { value: 'nature', label: '自然色系' },
      { value: 'neon', label: '亚比荧光' },
    ], state.partial.palette, (v) => updatePartial({ palette: v })));
  }

  if (state.partial.effect === 'ascii') {
    container.appendChild(createChipGroup('字符集', [
      { value: 'standard', label: '标准' },
      { value: 'shades', label: '阴影' },
      { value: 'dots', label: '圆点' },
      { value: 'steps', label: '阶梯' },
      { value: 'complex', label: '复杂' },
    ], state.partial.charset, (v) => updatePartial({ charset: v as CharsetName })));
  }

  if (state.partial.effect === 'symbols') {
    container.appendChild(createChipGroup('符号组', SYMBOL_SETS.map(s => ({
      value: s.id,
      label: s.name,
    })), state.partial.symbolSetId, (v) => updatePartial({ symbolSetId: v })));
  }

  container.appendChild(createToggle('反转', state.partial.invert, (v) => updatePartial({ invert: v })));
}

function renderFullStyleTab(container: HTMLElement): void {
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
}

function renderStampStyleTab(container: HTMLElement): void {
  // Library tabs
  container.appendChild(createChipGroup('分类', LIBRARY_GROUPS.map(g => ({
    value: g.name,
    label: g.name,
  })), state.stickerLibraryTab, (v) => updateState({ stickerLibraryTab: v })));

  // Sticker grid with sections
  const sections = getLibraryForGroup(state.stickerLibraryTab);
  for (const { section, items } of sections) {
    const sectionTitle = el('div', { className: 'control-label sticker-section-label' }, [section.title]);
    container.appendChild(sectionTitle);

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
}

function addStickerFromAsset(asset: StickerAsset): void {
  const canvasSize = getCanvasSize();
  const scale = getDefaultScale(asset, canvasSize.w, canvasSize.h);
  const unitSize = getEffectUnitSize(canvasSize.w, canvasSize.h);

  const sticker = {
    id: uid(),
    assetId: asset.id,
    x: 0.5,   // normalized to photo center
    y: 0.5,
    scale,
    rotation: 0,
    color: pickStickerColor(),
    mode: state.stickerMode,
    opacity: state.stampOpacity / 100,
    effectUnitSize: unitSize,
  };

  updateState({
    stickers: [...state.stickers, sticker],
    selectedStickerId: sticker.id,
  });
}

// ===== ADJUST TAB =====
function renderAdjustTab(container: HTMLElement): void {
  // Canvas ratio (shared)
  container.appendChild(createChipGroup('画布', [
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
  }

  switch (state.mode) {
    case 'partial':
      renderPartialAdjustTab(container);
      break;
    case 'full':
      renderFullAdjustTab(container);
      break;
    case 'stamp':
      renderStampAdjustTab(container);
      break;
  }
}

function renderPartialAdjustTab(container: HTMLElement): void {
  container.appendChild(createSlider('密度', 10, 80, state.partial.density, 1, (v) => {
    updateState({ subjectMask: null });
    updatePartial({ density: v });
  }));
  container.appendChild(createSlider('大小', 50, 200, state.partial.size, 5, (v) => updatePartial({ size: v })));
  container.appendChild(createSlider('辉光', 0, 40, state.partial.glow, 1, (v) => updatePartial({ glow: v })));

  if (state.partial.target === 'brush') {
    container.appendChild(createToggle('画笔', state.brushActive, (v) => updateState({ brushActive: v })));
    container.appendChild(createSlider('画笔大小', 10, 100, state.brushSize, 1, (v) => updateState({ brushSize: v })));
    container.appendChild(createButton('清除画笔', () => {
      updateState({ brushMask: null });
    }, 'btn-secondary'));
  }

  container.appendChild(createToggle('橡皮擦', state.eraserActive, (v) => updateState({ eraserActive: v })));
  container.appendChild(createSlider('橡皮擦大小', 10, 100, state.eraserSize, 1, (v) => updateState({ eraserSize: v })));
  container.appendChild(createButton('清除橡皮擦', () => {
    updateState({ eraserMask: null });
  }, 'btn-secondary'));
}

function renderFullAdjustTab(container: HTMLElement): void {
  container.appendChild(createSlider('密度', 10, 80, state.full.density, 1, (v) => updateFull({ density: v })));
  container.appendChild(createSlider('亮度', -100, 100, state.full.brightness, 1, (v) => updateFull({ brightness: v })));
  container.appendChild(createSlider('对比度', -100, 100, state.full.contrast, 1, (v) => updateFull({ contrast: v })));
  container.appendChild(createSlider('辉光', 0, 20, state.full.glow, 1, (v) => updateFull({ glow: v })));

  container.appendChild(createToggle('橡皮擦', state.eraserActive, (v) => updateState({ eraserActive: v })));
  container.appendChild(createSlider('橡皮擦大小', 10, 100, state.eraserSize, 1, (v) => updateState({ eraserSize: v })));
  container.appendChild(createButton('清除橡皮擦', () => {
    updateState({ eraserMask: null });
  }, 'btn-secondary'));
}

function renderStampAdjustTab(container: HTMLElement): void {
  // Subject avoidance
  container.appendChild(createToggle('主体避让', state.subjectAvoid, (v) => {
    if (v && !state.subjectMask && !state.subjectLoading && state.sourceImage) {
      // Trigger AI segmentation
      triggerSegmentation(state.sourceImage);
    }
    updateState({ subjectAvoid: v });
  }));

  if (state.subjectAvoid && state.subjectLoading) {
    const hint = el('div', { className: 'control-label' }, ['正在识别主体...']);
    hint.style.color = '#2B2BD4';
    container.appendChild(hint);
  }

  // Render mode
  container.appendChild(createChipGroup('效果', [
    { value: 'dots', label: 'Dots' },
    { value: 'ascii', label: 'ASCII' },
  ], state.stickerMode, (v) => {
    clearEffectCache();
    updateState({ stickerMode: v as StickerMode });
    // Update all existing stickers to new mode
    const stickers = state.stickers.map(s => ({ ...s, mode: v as StickerMode }));
    updateState({ stickers });
  }));

  // Palette
  container.appendChild(createChipGroup('色板', [
    { value: 'photo', label: '原图选色' },
    { value: 'dream', label: '千禧梦境' },
    { value: 'happy', label: '开心五彩' },
    { value: 'nature', label: '自然色系' },
    { value: 'neon', label: '亚比荧光' },
  ], state.stickerPalette, (v) => {
    clearEffectCache();
    updateState({ stickerPalette: v });
    // Recolor all stickers with new palette (pickStickerColor reads stickerPalette)
    const stickers = state.stickers.map(s => ({
      ...s,
      color: pickStickerColor(),
    }));
    updateState({ stickers });
  }));

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

  // Random
  container.appendChild(createButton('随机生成', () => {
    const canvasSize = getCanvasSize();
    const composition = generateRandomComposition(canvasSize.w, canvasSize.h);
    if (composition.length > 0) {
      updateState({
        stickers: composition,
        selectedStickerId: composition[composition.length - 1].id,
      });
    }
  }));

  // Delete / Clear
  container.appendChild(createButton('删除选中', () => {
    if (state.selectedStickerId) {
      updateState({
        stickers: state.stickers.filter(s => s.id !== state.selectedStickerId),
        selectedStickerId: null,
      });
    }
  }, 'btn-secondary'));

  container.appendChild(createButton('全部清除', () => {
    updateState({ stickers: [], selectedStickerId: null });
  }, 'btn-secondary'));
}
