'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snapxOverlay', {
  onInit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.once('overlay:init', listener);
  },
  confirm: (payload) => ipcRenderer.send('overlay:selection', payload),
  cancel: () => ipcRenderer.send('overlay:cancel')
});
