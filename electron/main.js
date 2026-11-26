'use strict';

const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  clipboard,
  nativeImage,
  dialog,
  shell,
  globalShortcut,
  protocol,
  net,
  Tray,
  Menu,
  safeStorage,
  session,
  systemPreferences,
  Notification
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = fs.promises;
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isDev = process.argv.includes('--dev');

app.setName('SnapX Pro');
if (isWin) app.setAppUserModelId('com.snapxlabs.pro');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'snapx',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let overlayWindow = null;
let toolbarWindow = null;
let tray = null;
let quitting = false;

let galleryDir = '';
let recordingsDir = '';
let galleryFile = '';
let settingsFile = '';
let secretsFile = '';
let settings = {};
let secrets = {};
let gallery = { items: [] };
let overlaySession = null;
let recordingDisplayId = null;

const DEFAULT_SETTINGS = {
  version: 1,
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

const SECRET_KEYS = new Set(['openaiKey', 'discordWebhook', 'imgurClientId']);

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readJsonSync(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

function ensureDirectories() {
  const pictures = app.getPath('pictures');
  galleryDir = path.join(pictures, 'SnapX Pro');
  recordingsDir = path.join(app.getPath('videos'), 'SnapX Pro');
  const userData = app.getPath('userData');
  galleryFile = path.join(userData, 'gallery.json');
  settingsFile = path.join(userData, 'settings.json');
  secretsFile = path.join(userData, 'secrets.json');
  fs.mkdirSync(galleryDir, { recursive: true });
  fs.mkdirSync(recordingsDir, { recursive: true });
  fs.mkdirSync(userData, { recursive: true });
}

function loadState() {
  settings = deepMerge(DEFAULT_SETTINGS, readJsonSync(settingsFile, {}));
  secrets = readJsonSync(secretsFile, {});
  const rawGallery = readJsonSync(galleryFile, { items: [] });
  gallery = { items: Array.isArray(rawGallery.items) ? rawGallery.items : [] };
  gallery.items = gallery.items.filter((item) => item && item.fileName && fs.existsSync(path.join(galleryDir, item.fileName)));
}

function publicSettings() {
  return {
    ...settings,
    secrets: {
      openaiKey: Boolean(secrets.openaiKey),
      discordWebhook: Boolean(secrets.discordWebhook),
      imgurClientId: Boolean(secrets.imgurClientId)
    }
  };
}

function encryptSecret(value) {
  if (!value) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString('base64')}`;
    }
  } catch {
    /* fall through */
  }
  return `b64:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function decryptSecret(payload) {
  if (!payload) return '';
  try {
    if (payload.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(payload.slice(4), 'base64'));
    }
    if (payload.startsWith('b64:')) {
      return Buffer.from(payload.slice(4), 'base64').toString('utf8');
    }
  } catch {
    return '';
  }
  return '';
}

function getSecret(name) {
  return decryptSecret(secrets[name] || '');
}

async function setSecret(name, value) {
  if (!SECRET_KEYS.has(name)) throw new Error('Unknown secret');
  if (!value) delete secrets[name];
  else secrets[name] = encryptSecret(String(value).trim());
  await writeJson(secretsFile, secrets);
  return true;
}

function getItemUrl(item) {
  return `snapx://capture/${encodeURIComponent(item.fileName)}`;
}

function getThumbUrl(item) {
  return item.thumbName ? `snapx://capture/${encodeURIComponent(item.thumbName)}` : getItemUrl(item);
}

function decorateItem(item) {
  return {
    ...item,
    url: getItemUrl(item),
    thumbnailUrl: getThumbUrl(item)
  };
}

function displayList() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: display.label || `Display ${index + 1}`,
    primary: display.id === primary.id,
    size: display.size,
    bounds: display.bounds,
    scaleFactor: display.scaleFactor,
    rotation: display.rotation
  }));
}

function displayForId(displayId) {
  const displays = screen.getAllDisplays();
  return displays.find((display) => String(display.id) === String(displayId))
    || screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    || screen.getPrimaryDisplay();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideCaptureWindows() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  if (toolbarWindow && !toolbarWindow.isDestroyed() && toolbarWindow.isVisible()) toolbarWindow.hide();
}

