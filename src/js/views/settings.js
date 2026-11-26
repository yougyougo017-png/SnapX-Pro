import { icon } from '../icons.js';
import {
  escapeHtml,
  toast,
  formatBytes,
  confirmDialog,
  acceleratorLabel,
  captureKeyCombo,
  openModal,
  setBusy,
  isMac
} from '../ui.js';
import { state, captures } from '../state.js';
import { CAPTURE_MODES, CAPTURE_DELAYS, FORMAT_OPTIONS } from '../data.js';

const SECTIONS = [
  { id: 'general', name: 'General', icon: 'settings', hint: 'Startup & behavior' },
  { id: 'capture', name: 'Capture', icon: 'capture', hint: 'Output & defaults' },
  { id: 'shortcuts', name: 'Shortcuts', icon: 'keyboard', hint: 'Global hotkeys' },
  { id: 'integrations', name: 'AI & Integrations', icon: 'ai', hint: 'Keys & sharing' },
  { id: 'storage', name: 'Storage & Privacy', icon: 'hardDrive', hint: 'Local vault' },
  { id: 'about', name: 'About', icon: 'info', hint: 'Version & credits' }
];

function toggleRow(key, label, hint, value, section) {
  return `
    <div class="switch-row">
      <div class="switch-copy"><b>${label}</b><span>${hint}</span></div>
      <button class="toggle ${value ? 'on' : ''}" data-setting-toggle="${section}.${key}" type="button" aria-label="${label}"></button>
    </div>
  `;
}

