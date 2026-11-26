import { icon } from './icons.js';
import {
  $,
  $$,
  hydrateIcons,
  toast,
  escapeHtml,
  openModal,
  acceleratorLabel,
  formatBytes,
  timeAgo,
  prettySource,
  readFileAsDataUrl,
  clamp
} from './ui.js';
import {
  state,
  normalizeSettings,
  applySettingsTheme,
  captures
} from './state.js';
import { NAV_ITEMS, DEMO_CAPTURES } from './data.js';
import { THEMES } from './themes.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCapture } from './views/capture.js';
import { renderGallery } from './views/gallery.js';
import { renderStudio } from './views/studio.js';
import { renderThemes } from './views/themes.js';
import { renderSettings } from './views/settings.js';
import { renderEditor } from './views/editor.js';
import {
  captureRegion,
  captureWindow,
  captureDisplay,
  captureAllDisplays,
  captureScrolling,
  captureDelayed,
  importImage,
  copyCaptureImage
} from './capture.js';
import { openPreview } from './preview.js';
import { openShare } from './share.js';
import { openRecorder } from './recorder.js';

const ROUTES = {
  dashboard: renderDashboard,
  capture: renderCapture,
  gallery: renderGallery,
  editor: renderEditor,
  ai: renderStudio,
  themes: renderThemes,
  settings: renderSettings
};

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  capture: 'Capture Studio',
  gallery: 'Library',
  editor: 'Editor',
  ai: 'AI Studio',
  themes: 'Themes',
  settings: 'Settings'
};

let currentCleanup = null;
let shellBound = false;

const ctx = {
  state,
  navigate,
  rerenderCurrent: () => navigate(state.currentPage, state.currentParams, { replace: true }),
  openEditor,
  openPreview: (capture, options) => openPreview(ctx, capture, options),
  openShare: (capture) => openShare(ctx, capture),
  openRecorder: (mode) => openRecorder(ctx, mode),
  copyCapture: (capture) => copyCaptureImage(capture),
  importImage: (mode) => importImage(ctx, mode),
  runCaptureMode,
  refreshGallery,
  refreshSettings,
  saveSettings,
  openCommandPalette,
  openQuickCapture,
  openDelayDialog,
  setBusy: setBusyOverlay,
  showPermissionBanner,
  openScreenPermission,
  onCleanup: (fn) => {
    currentCleanup = fn;
  },
  get root() {
    return $('#viewRoot');
  }
};

async function boot() {
  hydrateIcons();
  const platform = window.snapx?.platform || (navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'win32');
  document.documentElement.dataset.platform = platform;
  document.body.dataset.platform = platform;
  if (platform === 'darwin') {
    document.body.classList.add('platform-mac');
    const traffic = $('#macTraffic');
    if (traffic) traffic.style.display = 'flex';
    const controls = $('#winControls');
    if (controls) controls.style.display = 'none';
  }

  $('#viewRoot').innerHTML = `
    <div class="boot-splash">
      <div class="boot-logo"><img src="assets/app-icon.png" alt="SnapX Pro"><span class="boot-glow"></span></div>
      <div class="boot-copy">
        <b>SnapX <span>PRO</span></b>
        <span>Warming up the capture engine…</span>
      </div>
      <div class="boot-bar"><i></i></div>
      <div class="boot-foot">${icon('lock', 10)} Local-first · no account required</div>
    </div>
  `;

  bindShellOnce();
  await loadCoreState();
  applySettingsTheme();
  state.samples = state.settings?.samplesHidden ? [] : DEMO_CAPTURES.map((item) => ({ ...item }));
  renderNav();
  updateLibraryShell();
  updateToolbarState();
  updateUserShell();
  await checkScreenPermission();
  const initialPage = location.hash.startsWith('#/') ? location.hash.slice(2).split('?')[0] : 'dashboard';
  await navigate(ROUTES[initialPage] ? initialPage : 'dashboard', {}, { replace: true });
  bindMainEvents();
  hydrateIcons();
}

