'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function on(channel, callback) {
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('snapx', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    showItemInFolder: (target) => ipcRenderer.invoke('shell:show-item', target),
    openPath: (target) => ipcRenderer.invoke('shell:open-path', target),
    notify: (payload) => ipcRenderer.invoke('notification:show', payload),
    screenPermission: () => ipcRenderer.invoke('screen:permission'),
    openScreenPermission: () => ipcRenderer.invoke('screen:open-permission')
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: (callback) => on('window:maximized', callback)
  },
  capture: {
    displays: () => ipcRenderer.invoke('display:list'),
    sources: (types) => ipcRenderer.invoke('capture:sources', types),
    preview: () => ipcRenderer.invoke('capture:preview'),
    region: (mode) => ipcRenderer.invoke('capture:region', mode),
    full: (displayId) => ipcRenderer.invoke('capture:full', displayId),
    all: () => ipcRenderer.invoke('capture:all'),
    source: (sourceId, options) => ipcRenderer.invoke('capture:source', sourceId, options)
  },
  gallery: {
    list: () => ipcRenderer.invoke('gallery:list'),
    add: (payload) => ipcRenderer.invoke('gallery:add', payload),
    remove: (id) => ipcRenderer.invoke('gallery:remove', id),
    update: (id, patch) => ipcRenderer.invoke('gallery:update', id, patch),
    export: (id) => ipcRenderer.invoke('gallery:export', id),
    reveal: (id) => ipcRenderer.invoke('gallery:reveal', id),
    clear: () => ipcRenderer.invoke('gallery:clear'),
    stats: () => ipcRenderer.invoke('gallery:stats')
  },
  clipboard: {
    image: (dataUrl) => ipcRenderer.invoke('clipboard:image', dataUrl),
    text: (text) => ipcRenderer.invoke('clipboard:text', text)
  },
  share: {
    discord: (payload) => ipcRenderer.invoke('share:discord', payload),
    imgur: (payload) => ipcRenderer.invoke('share:imgur', payload)
  },
  ai: {
    analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload)
  },
  recordings: {
    setSource: (displayId) => ipcRenderer.invoke('recording:set-source', displayId),
    save: (payload) => ipcRenderer.invoke('recording:save', payload)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    setSecret: (name, value) => ipcRenderer.invoke('settings:set-secret', name, value),
    secretStatus: () => ipcRenderer.invoke('settings:secret-status')
  },
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:open-image')
  },
  toolbar: {
    setVisible: (visible) => ipcRenderer.invoke('toolbar:set-visible', visible)
  },
  events: {
    onShortcutCapture: (callback) => on('shortcut:capture', callback),
    onToolbarAction: (callback) => on('toolbar:action', callback),
    onNavigate: (callback) => on('navigate', callback),
    onSettingsChanged: (callback) => on('settings:changed', callback)
  }
});
