import { icon } from './icons.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function timeAgo(input) {
  const date = input instanceof Date ? input : new Date(input);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function debounce(fn, wait = 160) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function svgIcon(name, size = 20, className = '') {
  return icon(name, size, className);
}

export function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    if (el.dataset.iconHydrated === 'true') return;
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.iconSize) || 20, el.dataset.iconClass || '');
    el.dataset.iconHydrated = 'true';
  });
}

export function isMac() {
  return window.snapx?.platform === 'darwin' || navigator.platform.toLowerCase().includes('mac');
}

export function acceleratorLabel(accelerator = '') {
  if (!accelerator) return '';
  return accelerator
    .replace(/CommandOrControl|CmdOrCtrl/gi, isMac() ? '⌘' : 'Ctrl')
    .replace(/Command|Cmd/gi, '⌘')
    .replace(/Control|Ctrl/gi, isMac() ? '⌃' : 'Ctrl')
    .replace(/Shift/gi, isMac() ? '⇧' : 'Shift')
    .replace(/Alt|Option/gi, isMac() ? '⌥' : 'Alt')
    .replace(/\+/g, isMac() ? ' ' : ' + ');
}

export function toast(message, options = {}) {
  const root = $('#toastRoot');
  if (!root) return;
  const type = options.type || 'default';
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  const iconName = type === 'success' ? 'circleCheck' : type === 'error' ? 'alert' : type === 'info' ? 'info' : 'sparkle';
  item.innerHTML = `
    <span class="toast-icon">${icon(iconName, 16)}</span>
    <div class="toast-copy"><b>${escapeHtml(message)}</b>${options.detail ? `<span>${escapeHtml(options.detail)}</span>` : ''}</div>
    ${options.action ? `<button class="toast-action" type="button">${escapeHtml(options.action)}</button>` : ''}
    <button class="toast-close" type="button" aria-label="Dismiss">${icon('x', 12)}</button>
  `;
  root.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    item.classList.remove('show');
    setTimeout(() => item.remove(), 260);
  };
  item.querySelector('.toast-close').addEventListener('click', close);
  if (options.action) {
    item.querySelector('.toast-action').addEventListener('click', () => {
      close();
      options.onAction?.();
    });
  }
  setTimeout(close, options.duration ?? 3800);
  return close;
}

let activeModal = null;

