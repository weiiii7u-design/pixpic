// === Trace — Top Navigation Bar ===

import { el } from './dom';
import { updateState } from '../state';

const LOGO_FLOWER = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 8c-3 0-6 4-6 10 0-6-4-10-8-8s-4 8 0 12c-5-2-9 0-9 5s4 8 9 7c-4 3-4 8 1 10s8-2 10-6c1 4 4 8 8 6s5-6 3-10c4 2 9 0 9-5s-4-8-9-7c4-4 4-8-1-10s-6 0-8 5c0-6-3-10-6-10z" stroke="#2B2BD4" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#2B2BD4"/>
</svg>`;

export function createNavbar(onExport: () => void): HTMLElement {
  const nav = el('nav', { className: 'navbar' });

  const left = el('div', { className: 'navbar-left' });
  const logoFlower = el('span', { className: 'navbar-flower' });
  logoFlower.innerHTML = LOGO_FLOWER;
  const logoText = el('span', { className: 'navbar-logo' }, ['trace']);
  left.appendChild(logoFlower);
  left.appendChild(logoText);

  const right = el('div', { className: 'navbar-right' });

  const swapBtn = el('button', { className: 'nav-btn', title: '换图' }, ['🔄']);
  swapBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        updateState({
          sourceImage: img,
          imageFileName: file.name,
          subjectMask: null,
          subjectLoading: false,
          brushMask: null,
          eraserMask: null,
          stickers: [],
          canvasRatio: 'original',
          photoX: 0.5,
          photoY: 0.5,
          photoScale: 1,
        });
      };
      img.src = url;
    });
    fileInput.click();
  });

  const saveBtn = el('button', { className: 'nav-btn save-btn' }, ['保存']);
  saveBtn.addEventListener('click', onExport);

  right.appendChild(swapBtn);
  right.appendChild(saveBtn);

  nav.appendChild(left);
  nav.appendChild(right);

  return nav;
}