async function loadCoreState() {
  try {
    const [info, rawSettings, galleryList, galleryStats] = await Promise.all([
      window.snapx?.app.info().catch(() => null),
      window.snapx?.settings.get().catch(() => null),
      window.snapx?.gallery.list().catch(() => []),
      window.snapx?.gallery.stats().catch(() => ({ count: 0, bytes: 0, path: '' }))
    ]);
    state.info = info || {
      version: '1.0.0',
      platform: window.snapx?.platform || 'win32',
      arch: 'x64',
      isPackaged: false,
      paths: {}
    };
    state.settings = normalizeSettings(rawSettings || {});
    state.gallery = Array.isArray(galleryList) ? galleryList : [];
    state.stats = galleryStats || { count: 0, bytes: 0, path: '' };
    state.toolbarVisible = Boolean(state.settings.floatingToolbar);
  } catch (error) {
    state.settings = normalizeSettings({});
    state.info = { version: '1.0.0', platform: 'win32', arch: 'x64', paths: {} };
    toast('Some workspace data could not be loaded', { type: 'error' });
  }
}

async function checkScreenPermission() {
  try {
    const permission = await window.snapx?.app.screenPermission();
    state.screenPermission = permission || 'granted';
    if (permission && permission !== 'granted' && permission !== 'not-determined') {
      showPermissionBanner(ctx);
    }
  } catch {
    state.screenPermission = 'granted';
  }
}

function bindShellOnce() {
  if (shellBound) return;
  shellBound = true;

  $$('[data-window]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.window;
      if (action === 'minimize') window.snapx?.window.minimize();
      else if (action === 'maximize') window.snapx?.window.maximize();
      else if (action === 'close') window.snapx?.window.close();
    });
  });

  $('#newCaptureBtn')?.addEventListener('click', () => openQuickCapture());
  $('#titlebarSearch')?.addEventListener('click', () => openCommandPalette());
  $('#titlebar')?.addEventListener('dblclick', (event) => {
    if (event.target.closest('button, input, .titlebar-search')) return;
    window.snapx?.window.maximize();
  });

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.nav);
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toolbar') toggleToolbar();
    else if (action === 'notifications') openActivityPanel();
    else if (action === 'open-import') importImage(ctx, 'editor');
  });

  const permissionBanner = $('#permissionBanner');
  permissionBanner?.querySelector('[data-permission-action="open"]')?.addEventListener('click', () => openScreenPermission());
  permissionBanner?.querySelector('[data-permission-action="dismiss"]')?.addEventListener('click', () => {
    permissionBanner.hidden = true;
  });

  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommandPalette();
    }
    if (event.key === 'Escape') {
      closeActivityPanel();
      closePalette();
    }
  });

  window.snapx?.window.onMaximized?.((maximized) => {
    const button = $('.window-btn[data-window="maximize"]');
    if (button) button.innerHTML = icon(maximized ? 'restore' : 'maximize', 13);
  });

  window.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    $('#dropOverlay')?.classList.add('show');
  });
  window.addEventListener('dragleave', (event) => {
    if (event.relatedTarget === null) $('#dropOverlay')?.classList.remove('show');
  });
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    $('#dropOverlay')?.classList.remove('show');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('That file is not an image', { type: 'error' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
      });
      const shot = { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
      const title = file.name.replace(/\.[^.]+$/, '') || 'Dropped image';
      if (state.currentPage === 'editor') {
        ctx.openEditor({ ...shot, title, source: 'import' });
      } else {
        const { handleShot } = await import('./capture.js');
        await handleShot(ctx, shot, { source: 'import', title, tags: ['imported'] });
      }
    } catch {
      toast('Could not read that image', { type: 'error' });
    }
  });
}

