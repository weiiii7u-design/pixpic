// === Trace — Main Entry Point (v4: Layer Architecture) ===

import './style.css';
import { state, subscribe } from './state';
import { createWelcomeScreen } from './ui/welcome';
import { createNavbar } from './ui/navbar';
import { createPanel, renderPanelContent } from './ui/panel';
import { initCompositor, startRenderLoop, exportCanvas } from './render/compositor';
import { initStickers } from './core/stickers';
import { el } from './ui/dom';

const app = document.getElementById('app')!;

let editorMounted = false;
let panelWrapperEl: HTMLElement | null = null;

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
}

// Subscribe to state changes
subscribe(() => {
  if (!editorMounted && state.screen === 'editor') {
    mountApp();
  } else if (state.screen === 'welcome') {
    mountApp();
  } else {
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
