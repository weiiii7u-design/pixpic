// === Trace — UI Controls (Sliders, Toggles, Buttons) ===

import { el } from './dom';

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

  const input = el('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    value: String(value),
    step: String(step),
    className: 'slider',
  });

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valueEl.textContent = formatValue(v, step);
    onChange(v);
  });

  wrapper.appendChild(header);
  wrapper.appendChild(input);
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
  const labelEl = el('div', { className: 'control-label' }, [label]);
  wrapper.appendChild(labelEl);

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
