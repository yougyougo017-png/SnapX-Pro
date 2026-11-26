import {
  openModal,
  toast,
  escapeHtml,
  timeAgo,
  formatBytes,
  prettySource,
  confirmDialog,
  urlToDataUrl,
  setBusy,
  copyText
} from './ui.js';
import { icon } from './icons.js';
import { state, captures, displaySize } from './state.js';

function itemSource(capture) {
  return capture.dataUrl || capture.url || capture.src;
}

async function getItemDataUrl(capture) {
  if (capture.dataUrl) return capture.dataUrl;
  return urlToDataUrl(capture.url || capture.src);
}

export function openPreview(ctx, capture, options = {}) {
  if (!capture) return;
  const list = options.list || captures();
  const index = list.findIndex((item) => item.id === capture.id);
  const modal = openModal({
    title: capture.title || 'Capture',
    subtitle: `${displaySize(capture)}${capture.bytes ? ` · ${formatBytes(capture.bytes)}` : ''} · ${timeAgo(capture.createdAt)}`,
    size: 'xl',
    className: 'preview-modal',
    headerExtra: `
      <div class="preview-nav">
        ${index > 0 ? `<button class="icon-btn" data-preview-prev type="button" data-tip="Previous">${icon('chevronLeft', 15)}</button>` : ''}
        ${index >= 0 && index < list.length - 1 ? `<button class="icon-btn" data-preview-next type="button" data-tip="Next">${icon('chevronRight', 15)}</button>` : ''}
      </div>
    `,
    content: `
      <div class="preview-layout">
        <div class="preview-canvas">
          <div class="preview-image-wrap">
            <img src="${escapeHtml(itemSource(capture))}" alt="${escapeHtml(capture.title || 'Capture')}">
            ${capture.demo ? `<span class="preview-demo-badge">${icon('sparkle', 11)} Sample capture</span>` : ''}
          </div>
          <div class="preview-strip">
            <button class="preview-strip-btn ${capture.favorite ? 'active' : ''}" data-preview-favorite type="button">${icon(capture.favorite ? 'starFill' : 'star', 14)} <span>${capture.favorite ? 'Favorited' : 'Favorite'}</span></button>
            <button class="preview-strip-btn" data-preview-copy type="button">${icon('copy', 14)} Copy</button>
            <button class="preview-strip-btn" data-preview-edit type="button">${icon('editor', 14)} Edit</button>
            <button class="preview-strip-btn" data-preview-share type="button">${icon('share', 14)} Share</button>
            <span class="preview-strip-spacer"></span>
            ${capture.demo ? '' : `<button class="preview-strip-btn" data-preview-reveal type="button">${icon('folderOpen', 14)} Reveal</button>`}
            ${capture.demo ? '' : `<button class="preview-strip-btn danger" data-preview-delete type="button">${icon('trash', 14)} Delete</button>`}
          </div>
        </div>
        <aside class="preview-side">
          <div class="preview-side-section">
            <span class="preview-side-label">Details</span>
            <div class="preview-details">
              <div><span>Dimensions</span><b>${displaySize(capture)}</b></div>
              <div><span>Source</span><b>${escapeHtml(prettySource(capture.source))}</b></div>
              <div><span>Captured</span><b>${timeAgo(capture.createdAt)}</b></div>
              <div><span>Size</span><b>${capture.bytes ? formatBytes(capture.bytes) : '—'}</b></div>
            </div>
          </div>
          <div class="preview-side-section">
            <span class="preview-side-label">Tags</span>
            <div class="preview-tags" data-preview-tags>
              ${(capture.tags || []).map((tag) => `<span class="preview-tag">${escapeHtml(tag)}<button type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="Remove tag">${icon('x', 9)}</button></span>`).join('')}
              ${(capture.tags || []).length ? '' : '<span class="preview-tag-empty">No tags yet</span>'}
            </div>
            <form class="preview-tag-form" data-tag-form>
              <input class="input" name="tag" placeholder="Add a tag…" maxlength="24" autocomplete="off">
              <button class="btn btn-sm btn-secondary" type="submit">Add</button>
            </form>
          </div>
          ${capture.aiSummary ? `
            <div class="preview-side-section preview-ai">
              <span class="preview-side-label">${icon('sparkle', 11)} AI note</span>
              <p>${escapeHtml(capture.aiSummary)}</p>
            </div>
          ` : ''}
          <div class="preview-side-section">
            <span class="preview-side-label">Actions</span>
            <div class="preview-action-list">
              <button class="preview-action" data-preview-export type="button">${icon('download', 14)} Export file <span>${icon('chevronRight', 11)}</span></button>
              <button class="preview-action" data-preview-link type="button">${icon('link', 14)} Copy image link <span>${icon('chevronRight', 11)}</span></button>
              <button class="preview-action" data-preview-ai type="button">${icon('ai', 14)} Analyze with AI <span>${icon('chevronRight', 11)}</span></button>
            </div>
          </div>
        </aside>
      </div>
    `,
    onClose: () => ctx.onPreviewClosed?.(capture)
  });

  const favoriteButton = modal.modal.querySelector('[data-preview-favorite]');
  favoriteButton?.addEventListener('click', async () => {
    const next = !capture.favorite;
    capture.favorite = next;
    favoriteButton.classList.toggle('active', next);
    favoriteButton.innerHTML = `${icon(next ? 'starFill' : 'star', 14)} <span>${next ? 'Favorited' : 'Favorite'}</span>`;
    if (!capture.demo && window.snapx) {
      try {
        await window.snapx.gallery.update(capture.id, { favorite: next });
        await ctx.refreshGallery({ silent: true });
      } catch (error) {
        toast(error.message || 'Could not update favorite', { type: 'error' });
      }
    }
    toast(next ? 'Added to favorites' : 'Removed from favorites', { type: 'success' });
  });

  modal.modal.querySelector('[data-preview-copy]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Copying…');
    try {
      await window.snapx.clipboard.image(await getItemDataUrl(capture));
      toast('Image copied to clipboard', { type: 'success' });
    } catch (error) {
      toast(error.message || 'Could not copy image', { type: 'error' });
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-preview-edit]')?.addEventListener('click', () => {
    modal.close();
    ctx.openEditor(capture);
  });
  modal.modal.querySelector('[data-preview-share]')?.addEventListener('click', () => {
    modal.close();
    ctx.openShare(capture);
  });
  modal.modal.querySelector('[data-preview-ai]')?.addEventListener('click', () => {
    modal.close();
    state.aiCapture = capture.id;
    ctx.navigate('ai', { captureId: capture.id });
  });
  modal.modal.querySelector('[data-preview-export]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Exporting…');
    try {
      if (capture.demo) {
        const dataUrl = await getItemDataUrl(capture);
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = `${capture.title || 'snapx-sample'}.png`;
        anchor.click();
        toast('Sample exported', { type: 'success' });
      } else {
        const filePath = await window.snapx.gallery.export(capture.id);
        if (filePath) toast('Capture exported', { type: 'success', detail: filePath });
      }
    } catch (error) {
      toast(error.message || 'Could not export capture', { type: 'error' });
    } finally {
      setBusy(button, false);
    }
  });
  modal.modal.querySelector('[data-preview-link]')?.addEventListener('click', async () => {
    await copyText(capture.url || capture.src || 'Local SnapX capture', 'Image path copied');
  });
  modal.modal.querySelector('[data-preview-reveal]')?.addEventListener('click', async () => {
    await window.snapx.gallery.reveal(capture.id).catch(() => {});
  });
  modal.modal.querySelector('[data-preview-delete]')?.addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Delete this capture?', message: 'This removes the image and its thumbnail from your local library. It cannot be undone.', confirmLabel: 'Delete capture', danger: true });
    if (!yes) return;
    try {
      await window.snapx.gallery.remove(capture.id);
      await ctx.refreshGallery({ silent: true });
      modal.close();
      toast('Capture deleted');
      ctx.rerenderCurrent?.();
    } catch (error) {
      toast(error.message || 'Could not delete capture', { type: 'error' });
    }
  });

  modal.modal.querySelector('[data-preview-prev]')?.addEventListener('click', () => {
    modal.close();
    if (list[index - 1]) openPreview(ctx, list[index - 1], { list });
  });
  modal.modal.querySelector('[data-preview-next]')?.addEventListener('click', () => {
    modal.close();
    if (list[index + 1]) openPreview(ctx, list[index + 1], { list });
  });

  const tagsEl = modal.modal.querySelector('[data-preview-tags]');
  const saveTags = async () => {
    if (capture.demo) return;
    try {
      await window.snapx.gallery.update(capture.id, { tags: capture.tags });
      await ctx.refreshGallery({ silent: true });
    } catch (error) {
      toast(error.message || 'Could not update tags', { type: 'error' });
    }
  };
  const renderTags = () => {
    tagsEl.innerHTML = (capture.tags || []).map((tag) => `<span class="preview-tag">${escapeHtml(tag)}<button type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="Remove tag">${icon('x', 9)}</button></span>`).join('')
      + ((capture.tags || []).length ? '' : '<span class="preview-tag-empty">No tags yet</span>');
    tagsEl.querySelectorAll('[data-remove-tag]').forEach((button) => {
      button.addEventListener('click', async () => {
        capture.tags = (capture.tags || []).filter((tag) => tag !== button.dataset.removeTag);
        renderTags();
        await saveTags();
      });
    });
  };
  renderTags();
  modal.modal.querySelector('[data-tag-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    const tag = input.value.trim().toLowerCase();
    if (!tag) return;
    if ((capture.tags || []).includes(tag)) {
      toast('That tag already exists', { type: 'info' });
      return;
    }
    capture.tags = [...(capture.tags || []), tag].slice(0, 12);
    input.value = '';
    renderTags();
    await saveTags();
  });
  return modal;
}
