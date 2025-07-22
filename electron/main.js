const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { createWindow } = require('./window-manager');
const { createMenu } = require('./menu');

// Keep a global reference of the window object
let mainWindow;

function createMainWindow() {
  // Create the browser window
  mainWindow = createWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Set up application menu
  createMenu(mainWindow);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createMainWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// IPC handlers for future C# bridge integration
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

// Future recording bridge IPC handlers will be added here
ipcMain.handle('recording:start', async (event, config) => {
  // Will integrate with C# bridge in future phases
  console.log('Recording start requested:', config);
  return { success: false, error: 'Recording bridge not yet implemented' };
});

ipcMain.handle('recording:stop', async (event) => {
  // Will integrate with C# bridge in future phases  
  console.log('Recording stop requested');
  return { success: false, error: 'Recording bridge not yet implemented' };
});