function restoreCaptureWindows() {
  if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#05070d',
    hasShadow: true,
    roundedCorners: true,
    autoHideMenuBar: true,
    title: 'SnapX Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  if (isDev) {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`[SnapX] Failed to load ${url}: ${code} ${description}`);
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false);
  });

  mainWindow.on('close', (event) => {
    if (!quitting && settings.behavior?.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    quitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (toolbarWindow && !toolbarWindow.isDestroyed()) toolbarWindow.close();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (isDev && input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.type === 'keyDown' && input.key === 'F5') {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  if (settings.floatingToolbar) createToolbarWindow(true);
}

function createOverlayWindow(display, shot, mode) {
  const bounds = display.bounds;
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    title: 'SnapX Capture Overlay',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('overlay:init', {
      screenshot: shot.dataUrl,
      width: shot.width,
      height: shot.height,
      displayLabel: display.label || `Display ${displayList().findIndex((d) => d.id === display.id) + 1}`,
      mode,
      scaleFactor: display.scaleFactor
    });
    win.show();
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    win.focus();
  });
  win.on('closed', () => {
    overlayWindow = null;
    if (overlaySession) {
      const sessionRef = overlaySession;
      overlaySession = null;
      sessionRef.resolve(null);
      restoreCaptureWindows();
    }
  });
  return win;
}

async function grabDisplay(displayId) {
  const display = displayForId(displayId);
  const requestedWidth = Math.max(640, Math.round(display.bounds.width * display.scaleFactor));
  const requestedHeight = Math.max(480, Math.round(display.bounds.height * display.scaleFactor));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: requestedWidth, height: requestedHeight },
    fetchWindowIcons: false
  });

  let source = sources.find((entry) => String(entry.display_id) === String(display.id));
  if (!source) {
    const displays = screen.getAllDisplays();
    const index = displays.findIndex((entry) => entry.id === display.id);
    source = sources[index] || sources[0];
  }
  if (!source) throw new Error('No display source was available.');

  const image = source.thumbnail;
  if (!image || image.isEmpty()) throw new Error('Screen capture returned an empty image. Check screen recording permission.');

  return {
    dataUrl: image.toDataURL(),
    width: image.getSize().width,
    height: image.getSize().height,
    displayId: display.id,
    displayLabel: display.label || 'Display',
    scaleFactor: display.scaleFactor
  };
}

async function captureRegion(mode = 'rect') {
  if (overlayWindow) return null;
  hideCaptureWindows();
  await wait(220);

  let display;
  let shot;
  try {
    display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    shot = await grabDisplay(display.id);
  } catch (error) {
    restoreCaptureWindows();
    throw error;
  }

  const win = createOverlayWindow(display, shot, mode);
  overlayWindow = win;

  return new Promise((resolve) => {
    overlaySession = { resolve, display, shot, win };
  });
}

function finishOverlay(result) {
  if (!overlaySession) return;
  const sessionRef = overlaySession;
  overlaySession = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  overlayWindow = null;
  restoreCaptureWindows();
  sessionRef.resolve(result);
}

async function listCaptureSources(types = ['screen', 'window']) {
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 640, height: 400 },
    fetchWindowIcons: true
  });

  return sources
    .filter((source) => {
      const name = (source.name || '').toLowerCase();
      return !name.includes('snapx capture overlay') && !name.includes('snapx toolbar');
    })
    .map((source) => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id || null,
      thumbnail: source.thumbnail?.isEmpty() ? null : source.thumbnail.toDataURL(),
      appIcon: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null
    }));
}

