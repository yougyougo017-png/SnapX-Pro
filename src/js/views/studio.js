import { icon } from '../icons.js';
import {
  escapeHtml,
  openModal,
  toast,
  copyText,
  formatBytes,
  prettySource,
  timeAgo,
  urlToDataUrl,
  imageToPngDataUrl,
  loadImage,
  samplePaletteFromImage,
  setBusy
} from '../ui.js';
import { state, captures, getCapture } from '../state.js';
import { AI_TOOLS, DEMO_AI_RESULTS } from '../data.js';

const LOCAL_TOOLS = new Set(['colors', 'upscale', 'qr']);
const RESULT_TITLES = {
  ocr: 'Extracted text',
  blur: 'Sensitive regions',
  summary: 'AI summary',
  code: 'Detected code',
  colors: 'Color palette',
  upscale: 'Smart upscale',
  qr: 'QR scanner',
  remove: 'Object removal'
};

let aiHistory = [];

function toolMeta(id) {
  return AI_TOOLS.find((tool) => tool.id === id) || AI_TOOLS[0];
}

function getSelectedCapture(captureId) {
  return getCapture(captureId) || state.samples[0];
}

function captureImage(capture) {
  return capture.dataUrl || capture.url || capture.src;
}

async function captureDataUrl(capture, maxWidth = 1600) {
  if (capture.dataUrl) {
    if (maxWidth && capture.dataUrl.startsWith('data:image/png')) return imageToPngDataUrl(capture.dataUrl, maxWidth);
    return capture.dataUrl;
  }
  return imageToPngDataUrl(captureImage(capture), maxWidth);
}

function demoBanner(action) {
  return `
    <div class="ai-demo-banner">
      ${icon('sparkle', 14)}
      <div><b>Demo preview</b><span>This is a labeled sample result, not generated from your selected capture. Connect an OpenAI key for live analysis.</span></div>
      <button class="btn btn-sm btn-secondary" data-ai-connect type="button">Connect key</button>
    </div>
  `;
}

function historyMarkup() {
  if (!aiHistory.length) return '';
  return `
    <div class="ai-history">
      <span class="ai-history-heading">Recent AI runs</span>
      ${aiHistory.slice(0, 4).map((entry) => `
        <button class="ai-history-item" data-history-action="${entry.action}" data-history-capture="${entry.captureId}" type="button">
          <span class="ai-history-icon">${icon(toolMeta(entry.action).icon, 13)}</span>
          <span class="ai-history-label"><b>${escapeHtml(RESULT_TITLES[entry.action] || entry.action)}</b><small>${escapeHtml(entry.title)} · ${timeAgo(entry.at)}</small></span>
          ${entry.live ? `<span class="badge green">Live</span>` : `<span class="badge">Demo</span>`}
        </button>
      `).join('')}
    </div>
  `;
}

function emptyResult() {
  return `
    <div class="ai-empty">
      <div class="ai-empty-orb">
        <span class="ai-empty-ring"></span>
        ${icon('sparkle', 26)}
      </div>
      <h3>Your screenshot, understood.</h3>
      <p>Choose a tool and SnapX will read the pixels, find the details, and turn them into something you can use.</p>
      <div class="ai-suggestion-grid">
        <button data-suggest="ocr" type="button">${icon('scanText', 14)} <span><b>Extract text</b><small>Copy every word</small></span></button>
        <button data-suggest="summary" type="button">${icon('sparkle', 14)} <span><b>Summarize</b><small>Get the gist instantly</small></span></button>
        <button data-suggest="blur" type="button">${icon('shield', 14)} <span><b>Auto Blur</b><small>Hide sensitive info</small></span></button>
        <button data-suggest="colors" type="button">${icon('themes', 14)} <span><b>Color palette</b><small>Real local extraction</small></span></button>
      </div>
      ${historyMarkup()}
      <div class="ai-privacy-note">${icon('lock', 12)} Local tools run on-device. Cloud AI is optional and only runs when you connect a key.</div>
    </div>
  `;
}

function resultHeader(action, live, capture) {
  return `
    <div class="ai-result-head">
      <div class="ai-result-title">
        <span class="ai-result-icon">${icon(toolMeta(action).icon, 15)}</span>
        <div><b>${escapeHtml(RESULT_TITLES[action] || toolMeta(action).name)}</b><span>${escapeHtml(capture.title)} · ${live ? 'live result' : 'demo result'}</span></div>
      </div>
      <span class="pill ${live ? 'green' : 'gold'}">${icon(live ? 'bolt' : 'sparkle', 10)} ${live ? 'Live' : 'Demo'}</span>
    </div>
  `;
}