function sectionGeneral(settings) {
  const name = settings.profile?.name || 'Maya Chen';
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>General</span><h2>Workspace behavior</h2><p>How SnapX starts, lives in your tray, and keeps you informed.</p></div>
        <span class="pill green">${icon('check', 10)} Saved automatically</span>
      </div>

      <div class="settings-card card profile-settings">
        <div class="profile-avatar">MC</div>
        <div class="profile-copy">
          <span class="preview-side-label">Workspace profile</span>
          <h3>${escapeHtml(name)}</h3>
          <p>Personalize the name shown across your workspace.</p>
        </div>
        <div class="profile-actions">
          <button class="btn btn-secondary btn-sm" data-edit-profile type="button">${icon('pen', 12)} Edit profile</button>
          <span class="pill gold">${icon('sparkle', 10)} Pro</span>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('bolt', 16)}</span>
          <div><h3>Startup</h3><p>Keep SnapX one gesture away.</p></div>
        </div>
        ${toggleRow('launchAtLogin', 'Launch at login', 'Start SnapX automatically when you sign in.', settings.behavior?.launchAtLogin, 'behavior')}
        ${toggleRow('minimizeToTray', 'Minimize to tray', 'Keep capture shortcuts live when the window is hidden.', settings.behavior?.minimizeToTray, 'behavior')}
        ${toggleRow('closeToTray', 'Close to tray', 'Closing the window hides SnapX instead of quitting.', settings.behavior?.closeToTray, 'behavior')}
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('bell', 16)}</span>
          <div><h3>Notifications</h3><p>Subtle feedback when something important happens.</p></div>
        </div>
        ${toggleRow('notify', 'Desktop notifications', 'Notify when recordings and exports are saved.', settings.behavior?.notify, 'behavior')}
        <div class="switch-row">
          <div class="switch-copy"><b>Capture sound</b><span>A quiet shutter confirms every screenshot.</span></div>
          <button class="toggle ${settings.capture?.sound !== false ? 'on' : ''}" data-setting-toggle="capture.sound" type="button" aria-label="Capture sound"></button>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('themes', 16)}</span>
          <div><h3>Appearance</h3><p>Theme, corner radius, motion and density.</p></div>
          <button class="btn btn-secondary btn-sm settings-card-action" data-nav-themes type="button">${icon('themes', 12)} Open themes</button>
        </div>
        <div class="settings-appearance-row">
          <div><span>Current theme</span><b>${escapeHtml(settings.theme || 'royal')}</b></div>
          <div><span>Corner radius</span><b>${settings.ui?.cornerRadius ?? 22}px</b></div>
          <div><span>Density</span><b>${escapeHtml(settings.ui?.density || 'comfortable')}</b></div>
          <div><span>Motion</span><b>${settings.ui?.reduceMotion ? 'Reduced' : 'Full'}</b></div>
        </div>
      </div>
    </section>
  `;
}

function sectionCapture(settings) {
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>Capture</span><h2>Output & defaults</h2><p>Set up the capture engine exactly the way you work.</p></div>
        <button class="btn btn-secondary btn-sm" data-test-capture type="button">${icon('camera', 12)} Test capture</button>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('capture', 16)}</span>
          <div><h3>Default capture mode</h3><p>What opens when you press the primary shortcut.</p></div>
        </div>
        <div class="settings-mode-grid">
          ${CAPTURE_MODES.slice(0, 4).map((mode) => `
            <button class="settings-mode ${settings.capture?.mode === mode.id ? 'active' : ''}" data-default-mode="${mode.id}" type="button">
              ${icon(mode.icon, 17)}
              <span><b>${mode.name}</b><small>${mode.hint}</small></span>
              ${icon('check', 10)}
            </button>
          `).join('')}
        </div>
        <div class="settings-field-grid">
          <div class="field">
            <label class="field-label">Default delay</label>
            <div class="chip-row">
              ${CAPTURE_DELAYS.map((value) => `<button class="chip ${Number(settings.capture?.delay) === value ? 'active' : ''}" data-default-delay="${value}" type="button">${value === 0 ? 'Off' : `${value}s`}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label class="field-label">Output format</label>
            <select class="select" data-setting-select="capture.format">
              ${FORMAT_OPTIONS.map((format) => `<option value="${format}" ${settings.capture?.format === format ? 'selected' : ''}>${format.toUpperCase()}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('sliders', 16)}</span>
          <div><h3>After capture</h3><p>The little things that save seconds, every time.</p></div>
        </div>
        ${toggleRow('copyAfterCapture', 'Copy image after capture', 'The image is ready to paste before the preview appears.', settings.capture?.copyAfterCapture !== false, 'capture')}
        ${toggleRow('openEditor', 'Open editor after capture', 'Jump straight into annotations and redactions.', settings.capture?.openEditor, 'capture')}
        ${toggleRow('includeCursor', 'Include cursor', 'Keep the pointer in the captured frame.', settings.capture?.includeCursor, 'capture')}
        ${toggleRow('autoSave', 'Auto-save to library', 'Every capture lands in your local vault automatically.', settings.behavior?.autoSave !== false, 'behavior')}
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('image', 16)}</span>
          <div><h3>Quality</h3><p>Lossless PNG by default. JPEG and WebP trade detail for size.</p></div>
        </div>
        <div class="field quality-field">
          <label class="field-label">Compression quality <span class="field-hint" data-quality-value>${settings.capture?.quality ?? 95}%</span></label>
          <div class="range-row">
            <input class="slider" type="range" min="40" max="100" value="${settings.capture?.quality ?? 95}" data-quality-slider>
          </div>
          <p class="field-hint">Applies to JPEG and WebP. PNG always stays lossless.</p>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('panel', 16)}</span>
          <div><h3>Floating toolbar</h3><p>A tiny glass capture bar that follows you across apps.</p></div>
          <span class="pill ${settings.floatingToolbar ? 'green' : ''}">${settings.floatingToolbar ? 'Visible' : 'Hidden'}</span>
        </div>
        <div class="switch-row">
          <div class="switch-copy"><b>Show floating toolbar</b><span>Region, window, display, record and GIF — always one click away.</span></div>
          <button class="toggle ${settings.floatingToolbar ? 'on' : ''}" data-toolbar-toggle type="button" aria-label="Floating toolbar"></button>
        </div>
        <div class="settings-inline-note">${icon('keyboard', 12)} Toggle with <kbd>${acceleratorLabel(settings.shortcuts?.toolbar || 'CommandOrControl+Shift+4')}</kbd> from anywhere.</div>
      </div>
    </section>
  `;
}

function sectionShortcuts(settings) {
  const rows = [
    { key: 'region', name: 'Region capture', hint: 'Drag a precise area', icon: 'rectangle' },
    { key: 'full', name: 'Full display', hint: 'Capture the current monitor', icon: 'monitor' },
    { key: 'window', name: 'Window capture', hint: 'Pick any open window', icon: 'window' },
    { key: 'toolbar', name: 'Floating toolbar', hint: 'Show or hide the capture bar', icon: 'panel' }
  ];
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>Shortcuts</span><h2>Global hotkeys</h2><p>Click a shortcut, then press the keys you want. Works even when SnapX is hidden.</p></div>
        <button class="btn btn-secondary btn-sm" data-reset-shortcuts type="button">${icon('rotate', 12)} Reset defaults</button>
      </div>

      <div class="settings-card card shortcuts-card">
        <div class="shortcuts-head">
          <span class="preview-side-label">System-wide shortcuts</span>
          <span class="pill green">${icon('check', 10)} Active</span>
        </div>
        <div class="shortcut-list">
          ${rows.map((row) => `
            <div class="shortcut-row">
              <span class="shortcut-icon">${icon(row.icon, 17)}</span>
              <div class="shortcut-copy"><b>${row.name}</b><span>${row.hint}</span></div>
              <button class="shortcut-recorder" data-shortcut-key="${row.key}" type="button" aria-label="Change ${row.name} shortcut">
                <span class="shortcut-keys">${String(settings.shortcuts?.[row.key] || '').split('+').map((part) => `<kbd>${escapeHtml(acceleratorLabel(part))}</kbd>`).join('')}</span>
                <span class="shortcut-edit">${icon('pen', 11)} Change</span>
              </button>
            </div>
          `).join('')}
        </div>
        <div class="settings-inline-note">${icon('info', 12)} If a shortcut is reserved by another app, SnapX will keep the previous binding.</div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('keyboard', 16)}</span>
          <div><h3>Command palette</h3><p>Search everything without leaving the keyboard.</p></div>
          <span class="shortcut-static"><kbd>${acceleratorLabel('CommandOrControl+K')}</kbd></span>
        </div>
        <div class="settings-shortcut-extra">
          <div><span>Open command palette</span><kbd>${acceleratorLabel('CommandOrControl+K')}</kbd></div>
          <div><span>Confirm selection</span><kbd>Enter</kbd></div>
          <div><span>Cancel capture / close dialog</span><kbd>Esc</kbd></div>
          <div><span>Square region</span><kbd>Shift</kbd></div>
          <div><span>Nudge selection</span><kbd>Arrow keys</kbd></div>
          <div><span>Zoom in editor</span><kbd>${isMac() ? '⌘ +' : 'Ctrl +'}</kbd></div>
        </div>
      </div>
    </section>
  `;
}

function secretRow({ name, title, description, placeholder, connected, iconName, hint }) {
  return `
    <div class="integration-card ${connected ? 'connected' : ''}" data-secret-card="${name}">
      <div class="integration-head">
        <span class="integration-icon">${icon(iconName, 18)}</span>
        <div class="integration-copy">
          <div class="integration-title"><b>${title}</b>${connected ? `<span class="pill green">${icon('check', 9)} Connected</span>` : `<span class="pill">Not connected</span>`}</div>
          <p>${description}</p>
        </div>
      </div>
      <div class="secret-input-row">
        <div class="input-icon-wrap">
          ${icon('key', 14)}
          <input class="input" type="password" placeholder="${placeholder}" data-secret-input="${name}" autocomplete="off" spellcheck="false">
        </div>
        <button class="btn btn-secondary btn-sm" data-secret-save="${name}" type="button">${icon('save', 12)} Save</button>
        ${connected ? `<button class="icon-btn" data-secret-remove="${name}" type="button" data-tip="Remove key">${icon('trash', 13)}</button>` : ''}
      </div>
      ${hint ? `<div class="integration-hint">${icon('info', 11)} ${hint}</div>` : ''}
    </div>
  `;
}

function sectionIntegrations(settings) {
  const secrets = settings.secrets || {};
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>AI & Integrations</span><h2>Connect your tools</h2><p>Keys are encrypted with your operating system's secure storage and never leave this device.</p></div>
        <span class="pill ${secrets.openaiKey ? 'green' : 'gold'}">${icon('lock', 10)} Encrypted vault</span>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('ai', 16)}</span>
          <div><h3>SnapX AI</h3><p>Optional cloud vision for OCR, summaries, code and sensitive-data detection.</p></div>
        </div>
        ${secretRow({
          name: 'openaiKey',
          title: 'OpenAI API key',
          description: 'Powers live OCR, summaries, code extraction, auto-blur detection and object-removal planning.',
          placeholder: 'sk-…',
          connected: secrets.openaiKey,
          iconName: 'sparkle',
          hint: 'Use a restricted project key with only the models you need. SnapX calls the OpenAI API directly.'
        })}
        <div class="settings-field-grid integration-options">
          <div class="field">
            <label class="field-label">Model</label>
            <select class="select" data-setting-select="ai.model">
              <option value="gpt-4o-mini" ${settings.ai?.model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o mini · fast</option>
              <option value="gpt-4o" ${settings.ai?.model === 'gpt-4o' ? 'selected' : ''}>GPT-4o · best quality</option>
              <option value="gpt-4.1-mini" ${settings.ai?.model === 'gpt-4.1-mini' ? 'selected' : ''}>GPT-4.1 mini</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Demo mode</label>
            <div class="settings-inline-box">${icon(secrets.openaiKey ? 'bolt' : 'sparkle', 13)} ${secrets.openaiKey ? 'Live analysis is on.' : 'Labeled demo previews are shown.'}</div>
          </div>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('share', 16)}</span>
          <div><h3>Sharing</h3><p>Send captures to Discord or Imgur in one click.</p></div>
        </div>
        ${secretRow({
          name: 'discordWebhook',
          title: 'Discord webhook',
          description: 'Post captures directly into a Discord channel.',
          placeholder: 'https://discord.com/api/webhooks/…',
          connected: secrets.discordWebhook,
          iconName: 'discord',
          hint: 'Channel settings → Integrations → Webhooks → New Webhook → Copy URL.'
        })}
        ${secretRow({
          name: 'imgurClientId',
          title: 'Imgur Client ID',
          description: 'Create instant public image links.',
          placeholder: 'Your Imgur Client ID',
          connected: secrets.imgurClientId,
          iconName: 'imgur',
          hint: 'Register an application at api.imgur.com/oauth2/addclient to get a Client ID.'
        })}
        <div class="integration-card">
          <div class="integration-head">
            <span class="integration-icon">${icon('drive', 18)}</span>
            <div class="integration-copy">
              <div class="integration-title"><b>Google Drive</b><span class="pill">Export-only</span></div>
              <p>Save a local copy and open Drive to upload it. Direct OAuth sync is on the roadmap.</p>
            </div>
            <button class="btn btn-secondary btn-sm" data-open-drive type="button">${icon('external', 12)} Open Drive</button>
          </div>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('cloud', 16)}</span>
          <div><h3>Cloud sync</h3><p>Optional encrypted sync across your devices.</p></div>
          <span class="pill">${icon('sparkle', 10)} Coming soon</span>
        </div>
        <div class="switch-row">
          <div class="switch-copy"><b>Sync library across devices</b><span>End-to-end encrypted. Local-first even when enabled.</span></div>
          <button class="toggle ${settings.integrations?.cloudSync ? 'on' : ''}" data-setting-toggle="integrations.cloudSync" type="button" aria-label="Cloud sync"></button>
        </div>
      </div>
    </section>
  `;
}