async function captureSource(sourceId, hideApp = false) {
  if (!sourceId) throw new Error('No capture source selected.');
  if (hideApp) {
    hideCaptureWindows();
    await wait(220);
  }
  try {
    let sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: true
    });
    let source = sources.find((entry) => entry.id === sourceId);
    let image = source?.thumbnail;
    if (!source || !image || image.isEmpty()) {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const width = Math.max(640, Math.round(display.bounds.width * display.scaleFactor));
      const height = Math.max(480, Math.round(display.bounds.height * display.scaleFactor));
      sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width, height },
        fetchWindowIcons: true
      });
      source = sources.find((entry) => entry.id === sourceId);
      image = source?.thumbnail;
    }
    if (!source) throw new Error('That window is no longer available.');
    if (!image || image.isEmpty()) throw new Error('That window returned an empty capture.');
    return {
      dataUrl: image.toDataURL(),
      width: image.getSize().width,
      height: image.getSize().height,
      sourceName: source.name,
      displayId: source.display_id || null,
      kind: source.id.startsWith('screen:') ? 'display' : 'window'
    };
  } finally {
    if (hideApp) restoreCaptureWindows();
  }
}

async function captureDisplay(displayId, hideApp = true) {
  if (hideApp) {
    hideCaptureWindows();
    await wait(220);
  }
  try {
    return await grabDisplay(displayId);
  } finally {
    if (hideApp) restoreCaptureWindows();
  }
}

async function captureAllDisplays() {
  hideCaptureWindows();
  await wait(220);
  try {
    const displays = screen.getAllDisplays();
    const results = [];
    for (const display of displays) {
      const shot = await grabDisplay(display.id);
      results.push(shot);
    }
    return results;
  } finally {
    restoreCaptureWindows();
  }
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Unsupported image data.');
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('The image was empty.');
  if (buffer.length > 80 * 1024 * 1024) throw new Error('Image is too large (80 MB limit).');
  return { mime, ext, buffer };
}

function titleFromSource(source) {
  if (source === 'window') return 'Window capture';
  if (source === 'region' || source === 'lasso') return 'Region capture';
  if (source === 'multi') return 'All displays';
  return 'Desktop capture';
}

async function addGalleryItem(payload) {
  const { dataUrl, title, width, height, source = 'display', tags = [], favorite = false } = payload || {};
  const parsed = parseDataUrl(dataUrl);
  const id = crypto.randomUUID();
  const stamp = new Date();
  const base = `snapx-${stamp.toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${id.slice(0, 6)}`;
  const fileName = `${base}.${parsed.ext}`;
  const target = path.join(galleryDir, fileName);
  await fsp.writeFile(target, parsed.buffer);

  let thumbName = null;
  if (parsed.mime !== 'image/gif') {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (!image.isEmpty()) {
        const size = image.getSize();
        const maxWidth = 720;
        const ratio = Math.min(1, maxWidth / size.width);
        const thumb = image.resize({
          width: Math.max(1, Math.round(size.width * ratio)),
          height: Math.max(1, Math.round(size.height * ratio)),
          quality: 'good'
        });
        thumbName = `${base}-thumb.jpg`;
        await fsp.writeFile(path.join(galleryDir, thumbName), thumb.toJPEG(82));
      }
    } catch {
      thumbName = null;
    }
  }

  const item = {
    id,
    fileName,
    thumbName,
    title: String(title || titleFromSource(source)).slice(0, 120),
    createdAt: stamp.toISOString(),
    width: Number(width) || 0,
    height: Number(height) || 0,
    bytes: parsed.buffer.length,
    source,
    kind: parsed.ext === 'gif' ? 'gif' : 'image',
    mime: parsed.mime,
    tags: Array.isArray(tags) ? tags.slice(0, 12).map((tag) => String(tag).slice(0, 32)) : [],
    favorite: Boolean(favorite)
  };

  gallery.items.unshift(item);
  await writeJson(galleryFile, gallery);
  return decorateItem(item);
}

async function removeGalleryItem(id) {
  const index = gallery.items.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const [item] = gallery.items.splice(index, 1);
  for (const name of [item.fileName, item.thumbName]) {
    if (!name) continue;
    const target = path.join(galleryDir, name);
    if (path.dirname(target) === galleryDir) {
      await fsp.rm(target, { force: true }).catch(() => {});
    }
  }
  await writeJson(galleryFile, gallery);
  return true;
}