async function bindMainEvents() {
  window.snapx?.events.onShortcutCapture?.((mode) => {
    if (mode === 'region') runCaptureMode('region');
    else if (mode === 'full') runCaptureMode('full');
    else if (mode === 'window') runCaptureMode('window');
  });
  window.snapx?.events.onToolbarAction?.((action) => {
    if (['region', 'full', 'window', 'record', 'gif'].includes(action)) {
      if (action === 'record') runCaptureMode('video');
      else if (action === 'gif') runCaptureMode('gif');
      else runCaptureMode(action);
    }
  });
  window.snapx?.events.onNavigate?.((page) => {
    if (ROUTES[page]) navigate(page);
  });
  window.snapx?.events.onSettingsChanged?.((raw) => {
    state.settings = normalizeSettings(raw || {});
    state.samples = state.settings.samplesHidden ? [] : DEMO_CAPTURES.map((item) => ({ ...item }));
    applySettingsTheme();
    state.toolbarVisible = Boolean(state.settings.floatingToolbar);
    updateToolbarState();
    updateLibraryShell();
    updateSyncShell();
  });
}

async function navigate(page, params = {}, options = {}) {
  const renderer = ROUTES[page] || renderDashboard;
  if (currentCleanup) {
    try { currentCleanup(); } catch { /* ignore */ }
    currentCleanup = null;
  }
  closePalette();
  closeActivityPanel();
  state.currentPage = page;
  state.currentParams = params;
  const root = $('#viewRoot');
  root.classList.toggle('route-editor', page === 'editor');
  root.scrollTop = 0;
  $('#breadcrumbCurrent').textContent = PAGE_LABELS[page] || 'Dashboard';
  $$('.nav-item[data-page]').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  if (!options.replace) {
    try { history.replaceState(null, '', `#/${page}`); } catch { /* ignore */ }
  }
  try {
    await renderer(ctx, root, params);
  } catch (error) {
    console.error('[SnapX] View error:', error);
    root.innerHTML = `
      <div class="page">
        <div class="view-error card">
          <span class="view-error-icon">${icon('alert', 24)}</span>
          <h2>This view hit a snag</h2>
          <p>${escapeHtml(error.message || 'Something unexpected happened.')}</p>
          <button class="btn btn-primary" type="button" data-error-retry>Try again</button>
        </div>
      </div>
    `;
    root.querySelector('[data-error-retry]')?.addEventListener('click', () => navigate(page, params, { replace: true }));
    toast('Could not open that page', { type: 'error', detail: error.message });
  }
  hydrateIcons(root);
  updateUserShell();
}

function renderNav() {
  const container = $('#navGroups');
  if (!container) return;
  const captureCount = captures().length;
  container.innerHTML = NAV_ITEMS.map((group) => `
    <div class="nav-group">
      <div class="nav-label">${group.section}</div>
      <nav class="nav">
        ${group.items.map((item) => `
          <button class="nav-item ${state.currentPage === item.id ? 'active' : ''}" data-page="${item.id}" data-nav="${item.id}" type="button">
            ${icon(item.icon, 17)}
            <span>${item.name}</span>
            ${item.badge ? `<span class="nav-badge ${item.badge === 'AI' ? 'blue' : ''}">${item.badge}</span>` : item.id === 'gallery' ? `<span class="nav-count">${captureCount}</span>` : ''}
          </button>
        `).join('')}
      </nav>
    </div>
  `).join('');
  container.querySelectorAll('[data-page]').forEach((item) => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });
}

function updateLibraryShell() {
  const local = state.gallery;
  const count = local.length;
  const bytes = local.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
  const countEl = $('#libraryCount');
  const sizeEl = $('#librarySize');
  const meter = $('#libraryMeter');
  if (countEl) countEl.textContent = String(count);
  if (sizeEl) sizeEl.textContent = formatBytes(bytes);
  if (meter) meter.style.width = `${clamp(3 + (bytes / (20 * 1024 * 1024 * 1024)) * 100, 3, 100)}%`;
  const navCount = $('.nav-item[data-page="gallery"] .nav-count');
  if (navCount) navCount.textContent = String(captures().length);
}

