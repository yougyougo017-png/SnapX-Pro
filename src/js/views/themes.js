import { icon } from '../icons.js';
import { escapeHtml, toast } from '../ui.js';
import { state } from '../state.js';
import { THEMES, COMMUNITY_THEMES, getTheme, applyTheme } from '../themes.js';

function themeCard(theme, active) {
  return `
    <button class="theme-card ${active ? 'active' : ''} ${theme.community ? 'community' : ''}" data-theme-id="${theme.id}" type="button">
      <span class="theme-card-preview" style="background:${theme.previewGradient}">
        <span class="theme-mini" style="--mini-bg:${theme.vars.bg0};--mini-surface:${theme.vars.surfaceStrong};--mini-stroke:${theme.vars.stroke};--mini-text:${theme.vars.text};--mini-muted:${theme.vars.muted};--mini-accent:${theme.vars.accent};--mini-accent-2:${theme.vars.accent2}">
          <span class="theme-mini-side">
            <i class="theme-mini-logo"></i>
            <span></span><span></span><span></span><span></span>
          </span>
          <span class="theme-mini-main">
            <i class="theme-mini-title"></i>
            <span class="theme-mini-row"><i></i><i></i></span>
            <span class="theme-mini-card"></span>
          </span>
        </span>
        ${theme.signature ? `<span class="theme-signature">${icon('sparkle', 10)} SIGNATURE</span>` : ''}
        ${theme.community ? `<span class="theme-signature community">${icon('globe', 10)} COMMUNITY</span>` : ''}
        ${active ? `<span class="theme-selected">${icon('check', 11)} Active</span>` : ''}
        <span class="theme-preview-gloss"></span>
      </span>
      <span class="theme-card-meta">
        <span class="theme-card-name">
          <b>${escapeHtml(theme.name)}</b>
          <small>${escapeHtml(theme.subname || theme.tagline)}</small>
          ${theme.community ? `<em class="theme-card-author">${escapeHtml(theme.author || 'Community theme')}</em>` : ''}
        </span>
        <span class="theme-card-colors">
          ${theme.preview.map((color) => `<i style="background:${color}"></i>`).join('')}
        </span>
      </span>
    </button>
  `;
}

