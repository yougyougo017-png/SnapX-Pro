import { icon } from '../icons.js';
import {
  escapeHtml,
  formatBytes,
  timeAgo,
  prettySource,
  acceleratorLabel,
  toast
} from '../ui.js';
import {
  state,
  captures,
  totalBytes
} from '../state.js';
import { QUICK_MODES } from '../data.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function sparkPath(values, width = 74, height = 26) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `${line} L${width} ${height} L0 ${height} Z`;
}

function statCard({ label, value, unit, delta, iconName, values, className = '', right = '' }) {
  return `
    <article class="stat-card ${className}">
      <div class="stat-top">
        <span class="stat-label">${icon(iconName, 12)} ${label}</span>
        ${delta ? `<span class="stat-delta ${delta.startsWith('−') ? 'down' : ''}">${delta}</span>` : ''}
      </div>
      <div class="stat-value">
        <div><b>${value}</b>${unit ? ` <small>${unit}</small>` : ''}</div>
        ${right || `
          <svg class="sparkline" viewBox="0 0 74 26" aria-hidden="true">
            <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
            <path class="fill" d="${sparkPath(values)}"/>
            <path d="${sparkPath(values).replace(/ L74 26 L0 26 Z$/, '')}"/>
          </svg>
        `}
      </div>
    </article>
  `;
}

function recentItemMarkup(capture) {
  return `
    <article class="recent-item" data-open-capture="${capture.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(capture.title)}">
      <div class="recent-image">
        <img src="${escapeHtml(capture.thumbnailUrl || capture.url || capture.src)}" alt="${escapeHtml(capture.title)}" loading="lazy">
        <span class="badge ${capture.demo ? 'blue' : 'accent'}">${capture.demo ? 'Sample' : prettySource(capture.source)}</span>
        <div class="recent-actions">
          <button class="icon-btn" data-recent-copy="${capture.id}" type="button" data-tip="Copy">${icon('copy', 12)}</button>
          <button class="icon-btn" data-recent-edit="${capture.id}" type="button" data-tip="Edit">${icon('editor', 12)}</button>
        </div>
      </div>
      <div class="recent-info">
        <b>${escapeHtml(capture.title)}</b>
        <span>${icon(capture.demo ? 'sparkle' : 'clock', 10)} ${capture.demo ? 'Curated sample' : timeAgo(capture.createdAt)}<i class="dot-sep"></i>${capture.width || 0} × ${capture.height || 0}</span>
      </div>
    </article>
  `;
}

