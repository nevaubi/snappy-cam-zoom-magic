const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  
  // Environment detection
  isElectron: true,
  
  // Recording bridge (for future phases)
  recording: {
    start: (config) => ipcRenderer.invoke('recording:start', config),
    stop: () => ipcRenderer.invoke('recording:stop'),
    onProgress: (callback) => {
      ipcRenderer.on('recording:progress', (event, data) => callback(data));
    },
    onComplete: (callback) => {
      ipcRenderer.on('recording:complete', (event, data) => callback(data));
    },
    onError: (callback) => {
      ipcRenderer.on('recording:error', (event, error) => callback(error));
    }
  },

  // File system operations (for future phases)
  files: {
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  }
});

// Development helper
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('electronDev', {
    openDevTools: () => ipcRenderer.send('dev:openDevTools')
  });
}