export function renderThemes(ctx, root) {
  const currentId = state.settings?.theme || 'royal';
  const current = getTheme(currentId);
  const radius = state.settings?.ui?.cornerRadius ?? 22;
  const reduceMotion = Boolean(state.settings?.ui?.reduceMotion);
  const acrylic = state.settings?.ui?.acrylic !== false;
  const density = state.settings?.ui?.density || 'comfortable';

  root.innerHTML = `
    <div class="page themes-page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span>Appearance<span class="line"></span>${THEMES.length + COMMUNITY_THEMES.length} themes</div>
          <h1 class="page-title">Make it <span class="grad">unmistakably yours.</span></h1>
          <p class="page-sub">Eleven hand-tuned presets, three community editions, and enough control to make SnapX feel like home.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-reset-theme type="button">${icon('rotate', 14)} Reset to Royal Gold</button>
          <button class="btn btn-primary" data-theme-apply type="button">${icon('check', 14)} Keep ${escapeHtml(current.name)}</button>
        </div>
      </div>

      <section class="theme-showcase card gold-edge" data-theme-showcase>
        <div class="theme-showcase-copy">
          <span class="pill gold">${icon('sparkle', 11)} Current theme</span>
          <h2>${escapeHtml(current.name)}</h2>
          <p>${escapeHtml(current.tagline || current.subname)}</p>
          <div class="theme-showcase-swatches">
            ${current.preview.map((color) => `<span style="background:${color}" title="${color}"></span>`).join('')}
            <span class="theme-hex">${escapeHtml(current.preview[0])} / ${escapeHtml(current.preview[1])}</span>
          </div>
          <div class="theme-showcase-actions">
            <button class="btn btn-primary btn-sm" data-mode="region" type="button">${icon('camera', 13)} Try a capture</button>
            <button class="btn btn-secondary btn-sm" data-theme-browse type="button">${icon('themes', 13)} Browse all themes</button>
          </div>
        </div>
        <div class="theme-showcase-visual">
          <div class="theme-window" style="--win-bg:${current.vars.bg0};--win-surface:${current.vars.surfaceStrong};--win-stroke:${current.vars.stroke};--win-text:${current.vars.text};--win-muted:${current.vars.muted};--win-accent:${current.vars.accent};--win-accent-2:${current.vars.accent2}">
            <div class="theme-window-bar"><span></span><span></span><span></span><i>snapx://dashboard</i></div>
            <div class="theme-window-body">
              <div class="theme-window-side">
                <b class="theme-window-logo">S</b>
                <span class="on"></span><span></span><span></span><span></span>
                <i></i>
              </div>
              <div class="theme-window-main">
                <div class="theme-window-hero"><span></span><span></span><b></b></div>
                <div class="theme-window-cards"><i></i><i></i><i></i></div>
                <div class="theme-window-list"><span></span><span></span><span></span></div>
              </div>
            </div>
          </div>
          <span class="theme-showcase-glow"></span>
        </div>
      </section>

      <div class="theme-section-head" id="theme-presets">
        <div>
          <span class="eyebrow"><span class="line"></span>Signature collection</span>
          <h2>Built by SnapX Labs</h2>
        </div>
        <span class="section-hint">${THEMES.length} presets · instant switching · saved automatically</span>
      </div>
      <div class="theme-grid">
        ${THEMES.map((theme) => themeCard(theme, theme.id === currentId)).join('')}
      </div>

      <div class="theme-section-head">
        <div>
          <span class="eyebrow"><span class="line"></span>Community marketplace</span>
          <h2>Made by the community</h2>
        </div>
        <span class="section-hint">Curated, free, and one click away</span>
      </div>
      <div class="theme-grid community-grid">
        ${COMMUNITY_THEMES.map((theme) => themeCard(theme, theme.id === currentId)).join('')}
        <article class="theme-market-card card">
          <span class="theme-market-icon">${icon('globe', 22)}</span>
          <div class="theme-market-copy">
            <div class="theme-market-title">
              <h3>Theme marketplace</h3>
              <span class="badge">COMING SOON</span>
            </div>
            <p>Publish your own preset, browse the full collection, and sync themes across devices.</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-market-open type="button">${icon('external', 12)} Browse marketplace</button>
        </article>
      </div>

      <section class="theme-customize card">
        <div class="theme-customize-head">
          <div>
            <span class="eyebrow"><span class="line"></span>Fine tuning</span>
            <h2>Shape the details</h2>
          </div>
          <span class="pill">${icon('settings', 10)} Live preview</span>
        </div>
        <div class="theme-customize-grid">
          <div class="field">
            <label class="field-label">Corner radius <span class="field-hint" data-radius-value>${radius}px</span></label>
            <div class="range-row">
              <input class="slider" type="range" min="8" max="32" value="${radius}" data-radius-slider>
            </div>
            <div class="radius-preview">
              <span style="border-radius:${radius}px"></span><span style="border-radius:${Math.max(4, radius - 8)}px"></span><span style="border-radius:${Math.max(2, radius - 14)}px"></span>
            </div>
          </div>
          <div class="theme-customize-toggles">
            <div class="switch-row">
              <div class="switch-copy"><b>Acrylic &amp; blur</b><span>Frosted glass surfaces with depth</span></div>
              <button class="toggle ${acrylic ? 'on' : ''}" data-ui-toggle="acrylic" type="button" aria-label="Acrylic"></button>
            </div>
            <div class="switch-row">
              <div class="switch-copy"><b>Reduce motion</b><span>Calmer transitions and ambient movement</span></div>
              <button class="toggle ${reduceMotion ? 'on' : ''}" data-ui-toggle="reduceMotion" type="button" aria-label="Reduce motion"></button>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Interface density</label>
            <div class="segmented density-switch" data-density>
              <button class="${density === 'comfortable' ? 'active' : ''}" data-density-value="comfortable" type="button">Comfortable</button>
              <button class="${density === 'compact' ? 'active' : ''}" data-density-value="compact" type="button">Compact</button>
              <button class="${density === 'spacious' ? 'active' : ''}" data-density-value="spacious" type="button">Spacious</button>
            </div>
            <p class="field-hint">Density adjusts spacing across navigation, lists and the editor.</p>
          </div>
        </div>
      </section>
    </div>
  `;

  const applyAndSave = async (themeId, options = {}) => {
    const theme = getTheme(themeId);
    applyTheme(theme, {
      cornerRadius: Number(root.querySelector('[data-radius-slider]')?.value) || radius,
      reduceMotion: root.querySelector('[data-ui-toggle="reduceMotion"]')?.classList.contains('on'),
      acrylic: root.querySelector('[data-ui-toggle="acrylic"]')?.classList.contains('on'),
      density: root.querySelector('[data-density] .active')?.dataset.densityValue || density
    });
    await ctx.saveSettings({ theme: themeId }, { silent: true, skipApply: true });
    root.querySelectorAll('[data-theme-id]').forEach((card) => card.classList.toggle('active', card.dataset.themeId === themeId));
    root.querySelectorAll('[data-theme-id] .theme-selected').forEach((entry) => entry.remove());
    const activeCard = root.querySelector(`[data-theme-id="${CSS.escape(themeId)}"]`);
    activeCard?.querySelector('.theme-card-preview')?.insertAdjacentHTML('beforeend', `<span class="theme-selected">${icon('check', 11)} Active</span>`);
    const showcase = root.querySelector('[data-theme-showcase]');
    const copy = showcase?.querySelector('.theme-showcase-copy');
    if (copy) {
      copy.querySelector('h2').textContent = theme.name;
      copy.querySelector('p').textContent = theme.tagline || theme.subname;
      const swatches = copy.querySelector('.theme-showcase-swatches');
      if (swatches) {
        swatches.innerHTML = `${theme.preview.map((color) => `<span style="background:${color}" title="${color}"></span>`).join('')}<span class="theme-hex">${escapeHtml(theme.preview[0])} / ${escapeHtml(theme.preview[1])}</span>`;
      }
      const win = showcase.querySelector('.theme-window');
      if (win) {
        win.style.setProperty('--win-bg', theme.vars.bg0);
        win.style.setProperty('--win-surface', theme.vars.surfaceStrong);
        win.style.setProperty('--win-stroke', theme.vars.stroke);
        win.style.setProperty('--win-text', theme.vars.text);
        win.style.setProperty('--win-muted', theme.vars.muted);
        win.style.setProperty('--win-accent', theme.vars.accent);
        win.style.setProperty('--win-accent-2', theme.vars.accent2);
      }
    }
    const applyBtn = root.querySelector('[data-theme-apply]');
    if (applyBtn) applyBtn.innerHTML = `${icon('check', 14)} Keep ${escapeHtml(theme.name)}`;
    if (!options.silent) toast(`${theme.name} applied`, { type: 'success' });
  };

  root.querySelectorAll('[data-theme-id]').forEach((card) => {
    card.addEventListener('click', () => applyAndSave(card.dataset.themeId));
  });

  root.querySelector('[data-reset-theme]')?.addEventListener('click', () => applyAndSave('royal'));
  root.querySelector('[data-theme-apply]')?.addEventListener('click', () => toast(`${getTheme(state.settings?.theme || 'royal').name} saved`, { type: 'success' }));
  root.querySelector('[data-theme-browse]')?.addEventListener('click', () => root.querySelector('#theme-presets')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  root.querySelector('[data-market-open]')?.addEventListener('click', () => toast('Theme marketplace is coming soon', { type: 'info', detail: 'Community presets are already included in this build.' }));
  root.querySelector('[data-mode="region"]')?.addEventListener('click', () => ctx.runCaptureMode('region'));

  const radiusSlider = root.querySelector('[data-radius-slider]');
  radiusSlider?.addEventListener('input', () => {
    const value = Number(radiusSlider.value);
    document.documentElement.style.setProperty('--radius', `${value}px`);
    root.querySelector('[data-radius-value]').textContent = `${value}px`;
    root.querySelectorAll('.radius-preview span').forEach((span, index) => {
      span.style.borderRadius = `${Math.max(2, value - index * 7)}px`;
    });
  });
  radiusSlider?.addEventListener('change', () => {
    ctx.saveSettings({ ui: { cornerRadius: Number(radiusSlider.value) } }, { silent: true });
  });

  root.querySelectorAll('[data-ui-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('on');
      const on = toggle.classList.contains('on');
      const key = toggle.dataset.uiToggle;
      ctx.saveSettings({ ui: { [key]: on } }, { silent: true });
      toast(`${key === 'acrylic' ? 'Acrylic' : 'Reduced motion'} ${on ? 'enabled' : 'disabled'}`, { type: 'info' });
    });
  });

  root.querySelectorAll('[data-density-value]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-density-value]').forEach((entry) => entry.classList.toggle('active', entry === button));
      ctx.saveSettings({ ui: { density: button.dataset.densityValue } }, { silent: true });
      toast(`Density: ${button.dataset.densityValue}`, { type: 'info' });
    });
  });
}