function updateUserShell() {
  const name = state.settings?.profile?.name || 'Maya Chen';
  const nameEl = $('#userName');
  const avatar = $('#userAvatar');
  if (nameEl) nameEl.textContent = name;
  if (avatar) avatar.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'SX';
  $$('[data-accel]').forEach((el) => {
    el.textContent = acceleratorLabel(el.dataset.accel);
  });
  const newBtnKbd = $('#newCaptureBtn kbd');
  if (newBtnKbd) newBtnKbd.textContent = acceleratorLabel(state.settings?.shortcuts?.region || 'CommandOrControl+Shift+1');
  updateSyncShell();
}

function updateSyncShell() {
  const pill = $('#syncPill');
  if (!pill) return;
  pill.innerHTML = `${icon('lock', 13)}<span>Local vault</span>`;
  pill.title = 'All captures stay on this device. Cloud sync is coming soon.';
}

function updateToolbarState() {
  const button = $('[data-action="toolbar"]');
  if (!button) return;
  button.classList.toggle('active', Boolean(state.toolbarVisible));
}

async function toggleToolbar() {
  try {
    const visible = await window.snapx.toolbar.setVisible(!state.toolbarVisible);
    state.toolbarVisible = Boolean(visible);
    state.settings.floatingToolbar = state.toolbarVisible;
    updateToolbarState();
    toast(state.toolbarVisible ? 'Floating toolbar is visible' : 'Floating toolbar hidden', { type: 'success' });
  } catch (error) {
    toast(error.message || 'Could not toggle the floating toolbar', { type: 'error' });
  }
}

async function refreshGallery(options = {}) {
  try {
    const [list, stats] = await Promise.all([
      window.snapx.gallery.list(),
      window.snapx.gallery.stats()
    ]);
    state.gallery = list || [];
    state.stats = stats || state.stats;
    updateLibraryShell();
    if (!options.silent && !document.querySelector('.modal-backdrop') && ['dashboard', 'gallery', 'capture'].includes(state.currentPage)) {
      await navigate(state.currentPage, state.currentParams, { replace: true });
    }
  } catch {
    /* keep previous state */
  }
}

async function refreshSettings() {
  try {
    const raw = await window.snapx.settings.get();
    state.settings = normalizeSettings(raw || {});
    state.samples = state.settings.samplesHidden ? [] : DEMO_CAPTURES.map((item) => ({ ...item }));
    applySettingsTheme();
    state.toolbarVisible = Boolean(state.settings.floatingToolbar);
    updateToolbarState();
    updateUserShell();
    updateLibraryShell();
    updateSyncShell();
  } catch {
    /* ignore */
  }
}

async function saveSettings(patch, options = {}) {
  try {
    const raw = await window.snapx.settings.update(patch);
    state.settings = normalizeSettings(raw || {});
    state.samples = state.settings.samplesHidden ? [] : DEMO_CAPTURES.map((item) => ({ ...item }));
    if (!options.skipApply) applySettingsTheme();
    state.toolbarVisible = Boolean(state.settings.floatingToolbar);
    updateToolbarState();
    updateUserShell();
    updateLibraryShell();
    updateSyncShell();
    if (options.rerender) await navigate(state.currentPage, state.currentParams, { replace: true });
    return state.settings;
  } catch (error) {
    toast(error.message || 'Could not save settings', { type: 'error' });
    return state.settings;
  }
}

function setBusyOverlay(value) {
  document.body.classList.toggle('is-capturing', Boolean(value));
  let indicator = $('.capture-busy');
  if (value) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'capture-busy';
      indicator.innerHTML = `<span class="capture-busy-orb">${icon('capture', 15)}</span><span><b>Capturing</b><small>SnapX is taking the shot…</small></span><span class="spinner"></span>`;
      document.body.appendChild(indicator);
    }
    indicator.classList.add('show');
  } else if (indicator) {
    indicator.classList.remove('show');
    setTimeout(() => indicator.remove(), 280);
  }
}

