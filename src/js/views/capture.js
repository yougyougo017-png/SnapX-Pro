import { icon } from '../icons.js';
import {
  escapeHtml,
  acceleratorLabel,
  toast,
  formatBytes,
  timeAgo,
  prettySource
} from '../ui.js';
import { state, captures } from '../state.js';
import { CAPTURE_MODES, CAPTURE_DELAYS, FORMAT_OPTIONS } from '../data.js';

const MODE_COPY = {
  region: 'Drag a precise rectangle anywhere on your screen.',
  window: 'Pick any open window for a clean, shadowless capture.',
  full: 'Capture the entire display at native resolution.',
  multi: 'Grab every connected monitor in one action.',
  scroll: 'Long pages and apps. Beta in this build.',
  lasso: 'Draw a freeform shape around anything you want.',
  video: 'Record a display as a high-quality WebM video.',
  gif: 'Create a tiny, perfect looping GIF.'
};

export async function renderCapture(ctx, root) {
  const settings = state.settings || {};
  const latest = state.gallery[0] || state.samples[0];
  let mode = settings.capture?.mode || 'region';
  let delay = Number(settings.capture?.delay) || 0;
  let displayId = settings.capture?.displayId || null;
  let displays = [];

  root.innerHTML = `
    <div class="page capture-page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span>Capture Studio<span class="line"></span>Live engine</div>
          <h1 class="page-title">One gesture. <span class="grad">Pixel-perfect result.</span></h1>
          <p class="page-sub">Choose a capture mode, tune the output, and SnapX handles the rest — clipboard included.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-open-editor type="button">${icon('editor', 14)} Open editor</button>
          <button class="btn btn-secondary" data-record-video type="button">${icon('video', 14)} Record</button>
          <button class="btn btn-primary" data-big-capture type="button">${icon('camera', 15)} Capture now <kbd>${acceleratorLabel(settings.shortcuts?.region || 'CommandOrControl+Shift+1')}</kbd></button>
        </div>
      </div>

      <div class="capture-layout">
        <section class="capture-main">
          <div class="capture-stage card gold-edge">
            <div class="capture-stage-top">
              <div class="capture-display-tabs" data-display-tabs>
                <span class="capture-display-loading"><span class="spinner"></span> Reading displays…</span>
              </div>
              <div class="capture-stage-status"><span class="status-dot"></span> Ready to capture</div>
            </div>
            <div class="capture-canvas">
              <img src="${escapeHtml(latest.thumbnailUrl || latest.url || latest.src)}" alt="Latest capture preview">
              <span class="capture-vignette"></span>
              <div class="capture-demo-frame">
                <span class="capture-corner tl"></span><span class="capture-corner tr"></span><span class="capture-corner bl"></span><span class="capture-corner br"></span>
                <span class="capture-demo-size">1280 × 800</span>
              </div>
              <div class="capture-crosshair-h"></div>
              <div class="capture-crosshair-v"></div>
              <div class="capture-magnifier">
                <span class="capture-lens"></span>
                <span class="capture-lens-label">8× zoom</span>
              </div>
              <div class="capture-stage-hint">
                <span class="capture-hint-icon">${icon('capture', 15)}</span>
                <div><b>Drag anywhere to capture a region</b><span>Press Esc to cancel · Shift for square · Enter to confirm</span></div>
                <kbd>${acceleratorLabel(state.settings?.shortcuts?.region || 'CommandOrControl+Shift+1')}</kbd>
              </div>
              <div class="capture-stage-toolbar">
                <span class="active">${icon('rectangle', 14)}</span>
                <span>${icon('lasso', 14)}</span>
                <span>${icon('window', 14)}</span>
                <span>${icon('scroll', 14)}</span>
                <span class="tool-div"></span>
                <span>${icon('crosshair', 14)}</span>
                <span>${icon('ruler', 14)}</span>
                <span>${icon('zoomIn', 14)}</span>
              </div>
            </div>
            <div class="capture-stage-bottom">
              <div class="capture-stage-info">
                <span>${icon('monitor', 13)} <b data-stage-display>Display</b></span>
                <span>${icon('image', 13)} ${latest.width || 0} × ${latest.height || 0} preview</span>
                <span>${icon('lock', 13)} Local only</span>
              </div>
              <div class="capture-stage-actions">
                <button class="btn btn-sm btn-ghost" data-stage-import type="button">${icon('imagePlus', 13)} Open image</button>
                <button class="btn btn-sm btn-primary" data-stage-capture type="button">${icon('camera', 13)} Capture ${MODE_COPY[mode] ? '' : ''}</button>
              </div>
            </div>
          </div>

          <section class="capture-modes card">
            <div class="section-head">
              <div class="section-title">${icon('grid', 16)} Capture mode</div>
              <span class="section-hint" data-mode-hint>${MODE_COPY[mode]}</span>
            </div>
            <div class="capture-mode-grid">
              ${CAPTURE_MODES.map((entry) => `
                <button class="capture-mode ${entry.id === mode ? 'active' : ''}" data-capture-mode="${entry.id}" type="button">
                  ${entry.badge ? `<span class="badge ${entry.badge === 'NEW' ? 'accent' : 'blue'}">${entry.badge}</span>` : ''}
                  <span class="capture-mode-icon">${icon(entry.icon, 18)}</span>
                  <span><b>${entry.name}</b><small>${entry.hint}</small></span>
                  <span class="capture-mode-check">${icon('check', 10)}</span>
                </button>
              `).join('')}
            </div>
          </section>

          <section class="capture-recent card">
            <div class="recent-head">
              <div class="section-title">${icon('history', 15)} Pick up where you left off</div>
              <button class="section-link" data-nav-gallery type="button">View all ${icon('arrowRight', 12)}</button>
            </div>
            <div class="capture-recent-strip">
              ${captures().slice(0, 5).map((item) => `
                <button class="capture-recent-item" data-open-capture="${item.id}" type="button">
                  <img src="${escapeHtml(item.thumbnailUrl || item.url || item.src)}" alt="" loading="lazy">
                  <span><b>${escapeHtml(item.title)}</b><small>${item.demo ? 'Sample' : timeAgo(item.createdAt)} · ${prettySource(item.source)}</small></span>
                </button>
              `).join('')}
            </div>
          </section>
        </section>

        <aside class="capture-side">
          <section class="capture-setup card">
            <div class="section-head">
              <div class="section-title">${icon('settings', 15)} Setup</div>
              <span class="pill gold">${icon('bolt', 10)} Fast</span>
            </div>
            <div class="field">
              <label class="field-label">Display <span class="field-hint" data-display-count>Detecting…</span></label>
              <div class="display-list" data-display-list>
                <div class="display-loading"><span class="spinner"></span> Finding monitors…</div>
              </div>
            </div>
            <div class="field">
              <label class="field-label">Delay <span class="field-hint">Give yourself a head start</span></label>
              <div class="chip-row" data-delay-row>
                ${CAPTURE_DELAYS.map((value) => `<button class="chip ${value === delay ? 'active' : ''}" data-delay="${value}" type="button">${value === 0 ? 'Off' : `${value}s`}</button>`).join('')}
              </div>
            </div>
            <div class="field">
              <label class="field-label">Output format</label>
              <select class="select" data-format>
                ${FORMAT_OPTIONS.map((format) => `<option value="${format}" ${format === (settings.capture?.format || 'png') ? 'selected' : ''}>${format.toUpperCase()}${format === 'png' ? ' · lossless' : format === 'webp' ? ' · modern' : ' · compact'}</option>`).join('')}
              </select>
            </div>
            <div class="capture-switches">
              <div class="switch-row">
                <div class="switch-copy"><b>Copy after capture</b><span>Image is ready before you are</span></div>
                <button class="toggle ${settings.capture?.copyAfterCapture !== false ? 'on' : ''}" data-toggle-setting="capture.copyAfterCapture" type="button" aria-label="Copy after capture"></button>
              </div>
              <div class="switch-row">
                <div class="switch-copy"><b>Open editor after capture</b><span>Jump straight into annotations</span></div>
                <button class="toggle ${settings.capture?.openEditor ? 'on' : ''}" data-toggle-setting="capture.openEditor" type="button" aria-label="Open editor"></button>
              </div>
              <div class="switch-row">
                <div class="switch-copy"><b>Capture sound</b><span>Subtle shutter feedback</span></div>
                <button class="toggle ${settings.capture?.sound !== false ? 'on' : ''}" data-toggle-setting="capture.sound" type="button" aria-label="Capture sound"></button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg btn-block capture-launch" data-launch type="button">${icon('capture', 17)} <span>Start region capture</span></button>
            <div class="capture-shortcut-note"><span>${icon('keyboard', 13)} Shortcut</span><kbd>${acceleratorLabel(settings.shortcuts?.region || 'CommandOrControl+Shift+1')}</kbd></div>
          </section>

          <section class="capture-tip card">
            <span class="capture-tip-icon">${icon('sparkle', 16)}</span>
            <div><b>Pro tip</b><p>Hold <kbd>Shift</kbd> while dragging for a perfect square, or press <kbd>Space</kbd> to nudge the selection.</p></div>
          </section>

          <section class="capture-health card">
            <div class="section-head"><div class="section-title">${icon('shieldCheck', 15)} Capture health</div><span class="pill green">${icon('check', 10)} Ready</span></div>
            <div class="health-list">
              <div><span>Screen access</span><b>${state.screenPermission === 'granted' ? 'Granted' : 'Needs permission'}</b></div>
              <div><span>Displays</span><b data-health-displays>—</b></div>
              <div><span>Clipboard</span><b>Available</b></div>
              <div><span>Local storage</span><b>${formatBytes(captures().reduce((sum, item) => sum + (item.bytes || 0), 0))}</b></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  const hint = root.querySelector('[data-mode-hint]');
  const launch = root.querySelector('[data-launch]');
  const stageCapture = root.querySelector('[data-stage-capture]');
  const updateModeUI = () => {
    root.querySelectorAll('[data-capture-mode]').forEach((button) => button.classList.toggle('active', button.dataset.captureMode === mode));
    hint.textContent = MODE_COPY[mode] || '';
    const modeEntry = CAPTURE_MODES.find((entry) => entry.id === mode);
    launch.innerHTML = `${icon(modeEntry?.icon || 'capture', 17)} <span>${mode === 'video' ? 'Start recording' : mode === 'gif' ? 'Record a GIF' : `Start ${modeEntry?.name.toLowerCase() || 'capture'}`}</span>`;
    stageCapture.innerHTML = `${icon(modeEntry?.icon || 'camera', 13)} ${mode === 'video' ? 'Record' : mode === 'gif' ? 'GIF' : 'Capture'}`;
    saveCaptureSettings();
  };

  const saveCaptureSettings = () => {
    ctx.saveSettings({ capture: { mode, delay, displayId, format: root.querySelector('[data-format]')?.value || settings.capture?.format || 'png' } }, { silent: true });
  };

  root.querySelectorAll('[data-capture-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.captureMode;
      updateModeUI();
    });
  });

  root.querySelectorAll('[data-delay]').forEach((button) => {
    button.addEventListener('click', () => {
      delay = Number(button.dataset.delay);
      root.querySelectorAll('[data-delay]').forEach((entry) => entry.classList.toggle('active', entry === button));
      saveCaptureSettings();
    });
  });

  root.querySelector('[data-format]')?.addEventListener('change', (event) => {
    settings.capture.format = event.target.value;
    saveCaptureSettings();
  });

  root.querySelectorAll('[data-toggle-setting]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const path = toggle.dataset.toggleSetting.split('.');
      const current = path.reduce((value, key) => value?.[key], state.settings);
      const next = !current;
      toggle.classList.toggle('on', next);
      ctx.saveSettings({ [path[0]]: { [path[1]]: next } }, { silent: true });
    });
  });

  root.querySelectorAll('[data-open-capture]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = captures().find((entry) => entry.id === button.dataset.openCapture);
      if (item) ctx.openPreview(item);
    });
  });
  root.querySelector('[data-nav-gallery]')?.addEventListener('click', () => ctx.navigate('gallery'));
  root.querySelector('[data-open-editor]')?.addEventListener('click', () => ctx.navigate('editor'));
  root.querySelector('[data-stage-import]')?.addEventListener('click', () => ctx.importImage('editor'));
  root.querySelector('[data-record-video]')?.addEventListener('click', () => ctx.openRecorder('video'));

  const launchCapture = () => {
    ctx.runCaptureMode(mode, { delay, displayId });
  };
  launch.addEventListener('click', launchCapture);
  stageCapture.addEventListener('click', launchCapture);
  root.querySelector('[data-big-capture]')?.addEventListener('click', () => ctx.runCaptureMode(mode, { delay, displayId }));

  try {
    displays = await window.snapx.capture.displays();
    state.displays = displays;
    const selected = displayId || displays.find((display) => display.primary)?.id || displays[0]?.id;
    displayId = selected;
    const displayTabs = root.querySelector('[data-display-tabs]');
    const displayList = root.querySelector('[data-display-list]');
    const countEl = root.querySelector('[data-display-count]');
    const healthDisplays = root.querySelector('[data-health-displays]');
    if (!displayTabs) return;
    displayTabs.innerHTML = displays.map((display, index) => `
      <button class="capture-display-tab ${display.id === selected ? 'active' : ''}" data-display-tab="${display.id}" type="button">
        ${icon(display.primary ? 'monitor' : 'monitors', 13)}
        <span>${escapeHtml(display.label || `Display ${index + 1}`)}</span>
        ${display.primary ? '<i>Primary</i>' : ''}
      </button>
    `).join('');
    displayList.innerHTML = displays.map((display, index) => `
      <button class="display-row ${display.id === selected ? 'active' : ''}" data-display-row="${display.id}" type="button">
        <span class="display-row-icon">${icon(display.primary ? 'monitor' : 'monitors', 16)}</span>
        <span class="display-row-copy"><b>${escapeHtml(display.label || `Display ${index + 1}`)}</b><small>${display.size.width} × ${display.size.height}${display.scaleFactor && display.scaleFactor !== 1 ? ` @ ${display.scaleFactor}×` : ''}</small></span>
        <span class="display-row-check">${icon('check', 10)}</span>
      </button>
    `).join('');
    countEl.textContent = `${displays.length} connected`;
    healthDisplays.textContent = `${displays.length} active`;
    const stageDisplay = root.querySelector('[data-stage-display]');
    const setDisplay = (id) => {
      displayId = id;
      settings.capture.displayId = id;
      const display = displays.find((entry) => entry.id === id);
      if (stageDisplay) stageDisplay.textContent = display?.label || 'Display';
      root.querySelectorAll('[data-display-tab]').forEach((entry) => entry.classList.toggle('active', Number(entry.dataset.displayTab) === Number(id)));
      root.querySelectorAll('[data-display-row]').forEach((entry) => entry.classList.toggle('active', Number(entry.dataset.displayRow) === Number(id)));
      saveCaptureSettings();
    };
    root.querySelectorAll('[data-display-tab]').forEach((button) => button.addEventListener('click', () => setDisplay(Number(button.dataset.displayTab))));
    root.querySelectorAll('[data-display-row]').forEach((button) => button.addEventListener('click', () => setDisplay(Number(button.dataset.displayRow))));
    setDisplay(selected);
  } catch {
    const displayTabs = root.querySelector('[data-display-tabs]');
    if (displayTabs) displayTabs.innerHTML = `<span class="capture-display-loading">${icon('alert', 12)} Could not read displays</span>`;
  }
}
