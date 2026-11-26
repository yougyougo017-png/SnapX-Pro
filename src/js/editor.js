import { icon } from './icons.js';
import {
  clamp,
  escapeHtml,
  toast,
  openModal,
  loadImage,
  setBusy,
  downloadDataUrl,
  copyText,
  confirmDialog
} from './ui.js';

const TOOLS = [
  { id: 'select', name: 'Select', icon: 'cursor', key: 'V', hint: 'Move & select layers' },
  { id: 'crop', name: 'Crop', icon: 'crop', key: 'C', hint: 'Trim the image' },
  { id: 'pen', name: 'Pen', icon: 'pen', key: 'P', hint: 'Draw freehand' },
  { id: 'arrow', name: 'Arrow', icon: 'arrow', key: 'A', hint: 'Point at the detail' },
  { id: 'line', name: 'Line', icon: 'line', key: 'L', hint: 'Draw a straight line' },
  { id: 'rect', name: 'Rectangle', icon: 'square', key: 'R', hint: 'Outline an area' },
  { id: 'ellipse', name: 'Ellipse', icon: 'circle', key: 'O', hint: 'Circle something' },
  { id: 'highlight', name: 'Highlight', icon: 'highlighter', key: 'H', hint: 'Mark it in color' },
  { id: 'blur', name: 'Blur', icon: 'blur', key: 'B', hint: 'Soften sensitive details' },
  { id: 'pixelate', name: 'Pixelate', icon: 'pixelate', key: 'X', hint: 'Block out secrets' },
  { id: 'text', name: 'Text', icon: 'type', key: 'T', hint: 'Add a note' },
  { id: 'magnifier', name: 'Magnifier', icon: 'magnifier', key: 'M', hint: 'Zoom into detail' },
  { id: 'picker', name: 'Color picker', icon: 'pipette', key: 'I', hint: 'Sample any pixel' }
];

const LAYER_ICONS = {
  pen: 'pen', arrow: 'arrow', line: 'line', rect: 'square', ellipse: 'circle', highlight: 'highlighter',
  blur: 'blur', pixelate: 'pixelate', text: 'type', magnifier: 'magnifier'
};

const LAYER_NAMES = {
  pen: 'Pen stroke', arrow: 'Arrow', line: 'Line', rect: 'Rectangle', ellipse: 'Ellipse', highlight: 'Highlight',
  blur: 'Blur region', pixelate: 'Pixelate region', text: 'Text', magnifier: 'Magnifier'
};