export function renderDashboard(ctx) {
  const list = captures();
  const total = list.length;
  const week = list.filter((item) => Date.now() - new Date(item.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000).length;
  const bytes = totalBytes();
  const realCount = state.gallery.length;
  const sampleCount = state.samples.length;
  const minutesSaved = total * 3 + 12;
  const recent = list.slice(0, 4);
  const latest = state.gallery[0] || state.samples[0];
  const aiCapture = state.gallery.find((item) => item.source === 'window') || state.samples[2] || state.samples[0];
  const user = 'Maya';
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const permission = state.screenPermission;

  ctx.root.innerHTML = `
    <div class="page dashboard-page">
      <div class="page-head dash-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span>${dateLabel}<span class="line"></span></div>
          <h1 class="page-title">${greeting()}, ${user}. <span class="grad">Ready to capture?</span></h1>
          <p class="page-sub">Your workspace is warm, your shortcuts are live, and the perfect screenshot is one gesture away.</p>
        </div>
        <div class="page-actions">
          <div class="dash-head-meta"><span class="status-dot"></span> Capture engine ready</div>
          <button class="btn btn-secondary" data-action="open-import" type="button">${icon('imagePlus', 14)} Import</button>
          <button class="btn btn-primary" data-mode="region" type="button">${icon('camera', 15)} Capture now <kbd>${acceleratorLabel(state.settings?.shortcuts?.region || 'CommandOrControl+Shift+1')}</kbd></button>
        </div>
      </div>

      <section class="hero card gold-edge">
        <div class="hero-copy">
          <div class="hero-eyebrow">
            <span class="spark">${icon('sparkle', 12)}</span>
            SnapX Pro
            <span class="version">v${escapeHtml(state.info?.version || '1.0.0')}</span>
            <span class="pill gold" style="margin-left:2px">${icon('bolt', 10)} Instant</span>
          </div>
          <h1>Capture<br><span class="hero-gradient">everything.</span><br>Miss nothing.</h1>
          <p class="hero-lead">Screenshots, scrolling pages, recordings and AI insight — in one impossibly fast workspace. <b>Every pixel stays yours.</b></p>
          <div class="hero-cta">
            <button class="btn btn-primary" data-mode="region" type="button">${icon('capture', 16)} Capture a region <kbd>${acceleratorLabel(state.settings?.shortcuts?.region || 'CommandOrControl+Shift+1')}</kbd></button>
            <button class="btn btn-secondary" data-nav="ai" type="button">${icon('sparkle', 15)} Open AI Studio</button>
          </div>
          <div class="hero-meta">
            <span>${icon('shieldCheck', 12)} Local-first vault</span>
            <span>${icon('bolt', 12)} 18 ms capture</span>
            <span>${icon('monitors', 12)} Multi-monitor ready</span>
            <span>${icon('cloud', 12)} Optional sync</span>
          </div>
        </div>
        <div class="hero-visual">
          <span class="hero-glow"></span>
          <span class="hero-rings"></span>
          <div class="shot-stack">
            <div class="shot-card">
              <div class="shot-browser">
                <span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span>
                <span class="shot-url">snapx://studio/aurora</span>
              </div>
              <div class="shot-img-wrap">
                <img src="snapx://sample/aurora-analytics.svg" alt="Aurora analytics preview">
                <span class="scan-beam"></span>
              </div>
            </div>
            <div class="float-chip chip-one">
              <span class="chip-icon">${icon('scanText', 13)}</span>
              <span class="chip-copy"><b>AI OCR complete</b><span>482 words · 99.2%</span></span>
            </div>
            <div class="float-chip chip-two">
              <span class="chip-icon">${icon('cloudCheck', 13)}</span>
              <span class="chip-copy"><b>Saved locally</b><span>No upload · just now</span></span>
            </div>
            <div class="float-chip chip-three">
              <span class="chip-icon">${icon('sparkle', 12)}</span>
              <span class="chip-copy"><b>4K READY</b><span>Lossless PNG</span></span>
            </div>
            <div class="shot-toolbar">
              <span>${icon('rectangle', 13)}</span>
              <span>${icon('pen', 13)}</span>
              <span>${icon('arrow', 13)}</span>
              <span>${icon('type', 13)}</span>
              <span>${icon('highlighter', 13)}</span>
              <span class="tool-div"></span>
              <span>${icon('scanText', 13)}</span>
              <span>${icon('copy', 13)}</span>
            </div>
          </div>
        </div>
      </section>

      ${permission !== 'granted' ? `
        <div class="dash-permission card">
          <span class="permission-icon">${icon('monitor', 17)}</span>
          <div><b>Screen Recording permission is required</b><span>Grant SnapX access in System Settings to unlock capture.</span></div>
          <button class="btn btn-sm btn-primary" data-open-permission type="button">Open settings</button>
        </div>
      ` : ''}

      <section class="quick-section">
        <div class="section-head">
          <div class="section-title">${icon('bolt', 16)} Quick capture</div>
          <span class="section-hint">${realCount ? `${realCount} in your vault · ${sampleCount} curated samples` : `${sampleCount} curated samples · ready for your first capture`}</span>
        </div>
        <div class="quick-grid">
          ${QUICK_MODES.map((mode, index) => `
            <button class="quick-mode ${index === 0 ? 'active' : ''}" data-mode="${mode.id}" type="button">
              ${mode.badge ? `<span class="badge ${mode.badge === 'NEW' ? 'accent' : 'blue'}">${mode.badge}</span>` : ''}
              <span class="quick-icon">${icon(mode.icon, 18)}</span>
              <span class="quick-copy"><b>${mode.name}</b><span>${mode.description}</span></span>
              ${mode.shortcut ? `<span class="quick-shortcut">${mode.shortcut}</span>` : `<span class="quick-shortcut">${mode.id === 'delay' ? 'TIMER' : mode.id === 'scroll' ? 'BETA' : 'PRO'}</span>`}
            </button>
          `).join('')}
        </div>
      </section>

      <section class="stats-grid">
        ${statCard({ label: 'Total captures', value: total, unit: 'items', delta: '+12.4%', iconName: 'gallery', values: [2, 4, 3, 6, 5, 8, 7, 9] })}
        ${statCard({ label: 'This week', value: week, unit: 'new', delta: '+4', iconName: 'sparkle', values: [1, 3, 2, 4, 3, 6, 5, 7], className: 'blue' })}
        ${statCard({ label: 'Local storage', value: formatBytes(bytes).split(' ')[0], unit: formatBytes(bytes).split(' ')[1], iconName: 'hardDrive', className: 'soft', right: `<div class="storage-ring" style="--usage:100%" title="Every capture stays on this device"><b>${icon('shieldCheck', 13)}</b></div>` })}
        ${statCard({ label: 'Time saved', value: `${Math.floor(minutesSaved / 60)}h ${minutesSaved % 60}m`, iconName: 'timer', delta: 'AI assisted', values: [2, 2, 4, 4, 5, 6, 6, 7], className: 'green' })}
      </section>

      <div class="dash-grid">
        <section class="recent-card card">
          <div class="recent-head">
            <div class="section-title">${icon('history', 16)} Recent captures</div>
            <button class="section-link" data-nav="gallery" type="button">Open library ${icon('arrowRight', 13)}</button>
          </div>
          <div class="recent-grid">
            ${recent.map(recentItemMarkup).join('')}
          </div>
        </section>

        <aside class="dash-side">
          <section class="ai-spotlight card">
            <div class="ai-head">
              <div>
                <div class="ai-title">${icon('sparkle', 16)} SnapX AI</div>
                <div class="ai-sub">Turn any screenshot into words, code, colors and clean redactions.</div>
              </div>
              <span class="ai-orb">${icon('wand', 15)}</span>
            </div>
            <button class="ai-drop" data-nav="ai" type="button">
              <span class="scan-beam"></span>
              <span class="drop-icon">${icon('imagePlus', 15)}</span>
              <b>Drop a capture to analyze</b>
              <span>OCR · Summary · Auto Blur · Code</span>
            </button>
            <div class="ai-actions">
              <button class="ai-action" data-ai-quick="ocr" type="button">${icon('scanText', 12)} OCR</button>
              <button class="ai-action" data-ai-quick="blur" type="button">${icon('shield', 12)} Auto Blur</button>
              <button class="ai-action" data-ai-quick="summary" type="button">${icon('sparkle', 12)} Summarize</button>
            </div>
            <div class="ai-footer">
              <span class="mini-note">${icon('lock', 11)} ${state.settings?.secrets?.openaiKey ? 'Live OpenAI connected' : 'Demo mode · add your key'}</span>
              <button class="ai-open" data-nav="ai" type="button">Open studio ${icon('arrowRight', 12)}</button>
            </div>
          </section>

          <section class="timeline-card card">
            <div class="timeline-head">
              <h3>Today</h3>
              <span class="pill">${icon('bolt', 10)} Live</span>
            </div>
            <div class="timeline-list">
              <div class="timeline-item">
                <span class="timeline-icon">${icon('camera', 9)}</span>
                <div class="timeline-copy"><b>Workspace ready</b><span>Capture engine warmed up</span></div>
                <span class="timeline-time">now</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-icon">${icon('sparkle', 9)}</span>
                <div class="timeline-copy"><b>AI Studio available</b><span>${state.settings?.secrets?.openaiKey ? 'OpenAI connected' : 'Demo previews ready'}</span></div>
                <span class="timeline-time">now</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-icon">${icon('cloudCheck', 9)}</span>
                <div class="timeline-copy"><b>Vault secured</b><span>${realCount ? `${realCount} captures on device` : 'All data stays local'}</span></div>
                <span class="timeline-time">now</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-icon">${icon('sparkle', 9)}</span>
                <div class="timeline-copy"><b>${escapeHtml(latest?.title || 'Sample library loaded')}</b><span>${latest?.demo ? 'Curated sample capture' : 'Recently added to library'}</span></div>
                <span class="timeline-time">${latest ? timeAgo(latest.createdAt) : 'now'}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  ctx.root.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => ctx.runCaptureMode(button.dataset.mode));
  });
  ctx.root.querySelectorAll('[data-open-capture]').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('[data-recent-copy]')) {
        const capture = captures().find((entry) => entry.id === event.target.closest('[data-recent-copy]').dataset.recentCopy);
        if (capture) ctx.copyCapture(capture);
        return;
      }
      if (event.target.closest('[data-recent-edit]')) {
        const capture = captures().find((entry) => entry.id === event.target.closest('[data-recent-edit]').dataset.recentEdit);
        if (capture) ctx.openEditor(capture);
        return;
      }
      const capture = captures().find((entry) => entry.id === item.dataset.openCapture);
      if (capture) ctx.openPreview(capture);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const capture = captures().find((entry) => entry.id === item.dataset.openCapture);
        if (capture) ctx.openPreview(capture);
      }
    });
  });
  ctx.root.querySelectorAll('[data-ai-quick]').forEach((button) => {
    button.addEventListener('click', () => {
      state.aiCapture = aiCapture?.id;
      ctx.navigate('ai', { captureId: aiCapture?.id, action: button.dataset.aiQuick });
    });
  });
  ctx.root.querySelectorAll('[data-open-permission]').forEach((button) => {
    button.addEventListener('click', () => ctx.openScreenPermission());
  });
  ctx.root.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate(button.dataset.nav));
  });
  const importBtn = ctx.root.querySelector('[data-action="open-import"]');
  importBtn?.addEventListener('click', () => ctx.importImage('editor'));
}
