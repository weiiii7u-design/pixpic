// === Trace — UI Controls (Custom touch-drag sliders for mobile) ===

import { el } from './dom';

/** Global flag: when true, panel should NOT re-render (slider is being dragged) */
export let sliderDragging = false;

export function createSlider(
  label: string,
  min: number,
  max: number,
  value: number,
  step: number,
  onChange: (v: number) => void
): HTMLElement {
  const wrapper = el('div', { className: 'control-slider' });

  const header = el('div', { className: 'control-header' });
  const labelEl = el('span', { className: 'control-label' }, [label]);
  const valueEl = el('span', { className: 'control-value' }, [formatValue(value, step)]);
  header.appendChild(labelEl);
  header.appendChild(valueEl);

  // Custom drag slider
  const track = el('div', { className: 'slider-track' });
  const fill = el('div', { className: 'slider-fill' });
  const thumb = el('div', { className: 'slider-thumb' });
  track.appendChild(fill);
  track.appendChild(thumb);

  // Set initial position
  const ratio = (value - min) / (max - min);
  fill.style.width = `${ratio * 100}%`;
  thumb.style.left = `${ratio * 100}%`;

  // Drag logic
  let isDragging = false;

  function updateFromX(clientX: number): void {
    const rect = track.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));

    // Snap to step
    let val = min + pct * (max - min);
    val = Math.round(val / step) * step;
    val = Math.max(min, Math.min(max, val));

    const newRatio = (val - min) / (max - min);
    fill.style.width = `${newRatio * 100}%`;
    thumb.style.left = `${newRatio * 100}%`;
    valueEl.textContent = formatValue(val, step);
    onChange(val);
  }

  // Pointer events (works for both touch and mouse)
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isDragging = true;
    sliderDragging = true;
    track.setPointerCapture(e.pointerId);
    updateFromX(e.clientX);
    thumb.classList.add('active');
  });

  track.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    updateFromX(e.clientX);
  });

  track.addEventListener('pointerup', (e) => {
    isDragging = false;
    sliderDragging = false;
    track.releasePointerCapture(e.pointerId);
    thumb.classList.remove('active');
  });

  track.addEventListener('pointercancel', (e) => {
    isDragging = false;
    sliderDragging = false;
    track.releasePointerCapture(e.pointerId);
    thumb.classList.remove('active');
  });

  wrapper.appendChild(header);
  wrapper.appendChild(track);
  return wrapper;
}

function formatValue(v: number, step: number): string {
  if (step >= 1) return String(Math.round(v));
  return v.toFixed(1);
}

export function createToggle(
  label: string,
  value: boolean,
  onChange: (v: boolean) => void
): HTMLElement {
  const wrapper = el('div', { className: 'control-toggle' });
  const labelEl = el('span', { className: 'control-label' }, [label]);

  const toggle = el('button', { className: `toggle-btn ${value ? 'active' : ''}` });
  const knob = el('span', { className: 'toggle-knob' });
  toggle.appendChild(knob);

  toggle.addEventListener('click', () => {
    const newVal = !toggle.classList.contains('active');
    toggle.classList.toggle('active', newVal);
    onChange(newVal);
  });

  wrapper.appendChild(labelEl);
  wrapper.appendChild(toggle);
  return wrapper;
}

export function createButton(
  label: string,
  onClick: () => void,
  className?: string
): HTMLElement {
  const btn = el('button', { className: `btn ${className || ''}` }, [label]);
  btn.addEventListener('click', onClick);
  return btn;
}

export function createSelect(
  label: string,
  options: { value: string; label: string }[],
  currentValue: string,
  onChange: (v: string) => void
): HTMLElement {
  const wrapper = el('div', { className: 'control-select' });
  const labelEl = el('span', { className: 'control-label' }, [label]);

  const select = el('select', { className: 'select-input' });
  for (const opt of options) {
    const option = el('option', { value: opt.value }, [opt.label]);
    if (opt.value === currentValue) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    onChange(select.value);
  });

  wrapper.appendChild(labelEl);
  wrapper.appendChild(select);
  return wrapper;
}

export function createColorPicker(
  label: string,
  value: string,
  onChange: (v: string) => void
): HTMLElement {
  const wrapper = el('div', { className: 'control-color' });
  const labelEl = el('span', { className: 'control-label' }, [label]);

  const input = el('input', { type: 'color', value, className: 'color-input' });
  input.addEventListener('input', () => {
    onChange(input.value);
  });

  wrapper.appendChild(labelEl);
  wrapper.appendChild(input);
  return wrapper;
}

export function createChipGroup(
  label: string,
  options: { value: string; label: string }[],
  currentValue: string,
  onChange: (v: string) => void
): HTMLElement {
  const wrapper = el('div', { className: 'control-chips' });
  if (label) {
    const labelEl = el('div', { className: 'control-label' }, [label]);
    wrapper.appendChild(labelEl);
  }

  const chipRow = el('div', { className: 'chip-row' });
  for (const opt of options) {
    const chip = el('button', {
      className: `chip ${opt.value === currentValue ? 'active' : ''}`,
      'data-value': opt.value,
    }, [opt.label]);

    chip.addEventListener('click', () => {
      chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      onChange(opt.value);
    });
    chipRow.appendChild(chip);
  }

  wrapper.appendChild(chipRow);
  return wrapper;
}
