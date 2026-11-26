import { DEMO_CAPTURES } from './data.js';
import { applyTheme, getTheme } from './themes.js';

export const state = {
  info: null,
  settings: null,
  gallery: [],
  samples: DEMO_CAPTURES.map((item) => ({ ...item, demo: true })),
  stats: { count: 0, bytes: 0, path: '' },
  screenPermission: 'granted',
  currentPage: 'dashboard',
  currentParams: {},
  selectedCapture: null,
  editorCapture: null,
  aiCapture: null,
  busy: false,
  toolbarVisible: false,
  recordings: [],
  activity: [],
  notificationSeen: false
};

export function captures() {
  return [...state.gallery, ...state.samples];
}

export function allCaptures() {
  return captures();
}

export function getCapture(id) {
  return captures().find((item) => item.id === id) || null;
}

export function getDisplayCapture() {
  return state.gallery.find((item) => item.kind !== 'gif' && item.width > 0) || state.samples[0];
}

export function getAiCapture() {
  return getCapture(state.aiCapture) || getDisplayCapture();
}

export function findCaptureBySource(source) {
  return captures().find((item) => item.source === source);
}

export function normalizeSettings(raw = {}) {
  const defaults = {
    theme: 'royal',
    capture: {
      mode: 'region',
      delay: 0,
      displayId: null,
      includeCursor: true,
      copyAfterCapture: true,
      openEditor: false,
      sound: true,
      format: 'png',
      quality: 95
    },
    behavior: {
      launchAtLogin: false,
      minimizeToTray: true,
      closeToTray: false,
      autoSave: true,
      notify: true
    },
    ui: {
      reduceMotion: false,
      acrylic: true,
      cornerRadius: 22,
      density: 'comfortable'
    },
    shortcuts: {
      region: 'CommandOrControl+Shift+1',
      full: 'CommandOrControl+Shift+2',
      window: 'CommandOrControl+Shift+3',
      toolbar: 'CommandOrControl+Shift+4'
    },
    ai: {
      provider: 'openai',
      model: 'gpt-4o-mini'
    },
    integrations: {
      cloudSync: false
    },
    floatingToolbar: false,
    samplesHidden: false,
    onboardingDone: true
  };
  return {
    ...defaults,
    ...raw,
    capture: { ...defaults.capture, ...(raw.capture || {}) },
    behavior: { ...defaults.behavior, ...(raw.behavior || {}) },
    ui: { ...defaults.ui, ...(raw.ui || {}) },
    shortcuts: { ...defaults.shortcuts, ...(raw.shortcuts || {}) },
    ai: { ...defaults.ai, ...(raw.ai || {}) },
    integrations: { ...defaults.integrations, ...(raw.integrations || {}) },
    secrets: raw.secrets || {}
  };
}

export function applySettingsTheme(settings = state.settings) {
  if (!settings) return;
  const theme = getTheme(settings.theme);
  applyTheme(theme, {
    cornerRadius: settings.ui?.cornerRadius ?? 22,
    reduceMotion: Boolean(settings.ui?.reduceMotion),
    acrylic: settings.ui?.acrylic !== false,
    density: settings.ui?.density || 'comfortable'
  });
}

export function totalBytes() {
  return captures().reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
}

export function captureTitleFromSource(source, index = 0) {
  const map = {
    region: 'Region capture',
    lasso: 'Freeform capture',
    window: 'Window capture',
    full: 'Display capture',
    display: 'Display capture',
    multi: 'All displays',
    scroll: 'Scrolling capture',
    scrolling: 'Scrolling capture',
    video: 'Screen recording',
    gif: 'GIF recording',
    import: 'Imported image'
  };
  return `${map[source] || 'SnapX capture'}${index ? ` ${index + 1}` : ''}`;
}

export function displaySize(item) {
  if (!item) return '';
  if (item.width && item.height) return `${item.width} × ${item.height}`;
  return '—';
}
