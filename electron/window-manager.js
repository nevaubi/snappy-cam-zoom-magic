const { BrowserWindow, screen } = require('electron');
const path = require('path');

function createWindow(options = {}) {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Default window options
  const defaultOptions = {
    width: Math.min(1200, width * 0.8),
    height: Math.min(800, height * 0.8),
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready-to-show
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  };

  // Merge with provided options
  const windowOptions = { ...defaultOptions, ...options };

  // Create the browser window
  const window = new BrowserWindow(windowOptions);

  // Show window when ready to prevent visual flash
  window.once('ready-to-show', () => {
    window.show();
    
    // Focus on window creation
    if (windowOptions.focus !== false) {
      window.focus();
    }
  });

  // Remember window state
  window.on('resize', () => {
    // Save window bounds for restoration
    const bounds = window.getBounds();
    // TODO: Implement persistent storage of window state
  });

  window.on('move', () => {
    // Save window position for restoration
    const bounds = window.getBounds();
    // TODO: Implement persistent storage of window state
  });

  // Handle window focus
  window.on('focus', () => {
    // Handle window focus events if needed
  });

  window.on('blur', () => {
    // Handle window blur events if needed
  });

  return window;
}

function centerWindow(window) {
  const bounds = window.getBounds();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  const x = Math.round((width - bounds.width) / 2);
  const y = Math.round((height - bounds.height) / 2);
  
  window.setPosition(x, y);
}

function getWindowState(window) {
  const bounds = window.getBounds();
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized(),
    isMinimized: window.isMinimized(),
    isFullScreen: window.isFullScreen()
  };
}

function restoreWindowState(window, state) {
  if (state.isMaximized) {
    window.maximize();
  } else if (state.isMinimized) {
    window.minimize();
  } else if (state.isFullScreen) {
    window.setFullScreen(true);
  } else {
    window.setBounds({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    });
  }
}

module.exports = {
  createWindow,
  centerWindow,
  getWindowState,
  restoreWindowState
};