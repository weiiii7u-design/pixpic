// === PixPic — Top Navigation Bar (Apple Photos Editor Style) ===

import { el } from './dom';
import { updateState } from '../state';

export function createNavbar(onExport: () => void): HTMLElement {
  const nav = el('nav', { className: 'navbar' });

  // Left: Cancel + Undo/Redo
  const left = el('div', { className: 'navbar-left' });

  const cancelBtn = el('button', { className: 'nav-cancel-btn' }, ['Cancel']);
  cancelBtn.addEventListener('click', () => {
    updateState({ screen: 'welcome' });
  });
  left.appendChild(cancelBtn);

  nav.appendChild(left);

  // Right: Done button (golden pill)
  const right = el('div', { className: 'navbar-right' });

  const doneBtn = el('button', { className: 'nav-done-btn' }, ['Done']);
  doneBtn.addEventListener('click', onExport);
  right.appendChild(doneBtn);

  nav.appendChild(right);

  return nav;
}