function renderOcrResult(text, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-ocr-output" data-ocr-text>${escapeHtml(text)}</div>
      <div class="ai-result-actions">
        <button class="btn btn-primary" data-copy-ocr type="button">${icon('copy', 14)} Copy all text</button>
        <button class="btn btn-secondary" data-replace-capture-title type="button">${icon('type', 14)} Use first line as title</button>
      </div>
      <div class="ai-result-foot">${icon(live ? 'bolt' : 'info', 11)} ${live ? 'Extracted by OpenAI vision.' : 'Sample text for demonstration only.'}</div>
    </div>
  `;
}

function renderSummaryResult(data, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-summary-title">${escapeHtml(data.title || 'Capture summary')}</div>
      <p class="ai-summary-text">${escapeHtml(data.summary || '')}</p>
      ${Array.isArray(data.bullets) && data.bullets.length ? `
        <ul class="ai-bullet-list">
          ${data.bullets.map((bullet) => `<li>${icon('check', 11)}<span>${escapeHtml(bullet)}</span></li>`).join('')}
        </ul>
      ` : ''}
      ${Array.isArray(data.tags) && data.tags.length ? `
        <div class="ai-suggested-tags">
          <span>Suggested tags</span>
          ${data.tags.map((tag) => `<button class="chip" data-apply-tag="${escapeHtml(tag)}" type="button">#${escapeHtml(tag)}</button>`).join('')}
        </div>
      ` : ''}
      <div class="ai-result-actions">
        <button class="btn btn-primary" data-apply-summary type="button">${icon('check', 14)} Apply to capture</button>
        <button class="btn btn-secondary" data-copy-summary type="button">${icon('copy', 14)} Copy summary</button>
      </div>
      <div class="ai-result-foot">${icon(live ? 'bolt' : 'info', 11)} ${live ? 'Analyzed live with OpenAI vision.' : 'Sample analysis for demonstration only.'}</div>
    </div>
  `;
}

function renderCodeResult(data, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-code-meta"><span>${icon('fileCode', 12)} ${escapeHtml(data.language || 'Detected language')}</span><button data-copy-code type="button">${icon('copy', 11)} Copy code</button></div>
      <pre class="ai-code-block"><code>${escapeHtml(data.code || '')}</code></pre>
      ${data.explanation ? `<div class="ai-code-explain"><span>${icon('sparkle', 12)} What it does</span><p>${escapeHtml(data.explanation)}</p></div>` : ''}
      <div class="ai-result-foot">${icon(live ? 'bolt' : 'info', 11)} ${live ? 'Code extracted live.' : 'Sample code for demonstration only.'}</div>
    </div>
  `;
}

function renderBlurResult(data, live) {
  const regions = data.regions || [];
  return `
    <div class="ai-result-body">
      <p class="ai-blur-lead">${regions.length ? `${regions.length} sensitive region${regions.length === 1 ? '' : 's'} found. Review the highlighted areas, then apply pixelation.` : 'No sensitive regions were detected in this capture.'}</p>
      <div class="ai-region-list">
        ${regions.map((region, index) => `
          <div class="ai-region-row">
            <span class="ai-region-index">${index + 1}</span>
            <span><b>${escapeHtml(region.label || 'Sensitive region')}</b><small>${Math.round((region.confidence || 0) * 100)}% confidence</small></span>
            <span class="ai-region-coords">${Math.round((region.x || 0) * 100)}%, ${Math.round((region.y || 0) * 100)}%</span>
          </div>
        `).join('') || `<div class="ai-no-regions">${icon('shieldCheck', 16)} Looks clean. Nothing to hide.</div>`}
      </div>
      ${regions.length ? `<div class="ai-result-actions">
        <button class="btn btn-primary" data-apply-blur type="button">${icon('shield', 14)} Apply pixel blur</button>
        <button class="btn btn-secondary" data-copy-regions type="button">${icon('copy', 14)} Copy region data</button>
      </div>` : ''}
      <div class="ai-result-foot">${icon(live ? 'bolt' : 'info', 11)} ${live ? 'Regions found live. Blur is applied locally.' : 'Sample regions for demonstration. Blur is applied locally.'}</div>
    </div>
  `;
}

function renderColorsResult(palette, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-palette">
        ${palette.map((color) => `
          <button class="ai-palette-swatch" data-copy-color="${escapeHtml(color.hex)}" type="button" style="--swatch:${escapeHtml(color.hex)}">
            <span class="swatch-chip" style="background:${escapeHtml(color.hex)}"></span>
            <span><b>${escapeHtml(color.hex)}</b><small>${escapeHtml(color.name)}${color.share ? ` · ${color.share}%` : ''}</small></span>
            ${icon('copy', 11)}
          </button>
        `).join('')}
      </div>
      <div class="ai-result-actions">
        <button class="btn btn-primary" data-copy-palette type="button">${icon('copy', 14)} Copy palette CSS</button>
        <button class="btn btn-secondary" data-save-palette type="button">${icon('download', 14)} Save as image</button>
      </div>
      <div class="ai-result-foot">${icon('bolt', 11)} Extracted locally from the actual pixels. No cloud needed.</div>
    </div>
  `;
}

