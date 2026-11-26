'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snapxToolbar', {
  action: (name) => ipcRenderer.send('toolbar:action', name),
  platform: process.platform
});