async function updateGalleryItem(id, patch) {
  const item = gallery.items.find((entry) => entry.id === id);
  if (!item) throw new Error('Capture not found.');
  if (typeof patch.title === 'string') item.title = patch.title.slice(0, 120);
  if (typeof patch.favorite === 'boolean') item.favorite = patch.favorite;
  if (Array.isArray(patch.tags)) item.tags = patch.tags.slice(0, 12).map((tag) => String(tag).slice(0, 32));
  await writeJson(galleryFile, gallery);
  return decorateItem(item);
}

async function exportGalleryItem(id) {
  const item = gallery.items.find((entry) => entry.id === id);
  if (!item) throw new Error('Capture not found.');
  const ext = path.extname(item.fileName) || '.png';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export capture',
    defaultPath: path.join(app.getPath('pictures'), `${item.title.replace(/[\\/:*?"<>|]/g, '-')}${ext}`),
    filters: [
      { name: 'Image', extensions: [ext.replace('.', '') || 'png'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePath) return null;
  await fsp.copyFile(path.join(galleryDir, item.fileName), filePath);
  return filePath;
}

function ensureTempFile(dataUrl, extension = 'png') {
  const parsed = parseDataUrl(dataUrl);
  const file = path.join(app.getPath('temp'), `snapx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${extension}`);
  fs.writeFileSync(file, parsed.buffer);
  return file;
}

async function shareDiscord({ dataUrl, message = '' }) {
  const webhook = getSecret('discordWebhook');
  if (!webhook) throw new Error('Add a Discord webhook in Settings → Integrations first.');
  const parsed = parseDataUrl(dataUrl);
  let buffer = parsed.buffer;
  let mime = parsed.mime;
  if (buffer.length > 7.5 * 1024 * 1024) {
    const image = nativeImage.createFromDataURL(dataUrl);
    const size = image.getSize();
    const ratio = Math.min(1, 1920 / size.width);
    buffer = image.resize({
      width: Math.round(size.width * ratio),
      height: Math.round(size.height * ratio),
      quality: 'best'
    }).toPNG();
    mime = 'image/png';
  }
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    content: String(message || '').slice(0, 1800),
    username: 'SnapX Pro',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
  }));
  form.append('file', new Blob([buffer], { type: mime }), `snapx-${Date.now()}.${mime.split('/')[1].replace('jpeg', 'jpg')}`);
  const response = await fetch(webhook, { method: 'POST', body: form });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Discord upload failed (${response.status}). ${text.slice(0, 180)}`);
  }
  const data = await response.json();
  return {
    url: data.attachments?.[0]?.url || null,
    message: 'Uploaded to Discord'
  };
}

async function shareImgur({ dataUrl, title = 'SnapX Pro capture' }) {
  const clientId = getSecret('imgurClientId');
  if (!clientId) throw new Error('Add your Imgur Client ID in Settings → Integrations first.');
  const parsed = parseDataUrl(dataUrl);
  let base64 = parsed.buffer.toString('base64');
  let mime = parsed.mime;
  if (parsed.buffer.length > 9 * 1024 * 1024) {
    const image = nativeImage.createFromDataURL(dataUrl);
    const size = image.getSize();
    const ratio = Math.min(1, 1920 / size.width);
    base64 = image.resize({
      width: Math.round(size.width * ratio),
      height: Math.round(size.height * ratio),
      quality: 'best'
    }).toPNG().toString('base64');
    mime = 'image/png';
  }
  const form = new FormData();
  form.append('image', base64);
  form.append('type', 'base64');
  form.append('title', String(title).slice(0, 120));
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { Authorization: `Client-ID ${clientId}` },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data?.data?.error || `Imgur upload failed (${response.status}).`);
  }
  return { url: data.data.link, message: 'Uploaded to Imgur' };
}

function normalizeAiImage(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (parsed.buffer.length <= 3.5 * 1024 * 1024) return dataUrl;
  const image = nativeImage.createFromDataURL(dataUrl);
  const size = image.getSize();
  const ratio = Math.min(1, 1600 / Math.max(size.width, size.height));
  return `data:image/jpeg;base64,${image.resize({
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
    quality: 'good'
  }).toJPEG(88).toString('base64')}`;
}

const AI_PROMPTS = {
  ocr: 'Read the supplied screenshot and transcribe every piece of visible text exactly, preserving reading order and line breaks. Return only the transcribed text. Do not wrap it in markdown fences.',
  summary: 'Analyze this screenshot. Return strict JSON with keys: title (short), summary (2-3 sentences), bullets (array of 3-5 short strings), tags (array of 3-6 short lowercase tags). Do not include markdown fences.',
  code: 'Extract the code visible in this screenshot. Return strict JSON with keys: language, code, explanation. Preserve the code exactly. Do not include markdown fences around the JSON.',
  blur: 'Find sensitive information in this screenshot such as email addresses, passwords, API keys, phone numbers, payment details, and personal names. Return strict JSON with a single key "regions" whose value is an array of objects with normalized coordinates x,y,w,h in the range 0-1, a label, and confidence 0-1. Only include regions that are actually sensitive. Do not include markdown fences.',
  remove: 'Describe how to remove the main object from this screenshot and what background should fill its place. Return strict JSON with keys: object, description, fill. Do not include markdown fences.',
  describe: 'Describe this screenshot in detail, focusing on UI elements, colors, and any actionable content.'
};

async function runAiAnalysis({ action, imageDataUrl, prompt, model }) {
  const apiKey = getSecret('openaiKey');
  if (!apiKey) {
    return { ok: false, error: 'no-key', message: 'Connect an OpenAI API key to run live AI analysis.' };
  }
  if (!action || !AI_PROMPTS[action]) {
    return { ok: false, error: 'bad-action', message: 'Unknown AI action.' };
  }
  const normalized = normalizeAiImage(imageDataUrl);
  const chosenModel = String(model || settings.ai?.model || 'gpt-4o-mini');
  const instruction = prompt ? `${AI_PROMPTS[action]}\n\nUser instruction: ${prompt}` : AI_PROMPTS[action];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: normalized, detail: 'high' } }
            ]
          }
        ],
        max_tokens: 1800,
        temperature: 0.2
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: 'api-error',
        message: data?.error?.message || `OpenAI request failed (${response.status}).`
      };
    }
    const text = data?.choices?.[0]?.message?.content || '';
    let parsed = null;
    if (['summary', 'code', 'blur', 'remove'].includes(action)) {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = null;
      }
    }
    return { ok: true, text, parsed, model: chosenModel };
  } catch (error) {
    return {
      ok: false,
      error: 'network',
      message: error.name === 'AbortError' ? 'The AI request timed out.' : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function saveRecording({ dataUrl, extension = 'webm', title = 'SnapX recording' }) {
  const match = /^data:(video\/webm|image\/gif|image\/png)(?:;[^;]*)*;base64,([\s\S]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Unsupported recording data.');
  const ext = String(extension || (match[1] === 'image/gif' ? 'gif' : 'webm')).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (ext === 'gif') {
    const item = await addGalleryItem({
      dataUrl: `data:image/gif;base64,${match[2]}`,
      title,
      width: 0,
      height: 0,
      source: 'gif',
      tags: ['recording', 'gif']
    });
    return { filePath: path.join(galleryDir, item.fileName), item, kind: 'gif' };
  }
  const fileName = `snapx-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.${ext || 'webm'}`;
  const filePath = path.join(recordingsDir, fileName);
  await fsp.writeFile(filePath, buffer);
  if (Notification.isSupported() && settings.behavior?.notify) {
    const notification = new Notification({
      title: 'Recording saved',
      body: `SnapX Pro saved ${fileName} to Videos.`
    });
    notification.on('click', () => shell.showItemInFolder(filePath));
    notification.show();
  }
  return { filePath, kind: 'video' };
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const shortcuts = settings.shortcuts || {};
  const actions = {
    region: () => triggerShortcutCapture('region'),
    full: () => triggerShortcutCapture('full'),
    window: () => triggerShortcutCapture('window'),
    toolbar: () => toggleFloatingToolbar()
  };
  for (const [name, accelerator] of Object.entries(shortcuts)) {
    if (!accelerator || !actions[name]) continue;
    try {
      globalShortcut.register(accelerator, actions[name]);
    } catch {
      /* invalid or reserved accelerator */
    }
  }
}

function triggerShortcutCapture(mode) {
  showMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shortcut:capture', mode);
  }
}

function createToolbarWindow(showWhenReady = false) {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    if (showWhenReady) {
      toolbarWindow.show();
      toolbarWindow.focus();
    }
    return;
  }
  const primary = screen.getPrimaryDisplay();
  const width = 486;
  const height = 82;
  toolbarWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(primary.bounds.x + (primary.bounds.width - width) / 2),
    y: Math.round(primary.bounds.y + primary.bounds.height - height - 54),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'SnapX Toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'toolbar-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  toolbarWindow.setAlwaysOnTop(true, 'floating');
  toolbarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toolbarWindow.loadFile(path.join(__dirname, 'toolbar.html'));
  toolbarWindow.once('ready-to-show', () => {
    if (showWhenReady) toolbarWindow.showInactive();
  });
  toolbarWindow.on('closed', () => {
    toolbarWindow = null;
    if (settings.floatingToolbar) {
      settings.floatingToolbar = false;
      writeJson(settingsFile, settings).catch(() => {});
    }
  });
}

function toggleFloatingToolbar(force) {
  const shouldShow = typeof force === 'boolean' ? force : !(toolbarWindow && toolbarWindow.isVisible());
  settings.floatingToolbar = shouldShow;
  writeJson(settingsFile, settings).catch(() => {});
  if (shouldShow) {
    if (!toolbarWindow || toolbarWindow.isDestroyed()) createToolbarWindow(true);
    else {
      toolbarWindow.showInactive();
      toolbarWindow.setAlwaysOnTop(true, 'floating');
    }
  } else if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', publicSettings());
  }
  return shouldShow;
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'assets', 'app-icon.png');
  if (!fs.existsSync(iconPath)) return;
  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
    tray = new Tray(icon);
    tray.setToolTip('SnapX Pro — Capture everything. Miss nothing.');
    const menu = Menu.buildFromTemplate([
      { label: 'Open SnapX Pro', click: showMainWindow },
      { type: 'separator' },
      { label: 'Region capture', accelerator: settings.shortcuts?.region, click: () => triggerShortcutCapture('region') },
      { label: 'Full display', accelerator: settings.shortcuts?.full, click: () => triggerShortcutCapture('full') },
      { label: 'Window capture', accelerator: settings.shortcuts?.window, click: () => triggerShortcutCapture('window') },
      { type: 'separator' },
      {
        label: 'Floating capture toolbar',
        type: 'checkbox',
        checked: Boolean(settings.floatingToolbar),
        click: () => toggleFloatingToolbar()
      },
      { type: 'separator' },
      { label: 'Quit SnapX Pro', click: () => { quitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click', showMainWindow);
    tray.on('click', () => {
      if (isWin) showMainWindow();
    });
  } catch {
    tray = null;
  }
}

function setupApplicationMenu() {
  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'SnapX Pro',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Command+,', click: () => { showMainWindow(); mainWindow.webContents.send('navigate', 'settings'); } },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'Capture',
      submenu: [
        { label: 'Region capture', accelerator: 'Command+Shift+1', click: () => triggerShortcutCapture('region') },
        { label: 'Full display', accelerator: 'Command+Shift+2', click: () => triggerShortcutCapture('full') },
        { label: 'Window capture', accelerator: 'Command+Shift+3', click: () => triggerShortcutCapture('window') }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]));
}

function setupProtocol() {
  protocol.handle('snapx', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host === 'capture') {
        const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
        const target = path.resolve(galleryDir, name);
        if (path.dirname(target) !== path.resolve(galleryDir)) {
          return new Response('Forbidden', { status: 403 });
        }
        const data = await fsp.readFile(target);
        const ext = path.extname(target).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
              : ext === '.mp4' ? 'video/mp4'
                : 'image/jpeg';
        return new Response(new Uint8Array(data), {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'private, max-age=3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      if (url.host === 'sample') {
        const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
        const base = path.join(__dirname, '..', 'src', 'assets', 'samples');
        const target = path.resolve(base, name);
        if (!target.startsWith(path.resolve(base))) return new Response('Forbidden', { status: 403 });
        const data = await fsp.readFile(target);
        return new Response(new Uint8Array(data), {
          headers: {
            'Content-Type': target.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return new Response('Not found', { status: 404 });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function setupIpc() {
  ipcMain.handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    paths: {
      pictures: app.getPath('pictures'),
      videos: app.getPath('videos'),
      gallery: galleryDir,
      recordings: recordingsDir,
      userData: app.getPath('userData')
    }
  }));

  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()));

  ipcMain.handle('display:list', () => displayList());

  ipcMain.handle('capture:sources', async (_event, types) => {
    const requested = Array.isArray(types) && types.length ? types : ['screen', 'window'];
    return listCaptureSources(requested);
  });
  ipcMain.handle('capture:preview', async () => {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1200, height: 760 },
      fetchWindowIcons: false
    });
    const source = sources.find((entry) => String(entry.display_id) === String(display.id)) || sources[0];
    if (!source) return null;
    return {
      dataUrl: source.thumbnail.toDataURL(),
      width: source.thumbnail.getSize().width,
      height: source.thumbnail.getSize().height,
      displayId: display.id
    };
  });
  ipcMain.handle('capture:region', async (_event, mode) => captureRegion(mode === 'lasso' ? 'lasso' : 'rect'));
  ipcMain.handle('capture:full', async (_event, displayId) => captureDisplay(displayId, true));
  ipcMain.handle('capture:all', async () => captureAllDisplays());
  ipcMain.handle('capture:source', async (_event, sourceId, options = {}) => captureSource(sourceId, Boolean(options.hideApp)));

  ipcMain.handle('gallery:list', () => gallery.items.map(decorateItem));
  ipcMain.handle('gallery:add', async (_event, payload) => addGalleryItem(payload));
  ipcMain.handle('gallery:remove', async (_event, id) => removeGalleryItem(id));
  ipcMain.handle('gallery:update', async (_event, id, patch) => updateGalleryItem(id, patch));
  ipcMain.handle('gallery:export', async (_event, id) => exportGalleryItem(id));
  ipcMain.handle('gallery:reveal', async (_event, id) => {
    const item = gallery.items.find((entry) => entry.id === id);
    if (!item) return false;
    shell.showItemInFolder(path.join(galleryDir, item.fileName));
    return true;
  });
  ipcMain.handle('gallery:clear', async () => {
    const count = gallery.items.length;
    for (const item of gallery.items) {
      for (const name of [item.fileName, item.thumbName]) {
        if (name) await fsp.rm(path.join(galleryDir, name), { force: true }).catch(() => {});
      }
    }
    gallery = { items: [] };
    await writeJson(galleryFile, gallery);
    return count;
  });
  ipcMain.handle('gallery:stats', async () => {
    let bytes = 0;
    try {
      const files = await fsp.readdir(galleryDir);
      for (const file of files) {
        const stat = await fsp.stat(path.join(galleryDir, file)).catch(() => null);
        if (stat?.isFile()) bytes += stat.size;
      }
    } catch {
      /* ignore */
    }
    return { count: gallery.items.length, bytes, path: galleryDir };
  });

  ipcMain.handle('clipboard:image', async (_event, dataUrl) => {
    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) throw new Error('Could not read that image.');
    clipboard.writeImage(image);
    return true;
  });
  ipcMain.handle('clipboard:text', async (_event, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.handle('settings:update', async (_event, patch) => {
    settings = deepMerge(settings, patch);
    await writeJson(settingsFile, settings);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'behavior')) {
      try {
        app.setLoginItemSettings({
          openAtLogin: Boolean(settings.behavior.launchAtLogin),
          openAsHidden: true,
          args: ['--hidden']
        });
      } catch {
        /* ignore */
      }
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'shortcuts')) registerShortcuts();
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'floatingToolbar')) {
      toggleFloatingToolbar(Boolean(settings.floatingToolbar));
    }
    return publicSettings();
  });
  ipcMain.handle('settings:secret-status', () => ({
    openaiKey: Boolean(getSecret('openaiKey')),
    discordWebhook: Boolean(getSecret('discordWebhook')),
    imgurClientId: Boolean(getSecret('imgurClientId'))
  }));
  ipcMain.handle('settings:set-secret', async (_event, name, value) => {
    await setSecret(name, value);
    return true;
  });

  ipcMain.handle('share:discord', (_event, payload) => shareDiscord(payload));
  ipcMain.handle('share:imgur', (_event, payload) => shareImgur(payload));

  ipcMain.handle('ai:analyze', (_event, payload) => runAiAnalysis(payload || {}));

  ipcMain.handle('recording:set-source', (_event, displayId) => {
    recordingDisplayId = displayId;
    return true;
  });
  ipcMain.handle('recording:save', (_event, payload) => saveRecording(payload));

  ipcMain.handle('dialog:open-image', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open an image in SnapX Pro',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'] }]
    });
    if (canceled || !filePaths[0]) return null;
    const data = await fsp.readFile(filePaths[0]);
    const ext = path.extname(filePaths[0]).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
          : ext === 'avif' ? 'image/avif'
            : ext === 'bmp' ? 'image/bmp'
              : 'image/jpeg';
    return {
      name: path.basename(filePaths[0]),
      path: filePaths[0],
      dataUrl: `data:${mime};base64,${data.toString('base64')}`
    };
  });

  ipcMain.handle('shell:open-external', (_event, url) => {
    if (/^https?:\/\//i.test(String(url))) return shell.openExternal(url);
    return false;
  });
  ipcMain.handle('shell:show-item', (_event, target) => {
    if (!target) return false;
    shell.showItemInFolder(String(target));
    return true;
  });
  ipcMain.handle('shell:open-path', (_event, target) => {
    if (!target) return false;
    return shell.openPath(String(target));
  });

  ipcMain.handle('toolbar:set-visible', (_event, visible) => toggleFloatingToolbar(Boolean(visible)));
  ipcMain.handle('screen:permission', () => {
    if (!isMac) return 'granted';
    return systemPreferences.getMediaAccessStatus('screen');
  });
  ipcMain.handle('screen:open-permission', async () => {
    if (isMac) {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return true;
    }
    return false;
  });

  ipcMain.handle('notification:show', (_event, { title, body }) => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: String(title || 'SnapX Pro'), body: String(body || '') }).show();
    return true;
  });

  ipcMain.on('overlay:selection', (_event, payload) => {
    finishOverlay(payload && payload.dataUrl ? payload : null);
  });
  ipcMain.on('overlay:cancel', () => finishOverlay(null));

  ipcMain.on('toolbar:action', (_event, action) => {
    if (action === 'close') {
      toggleFloatingToolbar(false);
      return;
    }
    if (action === 'open') {
      showMainWindow();
      if (mainWindow) mainWindow.webContents.send('navigate', 'dashboard');
      return;
    }
    if (['region', 'full', 'window', 'record', 'gif'].includes(action)) {
      showMainWindow();
      if (mainWindow) mainWindow.webContents.send('toolbar:action', action);
    }
  });
}

function setupMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false
      });
      let source = null;
      if (recordingDisplayId) {
        source = sources.find((entry) => String(entry.display_id) === String(recordingDisplayId))
          || sources.find((entry) => entry.id === recordingDisplayId);
      }
      source = source || sources[0];
      if (!source) {
        callback({});
        return;
      }
      callback({ video: source });
    } catch {
      callback({});
    }
  }, { useSystemPicker: false });
}

app.on('second-instance', () => {
  showMainWindow();
});

app.whenReady().then(async () => {
  ensureDirectories();
  loadState();
  setupProtocol();
  setupIpc();
  setupMediaHandler();
  setupApplicationMenu();
  createMainWindow();
  createTray();
  registerShortcuts();

  if (process.argv.includes('--hidden') && settings.behavior?.minimizeToTray) {
    mainWindow.once('ready-to-show', () => mainWindow.hide());
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else showMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac && !settings.behavior?.closeToTray) {
    quitting = true;
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

process.on('uncaughtException', (error) => {
  console.error('[SnapX] Uncaught exception:', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[SnapX] Unhandled rejection:', error);
});
