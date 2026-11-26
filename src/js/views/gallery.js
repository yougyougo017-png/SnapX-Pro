import { icon } from '../icons.js';
import {
  escapeHtml,
  timeAgo,
  formatBytes,
  prettySource,
  debounce,
  toast,
  acceleratorLabel
} from '../ui.js';
import { state, captures } from '../state.js';
import { SMART_COLLECTIONS } from '../data.js';

function matchesCollection(item, collection) {
  if (collection === 'all') return true;
  if (collection === 'favorites') return Boolean(item.favorite);
  if (collection === 'design') return (item.tags || []).some((tag) => ['design', 'web', 'luxury', 'dashboard', 'ui'].includes(tag));
  if (collection === 'code') return (item.tags || []).some((tag) => ['code', 'typescript', 'javascript', 'ai'].includes(tag)) || item.source === 'code';
  if (collection === 'game') return item.source === 'game' || (item.tags || []).includes('game');
  if (collection === 'long') return item.height > 1500 || (item.tags || []).some((tag) => ['long capture', 'scrolling'].includes(tag));
  return true;
}

function collectionCounts(list) {
  return Object.fromEntries(SMART_COLLECTIONS.map((collection) => [collection.id, list.filter((item) => matchesCollection(item, collection.id)).length]));
}

