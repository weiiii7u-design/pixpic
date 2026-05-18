// === Trace — Welcome Screen ===

import { el } from './dom';
import { updateState } from '../state';

const FLOWER_SVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 8c-3 0-6 4-6 10 0-6-4-10-8-8s-4 8 0 12c-5-2-9 0-9 5s4 8 9 7c-4 3-4 8 1 10s8-2 10-6c1 4 4 8 8 6s5-6 3-10c4 2 9 0 9-5s-4-8-9-7c4-4 4-8-1-10s-6 0-8 5c0-6-3-10-6-10z" stroke="#2B2BD4" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="3" fill="#2B2BD4"/>
</svg>`;

export function createWelcomeScreen(): HTMLElement {
  const screen = el('div', { className: 'welcome-screen' });

  const content = el('div', { className: 'welcome-content' });

  const logo = el('div', { className: 'welcome-logo' });
  logo.innerHTML = FLOWER_SVG;
  content.appendChild(logo);

  const title = el('h1', { className: 'welcome-title' }, ['trace']);
  content.appendChild(title);

  const tagline = el('p', { className: 'welcome-tagline' }, ['在每张照片上留下你的痕迹']);

  content.appendChild(tagline);

  const poem = el('p', { className: 'welcome-poem' }, [
    '嘿，\n\n每张照片都藏着\n一个等待被讲述的故事。\n\ntrace 帮你在照片上\n留下属于你的痕迹 —\n一个符号，一行文字，一片光。\n\n因为你的照片\n值得不只是一个滤镜。'
  ]);
  content.appendChild(poem);

  const uploadBtn = el('button', { className: 'welcome-upload-btn' }, ['选一张照片']);
  const fileInput = el('input', { type: 'file', accept: 'image/*', className: 'hidden-input' });

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = (fileInput as HTMLInputElement).files?.[0];
    if (!file) return;
    loadImage(file);
  });

  content.appendChild(uploadBtn);
  content.appendChild(fileInput);

  // Drag and drop
  screen.addEventListener('dragover', (e) => {
    e.preventDefault();
    screen.classList.add('dragover');
  });
  screen.addEventListener('dragleave', () => {
    screen.classList.remove('dragover');
  });
  screen.addEventListener('drop', (e) => {
    e.preventDefault();
    screen.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  });

  const hint = el('p', { className: 'welcome-hint' }, ['或拖入一张图片']);
  content.appendChild(hint);

  screen.appendChild(content);
  return screen;
}

function loadImage(file: File): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    updateState({
      sourceImage: img,
      imageFileName: file.name,
      screen: 'editor',
      // Reset masks
      subjectMask: null,
      subjectLoading: false,
      brushMask: null,
      eraserMask: null,
      stickers: [],
      // Reset canvas
      canvasRatio: 'original',
      photoX: 0.5,
      photoY: 0.5,
      photoScale: 1,
    });
  };
  img.src = url;
}