function openScreenPermission() {
  window.snapx?.app.openScreenPermission?.();
  toast('Opening System Settings', { type: 'info', detail: 'Allow SnapX Pro under Screen Recording.' });
}

function showPermissionBanner() {
  const banner = $('#permissionBanner');
  if (!banner) return;
  banner.hidden = false;
  banner.classList.add('show');
}

function openEditor(capture) {
  if (!capture) return;
  state.editorCapture = capture;
  navigate('editor');
}

async function runCaptureMode(mode, options = {}) {
  if (!window.snapx) {
    toast('Capture is only available in the desktop app', { type: 'error' });
    return;
  }
  const delay = Number(options.delay ?? state.settings?.capture?.delay ?? 0);
  if (mode === 'region') {
    if (delay > 0) await captureDelayed(ctx, delay, 'region');
    else await captureRegion(ctx, 'rect');
  } else if (mode === 'lasso') {
    await captureRegion(ctx, 'lasso');
  } else if (mode === 'window') {
    await captureWindow(ctx);
  } else if (mode === 'full' || mode === 'display') {
    if (delay > 0) await captureDelayed(ctx, delay, 'full');
    else await captureDisplay(ctx, options.displayId);
  } else if (mode === 'multi') {
    await captureAllDisplays(ctx);
  } else if (mode === 'scroll' || mode === 'scrolling') {
    await captureScrolling(ctx);
  } else if (mode === 'delay') {
    openDelayDialog();
  } else if (mode === 'video' || mode === 'record') {
    openRecorder(ctx, 'video');
  } else if (mode === 'gif') {
    openRecorder(ctx, 'gif');
  } else if (mode === 'import') {
    importImage(ctx, 'editor');
  } else {
    toast('That capture mode is not available yet', { type: 'info' });
  }
}

function openQuickCapture() {
  const modes = [
    { id: 'region', name: 'Region', desc: 'Drag any area', icon: 'rectangle', key: state.settings?.shortcuts?.region },
    { id: 'window', name: 'Window', desc: 'Pick an app', icon: 'window', key: state.settings?.shortcuts?.window },
    { id: 'full', name: 'Display', desc: 'Full monitor', icon: 'monitor', key: state.settings?.shortcuts?.full },
    { id: 'lasso', name: 'Freeform', desc: 'Draw a shape', icon: 'lasso', badge: 'NEW' },
    { id: 'scroll', name: 'Scrolling', desc: 'Long pages', icon: 'scroll', badge: 'BETA' },
    { id: 'video', name: 'Record', desc: 'WebM video', icon: 'video', badge: '60 FPS' },
    { id: 'gif', name: 'GIF', desc: 'Looping clip', icon: 'gif', badge: 'NEW' },
    { id: 'import', name: 'Import', desc: 'Open an image', icon: 'imagePlus' }
  ];
  const modal = openModal({
    title: 'New capture',
    subtitle: 'What are we grabbing today?',
    size: 'md',
    className: 'quick-capture-modal',
    content: `
      <div class="quick-capture-grid">
        ${modes.map((mode) => `
          <button class="quick-capture-option ${mode.id === 'region' ? 'featured' : ''}" data-quick-mode="${mode.id}" type="button">
            <span class="quick-capture-icon">${icon(mode.icon, 20)}</span>
            <span class="quick-capture-copy"><b>${mode.name}</b><small>${mode.desc}</small></span>
            ${mode.badge ? `<span class="badge ${mode.badge === 'NEW' ? 'accent' : 'blue'}">${mode.badge}</span>` : mode.key ? `<kbd>${acceleratorLabel(mode.key)}</kbd>` : ''}
          </button>
        `).join('')}
      </div>
      <div class="quick-capture-foot">
        <span>${icon('keyboard', 12)} Press <kbd>Esc</kbd> to close</span>
        <button class="btn btn-ghost btn-sm" data-quick-delay type="button">${icon('timer', 12)} Delayed capture</button>
      </div>
    `
  });
  modal.modal.querySelectorAll('[data-quick-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      modal.close();
      runCaptureMode(button.dataset.quickMode);
    });
  });
  modal.modal.querySelector('[data-quick-delay]')?.addEventListener('click', () => {
    modal.close();
    openDelayDialog();
  });
}

