import {
  $,
  $$,
  escapeHtml,
  openModal,
  closeModal,
  confirmDialog,
  toast,
  formatBytes,
  prettySource,
  urlToDataUrl,
  copyText,
  setBusy,
  acceleratorLabel,
  uid
} from './ui.js';
import { state, captureTitleFromSource } from './state.js';
import { icon } from './icons.js';

let busy = false;

function countdownMarkup(seconds) {
  return `
    <div class="countdown-wrap">
      <div class="countdown-ring">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="track"/><circle cx="60" cy="60" r="52" class="progress"/></svg>
        <b data-countdown>${seconds}</b>
      </div>
      <p>Get everything ready. SnapX will capture in <b>${seconds}s</b>.</p>
      <button class="btn btn-ghost btn-sm" data-cancel-countdown type="button">Cancel</button>
    </div>
  `;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureScreenPermission(ctx) {
  const permission = await window.snapx?.app.screenPermission().catch(() => 'granted');
  state.screenPermission = permission || 'granted';
  if (permission === 'denied' || permission === 'restricted') {
    ctx.showPermissionBanner?.();
    toast('Screen Recording permission is required', { type: 'error', action: 'Open settings', onAction: () => ctx.openScreenPermission?.() });
    return false;
  }
  return true;
}

export async function pickWindowSource(ctx, { types = ['window'], title = 'Choose a window', subtitle = 'Pick the window you want to capture. SnapX hides itself first for a clean shot.' } = {}) {
  let sources = [];
  try {
    sources = await window.snapx.capture.sources(types);
  } catch (error) {
    toast(error.message || 'Could not list windows', { type: 'error' });
    return null;
  }
  if (!sources.length) {
    toast('No capturable windows were found', { type: 'info', detail: 'Open the window you want to capture and try again.' });
    return null;
  }
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      subtitle,
      size: 'lg',
      className: 'source-modal',
      content: `
        <div class="source-search"><span>${icon('search', 14)}</span><input type="text" placeholder="Filter windows…" data-source-search></div>
        <div class="source-grid" data-source-grid>
          ${sources.map((source) => `
            <button class="source-card" type="button" data-source-id="${escapeHtml(source.id)}" data-source-name="${escapeHtml(source.name)}">
              <span class="source-thumb">
                ${source.thumbnail ? `<img src="${escapeHtml(source.thumbnail)}" alt="">` : `<span class="source-empty">${icon('window', 22)}</span>`}
                <span class="source-hover">${icon('camera', 15)} Capture</span>
              </span>
              <span class="source-meta">
                ${source.appIcon ? `<img class="source-app-icon" src="${escapeHtml(source.appIcon)}" alt="">` : `<span class="source-app-icon fallback">${icon('window', 11)}</span>`}
                <b title="${escapeHtml(source.name)}">${escapeHtml(source.name || 'Untitled window')}</b>
              </span>
            </button>
          `).join('')}
        </div>
      `,
      onClose: () => resolve(null)
    });
    const grid = modal.modal.querySelector('[data-source-grid]');
    const search = modal.modal.querySelector('[data-source-search]');
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      $$('.source-card', grid).forEach((card) => {
        card.hidden = query && !card.dataset.sourceName.toLowerCase().includes(query);
      });
    });
    grid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-source-id]');
      if (!card) return;
      const source = sources.find((entry) => entry.id === card.dataset.sourceId);
      modal.close();
      resolve(source || null);
    });
  });
}

export async function captureWindow(ctx) {
  if (!(await ensureScreenPermission(ctx))) return;
  const source = await pickWindowSource(ctx, { types: ['window'] });
  if (!source) return;
  await captureSourceFlow(ctx, source, 'window');
}

export async function captureSourceFlow(ctx, source, sourceType = 'window') {
  ctx.setBusy?.(true);
  try {
    await wait(80);
    const shot = await window.snapx.capture.source(source.id, { hideApp: true });
    await handleShot(ctx, shot, { source: sourceType, title: source.name || captureTitleFromSource(sourceType) });
  } catch (error) {
    toast(error.message || 'Window capture failed', { type: 'error' });
  } finally {
    ctx.setBusy?.(false);
  }
}