export function openModal({ title, subtitle = '', content = '', size = 'md', className = '', headerExtra = '', footer = '', onClose = null, dismissible = true }) {
  closeModal({ silent: true });
  const root = $('#modalRoot');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <section class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-glow"></div>
      <header class="modal-head">
        <div class="modal-heading">
          <div class="modal-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="modal-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${headerExtra}
        ${dismissible ? `<button class="icon-btn modal-close" type="button" aria-label="Close">${icon('x', 15)}</button>` : ''}
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </section>
  `;
  root.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('show'));
  const modal = backdrop.querySelector('.modal');
  const close = () => {
    if (!activeModal) return;
    const closing = activeModal;
    activeModal = null;
    backdrop.classList.remove('show');
    setTimeout(() => {
      backdrop.remove();
      if (closing.onClose) closing.onClose();
    }, 220);
  };
  const entry = { backdrop, modal, close, onClose };
  activeModal = entry;
  if (dismissible) {
    backdrop.querySelector('.modal-close')?.addEventListener('click', close);
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) close();
    });
  }
  modal.addEventListener('pointerdown', (event) => event.stopPropagation());
  setTimeout(() => {
    const focusable = modal.querySelector('input, textarea, select, button:not(.modal-close)');
    focusable?.focus({ preventScroll: true });
  }, 80);
  return entry;
}

export function closeModal(options = {}) {
  if (!activeModal) return;
  const current = activeModal;
  activeModal = null;
  current.backdrop.classList.remove('show');
  setTimeout(() => {
    current.backdrop.remove();
    if (!options.silent && current.onClose) current.onClose();
  }, 220);
}

export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      subtitle: message,
      size: 'sm',
      content: '',
      footer: `
        <button class="btn btn-secondary" data-confirm="cancel" type="button">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="ok" type="button">${escapeHtml(confirmLabel)}</button>
      `,
      onClose: () => resolve(false)
    });
    let answered = false;
    const finish = (value) => {
      if (answered) return;
      answered = true;
      modal.close();
      resolve(value);
    };
    modal.modal.querySelector('[data-confirm="cancel"]').addEventListener('click', () => finish(false));
    modal.modal.querySelector('[data-confirm="ok"]').addEventListener('click', () => finish(true));
  });
}

export async function copyText(text, successMessage = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(String(text ?? ''));
    toast(successMessage, { type: 'success' });
    return true;
  } catch {
    try {
      await window.snapx?.clipboard.text(String(text ?? ''));
      toast(successMessage, { type: 'success' });
      return true;
    } catch {
      toast('Could not copy to clipboard', { type: 'error' });
      return false;
    }
  }
}

export function downloadDataUrl(dataUrl, filename = 'snapx-capture.png') {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^snapx:/i.test(src) || /^https?:/i.test(src)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = src;
  });
}

export async function urlToDataUrl(url) {
  if (!url) throw new Error('No image source');
  if (String(url).startsWith('data:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not read image');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

export async function imageToPngDataUrl(src, maxWidth = 0) {
  const image = await loadImage(src);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  if (maxWidth && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

export function captureKeyCombo(event) {
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const key = event.key;
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null;
  let normalized = key;
  if (key === ' ') normalized = 'Space';
  else if (key === 'ArrowUp') normalized = 'Up';
  else if (key === 'ArrowDown') normalized = 'Down';
  else if (key === 'ArrowLeft') normalized = 'Left';
  else if (key === 'ArrowRight') normalized = 'Right';
  else if (key === 'Escape') normalized = 'Esc';
  else if (key.length === 1) normalized = key.toUpperCase();
  parts.push(normalized);
  return parts.join('+');
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function prettySource(source) {
  const labels = {
    region: 'Rectangle',
    lasso: 'Freeform',
    window: 'Window',
    display: 'Display',
    full: 'Display',
    multi: 'All displays',
    scrolling: 'Scrolling',
    scroll: 'Scrolling',
    video: 'Video',
    gif: 'GIF',
    browser: 'Browser',
    game: 'Game capture',
    demo: 'Sample',
    import: 'Imported'
  };
  return labels[source] || 'Capture';
}

export function colorFromString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 70% 62%)`;
}

export function setBusy(element, busy, label = 'Working…') {
  if (!element) return;
  if (busy) {
    element.dataset.original = element.innerHTML;
    element.disabled = true;
    element.innerHTML = `<span class="spinner"></span>${escapeHtml(label)}`;
  } else {
    element.disabled = false;
    if (element.dataset.original) element.innerHTML = element.dataset.original;
    delete element.dataset.original;
  }
}

export function getInitials(name) {
  return String(name || 'SnapX')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'SX';
}

export function samplePaletteFromImage(image, count = 6) {
  const canvas = document.createElement('canvas');
  const size = 90;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }
  const colors = Array.from(buckets.values())
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.n),
      g: Math.round(bucket.g / bucket.n),
      b: Math.round(bucket.b / bucket.n),
      n: bucket.n
    }))
    .sort((a, b) => b.n - a.n);
  const selected = [];
  for (const color of colors) {
    if (selected.every((entry) => Math.hypot(entry.r - color.r, entry.g - color.g, entry.b - color.b) > 54)) {
      selected.push(color);
    }
    if (selected.length >= count) break;
  }
  const total = selected.reduce((sum, color) => sum + color.n, 0) || 1;
  return selected.map((color) => ({
    hex: `#${[color.r, color.g, color.b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`,
    share: Math.round((color.n / total) * 100),
    name: 'Sampled'
  }));
}