function openDelayDialog() {
  let seconds = 3;
  let mode = 'region';
  const modal = openModal({
    title: 'Delayed capture',
    subtitle: 'A little time to arrange the perfect frame.',
    size: 'sm',
    content: `
      <div class="field">
        <label class="field-label">Capture after</label>
        <div class="delay-options">
          ${[1, 3, 5, 10].map((value) => `<button class="delay-option ${value === 3 ? 'active' : ''}" data-delay-choice="${value}" type="button"><b>${value}</b><span>seconds</span></button>`).join('')}
        </div>
      </div>
      <div class="field" style="margin-top:16px">
        <label class="field-label">Capture type</label>
        <div class="segmented" data-delay-mode>
          <button class="active" data-delay-mode-value="region" type="button">Region</button>
          <button data-delay-mode-value="full" type="button">Full display</button>
        </div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" data-delay-cancel type="button">Cancel</button><button class="btn btn-primary" data-delay-start type="button">${icon('timer', 14)} Start countdown</button>`
  });
  modal.modal.querySelectorAll('[data-delay-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      seconds = Number(button.dataset.delayChoice);
      modal.modal.querySelectorAll('[data-delay-choice]').forEach((entry) => entry.classList.toggle('active', entry === button));
    });
  });
  modal.modal.querySelectorAll('[data-delay-mode-value]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.delayModeValue;
      modal.modal.querySelectorAll('[data-delay-mode-value]').forEach((entry) => entry.classList.toggle('active', entry === button));
    });
  });
  modal.modal.querySelector('[data-delay-cancel]')?.addEventListener('click', () => modal.close());
  modal.modal.querySelector('[data-delay-start]')?.addEventListener('click', () => {
    modal.close();
    setTimeout(() => captureDelayed(ctx, seconds, mode), 220);
  });
}