export async function captureRegion(ctx, mode = 'rect') {
  if (!(await ensureScreenPermission(ctx))) return;
  ctx.setBusy?.(true);
  try {
    const shot = await window.snapx.capture.region(mode);
    if (!shot) return;
    await handleShot(ctx, shot, { source: mode === 'lasso' ? 'lasso' : 'region' });
  } catch (error) {
    toast(error.message || 'Region capture failed', { type: 'error', detail: 'Check screen recording permission and try again.' });
  } finally {
    ctx.setBusy?.(false);
  }
}

export async function captureDisplay(ctx, displayId = null) {
  if (!(await ensureScreenPermission(ctx))) return;
  ctx.setBusy?.(true);
  try {
    const id = displayId ?? state.settings?.capture?.displayId;
    const shot = await window.snapx.capture.full(id || undefined);
    await handleShot(ctx, shot, { source: 'display' });
  } catch (error) {
    toast(error.message || 'Display capture failed', { type: 'error' });
  } finally {
    ctx.setBusy?.(false);
  }
}

export async function captureAllDisplays(ctx) {
  if (!(await ensureScreenPermission(ctx))) return;
  ctx.setBusy?.(true);
  try {
    const shots = await window.snapx.capture.all();
    if (!shots?.length) return;
    const saved = [];
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      if (state.settings?.behavior?.autoSave !== false) {
        const item = await saveShot(shot, { source: 'multi', title: `Display ${index + 1}`, tags: ['multi-monitor'] });
        if (item) saved.push(item);
      }
    }
    if (state.settings?.capture?.copyAfterCapture && shots[0]) {
      await window.snapx.clipboard.image(shots[0].dataUrl).catch(() => {});
    }
    await ctx.refreshGallery?.();
    showMultiResult(ctx, shots, saved);
    if (shots.length === 1) await handleShot(ctx, shots[0], { source: 'display', alreadySaved: saved[0] || null });
  } catch (error) {
    toast(error.message || 'Could not capture displays', { type: 'error' });
  } finally {
    ctx.setBusy?.(false);
  }
}

function showMultiResult(ctx, shots, saved) {
  if (shots.length < 2) return;
  const modal = openModal({
    title: `${shots.length} displays captured`,
    subtitle: 'Every monitor was captured at full resolution and saved to your library.',
    size: 'md',
    content: `
      <div class="multi-result-grid">
        ${shots.map((shot, index) => `
          <button class="multi-result-card" type="button" data-index="${index}">
            <img src="${shot.dataUrl}" alt="Display ${index + 1}">
            <span><b>Display ${index + 1}</b><small>${shot.width} × ${shot.height}</small></span>
          </button>
        `).join('')}
      </div>
      <div class="notice notice-green">${icon('cloudCheck', 15)} Saved locally${saved.length ? ` · ${saved.length} items` : ''}</div>
    `,
    footer: `<button class="btn btn-secondary" data-close-multi type="button">Done</button><button class="btn btn-primary" data-open-multi-editor type="button">${icon('editor', 14)} Open first in editor</button>`
  });
  modal.modal.querySelector('[data-close-multi]').addEventListener('click', () => modal.close());
  modal.modal.querySelector('[data-open-multi-editor]').addEventListener('click', () => {
    modal.close();
    ctx.openEditor({ ...shots[0], title: 'Display capture', source: 'multi' });
  });
  modal.modal.querySelectorAll('[data-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const shot = shots[Number(button.dataset.index)];
      modal.close();
      ctx.openEditor({ ...shot, title: `Display ${Number(button.dataset.index) + 1}`, source: 'multi' });
    });
  });
}

export async function captureScrolling(ctx) {
  if (!(await ensureScreenPermission(ctx))) return;
  const source = await pickWindowSource(ctx, {
    title: 'Scrolling capture',
    subtitle: 'Choose the window with the long page. SnapX will capture it as a scrolling screenshot and tag it for you.'
  });
  if (!source) return;
  ctx.setBusy?.(true);
  try {
    const shot = await window.snapx.capture.source(source.id, { hideApp: true });
    await handleShot(ctx, shot, {
      source: 'scrolling',
      title: source.name || 'Scrolling capture',
      tags: ['scrolling', 'long capture'],
      note: 'Scrolling capture is in beta. SnapX saved the visible frame of this window.'
    });
  } catch (error) {
    toast(error.message || 'Scrolling capture failed', { type: 'error' });
  } finally {
    ctx.setBusy?.(false);
  }
}

