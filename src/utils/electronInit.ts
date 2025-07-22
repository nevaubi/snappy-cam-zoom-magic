import { logEnvironmentInfo, isElectron } from './environment';

/**
 * Initialize Electron-specific features and environment detection
 * This should be called once when the app starts
 */
export const initializeElectron = async () => {
  if (isElectron()) {
    // Log environment info in development
    await logEnvironmentInfo();
    
    // Set up any global Electron-specific initialization
    console.log('🖥️  Running in Electron desktop mode');
    
    // Set up menu listeners if needed
    if (window.electronAPI) {
      // Future: Set up IPC event listeners for menu actions
      console.log('✅ Electron API available');
    }
  } else {
    console.log('🌐 Running in web browser mode');
  }
};

/**
 * Check if all Electron features are properly initialized
 */
export const isElectronReady = (): boolean => {
  if (!isElectron()) return true; // Web mode is always ready
  
  return !!(
    window.electronAPI &&
    window.electronAPI.isElectron &&
    window.electronAPI.recording &&
    window.electronAPI.files
  );
};