function openCommandPalette() {
  const root = $('#paletteRoot');
  if (!root) return;
  const allCaptures = captures();
  const actions = [
    ...NAV_ITEMS.flatMap((group) => group.items.map((item) => ({
      id: `nav-${item.id}`,
      group: 'Navigate',
      label: item.name,
      hint: item.id === 'dashboard' ? 'Workspace overview' : item.id === 'gallery' ? 'Search every capture' : `Open ${item.name}`,
      icon: item.icon,
      keywords: `go open page ${item.name}`,
      run: () => navigate(item.id)
    }))),
    { id: 'cap-region', group: 'Capture', label: 'Capture region', hint: acceleratorLabel(state.settings?.shortcuts?.region || ''), icon: 'rectangle', keywords: 'screenshot area drag rectangle', run: () => runCaptureMode('region') },
    { id: 'cap-window', group: 'Capture', label: 'Capture window', hint: acceleratorLabel(state.settings?.shortcuts?.window || ''), icon: 'window', keywords: 'app window', run: () => runCaptureMode('window') },
    { id: 'cap-full', group: 'Capture', label: 'Capture full display', hint: acceleratorLabel(state.settings?.shortcuts?.full || ''), icon: 'monitor', keywords: 'screen monitor full', run: () => runCaptureMode('full') },
    { id: 'cap-scroll', group: 'Capture', label: 'Scrolling capture', hint: 'Beta', icon: 'scroll', keywords: 'long page stitch', run: () => runCaptureMode('scroll') },
    { id: 'cap-lasso', group: 'Capture', label: 'Freeform lasso', hint: 'New', icon: 'lasso', keywords: 'freeform draw shape', run: () => runCaptureMode('lasso') },
    { id: 'cap-video', group: 'Capture', label: 'Record video', hint: '60 fps', icon: 'video', keywords: 'record screen webm', run: () => runCaptureMode('video') },
    { id: 'cap-gif', group: 'Capture', label: 'Record GIF', hint: 'New', icon: 'gif', keywords: 'record loop gif', run: () => runCaptureMode('gif') },
    { id: 'cap-delay', group: 'Capture', label: 'Delayed capture', hint: 'Timer', icon: 'timer', keywords: 'delay timer countdown', run: () => openDelayDialog() },
    { id: 'cap-import', group: 'Capture', label: 'Import image', hint: 'Open in editor', icon: 'imagePlus', keywords: 'file open upload', run: () => importImage(ctx, 'editor') },
    { id: 'toolbar', group: 'Workspace', label: state.toolbarVisible ? 'Hide floating toolbar' : 'Show floating toolbar', hint: acceleratorLabel(state.settings?.shortcuts?.toolbar || ''), icon: 'panel', keywords: 'toolbar floating capture', run: () => toggleToolbar() },
    { id: 'new-capture', group: 'Workspace', label: 'New capture…', hint: 'Choose a mode', icon: 'capture', keywords: 'new screenshot capture', run: () => openQuickCapture() },
    { id: 'themes', group: 'Workspace', label: 'Change theme', hint: 'Appearance', icon: 'themes', keywords: 'theme color appearance', run: () => navigate('themes') },
    ...THEMES.map((theme) => ({
      id: `theme-${theme.id}`,
      group: 'Themes',
      label: `Apply ${theme.name}`,
      hint: theme.subname,
      icon: 'themes',
      keywords: `theme color ${theme.name}`,
      run: async () => {
        await saveSettings({ theme: theme.id });
        toast(`${theme.name} applied`, { type: 'success' });
        if (state.currentPage === 'themes') navigate('themes');
      }
    })),
    ...allCaptures.slice(0, 10).map((capture) => ({
      id: `capture-${capture.id}`,
      group: 'Captures',
      label: capture.title,
      hint: `${prettySource(capture.source)} · ${timeAgo(capture.createdAt)}`,
      icon: capture.kind === 'gif' ? 'gif' : 'image',
      keywords: `${capture.title} ${(capture.tags || []).join(' ')} capture`,
      run: () => openPreview(ctx, capture, { list: allCaptures })
    }))
  ];

  root.innerHTML = `
    <div class="palette-backdrop">
      <div class="palette" role="dialog" aria-label="Command palette">
        <div class="palette-head">
          ${icon('search', 17)}
          <input type="text" placeholder="Search captures, tools, themes and settings…" data-palette-input autocomplete="off" spellcheck="false">
          <kbd>ESC</kbd>
        </div>
        <div class="palette-results" data-palette-results></div>
        <div class="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>ESC</kbd> Close</span>
          <span class="palette-brand">${icon('sparkle', 10)} SnapX Command</span>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => root.querySelector('.palette-backdrop')?.classList.add('show'));
  const input = root.querySelector('[data-palette-input]');
  const results = root.querySelector('[data-palette-results]');
  let filtered = actions;
  let activeIndex = 0;

  const paint = () => {
    const groups = [];
    for (const action of filtered) {
      const last = groups[groups.length - 1];
      if (!last || last.name !== action.group) groups.push({ name: action.group, actions: [action] });
      else last.actions.push(action);
    }
    if (!filtered.length) {
      results.innerHTML = `<div class="palette-empty">${icon('search', 20)}<b>No results found</b><span>Try a different word, or search for a capture title.</span></div>`;
      return;
    }
    let flatIndex = 0;
    results.innerHTML = groups.map((group) => `
      <div class="palette-group">
        <span class="palette-group-label">${escapeHtml(group.name)}</span>
        ${group.actions.map((action) => {
          const index = flatIndex;
          flatIndex += 1;
          return `
            <button class="palette-item ${index === activeIndex ? 'active' : ''}" data-palette-action="${action.id}" data-index="${index}" type="button">
              <span class="palette-item-icon">${icon(action.icon, 15)}</span>
              <span class="palette-item-copy"><b>${escapeHtml(action.label)}</b><small>${escapeHtml(action.hint || '')}</small></span>
              ${index === activeIndex ? `<span class="palette-enter">${icon('cornerDownLeft', 12)}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `).join('');
    results.querySelectorAll('[data-palette-action]').forEach((button) => {
      button.addEventListener('click', () => execute(Number(button.dataset.index)));
    });
    results.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' });
  };

  const execute = (index) => {
    const action = filtered[index];
    if (!action) return;
    closePalette();
    setTimeout(() => action.run(), 60);
  };

  const filter = () => {
    const query = input.value.trim().toLowerCase();
    filtered = query
      ? actions.filter((action) => `${action.label} ${action.hint || ''} ${action.keywords || ''} ${action.group}`.toLowerCase().includes(query)).slice(0, 24)
      : actions.slice(0, 18);
    activeIndex = 0;
    paint();
  };

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      paint();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      paint();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  });
  root.querySelector('.palette-backdrop').addEventListener('pointerdown', (event) => {
    if (event.target.classList.contains('palette-backdrop')) closePalette();
  });
  filter();
  setTimeout(() => input.focus(), 60);
}

function closePalette() {
  const root = $('#paletteRoot');
  if (!root) return;
  const backdrop = root.querySelector('.palette-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('show');
  setTimeout(() => { root.innerHTML = ''; }, 160);
}

let activityPop = null;

function openActivityPanel() {
  if (activityPop) {
    closeActivityPanel();
    return;
  }
  const entries = [
    ...state.activity.slice(0, 4),
    { id: 'welcome', label: 'SnapX Pro workspace ready', at: new Date().toISOString(), icon: 'sparkle' },
    { id: 'local', label: `${captures().length} captures in your local vault`, at: new Date().toISOString(), icon: 'cloudCheck' }
  ];
  activityPop = document.createElement('div');
  activityPop.className = 'activity-pop';
  activityPop.innerHTML = `
    <div class="activity-head"><div><b>Activity</b><span>Everything recent, in one place</span></div><span class="pill">${icon('bell', 10)} ${entries.length}</span></div>
    <div class="activity-list">
      ${entries.map((entry) => `
        <div class="activity-item">
          <span class="activity-icon">${icon(entry.icon || 'sparkle', 12)}</span>
          <div><b>${escapeHtml(entry.label)}</b><span>${timeAgo(entry.at)}</span></div>
        </div>
      `).join('')}
    </div>
    <div class="activity-foot"><span>${icon('lock', 10)} Stored locally</span><button data-clear-activity type="button">Clear</button></div>
  `;
  document.body.appendChild(activityPop);
  requestAnimationFrame(() => activityPop.classList.add('show'));
  activityPop.querySelector('[data-clear-activity]')?.addEventListener('click', () => {
    state.activity = [];
    closeActivityPanel();
    toast('Activity cleared');
  });
  const bell = $('[data-action="notifications"] .notif-dot');
  if (bell) bell.remove();
  state.notificationSeen = true;
  setTimeout(() => {
    const outside = (event) => {
      if (!activityPop) return;
      if (activityPop.contains(event.target) || event.target.closest('[data-action="notifications"]')) return;
      closeActivityPanel();
      document.removeEventListener('pointerdown', outside);
    };
    document.addEventListener('pointerdown', outside);
    activityPop._outside = outside;
  }, 20);
}

function closeActivityPanel() {
  if (!activityPop) return;
  const pop = activityPop;
  activityPop = null;
  pop.classList.remove('show');
  if (pop._outside) document.removeEventListener('pointerdown', pop._outside);
  setTimeout(() => pop.remove(), 180);
}

window.addEventListener('DOMContentLoaded', boot);