export async function captureDelayed(ctx, seconds = 3, mode = 'region') {
  if (!(await ensureScreenPermission(ctx))) return;
  const modal = openModal({
    title: 'Delayed capture',
    subtitle: `SnapX will capture ${mode === 'full' ? 'your display' : 'a region'} in ${seconds} seconds.`,
    size: 'sm',
    className: 'countdown-modal',
    content: countdownMarkup(seconds),
    dismissible: true
  });
  let remaining = seconds;
  let cancelled = false;
  const number = modal.modal.querySelector('[data-countdown]');
  const ring = modal.modal.querySelector('.countdown-ring .progress');
  const circumference = 2 * Math.PI * 52;
  ring.style.strokeDasharray = String(circumference);
  ring.style.strokeDashoffset = '0';
  modal.modal.querySelector('[data-cancel-countdown]').addEventListener('click', () => {
    cancelled = true;
    modal.close();
  });
  const tick = setInterval(() => {
    if (cancelled) {
      clearInterval(tick);
      return;
    }
    remaining -= 1;
    if (number) number.textContent = String(Math.max(0, remaining));
    if (ring) ring.style.strokeDashoffset = String(circumference * (1 - remaining / seconds));
    if (remaining <= 0) {
      clearInterval(tick);
      modal.close();
      setTimeout(() => {
        if (mode === 'full') captureDisplay(ctx);
        else captureRegion(ctx, 'rect');
      }, 280);
    }
  }, 1000);
}

export async function handleShot(ctx, shot, meta = {}) {
  if (!shot?.dataUrl) return null;
  const source = meta.source || 'display';
  const title = meta.title || captureTitleFromSource(source);
  const tags = meta.tags || [];
  let item = meta.alreadySaved || null;
  if (!item && state.settings?.behavior?.autoSave !== false) {
    item = await saveShot(shot, { source, title, tags });
    if (item) await ctx.refreshGallery?.();
  }
  if (state.settings?.capture?.copyAfterCapture !== false) {
    await window.snapx.clipboard.image(shot.dataUrl).catch(() => {});
  }
  showCaptureResult(ctx, shot, { ...meta, item, title, source, tags });
  return item;
}

export async function saveShot(shot, meta = {}) {
  try {
    const item = await window.snapx.gallery.add({
      dataUrl: shot.dataUrl,
      title: meta.title || captureTitleFromSource(meta.source),
      width: shot.width,
      height: shot.height,
      source: meta.source || 'display',
      tags: meta.tags || [],
      favorite: Boolean(meta.favorite)
    });
    toast('Capture saved to library', { type: 'success', detail: meta.title || '' });
    ctxAddActivity(`Captured ${meta.title || 'a screenshot'}`);
    return item;
  } catch (error) {
    toast(error.message || 'Could not save capture', { type: 'error' });
    return null;
  }
}

function ctxAddActivity(label) {
  state.activity.unshift({ id: uid('activity'), label, at: new Date().toISOString() });
  state.activity = state.activity.slice(0, 30);
}