function sectionStorage(settings) {
  const bytes = captures().reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
  const real = state.gallery.length;
  const samples = state.samples.length;
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>Storage & Privacy</span><h2>Your local vault</h2><p>No account required. No silent uploads. Your captures live on your machine.</p></div>
        <span class="pill green">${icon('shieldCheck', 10)} Local-first</span>
      </div>

      <div class="storage-overview card">
        <div class="storage-overview-ring" style="--usage:31%"><span>31<small>%</small></span></div>
        <div class="storage-overview-copy">
          <span class="preview-side-label">SnapX Pro library</span>
          <h3>${formatBytes(bytes)} <span>across ${captures().length} captures</span></h3>
          <p>${real} saved by you · ${samples} curated samples · images, GIFs and recordings</p>
          <div class="storage-bar"><i style="width:31%"></i></div>
          <div class="storage-bar-labels"><span>31% of your 20 GB local budget</span><span>Plenty of room</span></div>
        </div>
        <div class="storage-overview-actions">
          <button class="btn btn-secondary btn-sm" data-reveal-library type="button">${icon('folderOpen', 12)} Reveal library</button>
          <button class="btn btn-secondary btn-sm" data-open-videos type="button">${icon('video', 12)} Open videos</button>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('database', 16)}</span>
          <div><h3>Library</h3><p>Where every screenshot and GIF is stored.</p></div>
        </div>
        <div class="storage-path-row">
          <span class="storage-path-icon">${icon('folder', 16)}</span>
          <div><span>Gallery folder</span><b>${escapeHtml(state.stats.path || state.info?.paths?.gallery || 'Pictures/SnapX Pro')}</b></div>
          <button class="icon-btn" data-reveal-library type="button" data-tip="Reveal folder">${icon('external', 13)}</button>
        </div>
        <div class="storage-path-row">
          <span class="storage-path-icon">${icon('video', 16)}</span>
          <div><span>Recordings folder</span><b>${escapeHtml(state.info?.paths?.recordings || 'Videos/SnapX Pro')}</b></div>
          <button class="icon-btn" data-open-videos type="button" data-tip="Open videos">${icon('external', 13)}</button>
        </div>
        <div class="storage-path-row">
          <span class="storage-path-icon">${icon('lock', 16)}</span>
          <div><span>Settings & secrets</span><b>${escapeHtml(state.info?.paths?.userData || 'AppData/SnapX Pro')}</b></div>
          <button class="icon-btn" data-open-userdata type="button" data-tip="Open settings folder">${icon('external', 13)}</button>
        </div>
      </div>

      <div class="settings-card card">
        <div class="settings-card-head">
          <span class="settings-card-icon">${icon('shieldCheck', 16)}</span>
          <div><h3>Privacy controls</h3><p>Decide exactly what stays on this device.</p></div>
        </div>
        ${toggleRow('autoSave', 'Auto-save captures', 'Save every capture to the local library.', settings.behavior?.autoSave !== false, 'behavior')}
        <div class="switch-row">
          <div class="switch-copy"><b>Hide curated samples</b><span>Remove the six sample captures from your library.</span></div>
          <button class="toggle ${settings.samplesHidden ? 'on' : ''}" data-setting-toggle="samplesHidden" type="button" aria-label="Hide samples"></button>
        </div>
        <div class="danger-zone">
          <div><b>Clear local library</b><span>Delete every user capture and thumbnail from this device. Samples are not affected.</span></div>
          <button class="btn btn-danger btn-sm" data-clear-library type="button">${icon('trash', 12)} Clear library</button>
        </div>
      </div>

      <div class="privacy-note-card card">
        <span class="privacy-note-icon">${icon('lock', 20)}</span>
        <div><b>Built privacy-first</b><p>Screen captures are processed locally. Cloud AI only runs when you explicitly connect a key and press an AI tool. Secrets are encrypted with the OS secure storage.</p></div>
      </div>
    </section>
  `;
}

function sectionAbout(ctx) {
  const info = state.info || {};
  return `
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div><span class="eyebrow"><span class="line"></span>About</span><h2>The story in a pixel</h2><p>SnapX Pro is built for people who see the details.</p></div>
        <span class="pill gold">${icon('sparkle', 10)} Version ${escapeHtml(info.version || '1.0.0')}</span>
      </div>

      <div class="about-hero card gold-edge">
        <img src="assets/app-icon.png" alt="SnapX Pro">
        <div class="about-copy">
          <span class="eyebrow"><span class="line"></span>SnapX Labs</span>
          <h2>SnapX <span class="grad">Pro</span></h2>
          <p>Capture everything. Miss nothing. A premium screenshot and recording studio built for speed, clarity and beautiful output.</p>
          <div class="about-tags"><span>Windows</span><span>macOS</span><span>Local-first</span><span>AI-ready</span></div>
        </div>
        <div class="about-actions">
          <button class="btn btn-primary" data-check-updates type="button">${icon('cloudDown', 14)} Check for updates</button>
          <button class="btn btn-secondary" data-open-github type="button">${icon('code', 14)} View on GitHub</button>
        </div>
      </div>

      <div class="about-grid">
        <div class="settings-card card">
          <div class="settings-card-head"><span class="settings-card-icon">${icon('info', 16)}</span><div><h3>Build information</h3><p>Exactly what is running under the hood.</p></div></div>
          <div class="about-info-list">
            <div><span>SnapX Pro</span><b>${escapeHtml(info.version || '1.0.0')}</b></div>
            <div><span>Electron</span><b>${escapeHtml(info.versions?.electron || window.snapx?.versions?.electron || '—')}</b></div>
            <div><span>Chromium</span><b>${escapeHtml(info.versions?.chrome || window.snapx?.versions?.chrome || '—')}</b></div>
            <div><span>Node</span><b>${escapeHtml(info.versions?.node || window.snapx?.versions?.node || '—')}</b></div>
            <div><span>Platform</span><b>${escapeHtml(info.platform || window.snapx?.platform || '—')} · ${escapeHtml(info.arch || '—')}</b></div>
            <div><span>Distribution</span><b>${info.isPackaged ? 'Packaged build' : 'Development build'}</b></div>
          </div>
        </div>
        <div class="settings-card card">
          <div class="settings-card-head"><span class="settings-card-icon">${icon('heart', 16)}</span><div><h3>Made with</h3><p>Small, sharp tools chosen with care.</p></div></div>
          <div class="made-with-grid">
            <span>${icon('bolt', 12)} Vanilla ES modules</span>
            <span>${icon('image', 12)} Electron capture</span>
            <span>${icon('sparkle', 12)} Optional OpenAI</span>
            <span>${icon('qr', 12)} jsQR</span>
            <span>${icon('gif', 12)} gifenc</span>
            <span>${icon('type', 12)} Manrope + Sora</span>
          </div>
          <p class="about-footnote">No tracking. No ads. No telemetry. Just a very fast capture studio.</p>
        </div>
      </div>

      <div class="about-links card">
        <button data-open-link="https://github.com/snapxlabs/snapx-pro" type="button">${icon('code', 14)} GitHub repository ${icon('external', 10)}</button>
        <button data-open-link="https://github.com/snapxlabs/snapx-pro/releases" type="button">${icon('download', 14)} Release notes ${icon('external', 10)}</button>
        <button data-open-link="https://github.com/snapxlabs/snapx-pro/issues" type="button">${icon('alert', 14)} Report an issue ${icon('external', 10)}</button>
        <span>© 2026 SnapX Labs · MIT License</span>
      </div>
    </section>
  `;
}

function sectionMarkup(section, settings, ctx) {
  if (section === 'capture') return sectionCapture(settings);
  if (section === 'shortcuts') return sectionShortcuts(settings);
  if (section === 'integrations') return sectionIntegrations(settings);
  if (section === 'storage') return sectionStorage(settings);
  if (section === 'about') return sectionAbout(ctx);
  return sectionGeneral(settings);
}

export function renderSettings(ctx, root, params = {}) {
  let section = params.section || 'general';
  const settings = state.settings || {};

  root.innerHTML = `
    <div class="page settings-page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span>Settings<span class="line"></span>SnapX Pro</div>
          <h1 class="page-title">Tune the <span class="grad">perfect workspace.</span></h1>
          <p class="page-sub">Every preference is saved instantly. Nothing here breaks your flow.</p>
        </div>
        <div class="page-actions">
          <span class="pill green">${icon('check', 10)} All changes saved</span>
          <button class="btn btn-secondary" data-reset-settings type="button">${icon('rotate', 14)} Restore defaults</button>
        </div>
      </div>

      <div class="settings-layout">
        <aside class="settings-nav card">
          ${SECTIONS.map((entry) => `
            <button class="settings-nav-item ${entry.id === section ? 'active' : ''}" data-settings-section="${entry.id}" type="button">
              <span class="settings-nav-icon">${icon(entry.icon, 15)}</span>
              <span><b>${entry.name}</b><small>${entry.hint}</small></span>
              ${icon('chevronRight', 11)}
            </button>
          `).join('')}
          <div class="settings-nav-foot">
            <span class="status-dot"></span>
            <div><b>Capture engine</b><span>Online and ready</span></div>
          </div>
        </aside>
        <div class="settings-content" data-settings-content>
          ${sectionMarkup(section, settings, ctx)}
        </div>
      </div>
    </div>
  `;

  const save = (patch, options = {}) => ctx.saveSettings(patch, { silent: true, ...options });

  root.querySelectorAll('[data-settings-section]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate('settings', { section: button.dataset.settingsSection }));
  });
  root.querySelectorAll('[data-nav-themes]').forEach((button) => button.addEventListener('click', () => ctx.navigate('themes')));

  root.querySelectorAll('[data-setting-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const [group, key] = toggle.dataset.settingToggle.split('.');
      const next = !toggle.classList.contains('on');
      toggle.classList.toggle('on', next);
      save({ [group]: { [key]: next } });
      toast('Preference saved', { type: 'success', duration: 1600 });
    });
  });

  root.querySelectorAll('[data-setting-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const [group, key] = select.dataset.settingSelect.split('.');
      save({ [group]: { [key]: select.value } });
      toast('Preference saved', { type: 'success', duration: 1600 });
    });
  });

  root.querySelectorAll('[data-default-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-default-mode]').forEach((entry) => entry.classList.toggle('active', entry === button));
      save({ capture: { mode: button.dataset.defaultMode } });
    });
  });

  root.querySelectorAll('[data-default-delay]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-default-delay]').forEach((entry) => entry.classList.toggle('active', entry === button));
      save({ capture: { delay: Number(button.dataset.defaultDelay) } });
    });
  });

  const qualitySlider = root.querySelector('[data-quality-slider]');
  qualitySlider?.addEventListener('input', () => {
    root.querySelector('[data-quality-value]').textContent = `${qualitySlider.value}%`;
  });
  qualitySlider?.addEventListener('change', () => save({ capture: { quality: Number(qualitySlider.value) } }));

  root.querySelector('[data-toolbar-toggle]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const next = !button.classList.contains('on');
    button.classList.toggle('on', next);
    const visible = await window.snapx.toolbar.setVisible(next).catch(() => next);
    state.toolbarVisible = Boolean(visible);
    await ctx.refreshSettings();
    toast(visible ? 'Floating toolbar is visible' : 'Floating toolbar hidden', { type: 'success' });
  });

  root.querySelector('[data-test-capture]')?.addEventListener('click', () => ctx.runCaptureMode('region'));

  root.querySelectorAll('[data-shortcut-key]').forEach((recorder) => {
    recorder.addEventListener('click', () => {
      if (recorder.classList.contains('listening')) return;
      recorder.classList.add('listening');
      const key = recorder.dataset.shortcutKey;
      const keyEl = recorder.querySelector('.shortcut-keys');
      keyEl.innerHTML = '<span class="shortcut-listening">Press keys…</span>';
      const handler = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', handler, true);
          recorder.classList.remove('listening');
          keyEl.innerHTML = String(state.settings.shortcuts?.[key] || '').split('+').map((part) => `<kbd>${escapeHtml(acceleratorLabel(part))}</kbd>`).join('');
          return;
        }
        const combo = captureKeyCombo(event);
        if (!combo || !combo.includes('+')) return;
        document.removeEventListener('keydown', handler, true);
        recorder.classList.remove('listening');
        keyEl.innerHTML = combo.split('+').map((part) => `<kbd>${escapeHtml(acceleratorLabel(part))}</kbd>`).join('');
        save({ shortcuts: { [key]: combo } });
        toast('Shortcut updated', { type: 'success', detail: acceleratorLabel(combo) });
      };
      document.addEventListener('keydown', handler, true);
    });
  });

  root.querySelector('[data-reset-shortcuts]')?.addEventListener('click', async () => {
    const defaults = {
      region: 'CommandOrControl+Shift+1',
      full: 'CommandOrControl+Shift+2',
      window: 'CommandOrControl+Shift+3',
      toolbar: 'CommandOrControl+Shift+4'
    };
    await save({ shortcuts: defaults });
    toast('Shortcuts reset to defaults', { type: 'success' });
    ctx.navigate('settings', { section: 'shortcuts' });
  });

  root.querySelectorAll('[data-secret-save]').forEach((button) => {
    button.addEventListener('click', async () => {
      const name = button.dataset.secretSave;
      const input = root.querySelector(`[data-secret-input="${name}"]`);
      const value = input?.value.trim();
      if (!value) {
        toast('Paste a value first', { type: 'info' });
        input?.focus();
        return;
      }
      setBusy(button, true, 'Saving…');
      try {
        await window.snapx.settings.setSecret(name, value);
        input.value = '';
        await ctx.refreshSettings();
        toast(`${name === 'openaiKey' ? 'OpenAI key' : name === 'discordWebhook' ? 'Discord webhook' : 'Imgur Client ID'} saved securely`, { type: 'success' });
        ctx.navigate('settings', { section: 'integrations' });
      } catch (error) {
        toast(error.message || 'Could not save secret', { type: 'error' });
      } finally {
        setBusy(button, false);
      }
    });
  });

  root.querySelectorAll('[data-secret-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      const name = button.dataset.secretRemove;
      const yes = await confirmDialog({ title: 'Remove this connection?', message: 'SnapX will no longer be able to use this credential.', confirmLabel: 'Remove', danger: true });
      if (!yes) return;
      try {
        await window.snapx.settings.setSecret(name, '');
        await ctx.refreshSettings();
        toast('Credential removed');
        ctx.navigate('settings', { section: 'integrations' });
      } catch (error) {
        toast(error.message || 'Could not remove credential', { type: 'error' });
      }
    });
  });

  root.querySelector('[data-open-drive]')?.addEventListener('click', () => window.snapx.app.openExternal('https://drive.google.com/drive/my-drive'));
  root.querySelectorAll('[data-reveal-library]').forEach((button) => button.addEventListener('click', () => {
    const path = state.stats.path || state.info?.paths?.gallery;
    if (path) window.snapx.app.openPath(path);
  }));
  root.querySelectorAll('[data-open-videos]').forEach((button) => button.addEventListener('click', () => {
    if (state.info?.paths?.recordings) window.snapx.app.openPath(state.info.paths.recordings);
  }));
  root.querySelector('[data-open-userdata]')?.addEventListener('click', () => {
    if (state.info?.paths?.userData) window.snapx.app.openPath(state.info.paths.userData);
  });

  root.querySelector('[data-clear-library]')?.addEventListener('click', async () => {
    if (!state.gallery.length) {
      toast('Your library is already empty', { type: 'info' });
      return;
    }
    const yes = await confirmDialog({
      title: 'Clear your local library?',
      message: `Delete all ${state.gallery.length} user captures and thumbnails. This cannot be undone. The six curated samples stay.`,
      confirmLabel: 'Clear library',
      danger: true
    });
    if (!yes) return;
    try {
      const count = await window.snapx.gallery.clear();
      await ctx.refreshGallery({ silent: true });
      toast(`Cleared ${count} capture${count === 1 ? '' : 's'}`, { type: 'success' });
      ctx.navigate('settings', { section: 'storage' });
    } catch (error) {
      toast(error.message || 'Could not clear library', { type: 'error' });
    }
  });

  root.querySelector('[data-edit-profile]')?.addEventListener('click', () => {
    const current = state.settings?.profile?.name || 'Maya Chen';
    const modal = openModal({
      title: 'Edit workspace profile',
      subtitle: 'This name is only stored locally.',
      size: 'sm',
      content: `<div class="field"><label class="field-label">Display name</label><input class="input" data-profile-name value="${escapeHtml(current)}" maxlength="40"></div>`,
      footer: `<button class="btn btn-secondary" data-cancel-profile type="button">Cancel</button><button class="btn btn-primary" data-save-profile type="button">Save profile</button>`
    });
    modal.modal.querySelector('[data-cancel-profile]').addEventListener('click', () => modal.close());
    modal.modal.querySelector('[data-save-profile]').addEventListener('click', async () => {
      const name = modal.modal.querySelector('[data-profile-name]').value.trim() || 'Maya Chen';
      await save({ profile: { name } });
      modal.close();
      toast('Profile updated', { type: 'success' });
      ctx.navigate('settings', { section: 'general' });
    });
  });

  root.querySelector('[data-reset-settings]')?.addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Restore default settings?', message: 'Themes, capture options, shortcuts and behavior return to factory defaults. Your captures and keys are not deleted.', confirmLabel: 'Restore defaults' });
    if (!yes) return;
    const defaults = {
      theme: 'royal',
      capture: { mode: 'region', delay: 0, displayId: null, includeCursor: true, copyAfterCapture: true, openEditor: false, sound: true, format: 'png', quality: 95 },
      behavior: { launchAtLogin: false, minimizeToTray: true, closeToTray: false, autoSave: true, notify: true },
      ui: { reduceMotion: false, acrylic: true, cornerRadius: 22, density: 'comfortable' },
      shortcuts: { region: 'CommandOrControl+Shift+1', full: 'CommandOrControl+Shift+2', window: 'CommandOrControl+Shift+3', toolbar: 'CommandOrControl+Shift+4' },
      samplesHidden: false,
      floatingToolbar: false
    };
    await save(defaults);
    toast('Settings restored to defaults', { type: 'success' });
    ctx.navigate('settings', { section: 'general' });
  });

  root.querySelectorAll('[data-open-link]').forEach((button) => {
    button.addEventListener('click', () => window.snapx.app.openExternal(button.dataset.openLink));
  });
  root.querySelector('[data-open-github]')?.addEventListener('click', () => window.snapx.app.openExternal('https://github.com/snapxlabs/snapx-pro'));
  root.querySelector('[data-check-updates]')?.addEventListener('click', () => toast('You are on the latest build', { type: 'success', detail: 'SnapX Pro 1.0.0 · up to date' }));
}
