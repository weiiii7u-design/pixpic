// === Trace — Main Entry Point (v2) ===

import './style.css';
import { state, subscribe } from './state';
import { createWelcomeScreen } from './ui/welcome';
import { createNavbar } from './ui/navbar';
import { createModeNav, renderModeLinks } from './ui/modeNav';
import { createPanel, renderPanelContent } from './ui/panel';
import { initCompositor, startRenderLoop, exportCanvas } from './render/compositor';
import { initStickers } from './core/stickers';
import { el } from './ui/dom';

const app = document.getElementById('app')!;

let editorMounted = false;
let modeNavEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;

function mountApp(): void {
  app.innerHTML = '';

  if (state.screen === 'welcome') {
    app.appendChild(createWelcomeScreen());
    editorMounted = false;
  } else if (state.screen === 'editor') {
    mountEditor();
  }
}

function mountEditor(): void {
  if (editorMounted) {
    // Just update dynamic parts
    if (modeNavEl) renderModeLinks(modeNavEl);
    if (panelEl) renderPanelContent(panelEl);
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

  // Mode nav
  modeNavEl = createModeNav();
  editorWrapper.appendChild(modeNavEl);

  // Panel
  panelEl = createPanel();
  editorWrapper.appendChild(panelEl);

  app.appendChild(editorWrapper);

  // Init compositor
  initCompositor(canvasEl);
  startRenderLoop();
  renderPanelContent(panelEl);

  editorMounted = true;
}

// Subscribe to state changes
subscribe(() => {
  if (!editorMounted && state.screen === 'editor') {
    mountApp();
  } else if (state.screen === 'welcome') {
    mountApp();
  } else {
    // Update existing editor
    if (modeNavEl) renderModeLinks(modeNavEl);
    if (panelEl) renderPanelContent(panelEl);
  }
});

// Initialize
async function init(): Promise<void> {
  // Don't block app startup on sticker loading
  initStickers().catch(err => console.warn('[Trace] Sticker init error:', err));
  mountApp();
}

init();
