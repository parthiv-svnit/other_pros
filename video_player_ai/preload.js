const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File handling
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  onFilesSelected: (callback) => ipcRenderer.on('files-selected', (event, ...args) => callback(...args)),
  
  // Media processing
  analyzeFile: (filePath) => ipcRenderer.invoke('analyze-file', filePath),
  extractStream: (options) => ipcRenderer.invoke('extract-stream', options),
  onProcessingUpdate: (callback) => ipcRenderer.on('processing-update', (event, ...args) => callback(...args)),

  // Custom subtitle file
  openSubtitleDialog: () => ipcRenderer.invoke('open-subtitle-dialog'),

  // Fullscreen handling
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  onFullscreenChanged: (callback) => ipcRenderer.on('fullscreen-changed', (event, ...args) => callback(...args)),
});