function galleryCard(item) {
  return `
    <article class="gallery-card" data-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}">
      <div class="gallery-media">
        <img src="${escapeHtml(item.thumbnailUrl || item.url || item.src)}" alt="${escapeHtml(item.title)}" loading="lazy">
        <div class="gallery-media-top">
          <span class="badge ${item.demo ? 'blue' : 'accent'}">${item.demo ? 'Sample' : prettySource(item.source)}</span>
          ${item.kind === 'gif' ? `<span class="badge green">GIF</span>` : ''}
        </div>
        <div class="gallery-hover">
          <button class="icon-btn" data-card-action="preview" type="button" data-tip="Open">${icon('eye', 14)}</button>
          <button class="icon-btn" data-card-action="edit" type="button" data-tip="Edit">${icon('editor', 14)}</button>
          <button class="icon-btn" data-card-action="copy" type="button" data-tip="Copy">${icon('copy', 14)}</button>
          <button class="icon-btn" data-card-action="share" type="button" data-tip="Share">${icon('share', 14)}</button>
        </div>
        <span class="gallery-size">${item.width && item.height ? `${item.width} × ${item.height}` : item.kind === 'gif' ? 'GIF' : ''}</span>
      </div>
      <div class="gallery-info">
        <div class="gallery-title-row">
          <b title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</b>
          <button class="gallery-fav ${item.favorite ? 'on' : ''}" data-card-action="favorite" type="button" aria-label="Toggle favorite">${icon(item.favorite ? 'starFill' : 'star', 14)}</button>
        </div>
        <div class="gallery-meta">
          <span>${icon(item.demo ? 'sparkle' : 'clock', 10)} ${item.demo ? 'Curated sample' : timeAgo(item.createdAt)}</span>
          ${item.bytes ? `<span>${formatBytes(item.bytes)}</span>` : ''}
        </div>
        <div class="gallery-tags">
          ${(item.tags || []).slice(0, 3).map((tag) => `<span class="gallery-tag">${escapeHtml(tag)}</span>`).join('')}
          ${(item.tags || []).length > 3 ? `<span class="gallery-tag more">+${item.tags.length - 3}</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

function galleryRow(item) {
  return `
    <article class="gallery-row" data-id="${item.id}" tabindex="0" role="button">
      <div class="gallery-row-thumb">
        <img src="${escapeHtml(item.thumbnailUrl || item.url || item.src)}" alt="" loading="lazy">
        ${item.kind === 'gif' ? `<span class="badge green">GIF</span>` : ''}
      </div>
      <div class="gallery-row-main">
        <div class="gallery-row-title"><b>${escapeHtml(item.title)}</b>${item.demo ? `<span class="badge blue">Sample</span>` : ''}</div>
        <div class="gallery-row-tags">${(item.tags || []).slice(0, 4).map((tag) => `<span class="gallery-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>
      <div class="gallery-row-cell">${icon('layout', 12)} ${escapeHtml(prettySource(item.source))}</div>
      <div class="gallery-row-cell">${item.width && item.height ? `${item.width} × ${item.height}` : '—'}</div>
      <div class="gallery-row-cell">${item.bytes ? formatBytes(item.bytes) : '—'}</div>
      <div class="gallery-row-cell">${item.demo ? 'Sample' : timeAgo(item.createdAt)}</div>
      <div class="gallery-row-actions">
        <button class="icon-btn sm ${item.favorite ? 'active' : ''}" data-card-action="favorite" type="button" data-tip="Favorite">${icon(item.favorite ? 'starFill' : 'star', 13)}</button>
        <button class="icon-btn sm" data-card-action="edit" type="button" data-tip="Edit">${icon('editor', 13)}</button>
        <button class="icon-btn sm" data-card-action="share" type="button" data-tip="Share">${icon('share', 13)}</button>
      </div>
    </article>
  `;
}

export function renderGallery(ctx, root, params = {}) {
  const all = captures();
  const counts = collectionCounts(all);
  let collection = params.collection || 'all';
  let query = params.query || '';
  let sort = 'newest';
  let view = localStorage.getItem('snapx.galleryView') || 'grid';
  let favoritesOnly = false;

  const tags = [...new Set(all.flatMap((item) => item.tags || []))].slice(0, 14);
  const totalBytes = all.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);

  root.innerHTML = `
    <div class="page gallery-page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span>Library<span class="line"></span>${all.length} captures · ${formatBytes(totalBytes)}</div>
          <h1 class="page-title">Every pixel, <span class="grad">beautifully kept.</span></h1>
          <p class="page-sub">Search, tag and revisit everything you capture. Samples are marked so you always know what came from you.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-action="import" type="button">${icon('imagePlus', 14)} Import image</button>
          <button class="btn btn-primary" data-mode="region" type="button">${icon('camera', 15)} New capture</button>
        </div>
      </div>

      <section class="gallery-toolbar card">
        <div class="gallery-search search-input">
          ${icon('search', 15)}
          <input type="search" placeholder="Search titles, tags, sources…" value="${escapeHtml(query)}" data-gallery-search aria-label="Search captures">
          <kbd>${acceleratorLabel('CommandOrControl+K')}</kbd>
        </div>
        <div class="gallery-toolbar-divider"></div>
        <div class="chip-row gallery-collections">
          ${SMART_COLLECTIONS.map((entry) => `<button class="chip ${entry.id === collection ? 'active' : ''}" data-collection="${entry.id}" type="button">${entry.label}<span class="chip-count">${counts[entry.id]}</span></button>`).join('')}
        </div>
        <div class="gallery-toolbar-right">
          <button class="icon-btn ${favoritesOnly ? 'active' : ''}" data-favorites-toggle type="button" data-tip="Favorites only">${icon('star', 15)}</button>
          <select class="select select-compact" data-gallery-sort aria-label="Sort captures">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="largest">Largest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <div class="segmented view-toggle" data-view-toggle>
            <button type="button" data-view="grid" class="${view === 'grid' ? 'active' : ''}" aria-label="Grid view">${icon('grid', 13)}</button>
            <button type="button" data-view="list" class="${view === 'list' ? 'active' : ''}" aria-label="List view">${icon('list', 13)}</button>
          </div>
        </div>
      </section>

      <div class="gallery-tag-bar">
        <span class="gallery-tag-label">${icon('tag', 12)} Popular tags</span>
        ${tags.map((tag) => `<button class="tag-filter" data-tag-filter="${escapeHtml(tag)}" type="button">#${escapeHtml(tag)}</button>`).join('')}
      </div>

      <div class="gallery-results-head">
        <span data-gallery-count>${all.length} captures</span>
        <span class="gallery-sort-note">${icon('shieldCheck', 11)} Stored locally on this device</span>
      </div>
      <div class="gallery-grid" data-gallery-grid></div>
      <div class="gallery-empty" data-gallery-empty hidden>
        <div class="empty-orb">${icon('gallery', 30)}</div>
        <h3>No captures match that search</h3>
        <p>Try a different keyword, or clear your filters to see everything again.</p>
        <button class="btn btn-secondary" data-clear-filters type="button">${icon('rotate', 14)} Clear filters</button>
      </div>
      <button class="gallery-drop-card" data-action="import-drop" type="button">
        <span class="gallery-drop-icon">${icon('imagePlus', 20)}</span>
        <span><b>Drop images anywhere</b><small>Add them to your library or open straight in the editor</small></span>
        ${icon('arrowRight', 14)}
      </button>
    </div>
  `;

  const grid = root.querySelector('[data-gallery-grid]');
  const empty = root.querySelector('[data-gallery-empty]');
  const countEl = root.querySelector('[data-gallery-count]');

  const getFiltered = () => {
    let list = all.filter((item) => matchesCollection(item, collection));
    if (favoritesOnly) list = list.filter((item) => item.favorite);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((item) => [item.title, item.source, ...(item.tags || [])].join(' ').toLowerCase().includes(q));
    }
    const sorters = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      largest: (a, b) => (b.bytes || 0) - (a.bytes || 0),
      name: (a, b) => String(a.title).localeCompare(String(b.title))
    };
    return list.sort(sorters[sort] || sorters.newest);
  };

  const paint = () => {
    const list = getFiltered();
    grid.className = `gallery-grid ${view === 'list' ? 'list-view' : ''}`;
    grid.innerHTML = list.map(view === 'list' ? galleryRow : galleryCard).join('');
    empty.hidden = list.length > 0;
    countEl.textContent = `${list.length} capture${list.length === 1 ? '' : 's'}`;
    grid.querySelectorAll('[data-id]').forEach((card) => {
      card.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-card-action]');
        const item = all.find((entry) => entry.id === card.dataset.id);
        if (!item) return;
        if (actionButton) {
          event.stopPropagation();
          handleCardAction(ctx, item, actionButton.dataset.cardAction, () => paint());
          return;
        }
        ctx.openPreview(item, { list });
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const item = all.find((entry) => entry.id === card.dataset.id);
          if (item) ctx.openPreview(item, { list });
        }
      });
    });
    if (params.highlight) {
      requestAnimationFrame(() => {
        const target = grid.querySelector(`[data-id="${CSS.escape(params.highlight)}"]`);
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target?.classList.add('highlight');
      });
    }
  };

  const searchInput = root.querySelector('[data-gallery-search]');
  searchInput.addEventListener('input', debounce(() => {
    query = searchInput.value.trim();
    paint();
  }, 120));

  root.querySelectorAll('[data-collection]').forEach((button) => {
    button.addEventListener('click', () => {
      collection = button.dataset.collection;
      root.querySelectorAll('[data-collection]').forEach((entry) => entry.classList.toggle('active', entry === button));
      paint();
    });
  });

  root.querySelector('[data-favorites-toggle]')?.addEventListener('click', (event) => {
    favoritesOnly = !favoritesOnly;
    event.currentTarget.classList.toggle('active', favoritesOnly);
    paint();
  });

  root.querySelector('[data-gallery-sort]')?.addEventListener('change', (event) => {
    sort = event.target.value;
    paint();
  });

  root.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      view = button.dataset.view;
      localStorage.setItem('snapx.galleryView', view);
      root.querySelectorAll('[data-view]').forEach((entry) => entry.classList.toggle('active', entry === button));
      paint();
    });
  });

  root.querySelectorAll('[data-tag-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      query = `#${button.dataset.tagFilter}`.replace('#', '');
      searchInput.value = query;
      collection = 'all';
      root.querySelectorAll('[data-collection]').forEach((entry) => entry.classList.toggle('active', entry.dataset.collection === 'all'));
      paint();
    });
  });

  root.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    query = '';
    collection = 'all';
    favoritesOnly = false;
    searchInput.value = '';
    root.querySelectorAll('[data-collection]').forEach((entry) => entry.classList.toggle('active', entry.dataset.collection === 'all'));
    root.querySelector('[data-favorites-toggle]')?.classList.remove('active');
    paint();
  });

  root.querySelector('[data-action="import"]')?.addEventListener('click', () => ctx.importImage('gallery'));
  root.querySelector('[data-action="import-drop"]')?.addEventListener('click', () => ctx.importImage('gallery'));
  root.querySelector('[data-mode="region"]')?.addEventListener('click', () => ctx.runCaptureMode('region'));

  paint();
}

function handleCardAction(ctx, item, action, repaint) {
  if (action === 'favorite') {
    toggleFavorite(ctx, item, repaint);
    return;
  }
  if (action === 'edit') {
    ctx.openEditor(item);
    return;
  }
  if (action === 'copy') {
    ctx.copyCapture(item);
    return;
  }
  if (action === 'share') {
    ctx.openShare(item);
    return;
  }
  ctx.openPreview(item);
}

async function toggleFavorite(ctx, item, repaint) {
  item.favorite = !item.favorite;
  repaint?.();
  if (item.demo) {
    toast(item.favorite ? 'Added to favorites' : 'Removed from favorites', { type: 'success' });
    return;
  }
  try {
    await window.snapx.gallery.update(item.id, { favorite: item.favorite });
    await ctx.refreshGallery({ silent: true });
    toast(item.favorite ? 'Added to favorites' : 'Removed from favorites', { type: 'success' });
  } catch (error) {
    item.favorite = !item.favorite;
    repaint?.();
    toast(error.message || 'Could not update favorite', { type: 'error' });
  }
}