function renderUpscaleResult(data, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-upscale-preview">
        <img src="${data.dataUrl}" alt="Upscaled capture">
        <span class="ai-upscale-badge">${icon('upscale', 12)} ${data.width} × ${data.height}</span>
      </div>
      <div class="ai-result-meta-grid">
        <span><b>Scale</b>2×</span>
        <span><b>Filter</b>High quality</span>
        <span><b>Output</b>PNG</span>
        <span><b>Size</b>${formatBytes(Math.round(data.dataUrl.length * 0.75))}</span>
      </div>
      <div class="ai-result-actions">
        <button class="btn btn-primary" data-save-upscale type="button">${icon('save', 14)} Save 2× to library</button>
        <button class="btn btn-secondary" data-copy-upscale type="button">${icon('copy', 14)} Copy image</button>
      </div>
      <div class="ai-result-foot">${icon('bolt', 11)} Upscaled locally with high-quality resampling.</div>
    </div>
  `;
}

function renderQrResult(data, live) {
  return `
    <div class="ai-result-body">
      ${data.found ? `
        <div class="ai-qr-result">
          <span class="ai-qr-icon">${icon('qr', 22)}</span>
          <div><b>QR code detected</b><span>${escapeHtml(data.data)}</span></div>
        </div>
        <div class="ai-result-actions">
          <button class="btn btn-primary" data-copy-qr type="button">${icon('copy', 14)} Copy contents</button>
          ${/^https?:\/\//i.test(data.data) ? `<button class="btn btn-secondary" data-open-qr type="button">${icon('external', 14)} Open link</button>` : ''}
        </div>
      ` : `
        <div class="ai-no-regions">${icon('qr', 18)} No QR code found in this capture. Try a sharper screenshot with the code fully visible.</div>
      `}
      <div class="ai-result-foot">${icon('bolt', 11)} Scanned locally with jsQR. The image never leaves your device.</div>
    </div>
  `;
}

function renderRemoveResult(data, live) {
  return `
    <div class="ai-result-body">
      <div class="ai-remove-card">
        <span class="ai-remove-icon">${icon('wand', 20)}</span>
        <div>
          <b>${escapeHtml(data.object || 'Detected object')}</b>
          <p>${escapeHtml(data.description || 'SnapX AI would rebuild the background behind this object.')}</p>
          ${data.fill ? `<span class="ai-remove-fill">Fill: ${escapeHtml(data.fill)}</span>` : ''}
        </div>
      </div>
      <div class="ai-result-actions">
        <button class="btn btn-primary" data-remove-preview type="button">${icon('wand', 14)} Preview removal</button>
        <button class="btn btn-secondary" data-copy-remove type="button">${icon('copy', 14)} Copy plan</button>
      </div>
      <div class="ai-result-foot">${icon('info', 11)} ${live ? 'Removal plan generated live. Full generative fill is coming in a future build.' : 'Sample plan for demonstration. Full generative fill is coming in a future build.'}</div>
    </div>
  `;
}

function renderError(message) {
  return `
    <div class="ai-result-body">
      <div class="notice notice-error">${icon('alert', 15)} ${escapeHtml(message)}</div>
      <div class="ai-result-actions">
        <button class="btn btn-secondary" data-ai-retry type="button">${icon('rotate', 14)} Try again</button>
        <button class="btn btn-primary" data-ai-connect type="button">${icon('key', 14)} Connect OpenAI</button>
      </div>
    </div>
  `;
}

function renderLoading(action) {
  return `
    <div class="ai-loading">
      <div class="ai-loading-orb"><span class="spinner"></span></div>
      <b>${escapeHtml(toolMeta(action).action || 'Analyzing capture')}</b>
      <span>${LOCAL_TOOLS.has(action) ? 'Running locally…' : 'Reading pixels, structure and context…'}</span>
      <div class="ai-loading-steps">
        <span class="done">${icon('check', 9)} Decode image</span>
        <span class="${action ? 'active' : ''}">${icon('sparkle', 9)} ${LOCAL_TOOLS.has(action) ? 'Analyze pixels' : 'Vision model'}</span>
        <span>${icon('type', 9)} Compose result</span>
      </div>
    </div>
  `;
}

function paletteCss(palette) {
  return `:root {\n${palette.map((color, index) => `  --snapx-color-${index + 1}: ${color.hex};`).join('\n')}\n}`;
}

export function renderStudio(ctx, root, params = {}) {
  let selectedId = params.captureId || state.aiCapture || state.gallery[0]?.id || state.samples[0].id;
  let selected = getSelectedCapture(selectedId);
  let activeTool = params.action || 'ocr';
  let running = false;
  let lastResult = null;
  let lastLive = false;
  let lastData = null;
  const liveAvailable = Boolean(state.settings?.secrets?.openaiKey);

  const renderPage = () => {
    root.innerHTML = `
      <div class="page ai-page">
        <div class="page-head">
          <div class="page-head-copy">
            <div class="eyebrow"><span class="eyebrow-dot"></span>AI Studio<span class="line"></span>${liveAvailable ? 'OpenAI connected' : 'Demo previews ready'}</div>
            <h1 class="page-title">Screenshots that <span class="grad">explain themselves.</span></h1>
            <p class="page-sub">Extract text, summarize, find secrets, pull code and colors. Local tools run instantly; cloud AI is optional.</p>
          </div>
          <div class="page-actions">
            <span class="pill ${liveAvailable ? 'green' : 'gold'}">${icon(liveAvailable ? 'bolt' : 'sparkle', 11)} ${liveAvailable ? 'Live AI enabled' : 'Demo mode'}</span>
            <button class="btn btn-secondary" data-ai-connect type="button">${icon('key', 14)} ${liveAvailable ? 'AI settings' : 'Connect OpenAI'}</button>
            <button class="btn btn-primary" data-run-tool type="button">${icon(toolMeta(activeTool).icon, 14)} Run ${escapeHtml(toolMeta(activeTool).name)}</button>
          </div>
        </div>

        <div class="ai-capture-strip">
          <span class="ai-capture-label">${icon('image', 13)} Analyze</span>
          <div class="ai-capture-list">
            ${captures().slice(0, 8).map((capture) => `
              <button class="ai-capture-item ${capture.id === selected.id ? 'active' : ''}" data-ai-capture="${capture.id}" type="button" title="${escapeHtml(capture.title)}">
                <img src="${escapeHtml(capture.thumbnailUrl || capture.url || capture.src)}" alt="">
                <span>${capture.demo ? 'Sample' : escapeHtml(prettySource(capture.source))}</span>
              </button>
            `).join('')}
          </div>
          <button class="btn btn-sm btn-secondary" data-ai-import type="button">${icon('imagePlus', 13)} Import</button>
        </div>

        <div class="ai-layout">
          <aside class="ai-tool-rail card">
            <div class="ai-rail-head"><span>${icon('sparkle', 13)} AI tools</span><span class="badge ${liveAvailable ? 'green' : ''}">${liveAvailable ? 'LIVE' : 'DEMO'}</span></div>
            <div class="ai-tool-list">
              ${AI_TOOLS.map((tool) => `
                <button class="ai-tool-item ${tool.id === activeTool ? 'active' : ''}" data-tool="${tool.id}" type="button">
                  <span class="ai-tool-icon">${icon(tool.icon, 16)}</span>
                  <span class="ai-tool-copy"><b>${tool.name}</b><small>${tool.label}</small></span>
                  ${tool.local ? `<span class="ai-tool-badge local">LOCAL</span>` : tool.premium ? `<span class="ai-tool-badge">PRO</span>` : ''}
                </button>
              `).join('')}
            </div>
            <div class="ai-rail-foot">
              <span class="mini-note">${icon('lock', 11)} ${liveAvailable ? 'Encrypted key' : 'No key connected'}</span>
              <button data-ai-connect type="button">${liveAvailable ? 'Manage' : 'Connect'} ${icon('arrowRight', 10)}</button>
            </div>
          </aside>

          <section class="ai-preview-card card">
            <div class="ai-preview-head">
              <div class="ai-preview-title">
                <b>${escapeHtml(selected.title)}</b>
                <span>${selected.width || 0} × ${selected.height || 0} · ${selected.demo ? 'Sample capture' : escapeHtml(prettySource(selected.source))}</span>
              </div>
              <div class="ai-preview-actions">
                <button class="icon-btn sm" data-preview-capture type="button" data-tip="Open preview">${icon('eye', 13)}</button>
                <button class="icon-btn sm" data-edit-capture type="button" data-tip="Edit capture">${icon('editor', 13)}</button>
              </div>
            </div>
            <div class="ai-preview-stage" data-ai-preview>
              <img src="${escapeHtml(captureImage(selected))}" alt="${escapeHtml(selected.title)}">
              <span class="ai-preview-scan ${running ? 'running' : ''}"></span>
              <div class="ai-preview-grid"></div>
              <div class="ai-preview-badge"><span class="status-dot"></span> ${running ? 'Analyzing pixels' : 'Ready for analysis'}</div>
              <div class="ai-preview-overlay" data-ai-overlay></div>
              <div class="ai-preview-zoom">
                <button class="icon-btn sm" data-ai-zoom="out" type="button">${icon('zoomOut', 12)}</button>
                <span data-ai-zoom-label>100%</span>
                <button class="icon-btn sm" data-ai-zoom="in" type="button">${icon('zoomIn', 12)}</button>
              </div>
            </div>
            <div class="ai-preview-foot">
              <div class="ai-preview-meta"><span>${icon('file', 11)} ${selected.bytes ? formatBytes(selected.bytes) : 'Sample'}</span><span>${icon('clock', 11)} ${selected.demo ? 'Curated sample' : timeAgo(selected.createdAt)}</span></div>
              <div class="ai-preview-tip">${icon('info', 11)} Select a tool, then run it</div>
            </div>
          </section>

          <aside class="ai-result-panel card">
            <div class="ai-result-scroll" data-ai-result>
              ${emptyResult()}
            </div>
          </aside>
        </div>

        <div class="ai-bottom-grid">
          <section class="ai-tool-detail card">
            <div class="ai-tool-detail-icon">${icon(toolMeta(activeTool).icon, 19)}</div>
            <div class="ai-tool-detail-copy">
              <span class="preview-side-label">Selected tool</span>
              <h3>${escapeHtml(toolMeta(activeTool).name)}</h3>
              <p>${escapeHtml(toolMeta(activeTool).description)}</p>
            </div>
            <div class="ai-tool-detail-meta">
              <span class="pill ${LOCAL_TOOLS.has(activeTool) ? 'green' : 'gold'}">${icon(LOCAL_TOOLS.has(activeTool) ? 'bolt' : 'sparkle', 10)} ${LOCAL_TOOLS.has(activeTool) ? 'On-device' : liveAvailable ? 'OpenAI vision' : 'Demo output'}</span>
              <button class="btn btn-sm btn-primary" data-run-tool type="button">${icon(toolMeta(activeTool).icon, 13)} ${escapeHtml(toolMeta(activeTool).action)}</button>
            </div>
          </section>
          <section class="ai-prompt-card card">
            <div class="field">
              <label class="field-label">Optional instruction <span class="field-hint">For cloud AI tools</span></label>
              <input class="input" data-ai-prompt placeholder="e.g. Focus on the pricing table, ignore navigation">
            </div>
          </section>
        </div>
      </div>
    `;
    bind();
    if (lastResult) {
      renderResult(lastResult, lastLive, lastData, false);
    } else if (params.action) {
      setTimeout(() => runTool(params.action), 260);
    }
  };

  const selectCapture = (id) => {
    selectedId = id;
    selected = getSelectedCapture(id);
    state.aiCapture = id;
    lastResult = null;
    lastLive = false;
    lastData = null;
    renderPage();
  };

  const setActiveTool = (id) => {
    activeTool = id;
    root.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === id));
    const meta = toolMeta(id);
    const detail = root.querySelector('.ai-tool-detail');
    if (detail) {
      detail.querySelector('.ai-tool-detail-icon').innerHTML = icon(meta.icon, 19);
      detail.querySelector('h3').textContent = meta.name;
      detail.querySelector('p').textContent = meta.description;
      detail.querySelector('.pill').innerHTML = `${icon(LOCAL_TOOLS.has(id) ? 'bolt' : 'sparkle', 10)} ${LOCAL_TOOLS.has(id) ? 'On-device' : liveAvailable ? 'OpenAI vision' : 'Demo output'}`;
      detail.querySelector('.pill').className = `pill ${LOCAL_TOOLS.has(id) ? 'green' : 'gold'}`;
      const runBtn = detail.querySelector('[data-run-tool]');
      runBtn.innerHTML = `${icon(meta.icon, 13)} ${escapeHtml(meta.action)}`;
    }
    root.querySelectorAll('[data-run-tool]').forEach((button) => {
      button.innerHTML = `${icon(meta.icon, 14)} Run ${escapeHtml(meta.name)}`;
    });
  };

  const setZoom = (direction) => {
    const label = root.querySelector('[data-ai-zoom-label]');
    const img = root.querySelector('.ai-preview-stage img');
    if (!label || !img) return;
    const current = Number(label.dataset.zoom || 100);
    const next = Math.max(70, Math.min(180, current + (direction === 'in' ? 10 : -10)));
    label.dataset.zoom = String(next);
    label.textContent = `${next}%`;
    img.style.transform = `scale(${next / 100})`;
  };

  const renderResult = (markup, live, data, addHistory = true) => {
    const resultEl = root.querySelector('[data-ai-result]');
    if (!resultEl) return;
    resultEl.innerHTML = `${resultHeader(activeTool, live, selected)}${markup}`;
    resultEl.scrollTop = 0;
    const overlay = root.querySelector('[data-ai-overlay]');
    if (overlay) overlay.innerHTML = '';
    if (activeTool === 'blur' && data?.regions?.length) {
      if (overlay) {
        overlay.innerHTML = data.regions.map((region) => `
          <span class="ai-blur-box" style="left:${(region.x || 0) * 100}%;top:${(region.y || 0) * 100}%;width:${(region.w || 0) * 100}%;height:${(region.h || 0) * 100}%">
            <i>${escapeHtml(region.label || 'Sensitive')}</i>
          </span>
        `).join('');
      }
    }
    if (addHistory) {
      aiHistory.unshift({
        action: activeTool,
        captureId: selected.id,
        title: selected.title,
        at: new Date().toISOString(),
        live
      });
      aiHistory = aiHistory.slice(0, 8);
    }
    bindResult();
  };

  const buildResult = (action, data, live) => {
    const resultData = data || {};
    if (action === 'ocr') return renderOcrResult(resultData.text || resultData, live);
    if (action === 'summary') return renderSummaryResult(resultData, live);
    if (action === 'code') return renderCodeResult(resultData, live);
    if (action === 'blur') return renderBlurResult(resultData, live);
    if (action === 'colors') return renderColorsResult(resultData.palette || [], live);
    if (action === 'upscale') return renderUpscaleResult(resultData, live);
    if (action === 'qr') return renderQrResult(resultData, live);
    if (action === 'remove') return renderRemoveResult(resultData, live);
    return renderError('No result was returned.');
  };

  const runTool = async (action = activeTool) => {
    if (running) return;
    activeTool = action;
    setActiveTool(action);
    running = true;
    const scan = root.querySelector('.ai-preview-scan');
    const badge = root.querySelector('.ai-preview-badge');
    scan?.classList.add('running');
    if (badge) badge.innerHTML = `<span class="status-dot"></span> Analyzing pixels`;
    const resultEl = root.querySelector('[data-ai-result]');
    if (resultEl) resultEl.innerHTML = renderLoading(action);
    root.querySelectorAll('[data-run-tool]').forEach((button) => { button.disabled = true; });

    try {
      const local = LOCAL_TOOLS.has(action);
      const dataUrl = await captureDataUrl(selected, 1600);
      let data;
      let live = false;

      if (action === 'colors') {
        const image = await loadImage(dataUrl);
        data = { palette: samplePaletteFromImage(image, 6) };
        live = true;
      } else if (action === 'upscale') {
        const image = await loadImage(dataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth * 2;
        canvas.height = image.naturalHeight * 2;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        data = { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
        live = true;
      } else if (action === 'qr') {
        const image = await loadImage(dataUrl);
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const scanFn = window.jsQR || window.jsqr;
        const result = scanFn ? scanFn(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' }) : null;
        data = { found: Boolean(result), data: result?.data || '' };
        live = true;
      } else if (!liveAvailable) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        data = DEMO_AI_RESULTS[action] || { text: 'Demo result.' };
        live = false;
      } else {
        const prompt = root.querySelector('[data-ai-prompt]')?.value?.trim() || '';
        const response = await window.snapx.ai.analyze({
          action,
          imageDataUrl: dataUrl,
          prompt,
          model: state.settings?.ai?.model || 'gpt-4o-mini'
        });
        if (!response.ok) {
          if (response.error === 'no-key') {
            data = DEMO_AI_RESULTS[action] || { text: 'Demo result.' };
            live = false;
          } else {
            throw new Error(response.message || 'AI analysis failed');
          }
        } else {
          if (['summary', 'code', 'blur', 'remove'].includes(action)) {
            data = response.parsed || { text: response.text, summary: response.text, code: response.text, explanation: '', regions: [] };
            if (action === 'remove' && !response.parsed) data = { object: 'Requested object', description: response.text, fill: 'AI-suggested background' };
            if (action === 'blur' && !response.parsed) data = { regions: [] };
            if (action === 'summary' && !response.parsed) data = { title: selected.title, summary: response.text, bullets: [], tags: [] };
            if (action === 'code' && !response.parsed) data = { language: 'Detected', code: response.text, explanation: '' };
          } else {
            data = { text: response.text };
          }
          live = true;
        }
      }

      lastResult = buildResult(action, data, live);
      lastLive = live;
      lastData = data;
      renderResult(lastResult, live, data);
      if (action === 'blur' && data?.regions?.length) {
        toast(`${data.regions.length} sensitive regions highlighted`, { type: 'info' });
      }
    } catch (error) {
      lastResult = renderError(error.message || 'AI analysis failed');
      lastLive = false;
      lastData = null;
      renderResult(lastResult, false, null, false);
      toast(error.message || 'AI analysis failed', { type: 'error' });
    } finally {
      running = false;
      root.querySelectorAll('[data-run-tool]').forEach((button) => { button.disabled = false; });
      scan?.classList.remove('running');
      const badgeNow = root.querySelector('.ai-preview-badge');
      if (badgeNow) badgeNow.innerHTML = `<span class="status-dot"></span> Analysis complete`;
    }
  };

  const saveDerived = async (dataUrl, title, tags = []) => {
    try {
      const image = await loadImage(dataUrl);
      const item = await window.snapx.gallery.add({
        dataUrl,
        title,
        width: image.naturalWidth,
        height: image.naturalHeight,
        source: 'ai',
        tags
      });
      await ctx.refreshGallery({ silent: true });
      toast('AI result saved to library', { type: 'success', detail: title });
      return item;
    } catch (error) {
      toast(error.message || 'Could not save result', { type: 'error' });
      return null;
    }
  };

  const applyBlur = async () => {
    const regions = lastData?.regions || [];
    if (!regions.length) return;
    try {
      const dataUrl = await captureDataUrl(selected, 0);
      const image = await loadImage(dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      for (const region of regions) {
        const x = Math.round((region.x || 0) * canvas.width);
        const y = Math.round((region.y || 0) * canvas.height);
        const w = Math.max(4, Math.round((region.w || 0) * canvas.width));
        const h = Math.max(4, Math.round((region.h || 0) * canvas.height));
        const block = Math.max(6, Math.round(Math.min(w, h) / 8));
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(w / block));
        small.height = Math.max(1, Math.round(h / block));
        const smallCtx = small.getContext('2d');
        smallCtx.drawImage(canvas, x, y, w, h, 0, 0, small.width, small.height);
        context.save();
        context.imageSmoothingEnabled = false;
        context.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
        context.restore();
      }
      const blurred = canvas.toDataURL('image/png');
      const item = await saveDerived(blurred, `${selected.title} — protected`, ['ai', 'auto-blur', 'redacted']);
      if (item) {
        const resultEl = root.querySelector('[data-ai-result]');
        if (resultEl) {
          resultEl.insertAdjacentHTML('afterbegin', `<div class="notice notice-green" style="margin:0 0 12px">${icon('shieldCheck', 15)} Pixel blur applied and saved as a new capture. The original is untouched.</div>`);
        }
      }
    } catch (error) {
      toast(error.message || 'Could not apply blur', { type: 'error' });
    }
  };

  const bindResult = () => {
    const resultEl = root.querySelector('[data-ai-result]');
    if (!resultEl) return;
    resultEl.querySelectorAll('[data-suggest]').forEach((button) => button.addEventListener('click', () => {
      setActiveTool(button.dataset.suggest);
      runTool(button.dataset.suggest);
    }));
    resultEl.querySelector('[data-copy-ocr]')?.addEventListener('click', () => copyText(resultEl.querySelector('[data-ocr-text]')?.textContent || '', 'Text copied'));
    resultEl.querySelector('[data-replace-capture-title]')?.addEventListener('click', async () => {
      const firstLine = (resultEl.querySelector('[data-ocr-text]')?.textContent || '').split('\n').find(Boolean)?.trim();
      if (!firstLine) return;
      selected.title = firstLine.slice(0, 100);
      if (!selected.demo) await window.snapx.gallery.update(selected.id, { title: selected.title }).catch(() => {});
      toast('Capture title updated', { type: 'success' });
      renderPage();
    });
    resultEl.querySelector('[data-copy-summary]')?.addEventListener('click', () => {
      const summary = lastData?.summary || '';
      copyText(summary, 'Summary copied');
    });
    resultEl.querySelector('[data-apply-summary]')?.addEventListener('click', async () => {
      if (!lastData) return;
      selected.title = lastData.title || selected.title;
      selected.tags = [...new Set([...(selected.tags || []), ...(lastData.tags || [])])].slice(0, 12);
      if (!selected.demo) {
        await window.snapx.gallery.update(selected.id, { title: selected.title, tags: selected.tags }).catch(() => {});
        await ctx.refreshGallery({ silent: true });
      }
      toast('Summary applied to capture', { type: 'success' });
      renderPage();
    });
    resultEl.querySelectorAll('[data-apply-tag]').forEach((button) => button.addEventListener('click', async () => {
      const tag = button.dataset.applyTag;
      selected.tags = [...new Set([...(selected.tags || []), tag])].slice(0, 12);
      if (!selected.demo) await window.snapx.gallery.update(selected.id, { tags: selected.tags }).catch(() => {});
      button.classList.add('active');
      toast(`#${tag} added`, { type: 'success' });
    }));
    resultEl.querySelector('[data-copy-code]')?.addEventListener('click', () => copyText(lastData?.code || '', 'Code copied'));
    resultEl.querySelector('[data-copy-regions]')?.addEventListener('click', () => copyText(JSON.stringify(lastData?.regions || [], null, 2), 'Region data copied'));
    resultEl.querySelector('[data-apply-blur]')?.addEventListener('click', applyBlur);
    resultEl.querySelectorAll('[data-copy-color]').forEach((button) => button.addEventListener('click', () => copyText(button.dataset.copyColor, `${button.dataset.copyColor} copied`)));
    resultEl.querySelector('[data-copy-palette]')?.addEventListener('click', () => copyText(paletteCss(lastData?.palette || []), 'Palette CSS copied'));
    resultEl.querySelector('[data-save-palette]')?.addEventListener('click', async () => {
      const palette = lastData?.palette || [];
      if (!palette.length) return;
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 600;
      const context = canvas.getContext('2d');
      context.fillStyle = '#070b12';
      context.fillRect(0, 0, 1200, 600);
      const width = 1200 / palette.length;
      palette.forEach((color, index) => {
        context.fillStyle = color.hex;
        context.fillRect(index * width, 0, width, 470);
        context.fillStyle = 'rgba(255,255,255,.9)';
        context.font = '600 26px Manrope, sans-serif';
        context.fillText(color.hex, index * width + 26, 528);
        context.fillStyle = 'rgba(255,255,255,.48)';
        context.font = '400 17px Manrope, sans-serif';
        context.fillText(`${color.share || 0}% of pixels`, index * width + 26, 556);
      });
      await saveDerived(canvas.toDataURL('image/png'), `${selected.title} — palette`, ['ai', 'palette', 'colors']);
    });
    resultEl.querySelector('[data-save-upscale]')?.addEventListener('click', async () => {
      if (!lastData?.dataUrl) return;
      await saveDerived(lastData.dataUrl, `${selected.title} — 2× upscale`, ['ai', 'upscale']);
    });
    resultEl.querySelector('[data-copy-upscale]')?.addEventListener('click', async () => {
      if (!lastData?.dataUrl) return;
      await window.snapx.clipboard.image(lastData.dataUrl).then(() => toast('Upscaled image copied', { type: 'success' })).catch(() => toast('Could not copy image', { type: 'error' }));
    });
    resultEl.querySelector('[data-copy-qr]')?.addEventListener('click', () => copyText(lastData?.data || '', 'QR contents copied'));
    resultEl.querySelector('[data-open-qr]')?.addEventListener('click', () => {
      if (/^https?:\/\//i.test(lastData?.data || '')) window.snapx.app.openExternal(lastData.data);
    });
    resultEl.querySelector('[data-remove-preview]')?.addEventListener('click', () => {
      toast('Generative fill preview is coming soon', { type: 'info', detail: 'This build can plan the removal but does not alter the image yet.' });
    });
    resultEl.querySelector('[data-copy-remove]')?.addEventListener('click', () => copyText(JSON.stringify(lastData || {}, null, 2), 'Removal plan copied'));
    resultEl.querySelector('[data-ai-retry]')?.addEventListener('click', () => runTool(activeTool));
    resultEl.querySelectorAll('[data-ai-connect]').forEach((button) => button.addEventListener('click', () => ctx.navigate('settings', { section: 'integrations' })));
    resultEl.querySelectorAll('[data-history-action]').forEach((button) => button.addEventListener('click', () => {
      const capture = getCapture(button.dataset.historyCapture);
      if (capture) {
        selectedId = capture.id;
        selected = capture;
        state.aiCapture = capture.id;
        activeTool = button.dataset.historyAction;
        renderPage();
        setTimeout(() => runTool(activeTool), 260);
      }
    }));
  };

  const bind = () => {
    root.querySelectorAll('[data-ai-capture]').forEach((button) => {
      button.addEventListener('click', () => selectCapture(button.dataset.aiCapture));
    });
    root.querySelectorAll('[data-tool]').forEach((button) => {
      button.addEventListener('click', () => {
        activeTool = button.dataset.tool;
        setActiveTool(activeTool);
      });
    });
    root.querySelectorAll('[data-run-tool]').forEach((button) => {
      button.addEventListener('click', () => runTool(activeTool));
    });
    root.querySelectorAll('[data-ai-connect]').forEach((button) => {
      button.addEventListener('click', () => ctx.navigate('settings', { section: 'integrations' }));
    });
    root.querySelector('[data-ai-import]')?.addEventListener('click', async () => {
      const result = await window.snapx.dialog.openImage().catch(() => null);
      if (!result) return;
      const item = await window.snapx.gallery.add({
        dataUrl: result.dataUrl,
        title: result.name?.replace(/\.[^.]+$/, '') || 'Imported image',
        width: 0,
        height: 0,
        source: 'import',
        tags: ['imported']
      }).catch(() => null);
      if (item) {
        await ctx.refreshGallery({ silent: true });
        selectCapture(item.id);
      }
    });
    root.querySelector('[data-preview-capture]')?.addEventListener('click', () => ctx.openPreview(selected));
    root.querySelector('[data-edit-capture]')?.addEventListener('click', () => ctx.openEditor(selected));
    root.querySelector('[data-ai-zoom="in"]')?.addEventListener('click', () => setZoom('in'));
    root.querySelector('[data-ai-zoom="out"]')?.addEventListener('click', () => setZoom('out'));
    const prompt = root.querySelector('[data-ai-prompt]');
    prompt?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        runTool(activeTool);
      }
    });
    bindResult();
  };

  renderPage();
}
