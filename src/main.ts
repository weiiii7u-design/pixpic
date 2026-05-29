// === PixPic — Main Entry Point (v4: Layer Architecture) ===

import './style.css';
import { state, subscribe, updateState, updatePartial } from './state';
import { createWelcomeScreen } from './ui/welcome';
import { createNavbar } from './ui/navbar';
import { createPanel, renderPanelContent } from './ui/panel';
import { initCompositor, startRenderLoop, stopRenderLoop, exportCanvas } from './render/compositor';
import { initStickers } from './core/stickers';
import { sliderDragging } from './ui/controls';
import { el } from './ui/dom';

// Expose state API for automation (Puppeteer)
(window as any).__pixpic = { state, updateState, updatePartial, subscribe };

const app = document.getElementById('app')!;

let editorMounted = false;
let panelWrapperEl: HTMLElement | null = null;

function mountApp(): void {
  app.innerHTML = '';

  if (state.screen === 'welcome') {
    stopRenderLoop();
    app.appendChild(createWelcomeScreen());
    editorMounted = false;
  } else if (state.screen === 'editor') {
    mountEditor();
  }
}

function mountEditor(): void {
  if (editorMounted) {
    // Just update dynamic parts
    if (panelWrapperEl) renderPanelContent(panelWrapperEl);
    return;
  }

  app.innerHTML = '';

  const editorWrapper = el('div', { className: 'editor' });

  // Navbar
  const navbar = createNavbar(exportCanvas);
  editorWrapper.appendChild(navbar);

  // Canvas area
  const canvasContainer = el('div', { className: 'canvas-container' });
  const canvasEl = el('canvas', { className: 'main-canvas' }) as unknown as HTMLCanvasElement;
  canvasContainer.appendChild(canvasEl);
  editorWrapper.appendChild(canvasContainer);

  // Panel wrapper (contains popup panel + toolbar)
  panelWrapperEl = createPanel();
  editorWrapper.appendChild(panelWrapperEl);

  app.appendChild(editorWrapper);

  // Init compositor
  initCompositor(canvasEl);
  startRenderLoop();
  renderPanelContent(panelWrapperEl);

  editorMounted = true;

  // Show onboarding tip for first-time users
  showOnboardingTip(editorWrapper);
}

function showOnboardingTip(container: HTMLElement): void {
  if (localStorage.getItem('pixpic-onboarded')) return;

  const tip = el('div', { className: 'onboarding-tip' });
  tip.innerHTML = `
    <div class="onboarding-steps">
      <span class="onboarding-step">1. 点击下方 <b>Adjust</b> 开始编辑</span>
      <span class="onboarding-step">2. 选择<b>点样</b>风格 或 输入<b>自定义文字</b></span>
      <span class="onboarding-step">3. 点击右上角<b>导出</b>保存图片</span>
    </div>
    <button class="onboarding-dismiss">知道了</button>
  `;

  tip.querySelector('.onboarding-dismiss')!.addEventListener('click', () => {
    tip.remove();
    localStorage.setItem('pixpic-onboarded', '1');
  });

  // Auto dismiss after 6 seconds
  setTimeout(() => {
    if (tip.parentElement) {
      tip.style.opacity = '0';
      setTimeout(() => tip.remove(), 300);
    }
  }, 6000);

  container.appendChild(tip);
  localStorage.setItem('pixpic-onboarded', '1');
}

// Subscribe to state changes
subscribe(() => {
  if (!editorMounted && state.screen === 'editor') {
    mountApp();
  } else if (state.screen === 'welcome') {
    mountApp();
  } else {
    // Skip panel rebuild while slider is being dragged (prevents DOM destruction mid-drag)
    if (sliderDragging) return;
    // Update existing editor
    if (panelWrapperEl) renderPanelContent(panelWrapperEl);
  }
});

// Initialize
async function init(): Promise<void> {
  // Don't block app startup on sticker loading
  initStickers().catch(err => console.warn('[Trace] Sticker init error:', err));
  mountApp();
}

init();