const SWATCHES = ['#ffd700', '#ff5d73', '#4de2d0', '#7ea4ff', '#9b6cff', '#3be3a0', '#ff9e2c', '#ffffff'];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hexFromRgb(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgba(hex, alpha) {
  const normalized = String(hex).replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

export class SnapXEditor {
  constructor(host, app, capture) {
    this.host = host;
    this.app = app;
    this.capture = capture;
    this.baseCanvas = document.createElement('canvas');
    this.canvas = null;
    this.g = null;
    this.layers = [];
    this.selectedId = null;
    this.tool = 'select';
    this.color = '#FFD700';
    this.strokeWidth = 4;
    this.opacity = 1;
    this.fill = false;
    this.fontFamily = 'Sora';
    this.fontSize = 34;
    this.fontWeight = 700;
    this.blurStrength = 16;
    this.pixelSize = 14;
    this.magnifierZoom = 3;
    this.watermark = { enabled: false, text: 'Captured with SnapX Pro', opacity: 0.55 };
    this.zoom = 0.5;
    this.autoFit = true;
    this.draft = null;
    this.drag = null;
    this.cropRect = null;
    this.history = [];
    this.historyIndex = -1;
    this.baseVersions = [];
    this.baseVersionIndex = 0;
    this.dirty = false;
    this.raf = 0;
    this.spaceDown = false;
    this.panning = null;
    this.saved = false;
    this.destroyed = false;
    this.textEditor = null;
    this.cleanupFns = [];
    this.initialTitle = capture?.title || 'Untitled capture';
  }

  async init() {
    this.renderShell();
    this.bindShell();
    await this.loadCapture(this.capture);
  }

  renderShell() {
    const capture = this.capture;
    const initialImage = capture?.dataUrl || capture?.url || capture?.src || '';
    this.host.innerHTML = `
      <div class="editor-shell">
        <header class="editor-topbar">
          <div class="editor-topbar-left">
            <button class="icon-btn editor-back" data-editor-action="back" type="button" data-tip="Back to library">${icon('arrowLeft', 16)}</button>
            <div class="editor-title-wrap">
              <span class="editor-crumb">${icon('editor', 11)} Editor <span>/</span> <span>${escapeHtml(capture?.demo ? 'Sample capture' : 'Local capture')}</span></span>
              <input class="editor-title-input" data-editor-title value="${escapeHtml(capture?.title || 'Untitled capture')}" maxlength="100" spellcheck="false" aria-label="Capture title">
            </div>
            <span class="editor-save-state" data-editor-save-state><span class="status-dot"></span> All changes saved</span>
          </div>
          <div class="editor-topbar-center">
            <button class="icon-btn" data-editor-action="undo" type="button" data-tip="Undo (Ctrl+Z)">${icon('undo', 15)}</button>
            <button class="icon-btn" data-editor-action="redo" type="button" data-tip="Redo (Ctrl+Shift+Z)">${icon('redo', 15)}</button>
            <span class="separator-v"></span>
            <button class="icon-btn" data-editor-action="zoom-out" type="button" data-tip="Zoom out">${icon('zoomOut', 15)}</button>
            <button class="editor-zoom-value" data-editor-action="zoom-menu" type="button" data-zoom-label>50%</button>
            <button class="icon-btn" data-editor-action="zoom-in" type="button" data-tip="Zoom in">${icon('zoomIn', 15)}</button>
            <button class="btn btn-ghost btn-sm" data-editor-action="fit" type="button">Fit</button>
            <button class="btn btn-ghost btn-sm" data-editor-action="actual" type="button">1:1</button>
          </div>
          <div class="editor-topbar-right">
            <button class="btn btn-secondary btn-sm" data-editor-action="copy" type="button">${icon('copy', 13)} Copy</button>
            <button class="btn btn-secondary btn-sm" data-editor-action="share" type="button">${icon('share', 13)} Share</button>
            <button class="btn btn-primary btn-sm" data-editor-action="save" type="button">${icon('save', 13)} Save copy</button>
            <span class="separator-v"></span>
            <button class="icon-btn" data-editor-action="export" type="button" data-tip="Download PNG">${icon('download', 15)}</button>
          </div>
        </header>

        <div class="editor-body">
          <aside class="editor-tools">
            ${TOOLS.map((tool, index) => `
              ${index === 2 || index === 8 || index === 10 ? '<span class="editor-tool-sep"></span>' : ''}
              <button class="editor-tool ${tool.id === this.tool ? 'active' : ''}" data-tool="${tool.id}" type="button" data-tip="${tool.name} · ${tool.key}">
                ${icon(tool.icon, 17)}
                <span>${tool.name.split(' ')[0]}</span>
                <i>${tool.key}</i>
              </button>
            `).join('')}
            <span class="editor-tool-sep"></span>
            <button class="editor-tool ${this.watermark.enabled ? 'active' : ''}" data-editor-action="watermark" type="button" data-tip="Watermark">
              ${icon('watermark', 17)}
              <span>Mark</span>
              <i>W</i>
            </button>
          </aside>

          <section class="editor-workspace">
            <div class="editor-stage" data-editor-stage>
              <div class="editor-loading" data-editor-loading>
                <span class="editor-loading-orb">${icon('image', 26)}</span>
                <b>Preparing your canvas</b>
                <span>Decoding pixels at full resolution…</span>
                <div class="editor-loading-bar"><i></i></div>
              </div>
              <div class="editor-empty" data-editor-empty hidden>
                <span>${icon('imagePlus', 28)}</span>
                <h3>Open an image to begin</h3>
                <p>Drop a screenshot anywhere, or choose a file from your device.</p>
                <button class="btn btn-primary" data-editor-action="open" type="button">${icon('imagePlus', 14)} Open image</button>
              </div>
              <div class="editor-canvas-wrap" data-canvas-wrap hidden>
                <canvas data-editor-canvas></canvas>
                <div class="editor-text-layer" data-text-layer></div>
              </div>
            </div>
            <div class="editor-crop-bar" data-crop-bar hidden>
              <span>${icon('crop', 13)} <b data-crop-size>0 × 0</b></span>
              <span class="editor-crop-hint">Drag to adjust · Enter to apply</span>
              <button class="btn btn-sm btn-ghost" data-editor-action="crop-cancel" type="button">Cancel</button>
              <button class="btn btn-sm btn-primary" data-editor-action="crop-apply" type="button">${icon('check', 12)} Apply crop</button>
            </div>
            <div class="editor-stage-foot">
              <span><span class="status-dot"></span> <b data-image-size>—</b> · <span data-tool-status>Select tool</span></span>
              <span class="editor-stage-foot-right">${icon('lock', 11)} Edits stay on this device <span class="separator-v"></span> <kbd>Space</kbd> drag to pan</span>
            </div>
          </section>

          <aside class="editor-inspector">
            <div class="editor-inspector-scroll">
              <section class="editor-panel">
                <div class="editor-panel-head">
                  <span class="editor-panel-title">${icon('sliders', 13)} Tool settings</span>
                  <span class="badge accent" data-active-tool-label>Select</span>
                </div>
                <div class="editor-props" data-editor-props>
                  <div class="editor-prop-group" data-prop-group="color">
                    <label class="field-label">Color</label>
                    <div class="editor-color-row">
                      <label class="editor-color-input" data-color-preview style="--pick-color:${this.color}">
                        <input type="color" value="${this.color}" data-prop="color" aria-label="Stroke color">
                      </label>
                      <div class="editor-swatches">
                        ${SWATCHES.map((color) => `<button class="editor-swatch ${color.toLowerCase() === this.color.toLowerCase() ? 'active' : ''}" data-swatch="${color}" type="button" style="--swatch:${color}" aria-label="${color}"></button>`).join('')}
                      </div>
                    </div>
                  </div>
                  <div class="editor-prop-group" data-prop-group="stroke">
                    <label class="field-label">Stroke <span class="field-hint" data-prop-value="strokeWidth">${this.strokeWidth}px</span></label>
                    <input class="slider" type="range" min="1" max="24" value="${this.strokeWidth}" data-prop="strokeWidth">
                  </div>
                  <div class="editor-prop-group" data-prop-group="opacity">
                    <label class="field-label">Opacity <span class="field-hint" data-prop-value="opacity">100%</span></label>
                    <input class="slider" type="range" min="10" max="100" value="100" data-prop="opacity">
                  </div>
                  <div class="editor-prop-group" data-prop-group="fill">
                    <div class="switch-row">
                      <div class="switch-copy"><b>Fill shape</b><span>Translucent interior</span></div>
                      <button class="toggle" data-prop-toggle="fill" type="button" aria-label="Fill shape"></button>
                    </div>
                  </div>
                  <div class="editor-prop-group" data-prop-group="font">
                    <div class="field">
                      <label class="field-label">Font</label>
                      <select class="select" data-prop="fontFamily">
                        <option value="Sora">Sora</option>
                        <option value="Manrope">Manrope</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Cascadia Code">Cascadia Code</option>
                        <option value="Arial">Arial</option>
                      </select>
                    </div>
                    <div class="field">
                      <label class="field-label">Size <span class="field-hint" data-prop-value="fontSize">${this.fontSize}px</span></label>
                      <input class="slider" type="range" min="12" max="140" value="${this.fontSize}" data-prop="fontSize">
                    </div>
                    <div class="segmented font-weight-switch" data-font-weight>
                      <button data-weight="500" type="button">Regular</button>
                      <button data-weight="700" class="active" type="button">Bold</button>
                      <button data-weight="800" type="button">Black</button>
                    </div>
                  </div>
                  <div class="editor-prop-group" data-prop-group="blur">
                    <label class="field-label">Blur strength <span class="field-hint" data-prop-value="blurStrength">${this.blurStrength}px</span></label>
                    <input class="slider" type="range" min="4" max="40" value="${this.blurStrength}" data-prop="blurStrength">
                  </div>
                  <div class="editor-prop-group" data-prop-group="pixelate">
                    <label class="field-label">Pixel size <span class="field-hint" data-prop-value="pixelSize">${this.pixelSize}px</span></label>
                    <input class="slider" type="range" min="4" max="48" value="${this.pixelSize}" data-prop="pixelSize">
                  </div>
                  <div class="editor-prop-group" data-prop-group="magnifier">
                    <label class="field-label">Magnifier zoom <span class="field-hint" data-prop-value="magnifierZoom">${this.magnifierZoom}×</span></label>
                    <input class="slider" type="range" min="1.5" max="10" step="0.5" value="${this.magnifierZoom}" data-prop="magnifierZoom">
                  </div>
                </div>
              </section>

              <section class="editor-panel">
                <div class="editor-panel-head">
                  <span class="editor-panel-title">${icon('type', 13)} Watermark</span>
                  <button class="toggle ${this.watermark.enabled ? 'on' : ''}" data-prop-toggle="watermark" type="button" aria-label="Watermark"></button>
                </div>
                <div class="editor-watermark" data-watermark-fields ${this.watermark.enabled ? '' : 'hidden'}>
                  <input class="input" value="${escapeHtml(this.watermark.text)}" data-watermark-text maxlength="80" placeholder="Watermark text">
                  <div class="range-row"><span class="field-hint">Opacity</span><input class="slider" type="range" min="10" max="100" value="55" data-watermark-opacity><span class="range-value">55%</span></div>
                </div>
                <div class="editor-watermark-off" data-watermark-off ${this.watermark.enabled ? 'hidden' : ''}>${icon('info', 11)} Off. Turn it on to brand every export.</div>
              </section>

              <section class="editor-panel">
                <div class="editor-panel-head">
                  <span class="editor-panel-title">${icon('layers', 13)} Layers <span class="editor-count" data-layer-count>0</span></span>
                  <button class="icon-btn sm" data-editor-action="delete-layer" type="button" data-tip="Delete selected layer">${icon('trash', 12)}</button>
                </div>
                <div class="editor-layers" data-layers>
                  <div class="editor-empty-layers">${icon('layers', 17)} <span>Annotations will appear here</span></div>
                </div>
              </section>

              <section class="editor-panel">
                <div class="editor-panel-head">
                  <span class="editor-panel-title">${icon('history', 13)} History</span>
                  <span class="editor-count" data-history-count>0</span>
                </div>
                <div class="editor-history" data-history-list></div>
              </section>
            </div>
          </aside>
        </div>

        <footer class="editor-statusbar">
          <span>${icon('sparkle', 11)} SnapX Editor <span class="status-sep">·</span> <span data-selected-layer-status>Nothing selected</span></span>
          <span class="editor-status-right"><span data-zoom-status>50%</span><span class="status-sep">·</span><span data-dims-status>—</span><span class="status-sep">·</span><span>${escapeHtml(capture?.demo ? 'Sample image' : 'Local image')}</span></span>
        </footer>
      </div>
    `;
    this.canvas = this.host.querySelector('[data-editor-canvas]');
    this.g = this.canvas.getContext('2d');
    this.stage = this.host.querySelector('[data-editor-stage]');
    this.canvasWrap = this.host.querySelector('[data-canvas-wrap]');
    this.textLayer = this.host.querySelector('[data-text-layer]');
    this.loadingEl = this.host.querySelector('[data-editor-loading]');
    this.emptyEl = this.host.querySelector('[data-editor-empty]');
    this.updateToolbar();
    this.updateInspector();
  }

  bindShell() {
    this.host.addEventListener('click', this.onClick);
    this.host.addEventListener('input', this.onInput);
    this.host.addEventListener('change', this.onInput);
    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('pointermove', this.onPointerMove);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('pointercancel', this.onPointerUp);
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
    this.stage.addEventListener('scroll', () => this.updateZoomHud?.());
    this.keyHandler = (event) => this.onKeyDown(event);
    document.addEventListener('keydown', this.keyHandler);
    this.keyUpHandler = (event) => {
      if (event.code === 'Space') {
        this.spaceDown = false;
        this.stage.classList.remove('space-pan');
      }
    };
    document.addEventListener('keyup', this.keyUpHandler);
    this.resizeObserver = new ResizeObserver(() => {
      if (this.autoFit) this.fitToScreen(false);
    });
    this.resizeObserver.observe(this.stage);
    this.cleanupFns.push(() => {
      document.removeEventListener('keydown', this.keyHandler);
      document.removeEventListener('keyup', this.keyUpHandler);
      this.resizeObserver?.disconnect();
    });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.cleanupFns.forEach((fn) => {
      try { fn(); } catch { /* ignore */ }
    });
    this.cleanupFns = [];
    this.host.innerHTML = '';
  }

  async loadCapture(capture) {
    if (!capture) {
      this.loadingEl.hidden = true;
      this.emptyEl.hidden = false;
      return;
    }
    this.capture = capture;
    const src = capture.dataUrl || capture.url || capture.src;
    if (!src) {
      this.loadingEl.hidden = true;
      this.emptyEl.hidden = false;
      return;
    }
    this.loadingEl.hidden = false;
    this.emptyEl.hidden = true;
    this.canvasWrap.hidden = true;
    try {
      const image = await loadImage(src);
      await document.fonts?.ready?.catch?.(() => {});
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) throw new Error('The image has no dimensions.');
      this.baseCanvas = document.createElement('canvas');
      this.baseCanvas.width = width;
      this.baseCanvas.height = height;
      const context = this.baseCanvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      this.baseVersions = [canvasToDataUrl(this.baseCanvas)];
      this.baseVersionIndex = 0;
      this.layers = [];
      this.selectedId = null;
      this.history = [];
      this.historyIndex = -1;
      this.dirty = false;
      this.saved = false;
      this.cropRect = null;
      this.zoom = 0.5;
      this.autoFit = true;
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvasWrap.hidden = false;
      this.loadingEl.hidden = true;
      this.host.querySelector('[data-image-size]').textContent = `${width} × ${height}`;
      this.host.querySelector('[data-dims-status]').textContent = `${width} × ${height}`;
      this.host.querySelector('[data-editor-title]').value = capture.title || 'Untitled capture';
      this.fitToScreen(false);
      this.pushHistory('Opened image');
      this.dirty = false;
      this.updateSaveState();
      this.updateLayers();
      this.scheduleRender();
    } catch (error) {
      this.loadingEl.hidden = true;
      this.emptyEl.hidden = false;
      this.emptyEl.querySelector('h3').textContent = 'Could not open that image';
      this.emptyEl.querySelector('p').textContent = error.message || 'The image could not be decoded.';
      toast(error.message || 'Could not open image', { type: 'error' });
    }
  }

  openImagePicker() {
    this.app.importImage('editor');
  }

  async replaceWithImported(capture) {
    this.capture = capture;
    await this.loadCapture(capture);
  }

  onClick = async (event) => {
    const tool = event.target.closest('[data-tool]');
    if (tool) {
      this.setTool(tool.dataset.tool);
      return;
    }
    const swatch = event.target.closest('[data-swatch]');
    if (swatch) {
      this.color = swatch.dataset.swatch;
      this.updateColorUI();
      this.syncSelectedLayerStyle();
      return;
    }
    const action = event.target.closest('[data-editor-action]')?.dataset.editorAction;
    if (action) {
      event.preventDefault();
      await this.runAction(action);
      return;
    }
    const weight = event.target.closest('[data-weight]');
    if (weight) {
      this.fontWeight = Number(weight.dataset.weight);
      this.host.querySelectorAll('[data-weight]').forEach((entry) => entry.classList.toggle('active', entry === weight));
      this.syncSelectedLayerStyle();
      return;
    }
    const layerRow = event.target.closest('[data-layer-id]');
    if (layerRow && !event.target.closest('[data-layer-visibility]') && !event.target.closest('[data-layer-remove]')) {
      this.selectedId = layerRow.dataset.layerId;
      this.updateLayers();
      this.scheduleRender();
      return;
    }
    const visibility = event.target.closest('[data-layer-visibility]');
    if (visibility) {
      const layer = this.layers.find((entry) => entry.id === visibility.dataset.layerVisibility);
      if (layer) {
        layer.visible = !layer.visible;
        this.commit('Toggle layer visibility');
        this.updateLayers();
        this.scheduleRender();
      }
      return;
    }
    const remove = event.target.closest('[data-layer-remove]');
    if (remove) {
      this.layers = this.layers.filter((entry) => entry.id !== remove.dataset.layerRemove);
      if (this.selectedId === remove.dataset.layerRemove) this.selectedId = null;
      this.commit('Delete layer');
      this.updateLayers();
      this.scheduleRender();
      return;
    }
    const historyItem = event.target.closest('[data-history-index]');
    if (historyItem) {
      await this.restoreHistory(Number(historyItem.dataset.historyIndex));
      return;
    }
    const propToggle = event.target.closest('[data-prop-toggle]');
    if (propToggle) {
      const prop = propToggle.dataset.propToggle;
      if (prop === 'watermark') {
        this.watermark.enabled = !this.watermark.enabled;
        propToggle.classList.toggle('on', this.watermark.enabled);
        this.host.querySelector('[data-watermark-fields]').hidden = !this.watermark.enabled;
        this.host.querySelector('[data-watermark-off]').hidden = this.watermark.enabled;
        this.host.querySelector('[data-editor-action="watermark"]')?.classList.toggle('active', this.watermark.enabled);
        this.commit(this.watermark.enabled ? 'Watermark on' : 'Watermark off');
        this.scheduleRender();
      } else if (prop === 'fill') {
        this.fill = !this.fill;
        propToggle.classList.toggle('on', this.fill);
        this.syncSelectedLayerStyle();
      }
    }
  };

  onInput = (event) => {
    const target = event.target;
    if (target.matches('[data-editor-title]')) {
      this.dirty = true;
      this.saved = false;
      this.updateSaveState();
      return;
    }
    if (target.matches('[data-watermark-text]')) {
      this.watermark.text = target.value;
      this.dirty = true;
      this.updateSaveState();
      this.scheduleRender();
      return;
    }
    if (target.matches('[data-watermark-opacity]')) {
      this.watermark.opacity = Number(target.value) / 100;
      this.host.querySelector('.editor-watermark .range-value').textContent = `${target.value}%`;
      this.dirty = true;
      this.updateSaveState();
      this.scheduleRender();
      return;
    }
    const prop = target.dataset.prop;
    if (!prop) return;
    if (prop === 'color') {
      this.color = target.value;
      this.updateColorUI();
      this.syncSelectedLayerStyle();
      return;
    }
    const numeric = Number(target.value);
    this[prop] = prop === 'opacity' ? numeric / 100 : numeric;
    const valueEl = this.host.querySelector(`[data-prop-value="${prop}"]`);
    if (valueEl) {
      const suffix = prop === 'opacity' ? '%' : prop === 'magnifierZoom' ? '×' : 'px';
      valueEl.textContent = `${numeric}${suffix}`;
    }
    this.syncSelectedLayerStyle();
  };

  updateColorUI() {
    const preview = this.host.querySelector('[data-color-preview]');
    if (preview) preview.style.setProperty('--pick-color', this.color);
    const input = this.host.querySelector('[data-prop="color"]');
    if (input) input.value = this.color;
    this.host.querySelectorAll('[data-swatch]').forEach((entry) => entry.classList.toggle('active', entry.dataset.swatch.toLowerCase() === this.color.toLowerCase()));
  }

  syncSelectedLayerStyle() {
    const layer = this.layers.find((entry) => entry.id === this.selectedId);
    if (!layer) {
      this.scheduleRender();
      return;
    }
    if ('color' in layer) layer.color = this.color;
    if ('strokeWidth' in layer) layer.strokeWidth = this.strokeWidth;
    if ('opacity' in layer) layer.opacity = this.opacity;
    if ('fill' in layer) layer.fill = this.fill;
    if ('fontFamily' in layer) layer.fontFamily = this.fontFamily;
    if ('fontSize' in layer) layer.fontSize = this.fontSize;
    if ('fontWeight' in layer) layer.fontWeight = this.fontWeight;
    if ('strength' in layer) layer.strength = this.blurStrength;
    if ('block' in layer) layer.block = this.pixelSize;
    if ('zoom' in layer) layer.zoom = this.magnifierZoom;
    this.dirty = true;
    this.updateSaveState();
    this.scheduleRender();
  }

  setTool(toolId) {
    this.tool = toolId;
    this.cropRect = toolId === 'crop' ? this.cropRect : null;
    this.updateCropBar();
    this.updateToolbar();
    this.updateInspector();
    this.canvasWrap.style.cursor = toolId === 'select' ? 'default'
      : toolId === 'text' ? 'text'
        : toolId === 'picker' ? 'crosshair'
          : toolId === 'crop' ? 'crosshair'
            : 'crosshair';
    if (toolId === 'watermark') this.toggleWatermark();
  }

  toggleWatermark() {
    this.watermark.enabled = !this.watermark.enabled;
    this.host.querySelector('[data-prop-toggle="watermark"]')?.classList.toggle('on', this.watermark.enabled);
    const fields = this.host.querySelector('[data-watermark-fields]');
    const off = this.host.querySelector('[data-watermark-off]');
    if (fields) fields.hidden = !this.watermark.enabled;
    if (off) off.hidden = this.watermark.enabled;
    this.host.querySelector('[data-editor-action="watermark"]')?.classList.toggle('active', this.watermark.enabled);
    this.commit(this.watermark.enabled ? 'Watermark on' : 'Watermark off');
    this.scheduleRender();
  }

  updateToolbar() {
    this.host.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === this.tool));
    const tool = TOOLS.find((entry) => entry.id === this.tool);
    const label = this.host.querySelector('[data-active-tool-label]');
    if (label) label.textContent = tool?.name || 'Select';
    const status = this.host.querySelector('[data-tool-status]');
    if (status) status.textContent = tool?.hint || 'Select tool';
    this.host.querySelector('[data-editor-action="watermark"]')?.classList.toggle('active', this.watermark.enabled);
  }

  updateInspector() {
    const tool = this.tool;
    const groups = this.host.querySelectorAll('[data-prop-group]');
    groups.forEach((group) => {
      const name = group.dataset.propGroup;
      let visible = false;
      if (['color', 'stroke', 'opacity'].includes(name)) visible = ['pen', 'arrow', 'line', 'rect', 'ellipse', 'highlight', 'text', 'magnifier'].includes(tool);
      if (name === 'color' || name === 'stroke') visible = ['pen', 'arrow', 'line', 'rect', 'ellipse', 'highlight', 'text'].includes(tool);
      if (name === 'opacity') visible = ['pen', 'arrow', 'line', 'rect', 'ellipse', 'highlight', 'text', 'blur', 'pixelate', 'magnifier'].includes(tool);
      if (name === 'fill') visible = ['rect', 'ellipse'].includes(tool);
      if (name === 'font') visible = tool === 'text';
      if (name === 'blur') visible = tool === 'blur';
      if (name === 'pixelate') visible = tool === 'pixelate';
      if (name === 'magnifier') visible = tool === 'magnifier';
      group.hidden = !visible;
    });
  }

  updateSaveState() {
    const el = this.host.querySelector('[data-editor-save-state]');
    if (!el) return;
    if (this.saved) {
      el.innerHTML = `<span class="status-dot"></span> Saved to library`;
      el.classList.add('saved');
    } else if (this.dirty) {
      el.innerHTML = `<span class="status-dot warn"></span> Unsaved changes`;
      el.classList.remove('saved');
    } else {
      el.innerHTML = `<span class="status-dot"></span> All changes saved`;
      el.classList.remove('saved');
    }
  }

  get selectedLayer() {
    return this.layers.find((layer) => layer.id === this.selectedId) || null;
  }

  addLayer(layer, label = 'Add annotation') {
    layer.id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    layer.visible = true;
    this.layers.push(layer);
    this.selectedId = layer.id;
    this.commit(label);
    this.updateLayers();
    this.scheduleRender();
  }

  commit(label = 'Edit') {
    this.pushHistory(label);
    this.dirty = true;
    this.saved = false;
    this.updateSaveState();
  }

  pushHistory(label = 'Edit') {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push({
      label,
      layers: deepClone(this.layers),
      watermark: { ...this.watermark },
      baseVersion: this.baseVersionIndex,
      at: Date.now()
    });
    this.historyIndex = this.history.length - 1;
    if (this.history.length > 60) {
      this.history.shift();
      this.historyIndex -= 1;
    }
    this.updateHistory();
    this.updateUndoButtons();
  }

  updateUndoButtons() {
    const undo = this.host.querySelector('[data-editor-action="undo"]');
    const redo = this.host.querySelector('[data-editor-action="redo"]');
    if (undo) undo.disabled = this.historyIndex <= 0;
    if (redo) redo.disabled = this.historyIndex >= this.history.length - 1;
  }

  async restoreHistory(index) {
    if (index < 0 || index >= this.history.length || index === this.historyIndex) return;
    const entry = this.history[index];
    this.historyIndex = index;
    this.layers = deepClone(entry.layers);
    this.watermark = { ...entry.watermark };
    this.selectedId = this.layers.some((layer) => layer.id === this.selectedId) ? this.selectedId : null;
    if (entry.baseVersion !== this.baseVersionIndex) {
      await this.restoreBaseVersion(entry.baseVersion);
    }
    this.updateLayers();
    this.updateHistory();
    this.updateUndoButtons();
    this.updateWatermarkUI();
    this.dirty = true;
    this.updateSaveState();
    this.scheduleRender();
  }

  async restoreBaseVersion(index) {
    const dataUrl = this.baseVersions[index];
    if (!dataUrl) return;
    const image = await loadImage(dataUrl);
    this.baseCanvas.width = image.naturalWidth;
    this.baseCanvas.height = image.naturalHeight;
    const context = this.baseCanvas.getContext('2d');
    context.clearRect(0, 0, this.baseCanvas.width, this.baseCanvas.height);
    context.drawImage(image, 0, 0);
    this.canvas.width = this.baseCanvas.width;
    this.canvas.height = this.baseCanvas.height;
    this.baseVersionIndex = index;
    this.host.querySelector('[data-image-size]').textContent = `${this.canvas.width} × ${this.canvas.height}`;
    this.host.querySelector('[data-dims-status]').textContent = `${this.canvas.width} × ${this.canvas.height}`;
    if (this.autoFit) this.fitToScreen(false);
  }

  updateWatermarkUI() {
    const toggle = this.host.querySelector('[data-prop-toggle="watermark"]');
    toggle?.classList.toggle('on', this.watermark.enabled);
    const fields = this.host.querySelector('[data-watermark-fields]');
    const off = this.host.querySelector('[data-watermark-off]');
    if (fields) fields.hidden = !this.watermark.enabled;
    if (off) off.hidden = this.watermark.enabled;
    const text = this.host.querySelector('[data-watermark-text]');
    if (text) text.value = this.watermark.text;
    const opacity = this.host.querySelector('[data-watermark-opacity]');
    if (opacity) opacity.value = String(Math.round(this.watermark.opacity * 100));
    const value = this.host.querySelector('.editor-watermark .range-value');
    if (value) value.textContent = `${Math.round(this.watermark.opacity * 100)}%`;
    this.host.querySelector('[data-editor-action="watermark"]')?.classList.toggle('active', this.watermark.enabled);
  }

  updateLayers() {
    const container = this.host.querySelector('[data-layers]');
    const count = this.host.querySelector('[data-layer-count]');
    if (!container) return;
    count.textContent = String(this.layers.length);
    if (!this.layers.length) {
      container.innerHTML = `<div class="editor-empty-layers">${icon('layers', 17)} <span>Annotations will appear here</span></div>`;
    } else {
      container.innerHTML = [...this.layers].reverse().map((layer) => `
        <div class="editor-layer ${layer.id === this.selectedId ? 'active' : ''}" data-layer-id="${layer.id}">
          <span class="editor-layer-icon">${icon(LAYER_ICONS[layer.type] || 'layers', 12)}</span>
          <span class="editor-layer-name">${escapeHtml(this.layerLabel(layer))}</span>
          <button class="editor-layer-eye ${layer.visible ? '' : 'off'}" data-layer-visibility="${layer.id}" type="button" aria-label="Toggle visibility">${icon(layer.visible ? 'eye' : 'eyeOff', 11)}</button>
          <button class="editor-layer-remove" data-layer-remove="${layer.id}" type="button" aria-label="Delete layer">${icon('x', 10)}</button>
        </div>
      `).join('');
    }
    const selected = this.selectedLayer;
    const status = this.host.querySelector('[data-selected-layer-status]');
    if (status) status.textContent = selected ? this.layerLabel(selected) : 'Nothing selected';
    this.updateUndoButtons();
  }

  layerLabel(layer) {
    if (layer.type === 'text') return `“${(layer.text || '').slice(0, 24)}”`;
    const index = this.layers.filter((entry) => entry.type === layer.type).indexOf(layer) + 1;
    return `${LAYER_NAMES[layer.type] || 'Layer'} ${index}`;
  }

  updateHistory() {
    const list = this.host.querySelector('[data-history-list]');
    const count = this.host.querySelector('[data-history-count]');
    if (!list) return;
    count.textContent = String(this.history.length);
    list.innerHTML = [...this.history].reverse().slice(0, 8).map((entry) => {
      const originalIndex = this.history.indexOf(entry);
      return `
        <button class="editor-history-item ${originalIndex === this.historyIndex ? 'active' : ''}" data-history-index="${originalIndex}" type="button">
          <span>${icon(originalIndex === this.historyIndex ? 'dot' : 'history', 9)}</span>
          <span>${escapeHtml(entry.label)}</span>
          ${originalIndex === this.historyIndex ? '<i>Current</i>' : ''}
        </button>
      `;
    }).join('');
    this.updateUndoButtons();
  }

  updateCropBar() {
    const bar = this.host.querySelector('[data-crop-bar]');
    if (!bar) return;
    bar.hidden = !(this.cropRect && this.tool === 'crop');
    if (this.cropRect) {
      this.host.querySelector('[data-crop-size]').textContent = `${Math.round(this.cropRect.w)} × ${Math.round(this.cropRect.h)}`;
    }
  }

  fitToScreen(notify = true) {
    if (!this.canvas || !this.canvas.width) return;
    const rect = this.stage.getBoundingClientRect();
    const availableW = Math.max(100, rect.width - 80);
    const availableH = Math.max(100, rect.height - 80);
    const fit = Math.min(availableW / this.canvas.width, availableH / this.canvas.height);
    this.zoom = clamp(fit, 0.03, 1);
    this.autoFit = true;
    this.applyZoom();
    if (notify) toast('Zoomed to fit', { type: 'info', duration: 1400 });
  }

  setZoom(zoom, anchor = null) {
    this.zoom = clamp(zoom, 0.03, 50);
    this.autoFit = false;
    this.applyZoom();
    if (anchor) {
      const stageRect = this.stage.getBoundingClientRect();
      const dx = anchor.x - stageRect.left;
      const dy = anchor.y - stageRect.top;
      const ratio = this.zoom / (anchor.oldZoom || this.zoom);
      this.stage.scrollLeft = (this.stage.scrollLeft + dx) * ratio - dx;
      this.stage.scrollTop = (this.stage.scrollTop + dy) * ratio - dy;
    }
  }

  applyZoom() {
    if (!this.canvasWrap || !this.canvas) return;
    const width = Math.max(1, Math.round(this.canvas.width * this.zoom));
    const height = Math.max(1, Math.round(this.canvas.height * this.zoom));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvasWrap.style.width = `${width}px`;
    this.canvasWrap.style.height = `${height}px`;
    this.host.querySelectorAll('[data-zoom-label]').forEach((el) => { el.textContent = `${Math.round(this.zoom * 100)}%`; });
    const zoomStatus = this.host.querySelector('[data-zoom-status]');
    if (zoomStatus) zoomStatus.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  zoomBy(direction, anchor = null) {
    const current = this.zoom;
    let next;
    if (direction === 'in') {
      next = current < 0.1 ? 0.1 : current < 0.25 ? 0.25 : current < 0.5 ? 0.5 : current < 1 ? 1 : current < 2 ? 2 : current < 5 ? 5 : current < 10 ? 10 : current < 20 ? 20 : Math.min(50, current + 10);
    } else {
      next = current > 20 ? 20 : current > 10 ? 10 : current > 5 ? 5 : current > 2 ? 2 : current > 1 ? 1 : current > 0.5 ? 0.5 : current > 0.25 ? 0.25 : current > 0.1 ? 0.1 : Math.max(0.03, current - 0.02);
    }
    this.setZoom(next, anchor);
  }

  async runAction(action) {
    if (action === 'back') {
      if (this.dirty && this.history.length > 1) {
        const leave = await confirmDialog({
          title: 'Leave the editor?',
          message: 'Your annotations have not been saved to the library. You can still save a copy first.',
          confirmLabel: 'Leave without saving',
          danger: true
        });
        if (!leave) return;
      }
      this.app.navigate('gallery');
      return;
    }
    if (action === 'undo') {
      await this.restoreHistory(this.historyIndex - 1);
      return;
    }
    if (action === 'redo') {
      await this.restoreHistory(this.historyIndex + 1);
      return;
    }
    if (action === 'zoom-in') return this.zoomBy('in');
    if (action === 'zoom-out') return this.zoomBy('out');
    if (action === 'fit') return this.fitToScreen();
    if (action === 'actual') {
      this.setZoom(1);
      toast('Zoom set to 100%', { type: 'info', duration: 1400 });
      return;
    }
    if (action === 'zoom-menu') return this.openZoomMenu();
    if (action === 'copy') return this.copyToClipboard();
    if (action === 'share') return this.share();
    if (action === 'save') return this.saveToLibrary();
    if (action === 'export') return this.exportPng();
    if (action === 'open') return this.openImagePicker();
    if (action === 'watermark') return this.toggleWatermark();
    if (action === 'delete-layer') return this.deleteSelectedLayer();
    if (action === 'crop-apply') return this.applyCrop();
    if (action === 'crop-cancel') {
      this.cropRect = null;
      this.updateCropBar();
      this.scheduleRender();
      return;
    }
    if (action === 'zoom-reset') {
      this.setZoom(1);
      return;
    }
  }

  openZoomMenu() {
    const modal = openModal({
      title: 'Zoom',
      subtitle: 'Inspect every pixel. Up to 5000%.',
      size: 'sm',
      content: `
        <div class="editor-zoom-grid">
          ${[25, 50, 100, 200, 400, 800, 1600, 3200, 5000].map((value) => `<button class="btn btn-secondary" data-zoom-set="${value / 100}" type="button">${value}%</button>`).join('')}
        </div>
        <div class="editor-zoom-slider">
          <label class="field-label">Custom zoom <span class="field-hint" data-zoom-custom-value>${Math.round(this.zoom * 100)}%</span></label>
          <input class="slider" type="range" min="3" max="5000" value="${Math.round(this.zoom * 100)}" data-zoom-custom>
        </div>
      `
    });
    modal.modal.querySelectorAll('[data-zoom-set]').forEach((button) => button.addEventListener('click', () => {
      this.setZoom(Number(button.dataset.zoomSet));
      modal.close();
    }));
    const slider = modal.modal.querySelector('[data-zoom-custom]');
    slider.addEventListener('input', () => {
      modal.modal.querySelector('[data-zoom-custom-value]').textContent = `${slider.value}%`;
      this.setZoom(Number(slider.value) / 100);
    });
  }

  onPointerDown = (event) => {
    if (event.button === 1 || this.spaceDown) {
      event.preventDefault();
      this.panning = { x: event.clientX, y: event.clientY, left: this.stage.scrollLeft, top: this.stage.scrollTop };
      this.stage.classList.add('panning');
      return;
    }
    if (!this.canvasWrap || this.canvasWrap.hidden) return;
    if (!event.target.closest('[data-editor-canvas]') && !event.target.closest('[data-canvas-wrap]')) return;
    if (event.button !== 0) return;
    const point = this.pointFromEvent(event);
    if (!point) return;
    event.preventDefault();

    if (this.tool === 'picker') {
      this.pickColor(point);
      return;
    }
    if (this.tool === 'text') {
      this.showTextInput(point);
      return;
    }
    if (this.tool === 'select') {
      const hit = this.hitTest(point);
      this.selectedId = hit?.id || null;
      if (hit) {
        this.drag = {
          type: 'move',
          layerId: hit.id,
          start: point,
          original: deepClone(hit),
          moved: false
        };
      }
      this.updateLayers();
      this.scheduleRender();
      return;
    }
    if (this.tool === 'crop') {
      this.drag = { type: 'crop', start: point, end: point };
      this.cropRect = { x: point.x, y: point.y, w: 1, h: 1 };
      this.updateCropBar();
      this.scheduleRender();
      return;
    }

    const base = { type: this.tool, color: this.color, strokeWidth: this.strokeWidth, opacity: this.opacity, fill: this.fill };
    if (this.tool === 'pen') {
      this.drag = { type: 'draw', layer: { ...base, type: 'pen', points: [point] }, start: point };
    } else if (this.tool === 'arrow' || this.tool === 'line') {
      this.drag = { type: 'draw', layer: { ...base, type: this.tool, from: point, to: point }, start: point };
    } else if (this.tool === 'rect' || this.tool === 'ellipse' || this.tool === 'highlight' || this.tool === 'blur' || this.tool === 'pixelate') {
      const layer = { ...base, type: this.tool, x: point.x, y: point.y, w: 1, h: 1 };
      if (this.tool === 'blur') layer.strength = this.blurStrength;
      if (this.tool === 'pixelate') layer.block = this.pixelSize;
      this.drag = { type: 'draw', layer, start: point };
    } else if (this.tool === 'magnifier') {
      this.drag = { type: 'draw', layer: { ...base, type: 'magnifier', x: point.x, y: point.y, r: 20, zoom: this.magnifierZoom }, start: point };
    }
    if (this.drag?.layer) {
      this.draft = this.drag.layer;
      this.scheduleRender();
    }
  };

  onPointerMove = (event) => {
    if (this.panning) {
      this.stage.scrollLeft = this.panning.left - (event.clientX - this.panning.x);
      this.stage.scrollTop = this.panning.top - (event.clientY - this.panning.y);
      return;
    }
    if (!this.drag) return;
    const point = this.pointFromEvent(event);
    if (!point) return;
    if (this.drag.type === 'crop') {
      const x = Math.min(this.drag.start.x, point.x);
      const y = Math.min(this.drag.start.y, point.y);
      const w = Math.abs(point.x - this.drag.start.x);
      const h = Math.abs(point.y - this.drag.start.y);
      this.cropRect = { x, y, w, h };
      this.updateCropBar();
      this.scheduleRender();
      return;
    }
    if (this.drag.type === 'move') {
      const layer = this.layers.find((entry) => entry.id === this.drag.layerId);
      if (!layer) return;
      const dx = point.x - this.drag.start.x;
      const dy = point.y - this.drag.start.y;
      this.moveLayer(layer, this.drag.original, dx, dy);
      this.drag.moved = true;
      this.dirty = true;
      this.updateSaveState();
      this.scheduleRender();
      return;
    }
    if (this.drag.type === 'draw' && this.draft) {
      const layer = this.draft;
      if (layer.type === 'pen') {
        const last = layer.points[layer.points.length - 1];
        if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1) layer.points.push(point);
      } else if (layer.type === 'arrow' || layer.type === 'line') {
        layer.to = point;
      } else if (layer.type === 'magnifier') {
        layer.r = Math.max(10, Math.hypot(point.x - this.drag.start.x, point.y - this.drag.start.y));
      } else {
        layer.x = Math.min(this.drag.start.x, point.x);
        layer.y = Math.min(this.drag.start.y, point.y);
        layer.w = Math.abs(point.x - this.drag.start.x);
        layer.h = Math.abs(point.y - this.drag.start.y);
      }
      this.scheduleRender();
    }
  };

  onPointerUp = () => {
    if (this.panning) {
      this.panning = null;
      this.stage.classList.remove('panning');
      return;
    }
    if (!this.drag) return;
    if (this.drag.type === 'crop') {
      const rect = this.cropRect;
      if (!rect || rect.w < 4 || rect.h < 4) {
        this.cropRect = null;
        this.updateCropBar();
      } else {
        this.updateCropBar();
      }
      this.scheduleRender();
      this.drag = null;
      return;
    }
    if (this.drag.type === 'move') {
      if (this.drag.moved) this.commit('Move layer');
      this.drag = null;
      return;
    }
    if (this.drag.type === 'draw') {
      const layer = this.draft;
      this.draft = null;
      this.drag = null;
      if (layer && this.layerHasSize(layer)) {
        this.addLayer(layer, `Add ${LAYER_NAMES[layer.type] || 'annotation'}`);
      } else {
        this.scheduleRender();
      }
    }
  };

  layerHasSize(layer) {
    if (layer.type === 'pen') return layer.points.length > 1;
    if (layer.type === 'arrow' || layer.type === 'line') return Math.hypot(layer.to.x - layer.from.x, layer.to.y - layer.from.y) > 4;
    if (layer.type === 'magnifier') return layer.r > 8;
    return layer.w > 4 && layer.h > 4;
  }

  moveLayer(layer, original, dx, dy) {
    if (['pen'].includes(layer.type)) {
      layer.points = original.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
    } else if (['arrow', 'line'].includes(layer.type)) {
      layer.from = { x: original.from.x + dx, y: original.from.y + dy };
      layer.to = { x: original.to.x + dx, y: original.to.y + dy };
    } else if (layer.type === 'magnifier') {
      layer.x = original.x + dx;
      layer.y = original.y + dy;
    } else {
      layer.x = original.x + dx;
      layer.y = original.y + dy;
    }
  }

  hitTest(point) {
    for (let index = this.layers.length - 1; index >= 0; index -= 1) {
      const layer = this.layers[index];
      if (!layer.visible) continue;
      const bounds = this.layerBounds(layer);
      if (bounds && point.x >= bounds.x - 4 && point.x <= bounds.x + bounds.w + 4 && point.y >= bounds.y - 4 && point.y <= bounds.y + bounds.h + 4) {
        return layer;
      }
    }
    return null;
  }

  layerBounds(layer) {
    if (!layer) return null;
    if (layer.type === 'pen') {
      if (!layer.points.length) return null;
      const xs = layer.points.map((point) => point.x);
      const ys = layer.points.map((point) => point.y);
      const pad = layer.strokeWidth / 2;
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }
    if (layer.type === 'arrow' || layer.type === 'line') {
      const pad = layer.strokeWidth / 2 + 4;
      return { x: Math.min(layer.from.x, layer.to.x) - pad, y: Math.min(layer.from.y, layer.to.y) - pad, w: Math.abs(layer.to.x - layer.from.x) + pad * 2, h: Math.abs(layer.to.y - layer.from.y) + pad * 2 };
    }
    if (layer.type === 'magnifier') {
      return { x: layer.x - layer.r, y: layer.y - layer.r, w: layer.r * 2, h: layer.r * 2 };
    }
    if (layer.type === 'text') {
      const lines = String(layer.text || '').split('\n');
      this.g.save();
      this.g.font = `${layer.fontWeight || 700} ${layer.fontSize || 32}px "${layer.fontFamily || 'Sora'}", sans-serif`;
      const width = Math.max(...lines.map((line) => this.g.measureText(line).width), 10);
      this.g.restore();
      return { x: layer.x, y: layer.y, w: width, h: lines.length * (layer.fontSize || 32) * 1.25 };
    }
    return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
  }

  pointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * this.canvas.width, 0, this.canvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * this.canvas.height, 0, this.canvas.height)
    };
  }

  showTextInput(point) {
    this.closeTextInput();
    const zoom = this.zoom;
    const textarea = document.createElement('textarea');
    textarea.className = 'editor-inline-text';
    textarea.placeholder = 'Type your note…';
    textarea.style.left = `${point.x * zoom}px`;
    textarea.style.top = `${point.y * zoom}px`;
    textarea.style.fontSize = `${Math.max(13, this.fontSize * zoom)}px`;
    textarea.style.fontFamily = `${this.fontFamily}, sans-serif`;
    textarea.style.fontWeight = String(this.fontWeight);
    textarea.style.color = this.color;
    this.textLayer.appendChild(textarea);
    this.textEditor = textarea;
    requestAnimationFrame(() => textarea.focus());
    const finish = (commit) => {
      const value = textarea.value.trim();
      const x = point.x;
      const y = point.y;
      this.closeTextInput();
      if (commit && value) {
        this.addLayer({
          type: 'text',
          text: value,
          x,
          y,
          color: this.color,
          opacity: this.opacity,
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          fontWeight: this.fontWeight,
          strokeWidth: 0
        }, 'Add text');
      }
    };
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        finish(true);
      }
    });
    textarea.addEventListener('blur', () => finish(true));
  }

  closeTextInput() {
    if (this.textEditor) {
      const editor = this.textEditor;
      this.textEditor = null;
      editor.remove();
    }
  }

  pickColor(point) {
    try {
      const data = this.baseCanvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
      const hex = hexFromRgb(data[0], data[1], data[2]);
      this.color = hex;
      this.updateColorUI();
      this.setTool('select');
      copyText(hex, `${hex} picked and copied`);
    } catch {
      toast('Could not sample that pixel', { type: 'error' });
    }
  }

  onWheel = (event) => {
    if (!this.canvas || this.canvasWrap.hidden) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const oldZoom = this.zoom;
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    this.setZoom(clamp(this.zoom * factor, 0.03, 50), { x: event.clientX, y: event.clientY, oldZoom });
  };

  onKeyDown(event) {
    if (this.destroyed) return;
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
      if (event.key === 'Escape') active.blur();
      return;
    }
    if (event.code === 'Space') {
      this.spaceDown = true;
      this.stage.classList.add('space-pan');
      event.preventDefault();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.restoreHistory(this.historyIndex + 1);
      else this.restoreHistory(this.historyIndex - 1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.restoreHistory(this.historyIndex + 1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveToLibrary();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      event.preventDefault();
      this.copyToClipboard();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedId) {
        event.preventDefault();
        this.deleteSelectedLayer();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (this.cropRect) {
        this.cropRect = null;
        this.updateCropBar();
        this.scheduleRender();
      } else {
        this.selectedId = null;
        this.updateLayers();
        this.scheduleRender();
      }
      return;
    }
    if (event.key === 'Enter' && this.cropRect) {
      this.applyCrop();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      this.zoomBy('in');
      return;
    }
    if (event.key === '-') {
      this.zoomBy('out');
      return;
    }
    if (event.key.toLowerCase() === 'w') {
      this.toggleWatermark();
      return;
    }
    const tool = TOOLS.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
    if (tool) {
      event.preventDefault();
      this.setTool(tool.id);
    }
  }

  deleteSelectedLayer() {
    if (!this.selectedId) {
      toast('Select a layer first', { type: 'info' });
      return;
    }
    this.layers = this.layers.filter((layer) => layer.id !== this.selectedId);
    this.selectedId = null;
    this.commit('Delete layer');
    this.updateLayers();
    this.scheduleRender();
  }

  async applyCrop() {
    if (!this.cropRect || this.cropRect.w < 4 || this.cropRect.h < 4) {
      toast('Drag a crop area first', { type: 'info' });
      return;
    }
    const rect = {
      x: Math.round(this.cropRect.x),
      y: Math.round(this.cropRect.y),
      w: Math.round(this.cropRect.w),
      h: Math.round(this.cropRect.h)
    };
    this.renderCanvas({ exporting: true });
    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, Math.min(rect.w, this.canvas.width - rect.x));
    cropped.height = Math.max(1, Math.min(rect.h, this.canvas.height - rect.y));
    cropped.getContext('2d').drawImage(this.canvas, rect.x, rect.y, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    this.baseCanvas = cropped;
    this.baseVersions.push(canvasToDataUrl(cropped));
    this.baseVersionIndex = this.baseVersions.length - 1;
    this.layers = [];
    this.selectedId = null;
    this.cropRect = null;
    this.canvas.width = cropped.width;
    this.canvas.height = cropped.height;
    this.updateCropBar();
    this.host.querySelector('[data-image-size]').textContent = `${cropped.width} × ${cropped.height}`;
    this.host.querySelector('[data-dims-status]').textContent = `${cropped.width} × ${cropped.height}`;
    this.fitToScreen(false);
    this.commit('Crop image');
    this.updateLayers();
    this.scheduleRender();
    toast('Image cropped', { type: 'success', detail: 'Annotations were flattened into the new image.' });
  }

  renderCanvas({ exporting = false } = {}) {
    if (!this.g || !this.baseCanvas.width) return;
    const g = this.g;
    const width = this.canvas.width;
    const height = this.canvas.height;
    g.save();
    g.clearRect(0, 0, width, height);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.baseCanvas, 0, 0);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      this.drawLayer(g, layer);
    }
    if (this.draft) this.drawLayer(g, this.draft);
    if (this.watermark.enabled) this.drawWatermark(g);
    if (!exporting && this.selectedId) {
      const layer = this.selectedLayer;
      if (layer) this.drawSelection(g, layer);
    }
    if (!exporting && this.cropRect) this.drawCropOverlay(g);
    g.restore();
  }

  drawLayer(g, layer) {
    const opacity = layer.opacity ?? 1;
    g.save();
    g.globalAlpha = opacity;
    g.strokeStyle = layer.color || this.color;
    g.fillStyle = layer.color || this.color;
    g.lineWidth = layer.strokeWidth || this.strokeWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (layer.type === 'pen') {
      const points = layer.points || [];
      if (points.length > 1) {
        g.beginPath();
        points.forEach((point, index) => {
          if (index === 0) g.moveTo(point.x, point.y);
          else g.lineTo(point.x, point.y);
        });
        g.stroke();
      }
    } else if (layer.type === 'arrow' || layer.type === 'line') {
      g.beginPath();
      g.moveTo(layer.from.x, layer.from.y);
      g.lineTo(layer.to.x, layer.to.y);
      g.stroke();
      if (layer.type === 'arrow') {
        const angle = Math.atan2(layer.to.y - layer.from.y, layer.to.x - layer.from.x);
        const size = Math.max(12, (layer.strokeWidth || 4) * 4);
        g.beginPath();
        g.moveTo(layer.to.x, layer.to.y);
        g.lineTo(layer.to.x - size * Math.cos(angle - Math.PI / 6), layer.to.y - size * Math.sin(angle - Math.PI / 6));
        g.lineTo(layer.to.x - size * Math.cos(angle + Math.PI / 6), layer.to.y - size * Math.sin(angle + Math.PI / 6));
        g.closePath();
        g.fill();
      }
    } else if (layer.type === 'rect') {
      if (layer.fill) {
        g.globalAlpha = opacity * 0.2;
        g.fillRect(layer.x, layer.y, layer.w, layer.h);
        g.globalAlpha = opacity;
      }
      g.strokeRect(layer.x, layer.y, layer.w, layer.h);
    } else if (layer.type === 'ellipse') {
      g.beginPath();
      g.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, Math.max(0.1, layer.w / 2), Math.max(0.1, layer.h / 2), 0, 0, Math.PI * 2);
      if (layer.fill) {
        g.globalAlpha = opacity * 0.2;
        g.fill();
        g.globalAlpha = opacity;
      }
      g.stroke();
    } else if (layer.type === 'highlight') {
      g.globalAlpha = opacity * 0.34;
      g.fillStyle = layer.color;
      g.fillRect(layer.x, layer.y, layer.w, layer.h);
      g.globalAlpha = opacity * 0.7;
      g.lineWidth = 1;
      g.strokeStyle = rgba(layer.color, 0.6);
      g.strokeRect(layer.x, layer.y, layer.w, layer.h);
    } else if (layer.type === 'blur') {
      g.beginPath();
      g.rect(layer.x, layer.y, layer.w, layer.h);
      g.clip();
      g.filter = `blur(${layer.strength || 16}px)`;
      g.drawImage(this.baseCanvas, 0, 0);
      g.filter = 'none';
    } else if (layer.type === 'pixelate') {
      const block = Math.max(2, layer.block || 14);
      const source = document.createElement('canvas');
      source.width = Math.max(1, Math.ceil(layer.w / block));
      source.height = Math.max(1, Math.ceil(layer.h / block));
      source.getContext('2d').drawImage(this.baseCanvas, layer.x, layer.y, layer.w, layer.h, 0, 0, source.width, source.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(source, 0, 0, source.width, source.height, layer.x, layer.y, layer.w, layer.h);
      g.imageSmoothingEnabled = true;
    } else if (layer.type === 'text') {
      const lines = String(layer.text || '').split('\n');
      const size = layer.fontSize || 32;
      g.font = `${layer.fontWeight || 700} ${size}px "${layer.fontFamily || 'Sora'}", sans-serif`;
      g.textBaseline = 'top';
      g.fillStyle = layer.color;
      lines.forEach((line, index) => {
        g.fillText(line, layer.x, layer.y + index * size * 1.25);
      });
    } else if (layer.type === 'magnifier') {
      const radius = Math.max(1, layer.r);
      g.save();
      g.beginPath();
      g.arc(layer.x, layer.y, radius, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#05070d';
      g.fillRect(layer.x - radius, layer.y - radius, radius * 2, radius * 2);
      g.translate(layer.x, layer.y);
      g.scale(layer.zoom || 3, layer.zoom || 3);
      g.drawImage(this.baseCanvas, -layer.x, -layer.y);
      g.restore();
      g.beginPath();
      g.arc(layer.x, layer.y, radius, 0, Math.PI * 2);
      g.strokeStyle = layer.color || '#ffd700';
      g.lineWidth = Math.max(2, radius * 0.045);
      g.stroke();
      g.beginPath();
      g.arc(layer.x, layer.y, radius + 2, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(0,0,0,.4)';
      g.lineWidth = 2;
      g.stroke();
    }
    g.restore();
  }

  drawWatermark(g) {
    const { text, opacity } = this.watermark;
    const size = Math.max(14, Math.round(this.canvas.width * 0.016));
    g.save();
    g.globalAlpha = opacity;
    g.font = `600 ${size}px Sora, sans-serif`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    const padding = size * 1.3;
    const width = g.measureText(text).width;
    g.fillStyle = 'rgba(3, 6, 12, .45)';
    g.beginPath();
    const x = this.canvas.width - padding;
    const y = this.canvas.height - padding;
    g.roundRect(x - width - size * 0.9, y - size * 1.15, width + size * 1.8, size * 1.7, size * 0.45);
    g.fill();
    g.fillStyle = '#ffd700';
    g.beginPath();
    g.roundRect(x - width - size * 0.35, y - size * 0.78, size * 0.12, size * 0.78, size * 0.06);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(text, x, y);
    g.restore();
  }

  drawSelection(g, layer) {
    const bounds = this.layerBounds(layer);
    if (!bounds) return;
    const scale = 1 / Math.max(0.05, this.zoom);
    g.save();
    g.strokeStyle = '#FFD700';
    g.lineWidth = 1.5 * scale;
    g.setLineDash([5 * scale, 4 * scale]);
    g.strokeRect(bounds.x - 4 * scale, bounds.y - 4 * scale, bounds.w + 8 * scale, bounds.h + 8 * scale);
    g.setLineDash([]);
    const handle = 5 * scale;
    g.fillStyle = '#FFD700';
    const corners = [
      [bounds.x - 4 * scale, bounds.y - 4 * scale],
      [bounds.x + bounds.w + 4 * scale, bounds.y - 4 * scale],
      [bounds.x - 4 * scale, bounds.y + bounds.h + 4 * scale],
      [bounds.x + bounds.w + 4 * scale, bounds.y + bounds.h + 4 * scale]
    ];
    corners.forEach(([x, y]) => {
      g.fillRect(x - handle / 2, y - handle / 2, handle, handle);
    });
    g.restore();
  }

  drawCropOverlay(g) {
    const rect = this.cropRect;
    const scale = 1 / Math.max(0.05, this.zoom);
    g.save();
    g.fillStyle = 'rgba(3, 5, 10, .58)';
    g.fillRect(0, 0, this.canvas.width, rect.y);
    g.fillRect(0, rect.y, rect.x, rect.h);
    g.fillRect(rect.x + rect.w, rect.y, this.canvas.width - rect.x - rect.w, rect.h);
    g.fillRect(0, rect.y + rect.h, this.canvas.width, this.canvas.height - rect.y - rect.h);
    g.strokeStyle = '#FFD700';
    g.lineWidth = 2 * scale;
    g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    g.setLineDash([6 * scale, 5 * scale]);
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 1 * scale;
    for (let i = 1; i < 3; i += 1) {
      g.beginPath();
      g.moveTo(rect.x + (rect.w / 3) * i, rect.y);
      g.lineTo(rect.x + (rect.w / 3) * i, rect.y + rect.h);
      g.moveTo(rect.x, rect.y + (rect.h / 3) * i);
      g.lineTo(rect.x + rect.w, rect.y + (rect.h / 3) * i);
      g.stroke();
    }
    g.restore();
  }

  scheduleRender() {
    if (this.destroyed || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderCanvas();
      this.applyZoom();
    });
  }

  exportDataUrl() {
    this.renderCanvas({ exporting: true });
    return this.canvas.toDataURL('image/png');
  }

  async saveToLibrary(options = {}) {
    if (!this.canvas.width) {
      toast('Open an image first', { type: 'info' });
      return null;
    }
    const dataUrl = this.exportDataUrl();
    const title = this.host.querySelector('[data-editor-title]').value.trim() || 'Edited capture';
    try {
      const item = await window.snapx.gallery.add({
        dataUrl,
        title,
        width: this.canvas.width,
        height: this.canvas.height,
        source: 'editor',
        tags: ['edited', ...(this.capture?.tags || []).slice(0, 4)]
      });
      await this.app.refreshGallery({ silent: true });
      this.saved = true;
      this.dirty = false;
      this.updateSaveState();
      if (!options.silent) toast('Saved to your library', { type: 'success', detail: title });
      return item;
    } catch (error) {
      toast(error.message || 'Could not save capture', { type: 'error' });
      return null;
    }
  }

  async copyToClipboard() {
    if (!this.canvas.width) return;
    try {
      await window.snapx.clipboard.image(this.exportDataUrl());
      toast('Image copied to clipboard', { type: 'success' });
    } catch {
      toast('Could not copy image', { type: 'error' });
    }
  }

  async share() {
    if (!this.canvas.width) return;
    const dataUrl = this.exportDataUrl();
    const title = this.host.querySelector('[data-editor-title]').value.trim() || 'SnapX capture';
    this.app.openShare({ dataUrl, title, source: 'editor', width: this.canvas.width, height: this.canvas.height, tags: this.capture?.tags });
  }

  async exportPng() {
    if (!this.canvas.width) return;
    const dataUrl = this.exportDataUrl();
    const title = this.host.querySelector('[data-editor-title]').value.trim() || 'SnapX capture';
    downloadDataUrl(dataUrl, `${title.replace(/[\\/:*?"<>|]+/g, '-')}.png`);
    toast('PNG downloaded', { type: 'success', detail: `${this.canvas.width} × ${this.canvas.height}` });
  }
}
