// === PixPic — Welcome Screen (Apple HIG + Remix Icon) ===

import { el } from './dom';
import { updateState } from '../state';

const BASE = import.meta.env.BASE_URL;

const SHOWCASE_IMAGES = [
  `${BASE}showcase/demo1.png`,
  `${BASE}showcase/demo2.png`,
  `${BASE}showcase/demo3.png`,
  `${BASE}showcase/demo4.png`,
  `${BASE}showcase/demo5.png`,
];

export function createWelcomeScreen(): HTMLElement {
  const screen = el('div', { className: 'welcome-screen' });

  // Header (Navigation Bar style)
  const header = el('div', { className: 'welcome-header' });
  const logo = el('span', { className: 'welcome-logo' }, ['pixpic']);
  const infoBtn = el('button', { className: 'welcome-info-btn' });
  const infoIcon = el('i', { className: 'ri-information-line' });
  infoBtn.appendChild(infoIcon);
  header.appendChild(logo);
  header.appendChild(infoBtn);
  screen.appendChild(header);

  // Horizontal auto-scrolling showcase (infinite loop)
  const showcase = el('div', { className: 'welcome-showcase' });
  const track = el('div', { className: 'showcase-track' });
  // Double the images for seamless loop
  const allImages = [...SHOWCASE_IMAGES, ...SHOWCASE_IMAGES];
  for (const src of allImages) {
    const card = el('div', { className: 'showcase-card' });
    card.style.backgroundImage = `url(${src})`;
    track.appendChild(card);
  }
  showcase.appendChild(track);
  screen.appendChild(showcase);

  // Upload button
  const uploadBtn = el('button', { className: 'welcome-upload-btn' });
  const uploadIcon = el('i', { className: 'ri-upload-2-line' });
  const uploadText = el('span', {}, ['上传图片']);
  uploadBtn.appendChild(uploadIcon);
  uploadBtn.appendChild(uploadText);

  const fileInput = el('input', { type: 'file', accept: 'image/*', className: 'hidden-input' }) as HTMLInputElement;

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    loadImage(file);
  });

  screen.appendChild(uploadBtn);
  screen.appendChild(fileInput);

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

  return screen;
}

function loadImage(file: File): void {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url); // Release memory
    updateState({
      sourceImage: img,
      imageFileName: file.name,
      screen: 'editor',
      activeTool: 'adjust',
      effectMode: 'partial',
      subjectMask: null,
      subjectLoading: false,
      eraserMask: null,
      stickers: [],
      canvasRatio: 'original',
      photoX: 0.5,
      photoY: 0.5,
      photoScale: 1,
    });
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('无法加载此图片');
  };
  img.src = url;
}
