// === Trace — Mode Navigation (v3: partial · full · stamp) ===

import { el } from './dom';
import { state, updateState } from '../state';
import type { AppMode } from '../types';

const MODES: { id: AppMode; label: string }[] = [
  { id: 'partial', label: '局部' },
  { id: 'full', label: '全图' },
  { id: 'stamp', label: '贴纸' },
];

export function createModeNav(): HTMLElement {
  const nav = el('div', { className: 'mode-nav' });
  renderModeLinks(nav);
  return nav;
}

export function renderModeLinks(nav: HTMLElement): void {
  nav.innerHTML = '';
  for (let i = 0; i < MODES.length; i++) {
    const mode = MODES[i];
    if (i > 0) {
      const dot = el('span', { className: 'mode-dot' }, [' · ']);
      nav.appendChild(dot);
    }
    const link = el('button', {
      className: `mode-link ${state.mode === mode.id ? 'active' : ''}`,
      'data-mode': mode.id,
    }, [mode.label]);

    link.addEventListener('click', () => {
      updateState({ mode: mode.id, panelTab: 'style' });
    });

    nav.appendChild(link);
  }
}