export function showCaptureResult(ctx, shot, meta = {}) {
  const title = meta.title || captureTitleFromSource(meta.source);
  const item = meta.item;
  const modal = openModal({
    title: 'Capture ready',
    subtitle: `${shot.width || 0} × ${shot.height || 0} · ${prettySource(meta.source)}${item ? ' · saved to library' : ''}`,
    size: 'lg',
    className: 'result-modal',
    content: `
      <div class="result-preview">
        <img src="${shot.dataUrl}" alt="${escapeHtml(title)}">
        <span class="result-badge">${icon('camera', 11)} ${escapeHtml(prettySource(meta.source))}</span>
        <span class="result-check">${icon('check', 12)} Captured</span>
      </div>
      ${meta.note ? `<div class="notice notice-warm">${icon('info', 15)} ${escapeHtml(meta.note)}</div>` : ''}
      <div class="result-meta">
        <div><span>Dimensions</span><b>${shot.width || 0} × ${shot.height || 0}</b></div>
        <div><span>Estimated size</span><b>${formatBytes(Math.round((shot.dataUrl.length * 3) / 4))}</b></div>
        <div><span>Source</span><b>${escapeHtml(prettySource(meta.source))}</b></div>
        <div><span>Saved to</span><b>${item ? 'Local library' : 'Unsaved'}</b></div>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost" data-result-discard type="button">${icon('trash', 14)} Discard</button>
      <span class="modal-foot-spacer"></span>
      <button class="btn btn-secondary" data-result-copy type="button">${icon('copy', 14)} Copy</button>
      <button class="btn btn-secondary" data-result-share type="button">${icon('share', 14)} Share</button>
      <button class="btn btn-primary" data-result-editor type="button">${icon('editor', 14)} Open editor</button>
    `,
    onClose: () => {
      if (['dashboard', 'gallery', 'capture'].includes(state.currentPage)) ctx.rerenderCurrent?.();
    }
  });

  modal.modal.querySelector('[data-result-copy]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Copying…');
    try {
      await window.snapx.clipboard.image(shot.dataUrl);
      toast('Image copied to clipboard', { type: 'success' });
    } catch {
      toast('Could not copy image', { type: 'error' });
    } finally {
      setBusy(button, false);
    }
  });
  modal.modal.querySelector('[data-result-share]').addEventListener('click', () => {
    modal.close();
    ctx.openShare({ ...shot, title, source: meta.source, savedItem: item });
  });
  modal.modal.querySelector('[data-result-editor]').addEventListener('click', () => {
    modal.close();
    ctx.openEditor({ ...shot, title, source: meta.source, dataUrl: shot.dataUrl, savedItem: item });
  });
  modal.modal.querySelector('[data-result-discard]').addEventListener('click', async () => {
    if (item) {
      const yes = await confirmDialog({ title: 'Discard this capture?', message: 'The saved copy will be removed from your local library.', confirmLabel: 'Discard', danger: true });
      if (!yes) return;
      await window.snapx.gallery.remove(item.id).catch(() => {});
      await ctx.refreshGallery?.();
    }
    modal.close();
    toast('Capture discarded');
  });
  if (state.settings?.capture?.openEditor) {
    setTimeout(() => {
      modal.close();
      ctx.openEditor({ ...shot, title, source: meta.source, dataUrl: shot.dataUrl, savedItem: item });
    }, 650);
  }
}

export async function importImage(ctx, mode = 'editor') {
  try {
    const result = await window.snapx.dialog.openImage();
    if (!result) return;
    const payload = { dataUrl: result.dataUrl, title: result.name?.replace(/\.[^.]+$/, '') || 'Imported image', source: 'import', width: 0, height: 0 };
    if (mode === 'editor') {
      ctx.openEditor(payload);
    } else {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = result.dataUrl;
      });
      payload.width = image.naturalWidth;
      payload.height = image.naturalHeight;
      await handleShot(ctx, payload, { source: 'import', title: payload.title, tags: ['imported'] });
    }
  } catch (error) {
    toast(error.message || 'Could not open image', { type: 'error' });
  }
}

export async function copyCaptureImage(capture) {
  try {
    const dataUrl = capture.dataUrl || await urlToDataUrl(capture.url || capture.src);
    await window.snapx.clipboard.image(dataUrl);
    toast('Image copied to clipboard', { type: 'success' });
    return true;
  } catch (error) {
    toast(error.message || 'Could not copy image', { type: 'error' });
    return false;
  }
}

export async function openCaptureFile(ctx, capture) {
  try {
    const target = capture.path || capture.url;
    if (!target) return;
    if (capture.savedItem || capture.fileName) await window.snapx.gallery.reveal(capture.id);
    else if (/^snapx:/i.test(target)) toast('This is a built-in sample capture', { type: 'info' });
    else await window.snapx.app.openPath(target);
  } catch {
    toast('Could not open the file', { type: 'error' });
  }
}
